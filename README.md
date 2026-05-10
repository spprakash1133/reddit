# ScoutReddit

Reddit lead generation tool — find conversations, draft replies, grow without ads.

Built with Next.js 14 (App Router), deployed on Vercel, payments via Dodo.

## Stack

- **Next.js 14** with the App Router
- **Vercel** for hosting (any Node host works)
- **Dodo Payments** for subscriptions (Starter / Pro)
- **Google OAuth** for sign-in
- **Reddit JSON API** (free, no key required)

## Quick start

```bash
git clone https://github.com/<your-username>/scoutreddit.git
cd scoutreddit
npm install
cp .env.example .env.local
# fill in .env.local with your real values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Add the environment variables from `.env.example` to the Vercel project settings.
4. Deploy. Vercel autodetects Next.js — no extra config needed.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DODO_API_KEY` | yes | From `app.dodopayments.com` → Settings → API Keys |
| `DODO_STARTER_PRODUCT_ID` | yes | Starter plan product ID (e.g. `pdt_...`) |
| `DODO_PRO_PRODUCT_ID` | yes | Pro plan product ID |
| `DODO_WEBHOOK_SECRET` | yes | For verifying webhook signatures |
| `DODO_MODE` | no | `live` or `test` (informational) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | yes | Google OAuth client ID |
| `NEXT_PUBLIC_SHEETS_URL` | no | Google Apps Script URL (signup logging) |
| `NEXT_PUBLIC_APP_URL` | yes | Public URL of your deployed site (used for Dodo `return_url`) |

## Routes

| Path | Purpose |
|---|---|
| `/` | Landing page |
| `/signup` | Sign up / log in |
| `/homepage` | Reddit app (requires login) |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| `/api/checkout` | Server-side Dodo subscription creation (POST) |
| `/api/webhook/dodo` | Dodo webhook receiver (signature-verified) |

## Dodo webhook setup

1. In the Dodo dashboard, set the webhook URL to `https://<your-domain>/api/webhook/dodo`.
2. Copy the webhook secret into `DODO_WEBHOOK_SECRET`.
3. Subscribe to events you care about (e.g. `payment.succeeded`, `subscription.active`, `subscription.cancelled`).

The handler verifies signatures using the [Standard Webhooks](https://www.standardwebhooks.com/) scheme that Dodo uses.

## Mobile

The site is mobile-first responsive: hero stacks on small screens, a hamburger menu replaces the desktop nav under 768px, and tap targets meet the 44px guidance.

## License

This project is provided as-is. Add a `LICENSE` file if you want to publish under a specific open-source license.
