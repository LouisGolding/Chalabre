// Configuration du widget "Rangement indications" (Guide de la maison,
// reserve aux comptes admin) et du moteur de recherche du widget
// "Organisation des placards" (ouvert a tous) -- demande par Nicolas le
// 04/10/2026.
//
// La maison est decoupee en 4 etages, chacun avec 12 emplacements de
// rangement numerotes (ex. "2.07" = etage 2, emplacement 7). Chaque
// emplacement peut recevoir un texte libre (ce qui y est range) et un
// cote de maison (Canat/Lalande) -- ce dernier point n'a pas ete demande
// mot pour mot par Nicolas, mais est necessaire pour que le filtre
// Canat/Lalande de la recherche ait un sens (confirme par Nicolas :
// "filtrer la recherche a ce cote de la maison"). Voir
// migration_storage_slots.sql pour le stockage (table `storage_slots`).
//
// Les plans d'etage (memes fonctionnalites que ceux du widget "Urgences"
// -- vignette au format reel, plein ecran, pincement pour zoomer, voir
// PlanViewer.tsx) ont ete fournis par Nicolas le 05/10/2026 pour le RDC,
// le 2e et le 3e etage (3 PDF AutoCAD/Illustrator) -- le 1er etage doit
// encore suivre, `planImage` reste donc vide pour `1er` en attendant,
// l'appli affiche "Plan a venir" (meme convention que
// emergency-guide.ts).
//
// Chaque PDF recu avait un titre ("DEUXIEME ETAGE", etc.) directement
// dessine dans le plan, mais pas de maniere harmonisee (tailles/graisses
// differentes d'un etage a l'autre -- le titre etait vectorise/detoure,
// pas du texte modifiable, donc impossible a corriger proprement dans le
// PDF lui-meme). A la demande de Nicolas le 05/10/2026, le titre a ete
// efface des images (voir le script utilise, non versionne, dans
// l'historique de conversation) et est desormais reecrit par l'appli
// elle-meme, sous chaque vignette, avec la meme esthetique que la
// pastille "Canat" du widget "Organisation des placards" (voir
// `viewTogglePillClass`, PlanThumbnail dans PlanViewer.tsx). Le champ
// `label` ci-dessous sert donc a la fois de texte affiche (ex. "Emplacement
// 2.07 -- Deuxieme etage") et de titre sous le plan -- plus besoin de
// garder le wording synchronise a deux endroits.

export type StorageFloorId = 'rdc' | '1er' | '2e' | '3e'

export interface StorageFloor {
  id: StorageFloorId
  label: string
  planImage?: string
}

export const STORAGE_FLOORS: StorageFloor[] = [
  { id: 'rdc', label: 'Rez-de-chaussée', planImage: '/images/plans/rangement-rdc.jpg' },
  { id: '1er', label: 'Premier étage', planImage: '/images/plans/rangement-1er.jpg' },
  { id: '2e', label: 'Deuxième étage', planImage: '/images/plans/rangement-2e.jpg' },
  { id: '3e', label: 'Troisième étage', planImage: '/images/plans/rangement-3e.jpg' },
]

export const SLOTS_PER_FLOOR = 12

export function storageFloorLabel(floor: StorageFloorId): string {
  return STORAGE_FLOORS.find((f) => f.id === floor)?.label ?? floor
}

// Cle stable d'un emplacement (ex. "2e-07"), utilisee a la fois comme
// identifiant React et comme `slot_key` en base -- meme convention que
// `room_key` dans FireplacesTable.tsx.
export function storageSlotKey(floor: StorageFloorId, slotNumber: number): string {
  return `${floor}-${String(slotNumber).padStart(2, '0')}`
}

// Numero affiche a l'ecran (ex. "2.07"), repris du format donne par
// Nicolas dans sa demande ("le chiffre 2.07").
export function storageSlotLabel(floor: StorageFloorId, slotNumber: number): string {
  const floorNumber: Record<StorageFloorId, string> = { rdc: '0', '1er': '1', '2e': '2', '3e': '3' }
  return `${floorNumber[floor]}.${String(slotNumber).padStart(2, '0')}`
}

export type HouseSideFilter = 'canat' | 'lalande'

export interface StorageSlotRow {
  slot_key: string
  floor: string
  slot_number: number
  house_side: HouseSideFilter | null
  content: string | null
}

