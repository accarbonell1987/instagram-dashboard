import { adminHandlers } from './admin';
import { authHandlers } from './auth';
import { billingHandlers } from './billing';
import { identityHandlers } from './identity';
import { invitationsHandlers } from './invitations';
import { modulesHandlers } from './modules';
import { onboardingHandlers } from './onboarding';
import { plansHandlers } from './plans';
import { quizHandlers } from './quizzes';
import { instagramHandlers } from './instagram';

export const handlers = [
  ...authHandlers,
  ...plansHandlers,
  ...onboardingHandlers,
  ...invitationsHandlers,
  ...adminHandlers,
  ...identityHandlers,
  ...billingHandlers,
  ...modulesHandlers,
  ...quizHandlers,
  ...instagramHandlers,
];
