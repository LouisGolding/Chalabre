// ============================================================
// Couleurs par personne — attribution déterministe, stable dans le temps.
//
// Principe (demandé par Nicolas le 19/09/2026) : chaque personne se voit
// attribuer UNE teinte, une fois, qui ne change plus jamais. Contrairement
// à l'ancien système du planning (une couleur piochée dans un cycle fixe,
// selon l'ordre d'apparition dans la période affichée — donc instable
// d'une semaine/mois à l'autre pour la même personne), la teinte est ici
// calculée à partir du RANG D'INSCRIPTION de la personne et stockée une
// fois pour toutes (colonne profiles.color_hue, ou table guest_people pour
// les accompagnants sans compte — voir plus bas).
//
// Répartition : on place chaque teinte dans un arc du cercle chromatique
// grâce à l'angle d'or (≈137,5°), qui répartit les points le plus
// uniformément possible sans jamais qu'ils se ressemblent, même quand la
// famille grandit. Pour l'instant, tout le monde partage le même grand arc
// pastel (ACTIVE_HUE_RANGE ci-dessous). Le jour où Aurélie/Nicolas veulent
// activer une portion du cercle par famille (Lalande du vert au jaune,
// Canat du bleu au violet, amis du violet au jaune en passant par le
// rouge/orange — cf FUTURE_FAMILY_HUE_RANGES), il suffira de brancher ces
// arcs à la place d'ACTIVE_HUE_RANGE, sans toucher au reste du mécanisme.
// Ce jour-là, une migration de recalcul (par family_group cette fois) sera
// nécessaire pour les comptes déjà inscrits.
// ============================================================

export const GOLDEN_ANGLE_CONJUGATE = 0.6180339887498949

// Arc pastel partagé, utilisé pour tout le monde tant que les arcs par
// famille ne sont pas activés. 60°→320° : couvre vert, jaune, bleu, violet,
// en évitant la zone rouge/rose (0°-45° environ) déjà porteuse de sens
// ailleurs dans le site (--destructive est autour de 27°).
export const ACTIVE_HUE_RANGE = { start: 60, width: 260 }

// Prêt pour plus tard — non branché tant qu'Aurélie/Nicolas ne le demandent
// pas. Les amis passent par le rouge/orange (le « grand tour ») pour ne
// chevaucher ni Lalande ni Canat.
export const FUTURE_FAMILY_HUE_RANGES = {
  lalande: { start: 90, width: 60 }, // du jaune-vert au vert
  canat: { start: 250, width: 60 }, // du bleu au violet
  friend: { start: 310, width: 140 }, // du violet au jaune, via rouge/orange
} as const

// Luminosité et chroma fixes (harmonisées avec les teintes déjà utilisées
// sur le planning) : seule la teinte varie d'une personne à l'autre.
const LIGHTNESS = 0.86
const CHROMA = 0.045

/** Ramène x dans [0, width) — équivalent d'un modulo qui marche aussi en décimal. */
function wrap(x: number, width: number): number {
  return x - width * Math.floor(x / width)
}

/**
 * Teinte pour le n-ième membre (0-indexé, par ordre d'inscription) d'un
 * groupe. Même formule utilisée côté base (voir migration
 * migration_profile_colors.sql) pour que le calcul reste identique partout.
 */
export function hueForIndex(index: number, range: { start: number; width: number } = ACTIVE_HUE_RANGE): number {
  const offset = wrap(index * GOLDEN_ANGLE_CONJUGATE * range.width, range.width)
  return range.start + offset
}

/** Couleur CSS (oklch) prête à l'emploi pour une teinte donnée. */
export function oklchForHue(hue: number): string {
  return `oklch(${LIGHTNESS} ${CHROMA} ${hue.toFixed(1)})`
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
 * Teinte "proche" d'une teinte d'ancrage (ex. celle d'un parent), pour les
 * accompagnants sans compte (ex. Otto) — proche mais distincte, décalage
 * déterministe tiré du nom, borné pour rester reconnaissable comme "à côté"
 * de la personne d'ancrage plutôt qu'ailleurs sur le cercle.
 */
export function nearbyHue(anchorHue: number, seed: string, maxOffsetDeg = 18): number {
  const h = stableHash(seed)
  // Répartit le hash sur [-1, 1], puis met à l'échelle du décalage max.
  const signedUnit = (h % 2000) / 1000 - 1
  return wrap(anchorHue + signedUnit * maxOffsetDeg, 360)
}

/**
 * Repli si une personne n'a, pour une raison ou une autre, aucune couleur
 * persistée (ex. données de test en développement, ou séjour saisi avant
 * la mise en place de ce système) : calculée à partir du nom, donc stable
 * tant que le nom ne change pas, mais PAS enregistrée nulle part.
 */
export function fallbackHueForName(name: string): number {
  const h = stableHash(name.trim().toLowerCase())
  return ACTIVE_HUE_RANGE.start + (h % Math.round(ACTIVE_HUE_RANGE.width))
}

export function colorForName(name: string): string {
  return oklchForHue(fallbackHueForName(name))
}
