'use client'

import { useMemo, useState } from 'react'
import { PlanThumbnail, FullscreenPlanViewer } from '@/components/guide/PlanViewer'
import { viewTogglePillClass } from '@/lib/utils'
import {
  STORAGE_FLOORS,
  searchStorageSlots,
  storageFloorLabel,
  type HouseSideFilter,
  type StorageSlotRow,
} from '@/lib/storage-guide'

// Format reel des 3 plans recus de Nicolas le 05/10/2026 (RDC, 2e, 3e
// etage) : ~6200x2400px chacun, ratio tres proche d'un plan a l'autre
// (entre 2.56 et 2.62) sans etre strictement identique (contrairement
// aux 4 plans "Extincteurs", tous au meme format exact) -- une moyenne
// arrondie suffit, `object-contain` evite toute deformation visible quel
// que soit l'ecart. A ajuster si le futur plan du 1er etage a un format
// tres different.
const PLAN_ASPECT_RATIO = 2.6

// Widget "Organisation des placards" (Guide de la maison -> Organisation)
// -- demande par Nicolas le 04/10/2026, en plusieurs messages :
// - 2 pastilles CANAT/LALANDE (meme traitement que le selecteur de vue du
//   Planning, voir viewTogglePillClass) pour filtrer la recherche a ce
//   cote de la maison ("filtrer la recherche a ce cote de la maison",
//   confirme par Nicolas) ;
// - un encadre de recherche en dessous, traite esthetiquement comme le
//   champ "Titre" de "Partager ce qui a ete fait" (RealisationsBoard.tsx),
//   placeholder "Ex: draps blancs" ;
// - en tapant un mot (ex. "serviettes"), l'appli reconnait directement
//   dans quel emplacement numerote ce mot a ete ecrit par un admin (voir
//   widget "Rangement indications", StorageSlotsAdmin.tsx) et affiche,
//   sous l'encadre, le numero correspondant (ex. "2.07") et le plan de
//   l'etage concerne -- confirme par Nicolas : "le numero et le plan
//   devront s'afficher sous l'encadre editable du widget organisation
//   des placards". Recherche en direct (a chaque frappe), aucun appel
//   reseau : toutes les donnees sont deja chargees cote serveur (voir
//   guide/page.tsx) et passees en props.
//   05/10/2026, suite a une simulation visuelle demandee par Nicolas :
//   "Emplacement" renomme "Placard" ; le contenu trouve (ex. "Draps
//   blancs (lit double)") n'est plus reaffiche sous le titre du resultat
//   (deja visible dans l'encadre de recherche tape par l'utilisateur) ;
//   le titre d'etage n'est plus reecrit une seconde fois sous le plan
//   (deja present juste au-dessus, dans "Placard X -- <etage>") -- voir
//   PlanViewer.tsx, le prop `showTitle` ajoute pour cette demande a ete
//   retire aussitot, inutilise.
// - les memes fonctionnalites de plan que le widget "Urgences" (vignette
//   au format reel, plein ecran, pincement pour zoomer) sont reutilisees
//   a l'identique via PlanViewer.tsx -- demande explicite de Nicolas.
export function StorageOrganization({ slots }: { slots: StorageSlotRow[] }) {
  const [houseSide, setHouseSide] = useState<HouseSideFilter>('canat')
  const [query, setQuery] = useState('')
  const [fullscreenFloorId, setFullscreenFloorId] = useState<string | null>(null)

  const matches = useMemo(() => searchStorageSlots(slots, query, houseSide), [slots, query, houseSide])

  const fullscreenFloor = fullscreenFloorId
    ? STORAGE_FLOORS.find((f) => f.id === fullscreenFloorId) ?? null
    : null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button type="button" className={viewTogglePillClass(houseSide === 'canat')} onClick={() => setHouseSide('canat')}>
          Canat
        </button>
        <button type="button" className={viewTogglePillClass(houseSide === 'lalande')} onClick={() => setHouseSide('lalande')}>
          Lalande
        </button>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ex: draps blancs"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
      />

      {query.trim() !== '' && matches.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucun rangement ne correspond, côté {houseSide === 'canat' ? 'Canat' : 'Lalande'}.</p>
      )}

      {matches.map((match) => {
        const floor = STORAGE_FLOORS.find((f) => f.id === match.floor)
        return (
          <div key={`${match.floor}-${match.slotNumber}`} className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-foreground">
              Placard {match.slotLabel} — {storageFloorLabel(match.floor)}
            </p>
            {floor && (
              <PlanThumbnail
                level={floor}
                aspectRatio={PLAN_ASPECT_RATIO}
                altPrefix="Rangement"
                onToggle={() => setFullscreenFloorId(floor.id)}
              />
            )}
          </div>
        )
      })}

      {fullscreenFloor && (
        <FullscreenPlanViewer
          level={fullscreenFloor}
          aspectRatio={PLAN_ASPECT_RATIO}
          altPrefix="Rangement"
          onClose={() => setFullscreenFloorId(null)}
        />
      )}
    </div>
  )
}
