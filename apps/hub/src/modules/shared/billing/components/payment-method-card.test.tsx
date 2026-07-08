import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { components } from '@/lib/api/types';

import { PaymentMethodCard } from './payment-method-card';

type PaymentMethod = components['schemas']['PaymentMethod'];

const mockVisaCard: PaymentMethod = {
  brand: 'visa',
  lastFour: '4242',
  expiryMonth: 12,
  expiryYear: 2027,
};

const mockUnknownCard: PaymentMethod = {
  brand: 'unknown',
  lastFour: '9999',
  expiryMonth: 6,
  expiryYear: 2030,
};

describe('PaymentMethodCard', () => {
  describe('loading state', () => {
    it('renders skeleton when isLoading is true', () => {
      render(<PaymentMethodCard isLoading={true} paymentMethod={null} />);
      // Skeleton container should be present with aria-busy
      expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });

    it('has aria-busy true when loading', () => {
      render(<PaymentMethodCard isLoading={true} paymentMethod={null} />);
      expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });

    it('does not render card data when loading', () => {
      render(<PaymentMethodCard isLoading={true} paymentMethod={mockVisaCard} />);
      expect(screen.queryByText('Visa')).not.toBeInTheDocument();
      expect(screen.queryByText(/4242/)).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders message when paymentMethod is null and not loading', () => {
      render(<PaymentMethodCard isLoading={false} paymentMethod={null} />);
      expect(screen.getByText('Aún no registraste un método de pago')).toBeInTheDocument();
    });

    it('does not render masked PAN or expiry when empty', () => {
      render(<PaymentMethodCard isLoading={false} paymentMethod={null} />);
      expect(screen.queryByText(/••••/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Vence/)).not.toBeInTheDocument();
    });
  });

  describe('populated state', () => {
    it('renders masked PAN ending in lastFour', () => {
      render(<PaymentMethodCard isLoading={false} paymentMethod={mockVisaCard} />);
      expect(screen.getByText(/•••• •••• •••• 4242/)).toBeInTheDocument();
    });

    it('renders expiry as MM/YY format', () => {
      render(<PaymentMethodCard isLoading={false} paymentMethod={mockVisaCard} />);
      expect(screen.getByText('Vence 12/27')).toBeInTheDocument();
    });

    it('renders brand label "Visa" for visa brand', () => {
      render(<PaymentMethodCard isLoading={false} paymentMethod={mockVisaCard} />);
      expect(screen.getByText('Visa')).toBeInTheDocument();
    });

    it('renders brand label "Tarjeta" for unknown brand', () => {
      render(<PaymentMethodCard isLoading={false} paymentMethod={mockUnknownCard} />);
      expect(screen.getByText('Tarjeta')).toBeInTheDocument();
    });

    it('aria-label on card div includes brand and lastFour', () => {
      render(<PaymentMethodCard isLoading={false} paymentMethod={mockVisaCard} />);
      expect(screen.getByLabelText('Tarjeta Visa terminada en 4242')).toBeInTheDocument();
    });

    it('expiry renders single-digit month padded to 2 digits', () => {
      render(<PaymentMethodCard isLoading={false} paymentMethod={mockUnknownCard} />);
      // expiryMonth: 6 → "06", expiryYear: 2030 → "30"
      expect(screen.getByText('Vence 06/30')).toBeInTheDocument();
    });
  });
});
