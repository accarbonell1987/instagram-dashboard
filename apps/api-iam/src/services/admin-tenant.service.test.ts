import { describe, it, expect, vi } from 'vitest'
import { createAdminTenantService } from './admin-tenant.service.js'
import { NotFoundError, ConflictError, ValidationError } from '../errors.js'
import type { AdminTenantServiceDeps } from './admin-tenant.service.js'

function makeTenant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tenant-1',
    slug: 'acme-corp',
    name: 'Acme Corp',
    schemaName: 'tenant_acme_corp',
    planId: 'plan-1',
    status: 'active',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-05-01'),
    ...overrides,
  }
}

function makeTenantWithDetails(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ...makeTenant(overrides),
    planName: (overrides['planName'] as string) ?? 'Enterprise',
    userCount: (overrides['userCount'] as number) ?? 42,
    plan: {
      id: 'plan-1',
      name: 'Enterprise',
      price: 299.99,
      currency: 'PYG',
      billingInterval: 'month',
    },
  }
}

function makeDeps(overrides: Partial<AdminTenantServiceDeps> = {}): AdminTenantServiceDeps {
  return {
    tenantRepo: {
      findBySlug: vi.fn(),
      findByUuid: vi.fn().mockResolvedValue(makeTenant()),
      create: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(makeTenant({ status: 'suspended' })),
      updateName: vi.fn(),
      findAllPaginated: vi.fn().mockResolvedValue({
        items: [makeTenantWithDetails(), makeTenantWithDetails({ id: 'tenant-2', status: 'suspended' })],
        total: 2,
      }),
      findByIdWithDetail: vi.fn().mockResolvedValue(makeTenantWithDetails()),
      sweepUnpaidPending: vi.fn(),
    },
    userRepo: {
      findByEmail: vi.fn(),
      findByEmailGlobal: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      incrementFailedAttempts: vi.fn(),
      resetFailedAttempts: vi.fn(),
      setLockedUntil: vi.fn(),
      setPasswordHash: vi.fn(),
      listByTenant: vi.fn(),
      findByActivationTokenHash: vi.fn(),
      setActivationTokenUsed: vi.fn(),
      findByIdInTenant: vi.fn(),
      countActiveAdmins: vi.fn(),
      softDelete: vi.fn(),
      updateProfile: vi.fn(),
      findActiveUserIdsByTenant: vi.fn().mockResolvedValue(['user-1', 'user-2']),
    },
    refreshTokenRepo: {
      create: vi.fn(),
      findByHash: vi.fn(),
      findByHashForUpdate: vi.fn(),
      markUsedByHash: vi.fn(),
      invalidateFamily: vi.fn(),
      findActiveByUserId: vi.fn(),
      deleteExpired: vi.fn(),
      invalidateAllForUser: vi.fn(),
    },
    paymentRepo: {
      create: vi.fn().mockResolvedValue({ id: 'payment-synthetic' }),
      findByDraftId: vi.fn(),
      findByExternalRef: vi.fn(),
      listByTenant: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn(),
      cancelPendingByDraftId: vi.fn(),
    },
    draftRepo: {
      create: vi.fn().mockResolvedValue({ id: 'draft-synthetic' }),
      findById: vi.fn(),
      findByIdOrThrow: vi.fn(),
      findByIdForUpdate: vi.fn(),
      findByRepresentativeEmail: vi.fn(),
      update: vi.fn(),
      setResumeToken: vi.fn(),
      markResumeTokenUsed: vi.fn(),
      deleteExpired: vi.fn(),
      findByRuc: vi.fn(),
    },
    settlementService: {
      settlePayment: vi.fn().mockResolvedValue({ payment: { id: 'payment-1' }, alreadySettled: false }),
    },
    prisma: {} as any,
    ...overrides,
  }
}

