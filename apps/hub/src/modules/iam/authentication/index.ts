// Authentication module — public exports
export { LoginForm } from './components/login-form';
export { OtpForm } from './components/otp-form';
export type { OtpFormProps } from './components/otp-form';
export { SetPasswordForm } from './components/set-password-form';
export type { SetPasswordFormProps } from './components/set-password-form';
export { FirstLoginForm } from './components/first-login-form';
export { RecoverForm } from './components/recover-form';

export * from './services/auth.service';
export { useCountdown } from './hooks/use-countdown';
export type { UseCountdownResult, UseCountdownOptions } from './hooks/use-countdown';
export { buildPasswordSchema, evaluatePasswordChecklist } from './lib/password-policy';
export type { PasswordPolicy, PasswordChecklistItem } from './lib/password-policy';
export { getOrCreateDeviceId, clearDeviceId } from './lib/device';
