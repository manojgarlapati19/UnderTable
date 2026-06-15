import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { ThemeProvider } from 'next-themes'
import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'

// Local font assets (kept in /src/app/fonts/). Loading them via `next/font/local`
// gives us self-hosted, privacy-friendly, zero-FOIT typography and exposes the
// CSS variables `var(--font-geist-sans)` and `var(--font-geist-mono)` that
// `tailwind.config.ts` already references.
const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  display: 'swap',
  weight: '100 900',
})

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  display: 'swap',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'UnderTable',
  description: 'Anonymous office chat for Table Top Tech',
  applicationName: 'UnderTable',
  authors: [{ name: 'Table Top Tech' }],
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#0C0B1C',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  )
}
