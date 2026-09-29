// ============================================================
// Couleurs par personne — attribution déterministe, stable dans le temps.
//
// Principe (demandé par Nicolas le 19/09/2026) : chaque personne se voit
// attribuer UNE teinte, une fois, qui ne change plus jamais — calculée à
// partir de son RANG D'INSCRIPTION et stockée une fois pour toutes
// (colonne profiles.color_hue, ou table guest_people pour les
// accompagnants sans compte — voir plus bas).
//
// ⚠️ RÉÉCRITURE DU 29/09/2026 (demandée par Nicolas) : remplace le cercle
// chromatique continu (un angle en degrés, converti en oklch pastel à
// l'affichage) par une PALETTE DISCRÈTE de 50 teintes réelles par famille,
// choisies par Nicolas dans le nuancier "Argile" (image fournie) :
//   - VERT  (50 teintes) → LALANDE
//   - BLEU  (50 teintes) → CANAT
//   - ROUGE (50 teintes) → INVITÉS (family_group = 'friend')
// La colonne `color_hue` (en base comme dans les types TS) garde son nom
// pour ne pas avoir à renommer une colonne déjà en production ailleurs,
// mais contient désormais un INDEX DE PALETTE (0-49), plus un angle en
// degrés. Elle se lit toujours conjointement avec `family_group` (déjà
// présent sur `profiles` et `guest_people`), qui indique quelle palette
// utiliser. Une migration de recalcul est nécessaire pour les comptes déjà
// inscrits (voir supabase/migration_palette_couleurs.sql) — en attendant
// qu'elle soit appliquée par Louis, les anciennes valeurs (des degrés, pas
// des index) retombent simplement, via le modulo de colorForPaletteIndex
// ci-dessous, sur une teinte de la palette parmi 50 — pas la "bonne"
// (recalculée), mais jamais une erreur ni un plantage.
//
// Angle d'or (inchangé) : à l'intérieur d'une famille, chaque "unité"
// (une personne seule, ou tout un groupe de personnes très proches — voir
// nuclear_family plus bas) se voit attribuer un index de palette selon son
// rang parmi les unités déjà enregistrées dans sa famille, réparti via
// l'angle d'or (≈137,5°) pour ne jamais que deux unités voisines se
// ressemblent, même quand la famille grandit.
//
// Familles nucléaires (demandé par Nicolas le 29/09/2026) : au sein d'un
// même foyer proche (ex. Aurélie / Nicolas / Otto), les personnes doivent
// avoir des couleurs PROCHES plutôt que maximalement dispersées. Stockage :
// nouvelle colonne profiles.nuclear_family (texte libre, nullable) — un
// même texte pour tous les membres d'un même foyer. Le premier membre
// inscrit d'une famille nucléaire devient son "unité" au sens de l'angle
// d'or ci-dessus (index calculé normalement) ; chaque membre suivant de la
// même famille nucléaire réutilise cet index d'ancrage et s'en écarte
// juste un peu (voir nearbyIndex ci-dessous, même mécanisme que pour les
// accompagnants sans compte). Logique entièrement côté base (voir
// handle_new_user() dans la migration), rien à faire ici côté JS pour
// cette partie : ce fichier ne fait qu'exposer les fonctions de calcul
// communes, utilisées à la fois par la résolution d'affichage
// (src/app/dashboard/planning/page.tsx) et par l'attribution des
// accompagnants sans compte (src/app/api/bookings/quick/route.ts).
// ============================================================

import type { FamilyGroup } from '@/types'

export const GOLDEN_ANGLE_CONJUGATE = 0.6180339887498949

// Nombre de teintes par famille dans le nuancier "Argile" fourni par
// Nicolas le 29/09/2026 (capture "ARGILE · 3 FAMILLES DE 50 TEINTES") —
// lecture gauche à droite puis ligne suivante, donc index 0-24 = 1re
// ligne, 25-49 = 2e ligne, dans l'ordre exact de l'image.
export const PALETTE_SIZE = 50

// VERT → LALANDE
const LALANDE_PALETTE: readonly string[] = [
  '#E0DDD4', '#D5D3C0', '#C9CCB7', '#B0C9B4', '#B4B893',
  '#C8B976', '#C4AA33', '#C1B63A', '#B3AB36', '#919636',
  '#A49351', '#8A8254', '#81754B', '#797954', '#847D5E',
  '#968E6D', '#A1987B', '#BEB095', '#BFB49E', '#A5A28D',
  '#9C9686', '#939C8F', '#9CA089', '#8A9770', '#869176',
  '#827E72', '#7C7B79', '#777777', '#6F7B7B', '#686A67',
  '#575D5B', '#3F4843', '#2E3C3D', '#303B3D', '#243030',
  '#1D231F', '#444839', '#5C5948', '#5D6B5E', '#5F8C91',
  '#5B9189', '#83A79D', '#A5ABA9', '#BFC1B4', '#CAC7BD',
  '#CCD0D3', '#D5DED9', '#D1DCD8', '#C1DCDB', '#A7D5D4',
]

