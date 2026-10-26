'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

interface TachesUrgentesPillProps {
  title: string
  lines: string[]
  overflowLabel: string | null
}

// Vitesse de frappe (ms par caractère) de l'effet "tapé à la machine" --
// un seul compteur de caractères tapés, partagé entre le titre, les
// lignes de tâches et le "+N" éventuel (dans cet ordre), plutôt qu'un
// hook par segment : le nombre de lignes peut varier d'un rendu à
// l'autre (tâches cochées/ajoutées), et les Hooks React ne tolèrent pas
// un nombre de hooks variable d'un rendu à l'autre dans une boucle.
const TYPE_SPEED_MS = 18

// Pastille "Tâches urgentes" de l'accueil (fusion des anciennes
// pastilles "Tâches urgentes" + "Tâche ce mois ci", voir
// dashboard/page.tsx) -- extraite en composant client le 26/10/2026 à la
// demande d'Aurélie, uniquement pour l'effet "tapé à la machine" qui
// doit jouer chaque fois qu'on arrive sur l'accueil, qu'on vienne d'un
// autre onglet ou de la page de connexion. Le Server Component
// (dashboard/page.tsx) calcule déjà les tâches à afficher ; ce composant
// se contente de les recevoir en props déjà formatées (title/lines/
// overflowLabel) et de les taper au montage via useEffect -- un Server
// Component ne peut pas animer sa propre apparition.
export function TachesUrgentesPill({ title, lines, overflowLabel }: TachesUrgentesPillProps) {
  const segments = useMemo(
    () => [title, ...lines, ...(overflowLabel ? [overflowLabel] : [])],
    [title, lines, overflowLabel]
  )
  // Signature texte (plutôt que la référence du tableau `segments`, qui
  // change à chaque rendu même à contenu identique) : sert à détecter un
  // vrai changement de contenu pour retaper depuis le début.
  const signature = segments.join('\u0000')
  const totalLength = useMemo(() => segments.reduce((sum, s) => sum + s.length, 0), [segments])

  const [typedCount, setTypedCount] = useState(0)
  const [prevSignature, setPrevSignature] = useState(signature)
  // Remise à zéro quand le contenu change (nouvelle tâche urgente
  // pendant que la page reste ouverte) -- ajustée pendant le rendu
  // (pattern recommandé par React pour réinitialiser un état dérivé
  // d'une prop), pas dans un effet : un appel à setState synchrone dans
  // le corps d'un effet déclenche des rendus en cascade.
  if (signature !== prevSignature) {
    setPrevSignature(signature)
    setTypedCount(0)
  }

  // Frappe lettre par lettre au montage (donc à chaque arrivée sur
  // l'accueil, la page étant remontée en changeant d'onglet ou en
  // arrivant depuis la connexion) -- le seul setState ici vit dans le
  // callback du minuteur, jamais appelé de façon synchrone dans le corps
  // de l'effet.
  useEffect(() => {
    if (totalLength === 0) return
    const interval = setInterval(() => {
      setTypedCount((n) => {
        if (n >= totalLength) {
          clearInterval(interval)
          return n
        }
        return n + 1
      })
    }, TYPE_SPEED_MS)
    return () => clearInterval(interval)
  }, [totalLength, signature])

  let remaining = typedCount
  const typedSegments = segments.map((s) => {
    const shown = s.slice(0, Math.max(0, remaining))
    remaining -= s.length
    return shown
  })
  const [typedTitle, ...rest] = typedSegments
  const typedLines = overflowLabel ? rest.slice(0, -1) : rest
  const typedOverflow = overflowLabel ? rest[rest.length - 1] : null

  return (
    <Link href="/dashboard/taches" className="mt-12 block w-fit">
      <p className="text-lg font-normal text-background md:text-xl">{typedTitle}</p>
      <div className="mt-2 space-y-1">
        {typedLines.map((line, i) => (
          <p key={i} className="text-xs font-extrabold uppercase tracking-[0.08em] text-background md:text-sm">
            {/* Petite croix occitane en guise de tiret devant chaque
                ligne (26/10/2026, demande d'Aurélie) : même icône que
                la poignée de TileNav (.icon-croix-occitane dans
                globals.css, mask-image sur croix-occitane.png,
                colorée via currentColor donc toujours assortie au
                texte). Dimension calée sur la hauteur d'une ligne de
                texte (1em) -- suit donc text-xs/md:text-sm sans classe
                séparée par breakpoint. N'apparaît qu'une fois la ligne
                commencée, pour arriver avec elle plutôt que de rester
                seule pendant la frappe. */}
            {line.length > 0 && (
              <span
                aria-hidden="true"
                className="icon-croix-occitane mr-1.5 inline-block h-[1em] w-[1em] shrink-0 align-[-0.15em]"
              />
            )}
            {line}
          </p>
        ))}
        {overflowLabel && (
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-background/70 md:text-sm">
            {typedOverflow}
          </p>
        )}
      </div>
    </Link>
  )
}
