import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "react-hot-toast"
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Verity | Admin Console",
  description: "Administrative moderation and deployment console for Verity.",
  applicationName: "Verity Admin",
  icons: {
    icon: [{ url: "/icon", sizes: "64x64", type: "image/png" }],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen antialiased bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  )
}