// BLEU → CANAT
const CANAT_PALETTE: readonly string[] = [
  '#E0E1DC', '#D5DED9', '#D1DCD8', '#D4D9D3', '#CDCFCA',
  '#CCD0D3', '#DBD4DB', '#D9DDE0', '#CBD4DD', '#C1DCDB',
  '#A7D5D4', '#B5CDD2', '#B3C0C8', '#B5C5D5', '#9DBBB3',
  '#9FB3BB', '#9DAEBD', '#9B9EB0', '#938AB8', '#546B94',
  '#3A4B6F', '#4F5263', '#303B3D', '#2E2F34', '#2D3037',
  '#2F2F37', '#2D2C34', '#182022', '#232A32', '#212F3E',
  '#334A58', '#425A6B', '#40626F', '#416679', '#51747E',
  '#6B797C', '#6F7B7B', '#737D7E', '#8891A2', '#9396A1',
  '#8B9AA2', '#93A1A4', '#A5ABA9', '#8FA3A4', '#83A79D',
  '#788F95', '#66838E', '#5F8C91', '#0197A4', '#079BC2',
]

// ROUGE → INVITÉS (family_group = 'friend')
const GUEST_PALETTE: readonly string[] = [
  '#FEF0E8', '#EAE0D7', '#E5DBD2', '#E7E0DA', '#E5DCD7',
  '#E3D9D9', '#E2D5CF', '#DBCBBE', '#E2D2C3', '#E8D7C3',
  '#F3CCBD', '#F3BBB6', '#D3A2A5', '#BB8E88', '#C39F92',
  '#B7A39C', '#BDACA4', '#A98877', '#B0A299', '#B39C9F',
  '#9E887D', '#A98877', '#A1837B', '#976E68', '#8D5B54',
  '#7D4B48', '#714A4F', '#794245', '#804444', '#995059',
  '#9A4344', '#9D3C3F', '#8F3E3E', '#793F33', '#703D3A',
  '#62322E', '#69383B', '#73343F', '#6B233B', '#80011F',
  '#B02020', '#CA6052', '#F69181', '#D3818A', '#C9A1C1',
  '#D9BEC3', '#D6C0C2', '#D4C6C3', '#DDC9C2', '#D5BFB7',
]

export const PALETTES: Record<FamilyGroup, readonly string[]> = {
  lalande: LALANDE_PALETTE,
  canat: CANAT_PALETTE,
  friend: GUEST_PALETTE,
}

/** Ramène x dans [0, width) — équivalent d'un modulo qui marche aussi en décimal et avec des nombres négatifs. */
function wrap(x: number, width: number): number {
  return x - width * Math.floor(x / width)
}

/**
 * Index de palette (0 à size-1) pour la n-ième "unité" (0-indexée, par
 * rang d'enregistrement) d'une famille — une personne seule, ou tout un
 * groupe de personnes proches partageant la même famille nucléaire compte
 * pour UNE SEULE unité (voir en-tête de ce fichier). Même formule utilisée
 * côté base (voir la migration de la palette) pour que le calcul reste
 * identique partout.
 */
export function indexForUnit(unitIndex: number, size: number = PALETTE_SIZE): number {
  return Math.floor(wrap(unitIndex * GOLDEN_ANGLE_CONJUGATE * size, size))
}

/** Couleur CSS (hex) pour un index de palette donné, dans une famille donnée. Index hors bornes ramené dans la palette par modulo (jamais d'erreur). */
export function colorForPaletteIndex(family: FamilyGroup, index: number): string {
  const palette = PALETTES[family]
  const i = ((Math.round(index) % palette.length) + palette.length) % palette.length
  return palette[i]
}

/** Hash simple et stable (djb2) d'une chaîne, pour retomber toujours sur le même nombre. */
function stableHash(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return hash >>> 0
}

/**
 * Index "proche" d'un index d'ancrage (ex. celui d'un autre membre de la
 * même famille nucléaire, ou pour un accompagnant sans compte, celui de la
 * personne qui a saisi son séjour) — proche mais distinct, décalage
 * déterministe tiré d'une graine (le nom), borné pour rester à quelques
 * teintes de l'ancrage plutôt qu'ailleurs dans la palette. maxOffset=3 sur
 * 50 teintes ≈ même proportion que l'ancien maxOffsetDeg=18 sur 360°.
 */
export function nearbyIndex(anchorIndex: number, seed: string, maxOffset = 3, size: number = PALETTE_SIZE): number {
  const h = stableHash(seed)
  // Répartit le hash sur [-1, 1], puis met à l'échelle du décalage max.
  const signedUnit = (h % 2000) / 1000 - 1
  const offset = Math.round(signedUnit * maxOffset)
  return wrap(Math.round(anchorIndex) + offset, size)
}

/**
 * Repli si une personne n'a, pour une raison ou une autre, aucune couleur
 * persistée (ex. données de test en développement, ou séjour saisi avant
 * la mise en place de ce système) : calculé à partir du nom, donc stable
 * tant que le nom ne change pas, mais PAS enregistré nulle part.
 */
export function fallbackIndexForName(name: string, size: number = PALETTE_SIZE): number {
  const h = stableHash(name.trim().toLowerCase())
  return h % size
}

/**
 * Couleur de repli pour un nom sans couleur persistée. `family` par défaut
 * à 'friend' (palette rouge) pour les appelants qui n'ont pas cette
 * information sous la main (ex. données de test, titres d'événements) —
 * ça n'a pas besoin d'être "la bonne" famille puisque cette couleur n'est
 * jamais enregistrée.
 */
export function colorForName(name: string, family: FamilyGroup = 'friend'): string {
  return colorForPaletteIndex(family, fallbackIndexForName(name))
}
