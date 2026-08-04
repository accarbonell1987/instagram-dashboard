// Top-level modules barrel — Screaming Architecture domain groups:
//   iam/ — identity, authentication, invitations, onboarding, admin
//   backoffice/ — modulo-admin, planes, tenants
//   dashboard-instagram/ — Instagram analytics dashboard (unchanged)
//   shared/ — modules (iframe shell), billing
//
// NOTE: Not using export * due to name collisions.
// Modules are consumed via their own barrels: @/modules/iam, @/modules/backoffice, etc.
