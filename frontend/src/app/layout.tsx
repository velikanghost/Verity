import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import RightPanel from '@/components/layout/RightPanel'
import MobileNav from '@/components/layout/MobileNav'
import MobileComposeButton from '@/components/layout/MobileComposeButton'
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
  metadataBase: new URL('https://veritymarket.vercel.app'),
  title: 'Verity | Opinions Backed by Conviction',
  description: 'A social network where opinions can become markets.',
  applicationName: 'Verity',
  keywords: [
    'Verity',
    'prediction markets',
    'social markets',
    'Arc testnet',
    'USDC',
    'community signals',
  ],
  icons: {
    icon: [
      { url: '/icon', sizes: '64x64', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Verity | Opinions Backed by Conviction',
    description:
      'Post claims, rally Upvote/Downvote signals, fund launch pools, and trade community-backed markets.',
    url: 'https://veritymarket.vercel.app',
    siteName: 'Verity',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Verity social prediction markets preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Verity | Opinions Backed by Conviction',
    description:
      'A social prediction network where posts become USDC-backed markets.',
    images: ['/twitter-image'],
  },
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('verity-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen overflow-y-scroll bg-background text-foreground">
        <AppProviders>
          <div className="mx-auto flex min-h-screen w-full max-w-[1220px] justify-center gap-3 px-2 sm:px-3 xl:gap-6 xl:px-5">
            {/* Left Sidebar */}
            <header className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col py-4 sm:flex xl:w-[244px]">
              <Sidebar />
            </header>

            {/* Main Feed Content */}
            <main className="min-w-0 flex-1 max-w-[672px] pb-24 sm:pb-0">{children}</main>

            {/* Right Panel (Trending, Top Users) */}
            <aside className="sticky top-0 hidden h-screen w-[312px] shrink-0 flex-col py-4 lg:flex">
              <RightPanel />
            </aside>
          </div>
          <MobileComposeButton />
          <MobileNav />
        </AppProviders>
      </body>
    </html>
  )
}
