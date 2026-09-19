import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

// Police unique du site : Bahnschrift (police variable, graisse 300 à 700),
// choisie par Aurélie pour remplacer Inter / Space Mono / Cormorant. Les
// variations Bold / Light se font via font-weight (font-bold, font-light…)
// grâce aux axes variables de la police.
const bahnschrift = localFont({
  src: '../fonts/Bahnschrift.ttf',
  variable: '--font-bahnschrift',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'La Bâtisse',
  description: 'Gestion de la maison familiale La Bâtisse à Chalabre',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={bahnschrift.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
