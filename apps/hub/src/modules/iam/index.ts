// iam domain group barrel — identity, authentication, invitations, onboarding, admin
// Modules are consumed via their own sub-barrels. This barrel selectively re-exports
// the most commonly used members to avoid name collisions (e.g., updateTenantName).
export * from './identity';
export * from './authentication';
export * from './invitations';
export * from './onboarding';
// admin's updateTenantName collides with identity's — import admin directly via @/modules/iam/admin
