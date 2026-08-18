import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { CurrentPlanCard } from './current-plan-card';

import type { Plan } from '@/lib/api/plans';

const PLAN: Plan = {
  id: 'professional',
  name: 'Professional',
  price: 299000,
  currency: 'PYG',
  billingCycle: 'monthly',
  features: ['Soporte prioritario', 'Reportes avanzados'],
  modules: [
    { id: 'ig-basic-metrics', name: 'Métricas Básicas', subModules: [] },
    {
      id: 'ig-ai-agent',
      name: 'Agente IA',
      subModules: [
        { id: 'ig-ai-chat', name: 'Chat' },
        { id: 'ig-ai-carousels', name: 'Carousels' },
      ],
    },
  ],
  popular: false,
};

describe('CurrentPlanCard', () => {
  it('names the plan and its price', () => {
    render(<CurrentPlanCard plan={PLAN} onChangePlan={vi.fn()} />);
    expect(screen.getByText('Professional')).toBeInTheDocument();
    expect(screen.getByText(/299\.000/)).toBeInTheDocument();
  });

  /**
   * The substance of sharing the signup card, not just its looks: this view
   * used to list `features`, a free-text marketing array, while the plan
   * selector listed the modules the plan actually grants. A customer compared
   * plans on one screen and read a different description of the same plan on
   * the other.
   */
  it('describes the plan by the modules it grants, like the selector does', () => {
    render(<CurrentPlanCard plan={PLAN} onChangePlan={vi.fn()} />);
    expect(screen.getByText('Métricas Básicas')).toBeInTheDocument();
    expect(screen.getByText('Agente IA')).toBeInTheDocument();
    expect(screen.getByText(/2 funcionalidades/)).toBeInTheDocument();
  });

  it('marks it as the plan in force', () => {
    render(<CurrentPlanCard plan={PLAN} onChangePlan={vi.fn()} />);
    expect(screen.getByText('Plan actual')).toBeInTheDocument();
  });

  // It presents the plan; it does not offer it. Clicking the body must not act.
  it('is not selectable', async () => {
    const user = userEvent.setup();
    const onChangePlan = vi.fn();
    render(<CurrentPlanCard plan={PLAN} onChangePlan={onChangePlan} />);

    await user.click(screen.getByText('Professional'));
    expect(onChangePlan).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cambiar plan' }));
    expect(onChangePlan).toHaveBeenCalledOnce();
  });

  it('shows a busy skeleton while the plan is unknown', () => {
    const { container } = render(<CurrentPlanCard plan={null} isLoading onChangePlan={vi.fn()} />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText('Professional')).toBeNull();
  });
});
