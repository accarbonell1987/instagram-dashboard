import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { UsageMeter } from './usage-meter'

import type { UsageResponse } from '@/features/dashboard-instagram/types/instagram.types'



// ── Helpers ──

function makeUsage(overrides: {
  tokensUsed?: number
  tokensLimit?: number
  tokensPeriod?: string
  imagesUsed?: number
  imagesLimit?: number
  imagesPeriod?: string
  messagesUsed?: number
  messagesLimit?: number
  messagesPeriod?: string
} = {}): UsageResponse {
  return {
    quotas: {
      chat_sessions: {
        used: overrides.messagesUsed ?? 4,
        limit: overrides.messagesLimit ?? 30,
        period: overrides.messagesPeriod ?? 'day',
        resetsAt: '2026-06-15T00:00:00.000Z',
      },
      llm_tokens: {
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
    const bar = screen.getByTestId('llm_tokens-bar').querySelector('div')
    expect(bar?.className).toContain('bg-emerald-500')
  })

  it('shows yellow for 50-79%', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 55000, tokensLimit: 100000 })} isLoading={false} />)
    const bar = screen.getByTestId('llm_tokens-bar').querySelector('div')
    expect(bar?.className).toContain('bg-yellow-500')
  })

  it('shows orange for 80-94%', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 85000, tokensLimit: 100000 })} isLoading={false} />)
    const bar = screen.getByTestId('llm_tokens-bar').querySelector('div')
    expect(bar?.className).toContain('bg-orange-500')
  })

  it('shows red for ≥95%', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 95000, tokensLimit: 100000 })} isLoading={false} />)
    const bar = screen.getByTestId('llm_tokens-bar').querySelector('div')
    expect(bar?.className).toContain('bg-red-500')
  })

  it('shows red at exactly 100%', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 100000, tokensLimit: 100000 })} isLoading={false} />)
    const bar = screen.getByTestId('llm_tokens-bar').querySelector('div')
    expect(bar?.className).toContain('bg-red-500')
  })

  it('shows green at 0%', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 0, tokensLimit: 100000 })} isLoading={false} />)
    const bar = screen.getByTestId('llm_tokens-bar').querySelector('div')
    expect(bar?.className).toContain('bg-emerald-500')
  })

  it('shows green at exactly 50% boundary', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 50000, tokensLimit: 100000 })} isLoading={false} />)
    const bar = screen.getByTestId('llm_tokens-bar').querySelector('div')
    expect(bar?.className).toContain('bg-yellow-500')
  })

  it('shows orange at exactly 80% boundary', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 80000, tokensLimit: 100000 })} isLoading={false} />)
    const bar = screen.getByTestId('llm_tokens-bar').querySelector('div')
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
    const label = screen.getByTestId('llm_tokens-label')
    expect(label.textContent).toContain('12.5K')
  })

  it('formats round thousands without decimal', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 12000, tokensLimit: 100000 })} isLoading={false} />)
    const label = screen.getByTestId('llm_tokens-label')
    expect(label.textContent).toContain('12K')
  })

  it('shows raw number for values under 1000', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 500, tokensLimit: 100000 })} isLoading={false} />)
    const label = screen.getByTestId('llm_tokens-label')
    expect(label.textContent).toContain('500')
  })

  it('formats limit as K as well', () => {
    render(<UsageMeter usage={makeUsage({ tokensUsed: 500, tokensLimit: 100000 })} isLoading={false} />)
    const label = screen.getByTestId('llm_tokens-label')
    expect(label.textContent).toContain('100K')
  })
})

// ── Both Resources ──

describe('UsageMeter — Both Resources', () => {
  it('renders both llm_tokens and fal_images', () => {
    render(<UsageMeter usage={makeUsage()} isLoading={false} />)
    expect(screen.getByTestId('llm_tokens-label')).toBeInTheDocument()
    expect(screen.getByTestId('llm_tokens-bar')).toBeInTheDocument()
    // Note: fal_images uses a different test id
    // The component renders fal_images as "Imágenes" label
    expect(screen.getByText(/Imágenes:/)).toBeInTheDocument()
  })
})

/**
 * The daily message cap is the one that actually runs out — 30 a day on
 * professional, 5 on starter — and the meter fetched it and then dropped it.
 * Someone hit the wall with nothing on screen having counted towards it.
 */
describe('UsageMeter — mensajes diarios', () => {
  it('shows the daily message count', () => {
    render(<UsageMeter usage={makeUsage({ messagesUsed: 12, messagesLimit: 30 })} isLoading={false} />)

    expect(screen.getByTestId('chat_sessions-label')).toHaveTextContent('Mensajes: 12/30')
  })

  it('puts messages first, ahead of the monthly resources', () => {
    render(<UsageMeter usage={makeUsage()} isLoading={false} />)

    const labels = screen.getAllByText(/Mensajes|Tokens|Imágenes/)
    expect(labels[0]).toHaveTextContent('Mensajes')
  })

  it('says the allowance is daily, not monthly', () => {
    render(<UsageMeter usage={makeUsage({ messagesUsed: 12, messagesLimit: 30 })} isLoading={false} />)

    expect(screen.getByTestId('chat_sessions-label').parentElement).toHaveAttribute(
      'title',
      'Mensajes: 12 / 30 por día',
    )
  })

  it('colours the bar red as the daily cap is reached', () => {
    render(<UsageMeter usage={makeUsage({ messagesUsed: 29, messagesLimit: 30 })} isLoading={false} />)

    const bar = screen.getByTestId('chat_sessions-bar').querySelector('div')
    expect(bar?.className).toContain('bg-red-500')
  })

  it('shows unlimited without a bar', () => {
    render(
      <UsageMeter
        usage={makeUsage({ messagesLimit: -1, messagesPeriod: 'unlimited' })}
        isLoading={false}
      />,
    )

    expect(screen.queryByTestId('chat_sessions-bar')).not.toBeInTheDocument()
  })
})

/**
 * The web and the API deploy separately, so a response can predate a resource
 * this build knows about. Reading `.limit` off the missing entry threw inside
 * the map and took the whole agent panel down with it.
 */
describe('UsageMeter — a resource the response does not carry', () => {
  it('skips it instead of throwing', () => {
    const usage = makeUsage()
    // As an older API would answer.
    delete (usage.quotas as Partial<UsageResponse['quotas']>).chat_sessions

    expect(() => render(<UsageMeter usage={usage} isLoading={false} />)).not.toThrow()
  })

  it('still shows the resources it did receive', () => {
    const usage = makeUsage()
    delete (usage.quotas as Partial<UsageResponse['quotas']>).chat_sessions

    render(<UsageMeter usage={usage} isLoading={false} />)

    expect(screen.getByTestId('llm_tokens-label')).toBeInTheDocument()
    expect(screen.queryByTestId('chat_sessions-label')).not.toBeInTheDocument()
  })
})

