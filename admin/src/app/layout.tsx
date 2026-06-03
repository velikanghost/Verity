import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "react-hot-toast"

export const metadata: Metadata = {
  title: "Verity Admin Console",
  description: "Administrative moderation and deployment console for Verity.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  )
}
