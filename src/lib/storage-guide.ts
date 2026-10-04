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
// PlanViewer.tsx) ne sont pas encore fournis par Nicolas : `planImage`
// reste vide, l'appli affiche "Plan a venir" en attendant (meme
// convention que emergency-guide.ts). Deposer les 4 images dans
// /public/images/plans/ et renseigner `planImage` ci-dessous suffira a
// les activer, sans toucher au reste du code.

export type StorageFloorId = 'rdc' | '1er' | '2e' | '3e'

export interface StorageFloor {
  id: StorageFloorId
  label: string
  planImage?: string
}

export const STORAGE_FLOORS: StorageFloor[] = [
  { id: 'rdc', label: 'RDC' /* plan suggere : /images/plans/rangement-rdc.jpg */ },
  { id: '1er', label: '1er etage' /* plan suggere : /images/plans/rangement-1er.jpg */ },
  { id: '2e', label: '2eme etage' /* plan suggere : /images/plans/rangement-2e.jpg */ },
  { id: '3e', label: '3eme etage' /* plan suggere : /images/plans/rangement-3e.jpg */ },
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
