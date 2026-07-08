import { describe, it, expect } from 'vitest'
import { baseLayout, ctaButton } from './base-layout.js'

describe('baseLayout', () => {
  it('wraps content in branded header and footer', () => {
    const html = baseLayout('<p>Hello</p>')

    expect(html).toContain('Corehub')
    expect(html).toContain('© 2025 Corehub. Todos los derechos reservados.')
    expect(html).toContain('<p>Hello</p>')
  })

  it('does not contain any <style> blocks', () => {
    const html = baseLayout('<p>Test</p>')

    expect(html).not.toContain('<style')
  })

  it('includes XHTML DOCTYPE', () => {
    const html = baseLayout('<p>Test</p>')

    expect(html).toContain('<!DOCTYPE html PUBLIC')
    expect(html).toContain('xhtml1-transitional')
  })

  it('has lang="es"', () => {
    const html = baseLayout('<p>Test</p>')

    expect(html).toContain('lang="es"')
  })

  it('uses zinc-900 header background', () => {
    const html = baseLayout('<p>Test</p>')

    expect(html).toContain('background-color:#18181b')
  })

  it('includes hidden preview text span when previewText is provided', () => {
    const html = baseLayout('<p>Test</p>', { previewText: 'Preview snippet here' })

    expect(html).toContain('Preview snippet here')
    expect(html).toContain('display:none')
    expect(html).toContain('max-height:0')
  })

  it('does not include preview span when previewText is not provided', () => {
    const html = baseLayout('<p>Test</p>')

    expect(html).not.toContain('mso-hide:all')
  })
})

describe('ctaButton', () => {
  it('renders amber CTA button with correct colors', () => {
    const html = ctaButton('Click me', 'https://example.com')

    expect(html).toContain('background-color:#f59e0b')
    expect(html).toContain('color:#000000')
    expect(html).toContain('https://example.com')
    expect(html).toContain('Click me')
  })

  it('wraps in table for Outlook compatibility', () => {
    const html = ctaButton('Go', 'https://test.com')

    expect(html).toContain('<table')
    expect(html).toContain('<a href="https://test.com"')
    expect(html).toContain('border-radius:8px')
  })
})
