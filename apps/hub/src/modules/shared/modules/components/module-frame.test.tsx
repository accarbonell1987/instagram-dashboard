import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ModuleFrame } from './module-frame';

import { setAccessToken, clearAccessToken } from '@/modules/iam/identity/session/token';

const SRC = 'http://localhost:3004/admin/linked-accounts';
const ORIGIN = 'http://localhost:3004';

/** Stands in for the iframe's contentWindow, which jsdom never navigates. */
function stubContentWindow(): { postMessage: ReturnType<typeof vi.fn> } {
  const contentWindow = { postMessage: vi.fn() };
  const iframe = document.querySelector('iframe');
  if (iframe !== null) {
    Object.defineProperty(iframe, 'contentWindow', { value: contentWindow, configurable: true });
  }
  return contentWindow;
}

function postFromModule(data: unknown, origin = ORIGIN): void {
  // act(): a resize message drives a state update, and React should flush it
  // before the assertion rather than after the test has moved on.
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin }));
  });
}

describe('ModuleFrame', () => {
  beforeEach(() => {
    setAccessToken({ raw: 'jwt-abc' } as Parameters<typeof setAccessToken>[0]);
  });

  afterEach(() => {
    clearAccessToken();
  });

  it('embeds the given page', () => {
    render(<ModuleFrame src={SRC} title="Cuentas" />);
    const iframe = screen.getByTitle('Cuentas');
    expect(iframe).toHaveAttribute('src', SRC);
  });

  /**
   * The module cannot read the hub's memory-held token, so the handshake is the
   * only way it ever gets one.
   */
  it('answers a ready message with the current token', async () => {
    render(<ModuleFrame src={SRC} title="Cuentas" />);
    const contentWindow = stubContentWindow();

    postFromModule({ type: 'corehub.module.v1.ready' });

    await waitFor(() => {
      expect(contentWindow.postMessage).toHaveBeenCalledWith(
        { type: 'corehub.hub.v1.token', token: 'jwt-abc' },
        ORIGIN,
      );
    });
  });

  // A page on any other origin is not the module this frame loaded.
  it('ignores a message from another origin', async () => {
    render(<ModuleFrame src={SRC} title="Cuentas" />);
    const contentWindow = stubContentWindow();

    postFromModule({ type: 'corehub.module.v1.ready' }, 'http://evil.example');

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(contentWindow.postMessage).not.toHaveBeenCalled();
  });

  it('grows to the height the module reports', async () => {
    render(<ModuleFrame src={SRC} title="Cuentas" sizing="content" />);
    stubContentWindow();

    postFromModule({ type: 'corehub.module.v1.resize', height: 720 });

    await waitFor(() => {
      expect(screen.getByTitle('Cuentas')).toHaveStyle({ height: '720px' });
    });
  });

  /**
   * The height comes from a page the hub does not control. Without a ceiling a
   * runaway layout inside the module grows the hub's own page without limit.
   */
  it('caps a runaway height', async () => {
    render(<ModuleFrame src={SRC} title="Cuentas" sizing="content" />);
    stubContentWindow();

    postFromModule({ type: 'corehub.module.v1.resize', height: 999_999 });

    await waitFor(() => {
      expect(screen.getByTitle('Cuentas')).toHaveStyle({ height: '4000px' });
    });
  });

  // A full-screen product is sized by its container; the message is noise there.
  it('ignores resize when it fills its container', async () => {
    render(<ModuleFrame src={SRC} title="Cuentas" sizing="fill" />);
    stubContentWindow();

    postFromModule({ type: 'corehub.module.v1.resize', height: 720 });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.getByTitle('Cuentas')).not.toHaveStyle({ height: '720px' });
  });

  it('keeps the module sandboxed', () => {
    render(<ModuleFrame src={SRC} title="Cuentas" />);
    expect(screen.getByTitle('Cuentas')).toHaveAttribute('sandbox');
  });
});
