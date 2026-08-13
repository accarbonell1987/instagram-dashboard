'use client';

import { useEffect, useRef, useState, type JSX } from 'react';

import { ModuleToHubSchema } from '../lib/post-message-protocol';

import { getAccessToken, subscribeToToken } from '@/modules/iam/identity/session/token';

// ─── Constants ─────────────────────────────────────────────────────────────────

/**
 * Bounds on a content-sized frame. The height arrives from the embedded page,
 * which the hub does not control: a module with a runaway layout must not be
 * able to grow the page without limit, and one that reports nothing useful
 * should still show something.
 */
const MIN_CONTENT_HEIGHT = 160;
const MAX_CONTENT_HEIGHT = 4000;

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface ModuleFrameProps {
  /** Absolute URL of the page to embed. */
  src: string;
  title: string;
  /**
   * `fill` takes the height of its container — a product opened as a whole
   * screen. `content` grows to whatever the page reports, for a panel sitting
   * inside the hub's own layout.
   */
  sizing?: 'fill' | 'content';
  className?: string | undefined;
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * An embedded module page, with the hub's side of the token handshake.
 *
 * The hub is the token authority: it pushes the JWT in, listens for the
 * module's `ready`/`requestToken`, and re-pushes on every token change. Every
 * message is checked against the frame's own origin in both directions.
 */
export function ModuleFrame({
  src,
  title,
  sizing = 'fill',
  className,
}: ModuleFrameProps): JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [contentHeight, setContentHeight] = useState(MIN_CONTENT_HEIGHT);

  const targetOrigin = new URL(src).origin;

  function sendToken(token: string | null): void {
    const frame = iframeRef.current;
    if (frame?.contentWindow === null || frame?.contentWindow === undefined) return;

    frame.contentWindow.postMessage(
      token !== null
        ? { type: 'corehub.hub.v1.token', token }
        : { type: 'corehub.hub.v1.signOut' },
      targetOrigin,
    );
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent): void {
      if (event.origin !== targetOrigin) return;

      const parsed = ModuleToHubSchema.safeParse(event.data);
      if (!parsed.success) return;
      const message = parsed.data;

      if (
        message.type === 'corehub.module.v1.ready' ||
        message.type === 'corehub.module.v1.requestToken'
      ) {
        sendToken(getAccessToken()?.raw ?? null);
      }

      // Recorded whatever the sizing: only a content-sized frame applies it,
      // and gating here as well would be a second guard on the same decision —
      // two conditions that can only ever disagree by accident.
      if (message.type === 'corehub.module.v1.resize') {
        setContentHeight(
          Math.min(MAX_CONTENT_HEIGHT, Math.max(MIN_CONTENT_HEIGHT, Math.ceil(message.height))),
        );
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [targetOrigin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribing unconditionally, rather than waiting for the handshake, covers
  // a session refresh that resolves after the frame mounted.
  useEffect(() => {
    return subscribeToToken((token) => {
      sendToken(token);
    });
  }, [targetOrigin]); // eslint-disable-line react-hooks/exhaustive-deps

  // The `ready` message can be lost if the module posts it before this
  // component registers its listener; onLoad fires after the module's own
  // listener is in place, so this is the reliable delivery path.
  function handleLoad(): void {
    sendToken(getAccessToken()?.raw ?? null);
  }

  return (
    <iframe
      ref={iframeRef}
      src={src}
      onLoad={handleLoad}
      className={className ?? (sizing === 'fill' ? 'h-full w-full border-0' : 'w-full border-0')}
      {...(sizing === 'content' ? { style: { height: `${String(contentHeight)}px` } } : {})}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
      title={title}
    />
  );
}