describe('AdminTenantService', () => {
  // ── listTenants ────────────────────────────────────────────────────────────

  describe('listTenants', () => {
    it('returns paginated tenant list with plan name and user count', async () => {
      const deps = makeDeps()
      const service = createAdminTenantService(deps)
      const result = await service.listTenants({ page: 1, pageSize: 20 })

      expect(result.items).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.items[0]!.planName).toBe('Enterprise')
      expect(result.items[0]!.userCount).toBe(42)
      expect(deps.tenantRepo.findAllPaginated).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
    })

    it('passes search filter to repository', async () => {
      const deps = makeDeps()
      const service = createAdminTenantService(deps)
      await service.listTenants({ page: 1, pageSize: 20, search: 'acme' })

      expect(deps.tenantRepo.findAllPaginated).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        search: 'acme',
      })
    })

    it('passes status filter to repository', async () => {
      const deps = makeDeps()
      const service = createAdminTenantService(deps)
      await service.listTenants({ page: 1, pageSize: 20, status: 'suspended' })

      expect(deps.tenantRepo.findAllPaginated).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        status: 'suspended',
      })
    })
  })

  // ── getTenantDetail ────────────────────────────────────────────────────────

  describe('getTenantDetail', () => {
    it('returns full tenant detail with plan info', async () => {
      const deps = makeDeps()
      const service = createAdminTenantService(deps)
      const result = await service.getTenantDetail('tenant-1')

      expect(result.id).toBe('tenant-1')
      expect(result.plan.name).toBe('Enterprise')
      expect(result.userCount).toBe(42)
    })

    it('propagates NotFoundError for unknown tenant', async () => {
      const deps = makeDeps({
        tenantRepo: {
          ...makeDeps().tenantRepo,
          findByIdWithDetail: vi.fn().mockRejectedValue(new NotFoundError('tenant.not_found')),
        },
      })
      const service = createAdminTenantService(deps)
      await expect(service.getTenantDetail('nonexistent')).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  // ── changeTenantStatus ─────────────────────────────────────────────────────

  describe('changeTenantStatus', () => {
    it('updates status and returns updated tenant', async () => {
      const deps = makeDeps()
      const service = createAdminTenantService(deps)
      const result = await service.changeTenantStatus('tenant-1', 'suspended')

      expect(result.status).toBe('suspended')
      expect(deps.tenantRepo.updateStatus).toHaveBeenCalledWith('tenant-1', 'suspended')
    })

    it('invalidates all user sessions when suspending a tenant', async () => {
      const deps = makeDeps()
      const service = createAdminTenantService(deps)
      await service.changeTenantStatus('tenant-1', 'suspended')

      expect(deps.userRepo.findActiveUserIdsByTenant).toHaveBeenCalledWith('tenant-1')
      expect(deps.refreshTokenRepo.invalidateAllForUser).toHaveBeenCalledTimes(2)
      expect(deps.refreshTokenRepo.invalidateAllForUser).toHaveBeenCalledWith('user-1')
      expect(deps.refreshTokenRepo.invalidateAllForUser).toHaveBeenCalledWith('user-2')
    })

    it('does not invalidate sessions when activating', async () => {
      const deps = makeDeps()
      const service = createAdminTenantService(deps)
      await service.changeTenantStatus('tenant-1', 'active', 'admin-1', 'confirmed via bank statement')

      expect(deps.userRepo.findActiveUserIdsByTenant).not.toHaveBeenCalled()
      expect(deps.refreshTokenRepo.invalidateAllForUser).not.toHaveBeenCalled()
    })

    it('propagates NotFoundError for unknown tenant', async () => {
      const deps = makeDeps({
        tenantRepo: {
          ...makeDeps().tenantRepo,
          updateStatus: vi.fn().mockRejectedValue(new NotFoundError('tenant.not_found')),
        },
      })
      const service = createAdminTenantService(deps)
      await expect(
        service.changeTenantStatus('nonexistent', 'suspended')
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    // Task 3.8 regression: activation used to write tenant status directly.
    // It now always routes through settlePayment() (spec
    // "tenant-administration: Manual status changes route through settlement").

    it('rejects activation with a missing/empty note, without touching tenantRepo or settlementService', async () => {
      const deps = makeDeps()
      const service = createAdminTenantService(deps)

      await expect(
        service.changeTenantStatus('tenant-1', 'active', 'admin-1', '  '),
      ).rejects.toBeInstanceOf(ValidationError)

      expect(deps.tenantRepo.updateStatus).not.toHaveBeenCalled()
      expect(deps.settlementService.settlePayment).not.toHaveBeenCalled()
    })

    it('routes activation with an unsettled payment through settlePayment (manual_admin) instead of a direct status write', async () => {
      const deps = makeDeps({
        paymentRepo: {
          ...makeDeps().paymentRepo,
          listByTenant: vi.fn().mockResolvedValue([{ id: 'payment-1', status: 'pending' }]),
        },
      })
      const service = createAdminTenantService(deps)

      const result = await service.changeTenantStatus('tenant-1', 'active', 'admin-1', 'confirmed via bank statement')

      expect(deps.tenantRepo.updateStatus).not.toHaveBeenCalled()
      expect(deps.settlementService.settlePayment).toHaveBeenCalledWith({
        paymentId: 'payment-1',
        decision: 'approved',
        settlementKind: 'manual_admin',
        settledBy: 'admin-1',
        note: 'confirmed via bank statement',
      })
      expect(deps.paymentRepo.create).not.toHaveBeenCalled()
      expect(result).toEqual({ id: 'tenant-1', status: 'active' })
    })

    it('creates a synthetic manual_admin payment and settles it for a courtesy activation with zero payments', async () => {
      const deps = makeDeps()
      const service = createAdminTenantService(deps)

      await service.changeTenantStatus('tenant-1', 'active', 'admin-1', 'manually provisioned tenant')

      expect(deps.draftRepo.create).toHaveBeenCalledWith(expect.objectContaining({ planId: 'plan-1' }))
      expect(deps.draftRepo.update).toHaveBeenCalledWith('draft-synthetic', { status: 'completed', tenantId: 'tenant-1' })
      expect(deps.paymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ draftId: 'draft-synthetic', tenantId: 'tenant-1', amount: 0, status: 'pending' }),
      )
      expect(deps.settlementService.settlePayment).toHaveBeenCalledWith({
        paymentId: 'payment-synthetic',
        decision: 'approved',
        settlementKind: 'manual_admin',
        settledBy: 'admin-1',
        note: 'manually provisioned tenant',
      })
    })
  })
})
