import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import AppProviders from "@/components/providers/AppProviders"
import AppShell from "@/components/layout/AppShell"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL("https://veritymarket.vercel.app"),
  title: "Verity | Opinions Backed by Conviction",
  description: "A social network where opinions can become markets.",
  applicationName: "Verity",
  keywords: [
    "Verity",
    "prediction markets",
    "social markets",
    "Arc testnet",
    "USDC",
    "community signals",
  ],
  icons: {
    icon: [{ url: "/icon", sizes: "64x64", type: "image/png" }],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Verity | Opinions Backed by Conviction",
    description:
      "Post claims, rally Upvote/Downvote signals, fund launch pools, and trade community-backed markets.",
    url: "https://veritymarket.vercel.app",
    siteName: "Verity",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Verity social prediction markets preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Verity | Opinions Backed by Conviction",
    description:
      "A social prediction network where posts become USDC-backed markets.",
    images: ["/twitter-image"],
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
      <body
        className="min-h-screen overflow-y-scroll bg-background text-foreground"
        suppressHydrationWarning
      >
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  )
}
