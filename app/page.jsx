import LandingClient from '../components/LandingClient'
import Script from 'next/script'

export const metadata = { title: 'ScoutReddit — Reddit is your demand engine' }

export default function Home() {
  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/dodopayments-checkout@latest/dist/index.js" strategy="lazyOnload" />
      <LandingClient />
    </>
  )
}
