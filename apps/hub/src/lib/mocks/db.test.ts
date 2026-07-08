import { describe, it, expect, beforeEach } from 'vitest';

import { db, resetDb } from './db';
import { seedDb } from './seed';

describe('db factory + seed', () => {
  beforeEach(() => {
    resetDb();
  });

  it('starts empty after reset', () => {
    expect(db.user.count()).toBe(0);
    expect(db.plan.count()).toBe(0);
    expect(db.tenant.count()).toBe(0);
  });

  it('happy seed creates 3 plans', () => {
    seedDb('happy');
    expect(db.plan.count()).toBe(3);
  });

  it('happy seed creates 1 tenant and admin user', () => {
    seedDb('happy');
    expect(db.tenant.count()).toBe(1);
    // happy seed creates admin + 3 additional members via seedAdminData
    expect(db.user.count()).toBe(4);
    const user = db.user.findFirst({ where: { email: { equals: 'test@corehub.com' } } });
    expect(user?.email).toBe('test@corehub.com');
  });

  it('resetDb clears all data', () => {
    seedDb('happy');
    resetDb();
    expect(db.plan.count()).toBe(0);
    expect(db.user.count()).toBe(0);
  });

  it('otp-failure seed creates same base data as happy (no admin data)', () => {
    seedDb('otp-failure');
    expect(db.plan.count()).toBe(3);
    // otp-failure only seeds seedHappyBase (no extra members from seedAdminData)
    expect(db.user.count()).toBe(1);
  });

  it('invitation-expired seed creates 1 expired invitation', () => {
    seedDb('invitation-expired');
    const inv = db.invitation.findFirst({ where: { status: { equals: 'expired' } } });
    expect(inv).not.toBeNull();
    expect(inv?.status).toBe('expired');
  });
});
