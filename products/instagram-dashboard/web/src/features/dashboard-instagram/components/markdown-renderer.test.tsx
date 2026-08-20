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

    for (const rule of ['[&_ol]:ml-4', '[&_ul]:list-disc', '[&_li]:mt-0.5']) {
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
})
