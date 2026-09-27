import type { Metadata } from 'next'
import { EB_Garamond } from 'next/font/google'
import './globals.css'

// Police unique du site : EB Garamond, demandée par Nicolas le 27/09/2026
// pour remplacer Bahnschrift partout (d'abord utilisée seulement pour le
// logo "La Bâtisse" de la page de connexion, désormais généralisée à
// l'entièreté du site — Bahnschrift.ttf n'est plus importé nulle part).
// Chargée en graisse "variable" (axe 400-800, EB Garamond n'existe pas en
// dessous de 400) via next/font/google : Next.js télécharge et
// auto-héberge les fichiers de police au build, aucune requête vers
// Google au chargement de la page. Les graisses Tailwind se mappent
// directement sur l'axe de la police (font-normal=400, font-medium=500,
// font-semibold=600, font-bold=700, font-extrabold=800) — seul
// font-light (300, utilisé à quelques endroits) n'a pas d'équivalent
// plus fin que le Regular chez EB Garamond, le navigateur retombe donc
// sur 400 pour ces cas-là (limite de la police, pas un bug).
const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: 'variable',
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
    <html lang="fr" className={ebGaramond.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
