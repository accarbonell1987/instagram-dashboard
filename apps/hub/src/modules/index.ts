// Top-level modules barrel — Screaming Architecture domain groups:
//   iam/ — identity, authentication, invitations, onboarding, admin
//   backoffice/ — modulo-admin, planes, tenants, evaluaciones
//   dashboard-instagram/ — Instagram analytics dashboard (unchanged)
//   evaluaciones/ — user-facing quiz (was: prueba)
//   shared/ — modules (iframe shell), billing
//
// NOTE: Not using export * due to name collisions.
// Modules are consumed via their own barrels: @/modules/iam, @/modules/backoffice, etc.
