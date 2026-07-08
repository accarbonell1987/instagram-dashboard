import React from 'react'
import { Document, Page, Text, renderToBuffer } from '@react-pdf/renderer'
import type { PdfAdapter, PdfGenerateParams } from './types.js'

export class ReactPdfAdapter implements PdfAdapter {
  async generate(params: PdfGenerateParams): Promise<Buffer> {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: 'A4' },
        React.createElement(Text, null, `${params.type}\n${JSON.stringify(params.data, null, 2)}`)
      )
    )
    const uint8 = await renderToBuffer(doc)
    return Buffer.from(uint8)
  }
}
