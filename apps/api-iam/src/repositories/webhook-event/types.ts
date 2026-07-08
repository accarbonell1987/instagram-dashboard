export interface WebhookEventRepository {
  insertEvent(data: {
    source: string
    processId: string
    status: string
    rawBody: unknown
  }): Promise<boolean>
}
