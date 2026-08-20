import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { ProfileHeader } from './profile-header'

import type { InstagramProfile } from '@/features/dashboard-instagram/types/instagram.types'


const profile = (overrides: Partial<InstagramProfile> = {}): InstagramProfile => ({
  username: 'tiomonopy',
  fullName: 'Tio Mono',
  avatarUrl: '',
  bio: '',
  website: undefined,
  isVerified: false,
  isBusiness: false,
  followersCount: 5776,
  followingCount: 0,
  postsCount: 283,
  ...overrides,
})

describe('ProfileHeader', () => {
  it('shows the counts the account is judged by', () => {
    render(<ProfileHeader profile={profile()} />)

    expect(screen.getByText('5.776')).toBeInTheDocument()
    expect(screen.getByText('283')).toBeInTheDocument()
  })

  /**
   * The badge said "Actualizado" and nothing else. Whether that meant a minute
   * ago or last Tuesday is the whole question when you are reading metrics off
   * it.
   */
  it('says when the account was last synced', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString()

    render(<ProfileHeader profile={profile()} lastSyncAt={tenMinutesAgo} rightContent={<span />} />)

    expect(screen.getByText(/Sincronizado hace 10 min/)).toBeInTheDocument()
  })

  it('says nothing about syncing when it has never synced', () => {
    render(<ProfileHeader profile={profile()} lastSyncAt={null} rightContent={<span />} />)

    expect(screen.queryByText(/Sincronizado/)).not.toBeInTheDocument()
  })

  /** A brand follows few and is followed by many — one number instead of two. */
  it('shows the follower ratio when there is one to show', () => {
    render(<ProfileHeader profile={profile({ followingCount: 100, followersCount: 5000 })} />)

    expect(screen.getByText('50.0×')).toBeInTheDocument()
  })

  it('omits the ratio rather than dividing by zero', () => {
    render(<ProfileHeader profile={profile({ followingCount: 0 })} />)

    expect(screen.queryByText(/×/)).not.toBeInTheDocument()
  })

  it('strips the scheme and www from the website', () => {
    render(<ProfileHeader profile={profile({ website: 'https://www.tiomono.py/promos' })} />)

    expect(screen.getByRole('link', { name: /tiomono\.py/ })).toBeInTheDocument()
    expect(screen.queryByText(/https:/)).not.toBeInTheDocument()
  })

  it('keeps an unparseable website rather than dropping it', () => {
    render(<ProfileHeader profile={profile({ website: 'tiomono.py' })} />)

    expect(screen.getByRole('link', { name: /tiomono\.py/ })).toBeInTheDocument()
  })

  it('marks a business account', () => {
    render(<ProfileHeader profile={profile({ isBusiness: true })} />)

    expect(screen.getByText('Empresa')).toBeInTheDocument()
  })

  /** An empty bio used to render an empty line that still took its space. */
  it('renders no bio line when there is no bio', () => {
    const { container } = render(<ProfileHeader profile={profile({ bio: '' })} />)

    expect(container.querySelector('.line-clamp-1')).toBeNull()
  })

  /**
   * Each member connects their own Instagram account, so the card showed a
   * handle with nothing saying which of your logins was looking at it — the
   * exact ambiguity behind "I see the same thing in both browsers".
   */
  describe('who it is connected under', () => {
    it('names the member', () => {
      render(
        <ProfileHeader
          profile={profile()}
          connectedBy={{ email: 'accarbonellpy@gmail.com', fullName: 'Alberto' }}
        />,
      )

      expect(screen.getByText('accarbonellpy@gmail.com')).toBeInTheDocument()
    })

    /**
     * Degrades quietly. The label comes from the platform API, and a dashboard
     * that refuses to render because that call blinked trades a small loss for
     * a total one.
     */
    it('says nothing when the lookup came back empty', () => {
      render(<ProfileHeader profile={profile()} connectedBy={null} />)

      expect(screen.queryByText(/Conectada por/)).not.toBeInTheDocument()
    })

    it('says nothing when no member was passed at all', () => {
      render(<ProfileHeader profile={profile()} />)

      expect(screen.queryByText(/Conectada por/)).not.toBeInTheDocument()
    })
  })
})

