import { describe, it, expect, beforeEach } from 'vitest';

import { listPlans, getPlan } from './plans.service';

import { applyScenario } from '@/lib/mocks/seed';

beforeEach(() => {
  applyScenario('happy');
});

describe('listPlans', () => {
  it('returns 3 plans seeded from happy scenario', async () => {
    const result = await listPlans();
    expect(result.plans).toHaveLength(3);
    expect(result.plans.map((p) => p.id)).toEqual(
      expect.arrayContaining(['starter', 'professional', 'enterprise']),
    );
  });

  it('returns plan with correct fields', async () => {
    const result = await listPlans();
    const professional = result.plans.find((p) => p.id === 'professional');
    expect(professional).toBeDefined();
    expect(professional?.name).toBe('Profesional');
    expect(professional?.popular).toBe(true);
    expect(professional?.price).toBe(450_000);
    expect(professional?.currency).toBe('PYG');
  });
});

describe('getPlan', () => {
  it('returns specific plan by id', async () => {
    const plan = await getPlan('starter');
    expect(plan.id).toBe('starter');
    expect(plan.name).toBe('Básico');
  });

  it('throws on unknown plan id', async () => {
    await expect(getPlan('nonexistent')).rejects.toThrow();
  });
});
