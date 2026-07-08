const ROLE_LABELS: Record<'SuperAdmin' | 'TenantAdmin' | 'User', string> = {
  SuperAdmin: 'Superadministrador',
  TenantAdmin: 'Administrador',
  User: 'Usuario',
};

export function roleLabel(role: 'SuperAdmin' | 'TenantAdmin' | 'User'): string {
  return ROLE_LABELS[role];
}
