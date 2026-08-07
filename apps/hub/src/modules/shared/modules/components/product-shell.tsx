'use client';

import { useEffect, useRef, type JSX } from 'react';

import { useProducts } from '../hooks/use-products';
import { ModuleToHubSchema } from '../lib/post-message-protocol';
import { resolveProductUrl } from '../lib/resolve-url';

import { ProductNotAvailable } from './product-not-available';

import {
  getAccessToken,
  subscribeToToken,
} from '@/modules/iam/identity/session/token';


interface ProductShellProps {
  productId: string;
}

export function ProductShell({ productId }: ProductShellProps): JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { products, isLoading } = useProducts();

  const product = products.find((p) => p.id === productId);
  const productUrl =
    product?.defaultUrl !== undefined ? resolveProductUrl(productId, product.defaultUrl) : null;

  // Send token to the iframe
  function sendToken(token: string | null): void {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow === null || iframe?.contentWindow === undefined) return;
    if (productUrl === null) return;

    const targetOrigin = new URL(productUrl).origin;

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

  // Listen for messages from the product iframe
  useEffect(() => {
    if (productUrl === null) return;

    const targetOrigin = new URL(productUrl).origin;

    function handleMessage(event: MessageEvent): void {
      if (event.origin !== targetOrigin) return;

      const parsed = ModuleToHubSchema.safeParse(event.data);
      if (!parsed.success) return;

      const message = parsed.data;

      if (
        message.type === 'corehub.module.v1.ready' ||
        message.type === 'corehub.module.v1.requestToken'
      ) {
        const currentToken = getAccessToken();
        sendToken(currentToken?.raw ?? null);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [productUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Forward token changes to the iframe. Subscribing unconditionally (not
  // gated on the ready handshake) covers the case where the hub's session
  // refresh resolves after the iframe mounted: the new token is pushed as
  // soon as it lands.
  useEffect(() => {
    const unsubscribe = subscribeToToken((token) => {
      sendToken(token);
    });

    return unsubscribe;
  }, [productUrl]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (product === undefined || productUrl === null) {
    return <ProductNotAvailable productId={productId} />;
  }

  return (
    <iframe
      ref={iframeRef}
      src={productUrl}
      onLoad={handleIframeLoad}
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
      title={productId}
    />
  );
}
