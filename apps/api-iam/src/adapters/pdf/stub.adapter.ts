import type { PdfAdapter, PdfGenerateParams, PdfDocumentType } from './types.js'

export class StubPdfAdapter implements PdfAdapter {
  async generate(params: PdfGenerateParams): Promise<Buffer> {
    return buildStubPdf(params.type, params.data)
  }
}

// ─── PDF builder ────────────────────────────────────────────────────────────────
// Generates a syntactically valid PDF 1.4 with a single visible page so that
// browsers can open and render it. Uses Type1/Helvetica (no font embedding).
//
// Structure:
//   obj 1 – Catalog
//   obj 2 – Pages tree
//   obj 3 – Page
//   obj 4 – Content stream
//   obj 5 – Font (Helvetica)

function pdfEscape(str: string): string {
  // Escape special chars in PDF string literals
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
    .slice(0, 200)
}

function buildStubPdf(type: PdfDocumentType, data: Record<string, unknown>): Buffer {
  const title = type === 'invoice' ? 'Factura (stub)' : 'Contrato (stub)'

  const lines = [
    title,
    `Empresa: ${String(data['tenantName'] ?? '')}`,
    `Email:   ${String(data['repEmail'] ?? '')}`,
    `Fecha:   ${String(data['date'] ?? '').slice(0, 10)}`,
    '',
    '-- DOCUMENTO DE DESARROLLO --',
    JSON.stringify(data).slice(0, 120),
  ]

  // Build content stream text
  let stream = 'BT\n/F1 12 Tf\n72 720 Td\n14 TL\n'
  for (const line of lines) {
    stream += `(${pdfEscape(line)}) Tj T*\n`
  }
  stream += 'ET\n'

  const streamBuf = Buffer.from(stream, 'latin1')

  // Build object bodies (without the leading "N 0 obj\n" – that's prepended below)
  const bodies = [
    `<<\n/Type /Catalog\n/Pages 2 0 R\n>>\n`,
    `<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\n`,
    `<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n/Resources << /Font << /F1 5 0 R >> >>\n>>\n`,
    `<<\n/Length ${streamBuf.length}\n>>\nstream\n${stream}endstream\n`,
    `<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n`,
  ]

  const header = Buffer.from('%PDF-1.4\n', 'latin1')
  let offset = header.length
  const offsets: number[] = []
  const objectBuffers: Buffer[] = []

  for (let i = 0; i < bodies.length; i++) {
    offsets.push(offset)
    const obj = Buffer.from(`${i + 1} 0 obj\n${bodies[i]}endobj\n`, 'latin1')
    objectBuffers.push(obj)
    offset += obj.length
  }

  const xrefOffset = offset

  // Build xref table — each entry is exactly 20 bytes: "nnnnnnnnnn ggggg x \n"
  const numEntries = bodies.length + 1 // +1 for the free entry 0
  const xrefLines = [`xref\n0 ${numEntries}\n`, '0000000000 65535 f \n']
  for (const off of offsets) {
    xrefLines.push(`${String(off).padStart(10, '0')} 00000 n \n`)
  }

  const trailer = `trailer\n<<\n/Size ${numEntries}\n/Root 1 0 R\n>>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.concat([
    header,
    ...objectBuffers,
    Buffer.from(xrefLines.join(''), 'latin1'),
    Buffer.from(trailer, 'latin1'),
  ])
}
