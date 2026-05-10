import './globals.css'

export const metadata = {
  title: 'ScoutReddit — Reddit is your demand engine',
  description: 'Find conversations, drop replies that convert, grow without ads.',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'ScoutReddit — Reddit is your demand engine',
    description: 'Find conversations, drop replies that convert, grow without ads.',
    type: 'website',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#07090F',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,900;1,700;1,900&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/style.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-mono/style.css" />
      </head>
      <body>{children}</body>
    </html>
  )
}
