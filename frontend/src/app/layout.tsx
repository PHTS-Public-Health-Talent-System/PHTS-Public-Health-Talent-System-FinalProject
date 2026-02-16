import React from "react"
import type { Metadata } from 'next'
import { Sarabun } from 'next/font/google'
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/providers/auth-provider"
import { ReactQueryProvider } from "@/components/providers/query-provider"

import './globals.css'

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sarabun'
})

export const metadata: Metadata = {
  title: 'ระบบจัดการเงิน พ.ต.ส. | PTS Officer',
  description: 'ระบบจัดการเงินเพิ่มสำหรับตำแหน่งที่มีเหตุพิเศษ'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${sarabun.variable} font-sans antialiased`}>
        <ReactQueryProvider>
          <AuthProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              {children}
            </ThemeProvider>
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  )
}
