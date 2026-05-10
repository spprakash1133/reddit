import { NextResponse } from 'next/server'

const DODO_BASE = 'https://live.dodopayments.com'
const PRODUCT_IDS = {
  starter: 'pdt_0NeOuZ2Dd8vo1838y0EKu',
  pro:     'pdt_0NeOuwMCbGZzOiiA6pyoi',
}
const APP_URL = 'https://scoutreddit.com'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    if (!process.env.DODO_API_KEY) {
      return NextResponse.json({ error: 'DODO_API_KEY is not configured' }, { status: 500 })
    }

    const { planId, email, name } = await request.json()
    if (!planId || !PRODUCT_IDS[planId]) {
      return NextResponse.json({ error: 'Invalid planId' }, { status: 400 })
    }

    const productId = PRODUCT_IDS[planId]
    const returnUrl = `${APP_URL}/homepage?payment=success&plan=${planId}`

    const res = await fetch(`${DODO_BASE}/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: productId,
        payment_link: true,
        quantity: 1,
        customer: {
          email: email || 'customer@example.com',
          name: name || 'Customer',
        },
        return_url: returnUrl,
        metadata: { plan: planId, source: 'web' },
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || `Dodo error ${res.status}` },
        { status: res.status }
      )
    }

    const url = data.payment_link || data.data?.payment_link
    if (!url) {
      return NextResponse.json({ error: 'No payment link returned' }, { status: 500 })
    }
    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
