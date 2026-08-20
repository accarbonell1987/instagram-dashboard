import { describe, it, expect } from 'vitest';

import {
  AGENT_SETTINGS_SECTIONS,
  findChangedSections,
  resolveEditableSections,
} from './agent-settings-sections.js';

const ALL_MODULES = AGENT_SETTINGS_SECTIONS.map((section) => section.moduleId);

describe('resolveEditableSections', () => {
  it('gives a tenant admin with every module every section', () => {
    expect(resolveEditableSections(ALL_MODULES, 'TenantAdmin').sort()).toEqual(
      AGENT_SETTINGS_SECTIONS.map((s) => s.key).sort(),
    );
  });

  /**
   * The whole point of the role floor. A member can hold the module — the plan
   * sold it to the tenant — and still not be the person who rotates the key or
   * decides how many tokens each generation burns.
   */
  it('withholds credentials and spend levers from a plain member', () => {
    const editable = resolveEditableSections(ALL_MODULES, 'User');

    expect(editable).not.toContain('imageKey');
    expect(editable).not.toContain('model');
    expect(editable).not.toContain('limits');
    expect(editable).toEqual(
      expect.arrayContaining(['topics', 'prompt', 'imageModels', 'imageStyles']),
    );
  });

  // Being an admin is not a substitute for the tenant having bought the feature.
  it('withholds a section the tenant has no module for, admin or not', () => {
    const withoutModel = ALL_MODULES.filter((id) => id !== 'ig-agent-model');

    expect(resolveEditableSections(withoutModel, 'TenantAdmin')).not.toContain('model');
  });

  it('lets SuperAdmin clear a TenantAdmin floor without being listed on it', () => {
    expect(resolveEditableSections(ALL_MODULES, 'SuperAdmin')).toContain('imageKey');
  });

  // An unrecognised role must deny, not sail past the floor.
  it('denies an unknown role everything', () => {
    expect(resolveEditableSections(ALL_MODULES, 'Wizard')).toEqual([]);
  });

  it('grants nothing when no module is entitled', () => {
    expect(resolveEditableSections([], 'TenantAdmin')).toEqual([]);
  });
});

describe('findChangedSections', () => {
  const stored = {
    niche: 'Moda',
    tags: ['Ropa'],
    customPrompt: 'Sé breve',
    limits: { slideText: 150 },
    llm: { provider: 'deepseek', model: 'deepseek-v4-flash' },
    imageGen: { t2iModel: 'fal-ai/ideogram/v3', basePrompt: 'fondo claro' },
  };

  /**
   * The screen posts the whole config on every save, so a member editing the
   * topics still sends back the limits they loaded. If that counted as a change
   * they would be refused the save they are entitled to make.
   */
  it('reports nothing when the payload matches what is stored', () => {
    expect(findChangedSections({ ...stored }, stored)).toEqual([]);
  });

  it('reports only the section that actually moved', () => {
    expect(findChangedSections({ ...stored, niche: 'Fitness' }, stored)).toEqual(['topics']);
    expect(findChangedSections({ ...stored, tags: ['Ropa', 'Zapatos'] }, stored)).toEqual(['topics']);
  });

  it('separates the two halves of imageGen', () => {
    const models = { ...stored, imageGen: { ...stored.imageGen, t2iModel: 'fal-ai/flux/dev' } };
    const styles = { ...stored, imageGen: { ...stored.imageGen, basePrompt: 'fondo oscuro' } };

    expect(findChangedSections(models, stored)).toEqual(['imageModels']);
    expect(findChangedSections(styles, stored)).toEqual(['imageStyles']);
  });

  // Secrets never come back from storage, so there is nothing to compare
  // against: a value present at all is an attempt to set one.
  it('treats a submitted secret as a change to its section', () => {
    expect(findChangedSections({ ...stored, falApiKey: 'fal-new' }, stored)).toEqual(['imageKey']);
    expect(findChangedSections({ ...stored, llmApiKey: 'sk-new' }, stored)).toEqual(['model']);
  });

  it('reports the model section for a provider switch', () => {
    const switched = { ...stored, llm: { ...stored.llm, provider: 'openai' } };

    expect(findChangedSections(switched, stored)).toEqual(['model']);
  });

  // First save: everything present is new.
  it('reports every populated section when nothing is stored yet', () => {
    const changed = findChangedSections({ niche: 'Moda', tags: ['Ropa'] }, null);

    expect(changed).toContain('topics');
  });

  /**
   * An absent group means "unchanged", not "cleared" — a caller who cannot see
   * the limits omits them entirely, and that must not read as wiping them.
   */
  it('does not treat an omitted group as a change', () => {
    const withoutLimits = { niche: 'Moda', tags: ['Ropa'], customPrompt: 'Sé breve' };

    expect(findChangedSections(withoutLimits, stored)).toEqual([]);
  });
});
