import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Dodo signs webhooks using Standard Webhooks (https://www.standardwebhooks.com/).
// The signed payload is `${webhook-id}.${webhook-timestamp}.${rawBody}` and the
// signature header is a space-separated list of `v1,<base64-hmac-sha256>`.
//
// We require the raw request body to verify, so we read it as text first.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function timingSafeEqual(a, b) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

function verifyDodoSignature({ secret, id, timestamp, body, signatureHeader }) {
  if (!secret || !id || !timestamp || !signatureHeader) return false

  // Standard Webhooks: secret may be prefixed with "whsec_" — strip it before base64-decoding
  const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret
  let key
  try {
    key = Buffer.from(rawSecret, 'base64')
  } catch {
    key = Buffer.from(rawSecret, 'utf8')
  }

  const signed = `${id}.${timestamp}.${body}`
  const expected = crypto.createHmac('sha256', key).update(signed).digest('base64')

  // Header looks like: "v1,abc123 v1,def456" — any one match is enough
  const candidates = signatureHeader.split(' ')
  return candidates.some(part => {
    const [, sig] = part.split(',')
    return sig && timingSafeEqual(expected, sig)
  })
}

export async function POST(request) {
  try {
    const body = await request.text()
    const id = request.headers.get('webhook-id')
    const timestamp = request.headers.get('webhook-timestamp')
    const signatureHeader = request.headers.get('webhook-signature')

    const secret = process.env.DODO_WEBHOOK_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    const ok = verifyDodoSignature({ secret, id, timestamp, body, signatureHeader })
    if (!ok) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Reject payloads older than 5 minutes (replay-attack mitigation)
    const ts = parseInt(timestamp, 10)
    if (Number.isFinite(ts) && Math.abs(Date.now() / 1000 - ts) > 5 * 60) {
      return NextResponse.json({ error: 'Stale webhook' }, { status: 400 })
    }

    let event
    try { event = JSON.parse(body) } catch { event = {} }

    const type = event?.type || event?.event_type
    // Hand off to whatever your fulfillment logic is. For now we just log.
    // In production you'd update a DB / fire emails / sync to Sheets here.
    console.log('[dodo-webhook]', type, event?.data?.id || event?.id)

    return NextResponse.json({ received: true })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: 'dodo-webhook' })
}