// Normalisation simple (minuscules, sans accents) pour une recherche par
// mot-cle tolerante a la casse et aux accents -- "Draps" retrouve aussi
// bien "draps" que "DRAPS".
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

// Decoupe un texte normalise en mots (lettres/chiffres uniquement), pour
// comparer mot a mot plutot que la phrase entiere -- demande par Aurelie
// le 25/10/2026 : "si on cherche 'produit moustique', tu vas reconnaitre
// 'anti moustique'" (un seul mot en commun suffit, le reste de la phrase
// tapee n'a pas besoin de correspondre).
function tokenize(normalized: string): string[] {
  return normalized.split(/[^a-z0-9]+/).filter(Boolean)
}

// Mots-outils francais courants : sans valeur de recherche propre, et
// dangereux a matcher tels quels (cf. commentaire plus haut).
const STOPWORDS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'ou', 'a',
  'en', 'dans', 'pour', 'sur', 'avec', 'sans', 'ce', 'cette', 'ces',
  'mon', 'ma', 'mes', 'son', 'sa', 'ses', 'au', 'aux', 'ne', 'pas',
  'est', 'qui', 'que', 'd', 'l',
])

function commonPrefixLength(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

const FUZZY_MIN_PREFIX_LENGTH = 2

// Distance de Levenshtein (nombre minimal d'ajouts/suppressions/
// substitutions de lettres pour passer d'un mot a l'autre) -- utilisee
// ci-dessous pour tolerer les fautes de frappe (demande d'Aurelie : "si
// on tape 'moutic' (faute de frappe), tu reconnaitras 'moustique'").
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const curr = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[n]
}

// En dessous de ce ratio de similarite (1 = mots identiques, 0 = aucun
// point commun), deux mots sont consideres comme non lies. Le ratio est
// relatif a la longueur du plus long des deux mots : plus un mot est
// long, plus il tolere de lettres differentes avant de ne plus
// "ressembler" a l'original (coherent avec la tolerance aux fautes de
// frappe demandee -- un mot court (2-3 lettres) doit rester quasi exact,
// un mot long comme "moustique" tolere plusieurs lettres d'ecart).
// Valeur choisie (0.5) verifiee sur les exemples d'Aurelie du
// 25/10/2026 : "moutic"/"moustique" -> ~0.56 (match), "produit"/"anti"
// -> ~0.14 (pas de match, evite le bruit).
const FUZZY_SIMILARITY_THRESHOLD = 0.5

// En dessous de cette longueur, un mot est trop court pour que le ratio
// de similarite ci-dessous reste fiable (ex. "dr" et "de" n'ont qu'une
// lettre d'ecart sur 2, ratio 0.5, alors qu'ils n'ont aucun rapport) --
// seule la correspondance exacte/prefixe s'applique en dessous de ce
// seuil, le ratio approximatif seulement a partir de cette longueur.
const FUZZY_MIN_WORD_LENGTH = 4

// Deux mots "se repondent" si l'un contient l'autre (prefixe/sous-mot --
// couvre une recherche partielle volontaire, ex. "drap" dans "draps", ou
// "drap" tape pour "drap housse" retrouvant "draps" range seul), ou, pour
// des mots assez longs (FUZZY_MIN_WORD_LENGTH), si leur ratio de
// similarite depasse le seuil ci-dessus (couvre les fautes de frappe sur
// un mot complet, ex. "moutic" pour "moustique").
function wordsMatch(queryWord: string, contentWord: string): boolean {
  if (contentWord.includes(queryWord) || queryWord.includes(contentWord)) return true
  if (queryWord.length < FUZZY_MIN_WORD_LENGTH || contentWord.length < FUZZY_MIN_WORD_LENGTH) return false
  // Garde-fou (voir commentaire en tete de fichier, point 1) : une vraie
  // faute de frappe partage un debut de mot, une collision fortuite non.
  if (commonPrefixLength(queryWord, contentWord) < FUZZY_MIN_PREFIX_LENGTH) return false
  const maxLen = Math.max(queryWord.length, contentWord.length)
  const similarity = 1 - levenshtein(queryWord, contentWord) / maxLen
  return similarity >= FUZZY_SIMILARITY_THRESHOLD
}

