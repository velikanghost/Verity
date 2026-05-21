import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
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
      <body className="min-h-screen overflow-y-scroll bg-background text-foreground">
        <AppProviders>
          <div className="mx-auto flex min-h-screen w-full max-w-[1440px] justify-center gap-4 px-3 xl:gap-6 xl:px-6">
            {/* Left Sidebar */}
            <header className="sticky top-0 hidden h-screen w-[80px] shrink-0 flex-col py-3 sm:flex xl:w-[280px]">
              <Sidebar />
            </header>

            {/* Main Feed Content */}
            <main className="min-w-0 flex-1 max-w-[680px]">{children}</main>

            {/* Right Panel (Trending, Top Users) */}
            <aside className="sticky top-0 hidden h-screen w-[350px] shrink-0 flex-col py-3 lg:flex">
              <RightPanel />
            </aside>
          </div>
        </AppProviders>
      </body>
    </html>
  )
}
