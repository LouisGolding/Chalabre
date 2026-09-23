// Tolérance à l'erreur de saisie sur les noms (accompagnants sans compte,
// ex. "Otto Lalande") : demandé par Nicolas le 23/09/2026, pour qu'une
// faute de frappe ("Otot Lalanne") ne crée pas un second profil au lieu de
// retrouver la bonne personne ("Otto Lalande") déjà connue (profil existant
// ou déjà saisie une fois comme accompagnant — voir guest_people et
// src/app/api/bookings/quick/route.ts).
//
// Principe : on ne fait JAMAIS de correspondance floue entre deux noms
// qu'on n'a encore jamais vus tous les deux — uniquement entre le nom tel
// que saisi maintenant et un nom déjà connu (profil ou guest_people
// existant). Le tout premier enregistrement d'une personne fait donc
// toujours foi tel quel, fautes de frappe éventuelles comprises.

/** Enlève les accents, les espaces superflus et la casse. */
export function normalizeName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/**
 * Distance de Damerau-Levenshtein (substitutions, ajouts, suppressions ET
 * transpositions de deux lettres adjacentes comptées comme une seule
 * erreur — "otot" → "otto" ne coûte ainsi qu'1, pas 2) entre deux chaînes
 * déjà normalisées.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.length
  const bl = b.length
  if (al === 0) return bl
  if (bl === 0) return al

  const d: number[][] = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0))
  for (let i = 0; i <= al; i++) d[i][0] = i
  for (let j = 0; j <= bl; j++) d[0][j] = j

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // suppression
        d[i][j - 1] + 1, // ajout
        d[i - 1][j - 1] + cost // substitution
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1) // transposition
      }
    }
  }
  return d[al][bl]
}

/**
 * Tolérance : jusqu'à ~20% de la longueur du nom en erreurs (arrondi en
 * dessous), au moins 1, plafonné à 3 pour ne jamais fusionner deux noms
 * réellement différents (ex. "Otto Lalande" et "Otto Canat" restent
 * distincts : la différence porte sur un nom de famille entier, pas sur
 * une faute de frappe).
 */
function threshold(length: number): number {
  return Math.min(3, Math.max(1, Math.floor(length * 0.2)))
}

/**
 * Cherche, parmi une liste de noms déjà connus, celui qui correspond le
 * mieux au nom saisi — correspondance exacte (aux accents/espaces/casse
 * près) en priorité, sinon la plus petite distance d'édition si elle reste
 * sous le seuil de tolérance. Renvoie l'INDEX du candidat retenu dans
 * `candidates`, ou -1 si aucun ne correspond d'assez près.
 */
export function findClosestNameMatch(typedName: string, candidates: string[]): number {
  const typed = normalizeName(typedName)
  if (!typed) return -1

  let bestIndex = -1
  let bestDistance = Infinity

  for (let i = 0; i < candidates.length; i++) {
    const candidate = normalizeName(candidates[i])
    if (!candidate) continue
    if (candidate === typed) return i // correspondance exacte : on s'arrête là

    const dist = damerauLevenshtein(typed, candidate)
    if (dist <= threshold(Math.max(typed.length, candidate.length)) && dist < bestDistance) {
      bestDistance = dist
      bestIndex = i
    }
  }

  return bestIndex
}
