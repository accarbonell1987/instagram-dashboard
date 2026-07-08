// ─── Departamentos of Paraguay ────────────────────────────────────────────────

export const DEPARTAMENTOS = [
  'Asunción',
  'Alto Paraguay',
  'Alto Paraná',
  'Amambay',
  'Boquerón',
  'Caaguazú',
  'Caazapá',
  'Canindeyú',
  'Central',
  'Concepción',
  'Cordillera',
  'Guairá',
  'Itapúa',
  'Misiones',
  'Ñeembucú',
  'Paraguarí',
  'Presidente Hayes',
  'San Pedro',
] as const;

export const TIPOS_EMPRESA = ['SA', 'SRL', 'Unipersonal', 'Otro'] as const;

// RUC format for Paraguay: digits-digit (e.g. 80012345-1)
export const RUC_REGEX = /^\d{5,8}-\d$/;
