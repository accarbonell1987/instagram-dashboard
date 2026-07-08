// identity module barrel — session, guards, hooks, tenant resolution
export { RequireAuth } from './guards/require-auth';
export { RequireRole } from './guards/require-role';
export { useSession } from './hooks/use-session';
export { startSessionBroadcast } from './session/broadcast';
export { refreshSession } from './session/refresh';
export { getSessionState, setSessionState, buildSessionFromToken, updateTenantName, subscribe } from './session/store';
export type { SessionState, Session, SessionUser, SessionTenant } from './session/store';
export { getAccessToken, setAccessToken, clearAccessToken, isExpired, fromJwt } from './session/token';
export { getTenantMode, resolveTenantFromHost, resolveTenantFromPath } from './tenant/resolve';
export type { TenantMode } from './tenant/resolve';
