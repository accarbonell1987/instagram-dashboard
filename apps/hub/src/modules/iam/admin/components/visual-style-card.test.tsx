import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { VisualStyleCard } from './visual-style-card';

import { server } from '@/lib/mocks/server';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => {
      toastSuccess(...args);
    },
    error: (...args: unknown[]) => {
      toastError(...args);
    },
  },
}));

const setColorTheme = vi.fn();
vi.mock('@core/shared/providers', () => ({
  useColorTheme: () => ({ colorTheme: 'orange', setColorTheme }),
}));

describe('VisualStyleCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves the picked theme for the whole tenant', async () => {
    const user = userEvent.setup();
    let sentBody: unknown = null;
    server.use(
      http.patch(`${BASE}/tenants/current`, async ({ request }) => {
        sentBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      })
    );
    const onSaved = vi.fn();

    render(<VisualStyleCard colorTheme="orange" isLoading={false} onSaved={onSaved} />);
    await user.click(screen.getByRole('button', { name: /violet/i }));

    await waitFor(() => {
      expect(sentBody).toEqual({ colorTheme: 'violet' });
    });
    expect(onSaved).toHaveBeenCalledWith('violet');
    expect(setColorTheme).toHaveBeenCalledWith('violet');
    expect(toastSuccess).toHaveBeenCalled();
  });

  // The theme is applied optimistically so the admin can judge it on the real
  // UI. If the save fails, leaving it applied would claim a persistence that
  // never happened.
  it('rolls the theme back when the save fails', async () => {
    const user = userEvent.setup();
    server.use(
      http.patch(`${BASE}/tenants/current`, () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'Forbidden', status: 403 },
          { status: 403, headers: { 'Content-Type': 'application/problem+json' } }
        )
      )
    );

    render(<VisualStyleCard colorTheme="orange" isLoading={false} onSaved={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /violet/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(setColorTheme).toHaveBeenLastCalledWith('orange');
  });

  it('marks the tenant theme as the selected one', () => {
    render(<VisualStyleCard colorTheme="violet" isLoading={false} onSaved={vi.fn()} />);
    expect(screen.getByRole('button', { name: /violet/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
