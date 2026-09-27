import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { EB_Garamond } from 'next/font/google'
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

// EB Garamond — demandée par Nicolas le 27/09/2026 pour le logo/wordmark
// "La Bâtisse" (graisse Regular uniquement pour l'instant), en plus de
// Bahnschrift qui reste la police du reste du site. Chargée via
// next/font/google : Next.js télécharge et auto-héberge les fichiers de
// police au build, aucune requête vers Google au chargement de la page.
const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-eb-garamond',
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
    <html lang="fr" className={`${bahnschrift.variable} ${ebGaramond.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
