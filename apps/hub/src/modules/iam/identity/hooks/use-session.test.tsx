import { render, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { setSessionState } from '../session/store';

import { useSession } from './use-session';

afterEach(() => {
  act(() => {
    setSessionState({ status: 'unauthenticated', session: null });
  });
});

function SessionDisplay() {
  const sessionState = useSession();
  return <div data-testid="status">{sessionState.status}</div>;
}

describe('useSession', () => {
  it('renders current state (unauthenticated by default)', () => {
    render(<SessionDisplay />);
    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
  });

  it('re-renders when setSessionState is called', () => {
    render(<SessionDisplay />);

    act(() => {
      setSessionState({ status: 'refreshing', session: null });
    });

    expect(screen.getByTestId('status').textContent).toBe('refreshing');
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = render(<SessionDisplay />);
    unmount();
    // Subsequent state change should not throw
    act(() => {
      setSessionState({ status: 'authenticated', session: null });
    });
    // No assertion needed — absence of error is the test
  });
});
