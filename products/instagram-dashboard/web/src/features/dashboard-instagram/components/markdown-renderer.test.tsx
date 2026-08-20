import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { MarkdownRenderer } from './markdown-renderer'

function containerOf(content: string): HTMLElement {
  const { container } = render(<MarkdownRenderer content={content} />)
  return container.firstElementChild as HTMLElement
}

describe('MarkdownRenderer', () => {
  /**
   * The styles were built as `'a' + 'b'`, and a fragment that did not end in a
   * space fused with the next one: `[&_p]:leading-relaxed[&_ol]:ml-4` is a
   * single invalid class, and Tailwind emits nothing for it. Half the rules
   * were dead, including the ones keeping wide content inside the bubble.
   *
   * The signature of the bug is a class token with `[&_` somewhere other than
   * the start — that can only be two selectors run together.
   */
  it('emits no class with two selectors run together', () => {
    const fused = containerOf('texto')
      .className.split(/\s+/)
      .filter((cls) => cls.lastIndexOf('[&_') > 0)

    expect(fused).toEqual([])
  })

  it('keeps the list rules that the fusing had swallowed', () => {
    const classes = containerOf('1. uno\n2. dos').className.split(/\s+/)

    for (const rule of ['[&_ol]:ml-4', '[&_ul]:list-disc', '[&_li]:mt-2']) {
      expect(classes).toContain(rule)
    }
  })

  /**
   * The visible complaint: a long reply ran past the panel and the words were
   * cut off by its edge.
   */
  it('breaks what cannot be wrapped rather than widening the bubble', () => {
    const classes = containerOf('texto').className.split(/\s+/)

    expect(classes).toContain('min-w-0')
    expect(classes).toContain('break-words')
  })

  it('gives code blocks and tables their own scroll', () => {
    const classes = containerOf('texto').className.split(/\s+/)

    expect(classes).toContain('[&_pre]:overflow-x-auto')
    expect(classes).toContain('[&_table]:overflow-x-auto')
  })

  it('still renders the markdown it is given', () => {
    render(<MarkdownRenderer content={'# Título\n\n1. primero'} />)

    expect(screen.getByRole('heading', { name: 'Título' })).toBeInTheDocument()
    expect(screen.getByText('primero')).toBeInTheDocument()
  })

  /**
   * The agent answers in numbered recommendations with a bold lead-in each.
   * Everything below serves that shape: the markers anchor, the items breathe,
   * and nothing tints itself the colour of the bubble it sits in.
   */
  describe('colour and hierarchy', () => {
    it('colours the list markers so they anchor rather than punctuate', () => {
      const classes = containerOf('1. uno').className.split(/\s+/)

      expect(classes).toContain('[&_ol]:marker:text-primary')
      expect(classes).toContain('[&_ul]:marker:text-primary')
    })

    it('separates list items that run several lines each', () => {
      const classes = containerOf('1. uno').className.split(/\s+/)

      expect(classes).toContain('[&_li]:mt-2')
      expect(classes).not.toContain('[&_li]:mt-0.5')
    })

    /**
     * `bg-muted` on inline code was invisible: the agent's bubble is `bg-muted`,
     * so the tint matched its own background exactly.
     */
    it('does not tint inline code the colour of the bubble it sits in', () => {
      const classes = containerOf('un `valor`').className.split(/\s+/)

      expect(classes).not.toContain('[&_code]:bg-muted')
      expect(classes).toContain('[&_code]:bg-foreground/10')
    })

    it('bands table rows, which are read across', () => {
      const classes = containerOf('texto').className.split(/\s+/)

      expect(classes).toContain('[&_tbody_tr:nth-child(even)]:bg-foreground/[0.04]')
    })

    /**
     * Every colour here is a theme token. A literal would look right in the
     * theme it was picked in and wrong in the other five.
     */
    it('uses no literal colours', () => {
      const literal = containerOf('texto')
        .className.split(/\s+/)
        .filter((cls) =>
          /#[0-9a-f]{3,8}/i.test(cls) ||
          // The palette name can follow a dash or a colon — `text-blue-500` as
          // readily as `:bg-red-500` — so anchor on the name, not on what
          // precedes it.
          /\b(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/i.test(cls),
        )
        // The code-block palette is deliberate: a dark box in either theme.
        .filter((cls) => !cls.startsWith('[&_pre'))

      expect(literal).toEqual([])
    })
  })
})

