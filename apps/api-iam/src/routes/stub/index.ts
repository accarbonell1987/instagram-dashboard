import { createHmac } from 'crypto'
import { Hono } from 'hono'
import type { WebhookService } from '../../services/index.js'
import type { PaymentRepository } from '../../repositories/index.js'
import type { Config } from '../../config.js'

export function createStubBancardRouter(
  webhookService: WebhookService,
  paymentRepo: PaymentRepository,
  config: Config,
) {
  const router = new Hono()

  // Simulates Bancard's payment approval page in development.
  // Approves the payment, fires the webhook internally, then redirects
  // the user back to the Hub's payment verifying screen.
  router.get('/__stub/bancard/approve', async (c) => {
    const processId = c.req.query('process_id')
    if (!processId) {
      return c.text('Missing process_id', 400)
    }

    const payment = await paymentRepo.findByBancardProcessId(processId)
    if (!payment) {
      return c.text(`No payment found for process_id: ${processId}`, 404)
    }

    const payload = {
      process_id: processId,
      status: 'approved',
      response_code: '00',
      response_description: 'Stub approval',
      amount: payment.amount,
      authorization_number: 'STUB000',
      operation_date: new Date().toISOString(),
    }
    const rawBody = JSON.stringify(payload)
    const signature = createHmac('sha256', config.BANCARD_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex')

    await webhookService.processBancardWebhook({ rawBody, signature, payload })

    const hubUrl = new URL(config.BANCARD_RETURN_URL)
    const redirectTo = `${hubUrl.origin}/signup/${payment.draftId}/payment?status=verifying`
    return c.redirect(redirectTo, 302)
  })

  return router
}
