import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import type { Plan } from '../services/plans.service';

import { PlanChip } from './plan-chip';


const mockPlan: Plan = {
  id: 'professional',
  name: 'Profesional',
  price: 450_000,
  currency: 'PYG',
  billingCycle: 'monthly',
  features: [],
  popular: true,
};

describe('PlanChip', () => {
  it('renders plan name, price, and cycle', () => {
    render(<PlanChip plan={mockPlan} onChange={() => void 0} />);
    expect(screen.getByText('Profesional')).toBeInTheDocument();
    expect(screen.getByText(/450/)).toBeInTheDocument();
    expect(screen.getByText(/mensual/i)).toBeInTheDocument();
  });

  it('calls onChange when "Cambiar" is clicked', () => {
    const onChange = vi.fn();
    render(<PlanChip plan={mockPlan} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /cambiar/i }));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('returns null when plan is null', () => {
    const { container } = render(<PlanChip plan={null} onChange={() => void 0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders currency label', () => {
    render(<PlanChip plan={mockPlan} onChange={() => void 0} />);
    expect(screen.getByText(/PYG/)).toBeInTheDocument();
  });
});
