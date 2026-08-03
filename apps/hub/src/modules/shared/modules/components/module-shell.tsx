'use client';

import { useEffect, useRef, useState, type JSX } from 'react';

import { useModules } from '../hooks/use-modules';
import { ModuleToHubSchema } from '../lib/post-message-protocol';
import { resolveModuleUrl } from '../lib/resolve-url';

import { ModuleNotAvailable } from './module-not-available';

import {
  getAccessToken,
  subscribeToToken,
} from '@/modules/iam/identity/session/token';


interface ModuleShellProps {
  moduleId: string;
}

export function ModuleShell({ moduleId }: ModuleShellProps): JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const { modules, isLoading } = useModules();

  const moduleItem = modules.find((m) => m.id === moduleId);
  const moduleUrl = moduleItem !== undefined ? resolveModuleUrl(moduleId, moduleItem.defaultUrl) : null;

  // Send token to the iframe
  function sendToken(token: string | null): void {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow === null || iframe?.contentWindow === undefined) return;
    if (moduleUrl === null) return;

    const targetOrigin = new URL(moduleUrl).origin;

    if (token !== null) {
      iframe.contentWindow.postMessage(
        { type: 'corehub.hub.v1.token', token },
        targetOrigin
      );
    } else {
      iframe.contentWindow.postMessage(
        { type: 'corehub.hub.v1.signOut' },
        targetOrigin
      );
    }
  }

  // Listen for messages from the module iframe
  useEffect(() => {
    if (moduleUrl === null) return;

    const targetOrigin = new URL(moduleUrl).origin;

    function handleMessage(event: MessageEvent): void {
      if (event.origin !== targetOrigin) return;

      const parsed = ModuleToHubSchema.safeParse(event.data);
      if (!parsed.success) return;

      const message = parsed.data;

      if (
        message.type === 'corehub.module.v1.ready' ||
        message.type === 'corehub.module.v1.requestToken'
      ) {
        setIsReady(true);
        const currentToken = getAccessToken();
        sendToken(currentToken?.raw ?? null);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [moduleUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Forward token changes to the iframe. Subscribing unconditionally (not
  // gated on isReady) covers the case where the hub's session refresh resolves
  // after the iframe mounted: the new token is pushed as soon as it lands.
  useEffect(() => {
    const unsubscribe = subscribeToToken((token) => {
      sendToken(token);
    });

    return unsubscribe;
  }, [moduleUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push the current token once the iframe finishes loading. The `ready`/
  // `requestToken` handshake can be lost if the iframe posts it before this
  // component registers its message listener; onLoad fires after the iframe's
  // own listener is in place, so this is the reliable delivery path.
  function handleIframeLoad(): void {
    sendToken(getAccessToken()?.raw ?? null);
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (moduleItem === undefined || moduleUrl === null) {
    return <ModuleNotAvailable moduleId={moduleId} />;
  }

  return (
    <iframe
      ref={iframeRef}
      src={moduleUrl}
      onLoad={handleIframeLoad}
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
      title={moduleId}
    />
  );
}
