import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OtpForm } from './otp-form';

const noop = vi.fn().mockResolvedValue(undefined);

function renderForm(overrides?: Partial<React.ComponentProps<typeof OtpForm>>) {
  const onVerify = vi.fn().mockResolvedValue(undefined);
  const onResend = vi.fn().mockResolvedValue(undefined);
  const onBack = vi.fn();

  render(
    <OtpForm
      otpId="otp-123"
      channel="email"
      identifier="a***@corehub.com"
      onVerify={onVerify}
      onResend={onResend}
      onBack={onBack}
      cooldownSeconds={30}
      {...overrides}
    />
  );

  return { onVerify, onResend, onBack };
}

describe('OtpForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders destination info with channel and identifier', () => {
    renderForm();
    expect(screen.getByText(/correo electrónico/)).toBeInTheDocument();
    expect(screen.getByText(/a\*\*\*@corehub\.com/)).toBeInTheDocument();
  });

  it('renders OTP input', () => {
    renderForm();
    // InputOTP renders a hidden text input — check the labeled input exists
    expect(screen.getByLabelText('Código de verificación de 6 dígitos')).toBeInTheDocument();
  });

  it('verify button is disabled when code is incomplete', () => {
    renderForm();
    const button = screen.getByRole('button', { name: /Verificar código/i });
    expect(button).toBeDisabled();
  });

  it('shows trust device checkbox and label when showTrustDevice=true', () => {
    renderForm({ showTrustDevice: true });
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByText(/Confiar en este dispositivo/i)).toBeInTheDocument();
  });

  it('does not show trust device checkbox by default', () => {
    renderForm();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows resend button in cooldown state initially', () => {
    renderForm({ cooldownSeconds: 30 });
    const resendBtn = screen.getByRole('button', { name: /Reenviar código en/i });
    expect(resendBtn).toBeDisabled();
  });

  it('shows back button when onBack is provided', () => {
    renderForm();
    expect(screen.getByRole('button', { name: /Volver/i })).toBeInTheDocument();
  });

  it('shows inline error after failed verify', () => {
    const onVerify = vi.fn().mockRejectedValue(new Error('Código incorrecto'));

    render(
      <OtpForm
        otpId="otp-123"
        channel="email"
        identifier="a***@corehub.com"
        onVerify={onVerify}
        onResend={noop}
        cooldownSeconds={0}
      />
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('calls onResend when resend button is clicked (no cooldown)', async () => {
    const user = userEvent.setup();
    const { onResend } = renderForm({ cooldownSeconds: 0 });

    const resendBtn = screen.getByRole('button', { name: /Reenviar código/i });
    await user.click(resendBtn);

    await waitFor(() => {
      expect(onResend).toHaveBeenCalledOnce();
    });
  });

  it('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();
    const { onBack } = renderForm();

    await user.click(screen.getByRole('button', { name: /Volver/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
