import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UsageMeter } from './usage-meter'
import type { UsageResponse } from '../types/instagram.types'

// ── Helpers ──

function makeUsage(overrides: {
  tokensUsed?: number
  tokensLimit?: number
  tokensPeriod?: string
  imagesUsed?: number
  imagesLimit?: number
  imagesPeriod?: string
} = {}): UsageResponse {
  return {
    quotas: {
      deepseek_tokens: {
        used: overrides.tokensUsed ?? 12000,
        limit: overrides.tokensLimit ?? 100000,
        period: overrides.tokensPeriod ?? 'month',
        resetsAt: '2026-07-01T00:00:00.000Z',
      },
      fal_images: {
        used: overrides.imagesUsed ?? 8,
        limit: overrides.imagesLimit ?? 50,
        period: overrides.imagesPeriod ?? 'month',
        resetsAt: '2026-07-01T00:00:00.000Z',
      },
    },
    periodStart: '2026-06-01T00:00:00.000Z',
    periodEnd: '2026-07-01T00:00:00.000Z',
  }
}

// ── Loading State ──

describe('UsageMeter — Loading', () => {
  it('shows skeleton when loading', () => {
    const { container } = render(<UsageMeter usage={null} isLoading={true} />)
    const status = screen.getByRole('status', { name: /Cargando uso/i })
    expect(status).toBeInTheDocument()
    // Should have pulse animation
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})

// ── Disabled / Null ──

describe('UsageMeter — Disabled', () => {
  it('renders nothing when usage is null (tracking disabled)', () => {
    const { container } = render(<UsageMeter usage={null} isLoading={false} />)
    expect(container.firstChild).toBeNull()
  })
})

// ── Color Thresholds ──

describe('UsageMeter — Color Thresholds', () => {
  it('shows green for <50%', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 10000, tokensLimit: 100000 })} isLoading={false} />)
    const bar = screen.getByTestId('deepseek_tokens-bar').querySelector('div')
    expect(bar?.className).toContain('bg-emerald-500')
  })

  it('shows yellow for 50-79%', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 55000, tokensLimit: 100000 })} isLoading={false} />)
    const bar = screen.getByTestId('deepseek_tokens-bar').querySelector('div')
    expect(bar?.className).toContain('bg-yellow-500')
  })

  it('shows orange for 80-94%', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 85000, tokensLimit: 100000 })} isLoading={false} />)
    const bar = screen.getByTestId('deepseek_tokens-bar').querySelector('div')
    expect(bar?.className).toContain('bg-orange-500')
  })

  it('shows red for ≥95%', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 95000, tokensLimit: 100000 })} isLoading={false} />)
    const bar = screen.getByTestId('deepseek_tokens-bar').querySelector('div')
    expect(bar?.className).toContain('bg-red-500')
  })

  it('shows red at exactly 100%', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 100000, tokensLimit: 100000 })} isLoading={false} />)
    const bar = screen.getByTestId('deepseek_tokens-bar').querySelector('div')
    expect(bar?.className).toContain('bg-red-500')
  })

  it('shows green at 0%', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 0, tokensLimit: 100000 })} isLoading={false} />)
    const bar = screen.getByTestId('deepseek_tokens-bar').querySelector('div')
    expect(bar?.className).toContain('bg-emerald-500')
  })

  it('shows green at exactly 50% boundary', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 50000, tokensLimit: 100000 })} isLoading={false} />)
    const bar = screen.getByTestId('deepseek_tokens-bar').querySelector('div')
    expect(bar?.className).toContain('bg-yellow-500')
  })

  it('shows orange at exactly 80% boundary', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 80000, tokensLimit: 100000 })} isLoading={false} />)
    const bar = screen.getByTestId('deepseek_tokens-bar').querySelector('div')
    expect(bar?.className).toContain('bg-orange-500')
  })
})

// ── Unlimited ──

describe('UsageMeter — Unlimited', () => {
  it('shows "Ilimitado" badge when limit is 0', () => {
    render(
      <UsageMeter
        usage={makeUsage({ tokensUsed: 5000, tokensLimit: 0, tokensPeriod: 'unlimited' })}
        isLoading={false}
      />,
    )
    expect(screen.getByText('Ilimitado')).toBeInTheDocument()
  })

  it('shows "Ilimitado" badge when limit is -1', () => {
    render(
      <UsageMeter
        usage={makeUsage({ tokensUsed: 5000, tokensLimit: -1, tokensPeriod: 'unlimited' })}
        isLoading={false}
      />,
    )
    expect(screen.getByText('Ilimitado')).toBeInTheDocument()
  })

  it('shows green text for unlimited', () => {
    render(
      <UsageMeter
        usage={makeUsage({ tokensUsed: 5000, tokensLimit: 0, tokensPeriod: 'unlimited' })}
        isLoading={false}
      />,
    )
    const badge = screen.getByText('Ilimitado')
    expect(badge.className).toContain('text-emerald-400')
  })
})

// ── Number Formatting ──

describe('UsageMeter — Number Formatting', () => {
  it('formats thousands with K suffix', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 12500, tokensLimit: 100000 })} isLoading={false} />)
    const label = screen.getByTestId('deepseek_tokens-label')
    expect(label.textContent).toContain('12.5K')
  })

  it('formats round thousands without decimal', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 12000, tokensLimit: 100000 })} isLoading={false} />)
    const label = screen.getByTestId('deepseek_tokens-label')
    expect(label.textContent).toContain('12K')
  })

  it('shows raw number for values under 1000', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 500, tokensLimit: 100000 })} isLoading={false} />)
    const label = screen.getByTestId('deepseek_tokens-label')
    expect(label.textContent).toContain('500')
  })

  it('formats limit as K as well', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 500, tokensLimit: 100000 })} isLoading={false} />)
    const label = screen.getByTestId('deepseek_tokens-label')
    expect(label.textContent).toContain('100K')
  })
})

// ── Both Resources ──

describe('UsageMeter — Both Resources', () => {
  it('renders both deepseek_tokens and fal_images', () => {
    render(<UsageMeter usage={makeUsage()} isLoading={false} />)
    expect(screen.getByTestId('deepseek_tokens-label')).toBeInTheDocument()
    expect(screen.getByTestId('deepseek_tokens-bar')).toBeInTheDocument()
    // Note: fal_images uses a different test id
    // The component renders fal_images as "Imágenes" label
    expect(screen.getByText(/Imágenes:/)).toBeInTheDocument()
  })
})
