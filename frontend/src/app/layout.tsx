import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import '@rainbow-me/rainbowkit/styles.css'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import RightPanel from '@/components/layout/RightPanel'
import AppProviders from '@/components/providers/AppProviders'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Verity | Opinions Backed by Conviction',
  description: 'A social network where opinions can become markets.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen overflow-y-scroll bg-[var(--background)] text-[var(--foreground)]">
        <AppProviders>
          <div className="mx-auto flex min-h-screen justify-center gap-4 px-3">
            {/* Left Sidebar */}
            <header className="sticky top-0 hidden h-screen w-[80px] flex-shrink-0 flex-col py-3 sm:flex xl:w-[280px]">
              <Sidebar />
            </header>

            {/* Main Feed Content */}
            <main className="min-w-0 flex-1 max-w-[586px]">{children}</main>

            {/* Right Panel (Trending, Top Users) */}
            <aside className="sticky top-0 hidden h-screen w-[350px] flex-shrink-0 flex-col py-3 lg:flex">
              <RightPanel />
            </aside>
          </div>
        </AppProviders>
      </body>
    </html>
  )
}
