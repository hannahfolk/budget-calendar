import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'

export const metadata: Metadata = {
  title: 'Budget Calendar - Financial Spreadsheet',
  description: 'Track your income and expenses with a beautiful spreadsheet interface',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
