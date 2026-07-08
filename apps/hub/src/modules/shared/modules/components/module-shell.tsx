'use client';

import { useEffect, useRef, useState, type JSX } from 'react';

import {
  getAccessToken,
  subscribeToToken,
} from '@/modules/iam/identity/session/token';

import { ModuleNotAvailable } from './module-not-available';
import { ModuleToHubSchema } from '../lib/post-message-protocol';
import { resolveModuleUrl } from '../lib/resolve-url';
import { useModules } from '../hooks/use-modules';

interface ModuleShellProps {
  moduleId: string;
}

export function ModuleShell({ moduleId }: ModuleShellProps): JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const { modules, isLoading } = useModules();

  const module = modules.find((m) => m.id === moduleId);
  const moduleUrl = module !== undefined ? resolveModuleUrl(moduleId, module.defaultUrl) : null;

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

  // Subscribe to token changes and forward them to the iframe when ready
  useEffect(() => {
    if (!isReady) return;

    const unsubscribe = subscribeToToken((token) => {
      sendToken(token);
    });

    return unsubscribe;
  }, [isReady, moduleUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (module === undefined || moduleUrl === null) {
    return <ModuleNotAvailable moduleId={moduleId} />;
  }

  return (
    <iframe
      ref={iframeRef}
      src={moduleUrl}
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      title={moduleId}
    />
  );
}
