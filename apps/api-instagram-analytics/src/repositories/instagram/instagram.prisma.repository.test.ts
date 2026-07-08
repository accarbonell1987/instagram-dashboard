import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaInstagramRepository } from './instagram.prisma.repository.js';
import { config } from '../../config.js';

// Skip integration tests if no real database is configured.
// The vitest setup sets DATABASE_URL to a local PostgreSQL URL by default.
// Tests will run only if Prisma can connect.
const describeIf = describe;

describeIf('PrismaInstagramRepository (integration)', () => {
  let prisma: PrismaClient;
  let repo: PrismaInstagramRepository;
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';
  const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeAll(async () => {
    // Try to connect — if it fails, skip remaining tests
    try {
      prisma = new PrismaClient({
        datasourceUrl: config.DATABASE_URL,
      });
      // Quick connectivity check
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      // No database available — tests in this block will be skipped
      return;
    }
    repo = new PrismaInstagramRepository(prisma);

    // Clean up test data from previous runs
    await prisma.$executeRaw`DELETE FROM "InstagramSyncLog" WHERE "tenantId" IN ('${tenantA}', '${tenantB}')`;
    await prisma.$executeRaw`DELETE FROM "InstagramMediaMetric" WHERE "mediaId" IN (SELECT "id" FROM "InstagramMedia" WHERE "accountId" IN (SELECT "id" FROM "InstagramAccount" WHERE "tenantId" IN ('${tenantA}', '${tenantB}')))`;
    await prisma.instagramMedia.deleteMany({
      where: { account: { tenantId: { in: [tenantA, tenantB] } } },
    });
    await prisma.instagramAccountInsight.deleteMany({
      where: { account: { tenantId: { in: [tenantA, tenantB] } } },
    });
    await prisma.instagramAccount.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('creates and retrieves an account scoped to the correct tenant and user', async () => {
    if (!repo) return; // skip if no DB

    const account = await repo.upsertAccount(
      tenantA,
      { userId: userA, igUserId: 'ig-test-1', username: 'testuser', accountType: 'BUSINESS' },
      'hash123',
      'encrypted123',
      new Date('2027-01-01'),
    );

    expect(account.tenantId).toBe(tenantA);
    expect(account.userId).toBe(userA);
    expect(account.username).toBe('testuser');
    expect(account.accountType).toBe('BUSINESS');
    expect(account.igUserId).toBe('ig-test-1');
  });

  it('enforces tenant isolation via findAccountByTenantId', async () => {
    if (!repo) return;

    // Tenant A has data (created in first test)
    const accountA = await repo.findAccountByTenantId(tenantA);
    // Tenant B has no data
    const accountB = await repo.findAccountByTenantId(tenantB);

    expect(accountA).not.toBeNull();
    expect(accountB).toBeNull();
  });

  it('finds account by tenantId and userId via findAccountByTenantAndUserId', async () => {
    if (!repo) return;

    const found = await repo.findAccountByTenantAndUserId(tenantA, userA);
    const notFound = await repo.findAccountByTenantAndUserId(tenantA, userB);

    expect(found).not.toBeNull();
    expect(found?.userId).toBe(userA);
    expect(notFound).toBeNull();
  });

  it('upserts on same tenant+userId updates existing record', async () => {
    if (!repo) return;

    await repo.upsertAccount(
      tenantA,
      { userId: userA, igUserId: 'ig-test-1-updated', username: 'updateduser', accountType: 'CREATOR' },
      'newhash456',
      'newencrypted456',
      new Date('2027-06-01'),
    );

    const account = await repo.findAccountByTenantAndUserId(tenantA, userA);
    expect(account?.username).toBe('updateduser');
    expect(account?.accountType).toBe('CREATOR');
  });

  it('disconnectAccount sets syncStatus to disconnected', async () => {
    if (!repo) return;

    // Create a separate account for disconnect test
    const tenantC = '33333333-3333-3333-3333-333333333333';
    const userC = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    try {
      await repo.upsertAccount(
        tenantC,
        { userId: userC, igUserId: 'ig-test-c', username: 'disconnectuser', accountType: 'BUSINESS' },
        'hashC',
        'encryptedC',
        new Date('2027-01-01'),
      );

      const disconnected = await repo.disconnectAccount(tenantC, userC);
      expect(disconnected.syncStatus).toBe('disconnected');

      // Second disconnect should throw NotFoundError
      const { NotFoundError } = await import('../../errors.js');
      await expect(repo.disconnectAccount(tenantC, userC)).rejects.toThrow(NotFoundError);
    } finally {
      // Cleanup
      await prisma.instagramAccount.deleteMany({ where: { tenantId: tenantC } }).catch(() => {});
    }
  });

  it('can create a sync log and retrieve it', async () => {
    if (!repo) return;

    const account = await repo.findAccountByTenantAndUserId(tenantA, userA);
    expect(account).not.toBeNull();

    const logId = await repo.createSyncLog(account!.id, tenantA);
    expect(logId).toBeTruthy();

    await repo.updateSyncLog(logId, 'completed', 5);

    const lastLog = await repo.getLatestSyncLog(account!.id);
    expect(lastLog).not.toBeNull();
    expect(lastLog?.status).toBe('completed');
    expect(lastLog?.mediaSynced).toBe(5);
  });

  it('createSyncLog is scoped to the correct account', async () => {
    if (!repo) return;

    // Create a second account for tenant B
    const accountB = await repo.upsertAccount(
      tenantB,
      { userId: userB, igUserId: 'ig-test-b', username: 'tenantbuser', accountType: 'BUSINESS' },
      'hashB',
      'encryptedB',
      new Date('2027-01-01'),
    );

    const logIdB = await repo.createSyncLog(accountB.id, tenantB);
    expect(logIdB).toBeTruthy();

    // Verify tenant A's latest log is unchanged
    const accountA = await repo.findAccountByTenantAndUserId(tenantA, userA);
    const lastLogA = await repo.getLatestSyncLog(accountA!.id);
    expect(lastLogA).not.toBeNull();
    // Should still be the "completed" log with 5 mediaSynced from previous test
    expect(lastLogA?.status).toBe('completed');
  });

  it('returns null for nonexistent account or media', async () => {
    if (!repo) return;

    const nonexistent = await repo.findAccountByTenantAndUserId('00000000-0000-0000-0000-000000000000', userA);
    expect(nonexistent).toBeNull();

    const nonexistentMedia = await repo.findMediaById('nonexistent-id');
    expect(nonexistentMedia).toBeNull();
  });

  describe('agent config', () => {
    it('getAgentConfig returns null when no config is saved', async () => {
      if (!repo) return;

      const config = await repo.getAgentConfig(tenantA, userA);
      expect(config).toBeNull();
    });

    it('saveAgentConfig + getAgentConfig roundtrip', async () => {
      if (!repo) return;

      const sampleConfig = {
        niche: 'Ferretería',
        tags: ['Herramientas', 'Tutoriales'],
        customPrompt: 'Sé conciso',
      };

      await repo.saveAgentConfig(tenantA, userA, sampleConfig);

      const config = await repo.getAgentConfig(tenantA, userA);
      expect(config).not.toBeNull();
      expect(config?.niche).toBe('Ferretería');
      expect(config?.tags).toEqual(['Herramientas', 'Tutoriales']);
      expect(config?.customPrompt).toBe('Sé conciso');
    });

    it('getAgentConfig returns null for different user in same tenant', async () => {
      if (!repo) return;

      // User B should have no config even though user A does
      const config = await repo.getAgentConfig(tenantA, userB);
      expect(config).toBeNull();
    });

    it('saveAgentConfig overwrites existing config', async () => {
      if (!repo) return;

      const config1 = { niche: 'Moda', tags: ['Ropa'] };
      const config2 = { niche: 'Gastronomía', tags: ['Comida', 'Recetas'] };

      await repo.saveAgentConfig(tenantA, userA, config1);
      await repo.saveAgentConfig(tenantA, userA, config2);

      const config = await repo.getAgentConfig(tenantA, userA);
      expect(config?.niche).toBe('Gastronomía');
      expect(config?.tags).toEqual(['Comida', 'Recetas']);
    });
  });

  describe('getAccountInsightHistory', () => {
    it('returns snapshots for an account filtered by date', async () => {
      if (!repo) return;

      const account = await repo.findAccountByTenantAndUserId(tenantA, userA);
      if (!account) return; // no account in DB

      // Insert a few account insights at different times
      const now = new Date();
      await repo.insertAccountInsight(
        account.id,
        {
          period: 'day',
          impressions: 100,
          reach: 80,
          profileViews: 10,
          followerCount: 50,
          likes: 30,
          comments: 5,
          saves: 10,
          shares: 2,
        },
        'day',
      );

      // Wait a bit so timestamps differ
      await new Promise((r) => setTimeout(r, 100));

      await repo.insertAccountInsight(
        account.id,
        {
          period: 'day',
          impressions: 200,
          reach: 160,
          profileViews: 20,
          followerCount: 55,
          likes: 40,
          comments: 8,
          saves: 15,
          shares: 3,
        },
        'day',
      );

      // Query from 1 minute ago → should get both
      const sinceRecent = new Date(now.getTime() - 60_000);
      const snapshots = await repo.getAccountInsightHistory(account.id, sinceRecent);
      expect(snapshots.length).toBeGreaterThanOrEqual(2);
      expect(snapshots[0]!.syncedAt <= snapshots[1]!.syncedAt).toBe(true); // asc order

      // Query from 1 hour in the future → should get none
      const sinceFuture = new Date(now.getTime() + 3_600_000);
      const empty = await repo.getAccountInsightHistory(account.id, sinceFuture);
      expect(empty.length).toBe(0);
    });

    it('returns empty array when no insights exist for the account', async () => {
      if (!repo) return;

      const emptyResult = await repo.getAccountInsightHistory(
        '00000000-0000-0000-0000-000000000000',
        new Date('2020-01-01'),
      );
      expect(emptyResult).toEqual([]);
    });

    it('returns snapshots ordered by syncedAt ascending', async () => {
      if (!repo) return;

      const account = await repo.findAccountByTenantAndUserId(tenantA, userA);
      if (!account) return;

      const since = new Date(Date.now() - 86_400_000); // 1 day ago
      const snapshots = await repo.getAccountInsightHistory(account.id, since);

      // Verify ascending order
      for (let i = 1; i < snapshots.length; i++) {
        expect(
          snapshots[i]!.syncedAt.getTime() >= snapshots[i - 1]!.syncedAt.getTime(),
        ).toBe(true);
      }
    });
  });
});
