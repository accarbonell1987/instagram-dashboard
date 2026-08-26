import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Every overlay in the system dims the page the same way, so a dialog and a
 * sheet do not sit at different depths.
 *
 * Read from source rather than rendered: these overlays are Radix portals that
 * need an open root to exist at all, and what is being checked is the shared
 * decision, not one component's runtime.
 */
const OVERLAYS = [
  'components/atoms/dialog/dialog.tsx',
  'components/atoms/drawer/drawer.tsx',
  'components/molecules/sheet/sheet.tsx',
  'components/molecules/alert-dialog/alert-dialog.tsx',
]

const sourceOf = (relative: string): string =>
  readFileSync(join(here, '..', relative), 'utf8')

describe('overlay scrim', () => {
  it.each(OVERLAYS)('%s blurs what is behind it', (relative) => {
    expect(sourceOf(relative)).toContain('backdrop-blur-sm')
  })

  /**
   * The scrim was lightened *because* of the blur. Under 80% black nothing
   * shows through, so the filter would run fullscreen for no visible result —
   * one of the two had to give, and the darkness is the half that was doing the
   * work the blur now shares.
   */
  it.each(OVERLAYS)('%s leaves the blur something to blur', (relative) => {
    expect(sourceOf(relative)).not.toContain('bg-black/80')
  })

  it('dims every overlay by the same amount', () => {
    const scrims = OVERLAYS.map((relative) => {
      const match = /bg-black\/\d+/.exec(sourceOf(relative))
      return match?.[0]
    })

    expect(new Set(scrims).size).toBe(1)
    expect(scrims[0]).toBeDefined()
  })
})
