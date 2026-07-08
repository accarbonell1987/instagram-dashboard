export type PdfDocumentType = 'invoice' | 'contract'

export interface PdfGenerateParams {
  type: PdfDocumentType
  data: Record<string, unknown>
}

export interface PdfAdapter {
  generate(params: PdfGenerateParams): Promise<Buffer>
}