export interface StorageSlotMatch {
  floor: StorageFloorId
  slotNumber: number
  slotLabel: string
  content: string
}

// Recherche les emplacements (d'un cote de maison donne) dont le texte
// libre contient un mot proche de celui tape -- demande par Nicolas le
// 04/10/2026 ("tu vas directement reconnaitre le mot et reconnaitre dans
// quel tableau il est marque"), rendue approximative le 25/10/2026 a la
// demande d'Aurelie (recherche "a la Google", tolerante aux mots
// partiels et aux fautes de frappe -- voir wordsMatch ci-dessus). Un
// SEUL mot de la recherche doit trouver une correspondance (pas besoin
// que toute la phrase tapee corresponde) : "produit moustique" retrouve
// "anti moustique" grace au seul mot "moustique", meme si "produit"
// n'apparait nulle part. Resultats tries par pertinence (nombre de mots
// de la recherche retrouves, le plus de correspondances en premier) --
// Array.prototype.sort est stable en JS moderne, l'ordre d'origine des
// emplacements a egalite de score est donc conserve. Recherche cote
// client, sur les donnees deja chargees cote serveur (pas d'appel reseau
// a chaque frappe).
export function searchStorageSlots(
  slots: StorageSlotRow[],
  query: string,
  houseSide: HouseSideFilter
): StorageSlotMatch[] {
  const rawQueryWords = tokenize(normalize(query.trim()))
  // On ignore les mots-outils (voir commentaire en tete de fichier,
  // point 2), sauf si la requete n'est faite QUE de mots-outils : dans
  // ce cas degenerescent, mieux vaut chercher ces mots tels quels que
  // ne rien chercher du tout.
  const withoutStopwords = rawQueryWords.filter((w) => !STOPWORDS.has(w))
  const queryWords = withoutStopwords.length > 0 ? withoutStopwords : rawQueryWords
  if (queryWords.length === 0) return []

  const scored = slots
    .filter((s) => s.house_side === houseSide && s.content)
    .map((s) => {
      const contentWords = tokenize(normalize(s.content as string))
      const matchedWords = queryWords.filter((qw) => contentWords.some((cw) => wordsMatch(qw, cw)))
      return { slot: s, score: matchedWords.length }
    })
    .filter(({ score }) => score > 0)

  scored.sort((a, b) => b.score - a.score)

  return scored.map(({ slot: s }) => ({
    floor: s.floor as StorageFloorId,
    slotNumber: s.slot_number,
    slotLabel: storageSlotLabel(s.floor as StorageFloorId, s.slot_number),
    content: s.content as string,
  }))
}

const SUGGESTION_LIMIT = 6

// Suggestions "a la Google" pendant la frappe (demande d'Aurelie le
// 25/10/2026 : "si on tape 'dr' tu fais une suggestion pour completer la
// phrase par des elements deja entres 'draps blancs'") : propose, pour
// le cote de maison selectionne, les textes DEJA ENREGISTRES (voir
// StorageSlotsAdmin.tsx) dont un mot commence par ce qui est tape --
// prefixe simple, pas la recherche approximative de searchStorageSlots
// ci-dessus (completer "dr" n'a pas besoin de tolerer les fautes de
// frappe, juste de retrouver le debut d'un mot). Chaque texte distinct
// n'apparait qu'une fois (plusieurs placards peuvent contenir le meme
// texte), et le texte deja tape tel quel n'est pas re-suggere.
export function suggestStorageContents(
  slots: StorageSlotRow[],
  query: string,
  houseSide: HouseSideFilter
): string[] {
  const trimmed = query.trim()
  const needle = normalize(trimmed)
  if (!needle) return []

  const seen = new Set<string>()
  const suggestions: string[] = []
  for (const s of slots) {
    if (s.house_side !== houseSide || !s.content) continue
    const content = s.content
    const normalizedContent = normalize(content)
    if (normalizedContent === needle) continue
    const key = normalizedContent
    if (seen.has(key)) continue
    const words = tokenize(normalizedContent)
    const matches = words.some((w) => w.startsWith(needle))
    if (!matches) continue
    seen.add(key)
    suggestions.push(content)
    if (suggestions.length >= SUGGESTION_LIMIT) break
  }
  return suggestions
}
