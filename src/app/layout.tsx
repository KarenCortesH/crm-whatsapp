import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Canal Seguro — el CRM de WhatsApp que no te bloquea el número',
  description: 'Bandeja compartida y monitor de salud para WhatsApp Business, con la API oficial de Meta.',
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0f766e' }

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
