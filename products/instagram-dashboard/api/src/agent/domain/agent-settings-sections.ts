/**
 * Who may configure what, inside the agent's settings.
 *
 * Two axes, because the question has two halves:
 *
 * - **`moduleId`** — did the tenant buy this? Sub-modules of `ig-ai-agent`,
 *   so plans grant them (`PlanModule`) and product roles narrow them
 *   (`RoleModuleAccess`) through the machinery that already exists. Nothing
 *   here is a new permission system; it is the module system applied one
 *   level down.
 *
 * - **`minRole`** — may this member touch it? A floor that a plan cannot sell
 *   and a role cannot widen. The three `TenantAdmin` sections are the
 *   credentials and the spend levers: the fal.ai key is a secret, and the
 *   model and the character limits decide how many tokens each generation
 *   burns against the quota the *tenant* bought. Making that floor sellable
 *   would mean a plan could hand a member the ability to rotate the API key.
 *
 * A caller must clear BOTH to change a section. The table is deliberately the
 * only place this is written down: `GET /settings` reports from it and
 * `PUT /settings` enforces from it, so the screen and the guard cannot drift.
 */

export const AGENT_SETTINGS_SECTIONS = [
  { key: 'topics', moduleId: 'ig-agent-topics', minRole: 'User' },
  { key: 'prompt', moduleId: 'ig-agent-prompt', minRole: 'User' },
  { key: 'limits', moduleId: 'ig-agent-limits', minRole: 'TenantAdmin' },
  { key: 'model', moduleId: 'ig-agent-model', minRole: 'TenantAdmin' },
  { key: 'imageKey', moduleId: 'ig-agent-image-key', minRole: 'TenantAdmin' },
  { key: 'imageModels', moduleId: 'ig-agent-image-models', minRole: 'User' },
  { key: 'imageStyles', moduleId: 'ig-agent-image-styles', minRole: 'User' },
] as const satisfies readonly {
  key: string;
  moduleId: string;
  minRole: 'User' | 'TenantAdmin';
}[];

export type AgentSettingsSectionKey = (typeof AGENT_SETTINGS_SECTIONS)[number]['key'];

/**
 * Ranks, not a boolean, so SuperAdmin clears a TenantAdmin floor without being
 * listed on every section. Mirrors `ROLE_RANK` in api-iam's module service; an
 * unknown role ranks below everything rather than defaulting to trusted.
 */
const ROLE_RANK: Record<string, number> = { User: 0, TenantAdmin: 1, SuperAdmin: 2 };

export function resolveEditableSections(
  entitledModuleIds: readonly string[],
  role: string,
): AgentSettingsSectionKey[] {
  const entitled = new Set(entitledModuleIds);
  const rank = ROLE_RANK[role] ?? -1;

  return AGENT_SETTINGS_SECTIONS.filter(
    // `?? 99` on the floor, `?? -1` on the caller: an unrecognised role on
    // either side denies rather than waves through.
    (section) => entitled.has(section.moduleId) && rank >= (ROLE_RANK[section.minRole] ?? 99),
  ).map((section) => section.key);
}

/** The shape the two callers share; both are structurally `AgentConfig`-like. */
interface SettingsShape {
  niche?: string | undefined;
  tags?: string[] | undefined;
  customPrompt?: string | undefined;
  limits?: Record<string, unknown> | undefined;
  llm?: Record<string, unknown> | undefined;
  imageGen?: Record<string, unknown> | undefined;
  falApiKey?: string | undefined;
  llmApiKey?: string | undefined;
}

/** Which fields belong to which section. `imageGen` splits across two. */
const SECTION_FIELDS: Record<AgentSettingsSectionKey, (a: SettingsShape, b: SettingsShape) => boolean> = {
  topics: (a, b) => a.niche !== b.niche || !sameStrings(a.tags, b.tags),
  prompt: (a, b) => (a.customPrompt ?? '') !== (b.customPrompt ?? ''),
  limits: (a, b) => differsOn(a.limits, b.limits, ['slideText', 'visualPrompt']),
  model: (a, b) => differsOn(a.llm, b.llm, ['provider', 'baseUrl', 'model']),
  imageKey: () => false,
  imageModels: (a, b) => differsOn(a.imageGen, b.imageGen, ['t2iModel', 'i2iModel']),
  imageStyles: (a, b) =>
    differsOn(a.imageGen, b.imageGen, [
      'basePrompt',
      'hookPrompt',
      'developmentPrompt',
      'ctaPrompt',
    ]),
};

function sameStrings(a: string[] | undefined, b: string[] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function differsOn(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
  keys: readonly string[],
): boolean {
  // An absent group means "unchanged", not "cleared". The screen sends whatever
  // it loaded, and a section the caller cannot see is simply not in the payload.
  if (a === undefined) return false;
  return keys.some((key) => a[key] !== b?.[key]);
}

/**
 * Which sections a payload actually tries to change.
 *
 * Compared against what is stored rather than rejecting on mere presence: the
 * screen posts the whole config on every save, so a member editing the topics
 * still sends back the limits they loaded. Refusing that would block the save
 * they are entitled to make. Authorisation here is about changes, which also
 * makes it hold against a client that posts every field on purpose.
 */
export function findChangedSections(
  incoming: SettingsShape,
  stored: SettingsShape | null,
): AgentSettingsSectionKey[] {
  const current = stored ?? {};
  const changed = AGENT_SETTINGS_SECTIONS.filter((section) =>
    SECTION_FIELDS[section.key](incoming, current),
  ).map((section) => section.key);

  // Secrets never come back from storage, so there is nothing to compare: a
  // value present at all is an attempt to set one.
  if (incoming.falApiKey !== undefined && !changed.includes('imageKey')) changed.push('imageKey');
  if (incoming.llmApiKey !== undefined && !changed.includes('model')) changed.push('model');

  return changed;
}
