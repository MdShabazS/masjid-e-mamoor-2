import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'Masjid-e-Mamoor 2 | Administration', description: 'Transparent, accountable Masjid management.' }
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#f7f8f5' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html> }
