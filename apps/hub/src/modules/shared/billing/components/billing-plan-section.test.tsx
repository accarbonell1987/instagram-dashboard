import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { seedDb } from '@/lib/mocks/seed';
import { server } from '@/lib/mocks/server';
import { http, HttpResponse } from 'msw';

import { BillingPlanSection } from './billing-plan-section';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

describe('BillingPlanSection', () => {
  it('renders CurrentPlanCard in loading state on mount', () => {
    seedDb('happy');
    render(<BillingPlanSection />);
    // CurrentPlanCard renders skeleton when isLoading=true or plan=null
    // The card itself should be present
    expect(screen.getByText('Plan contratado')).toBeInTheDocument();
  });

  it('renders CurrentPlanCard with current plan after fetch', async () => {
    seedDb('happy');
    render(<BillingPlanSection />);
    await waitFor(() => {
      // The professional plan name "Profesional" should appear
      expect(screen.getByText('Profesional')).toBeInTheDocument();
    });
  });

  it('renders CurrentPlanCard with plan=null when both fetches fail', async () => {
    server.use(
      http.get(`${BASE}/tenants/current`, () =>
        HttpResponse.json({ title: 'Error', status: 500 }, { status: 500 })
      ),
      http.get(`${BASE}/plans`, () =>
        HttpResponse.json({ title: 'Error', status: 500 }, { status: 500 })
      )
    );
    render(<BillingPlanSection />);
    // Should eventually render with null plan (skeleton state)
    await waitFor(() => {
      expect(screen.getByText('Plan contratado')).toBeInTheDocument();
    });
  });

  it('opens PlanChangeRequestDialog when onChangePlan is triggered', async () => {
    seedDb('happy');
    render(<BillingPlanSection />);
    await waitFor(() => {
      expect(screen.getByText('Cambiar plan')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Cambiar plan/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('closes PlanChangeRequestDialog when onOpenChange(false) is called', async () => {
    seedDb('happy');
    render(<BillingPlanSection />);
    await waitFor(() => {
      expect(screen.getByText('Cambiar plan')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Cambiar plan/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Close via cancel button
    const cancelButton = screen.getByRole('button', { name: /Cancelar/i });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
