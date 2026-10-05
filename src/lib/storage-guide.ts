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
  { id: '1er', label: 'Premier étage' /* plan a venir : /images/plans/rangement-1er.jpg */ },
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

export interface StorageSlotMatch {
  floor: StorageFloorId
  slotNumber: number
  slotLabel: string
  content: string
}

// Recherche les emplacements (d'un cote de maison donne) dont le texte
// libre contient le mot tape -- demande par Nicolas le 04/10/2026 ("tu
// vas directement reconnaitre le mot et reconnaitre dans quel tableau il
// est marque"). Recherche cote client, sur les donnees deja chargees
// cote serveur (pas d'appel reseau a chaque frappe).
export function searchStorageSlots(
  slots: StorageSlotRow[],
  query: string,
  houseSide: HouseSideFilter
): StorageSlotMatch[] {
  const needle = normalize(query.trim())
  if (!needle) return []
  return slots
    .filter((s) => s.house_side === houseSide && s.content && normalize(s.content).includes(needle))
    .map((s) => ({
      floor: s.floor as StorageFloorId,
      slotNumber: s.slot_number,
      slotLabel: storageSlotLabel(s.floor as StorageFloorId, s.slot_number),
      content: s.content as string,
    }))
}
