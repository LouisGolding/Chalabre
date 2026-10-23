'use client'

import { useState } from 'react'
import { viewTogglePillClass } from '@/lib/utils'
import { PlanThumbnail, FullscreenPlanViewer } from '@/components/guide/PlanViewer'
import {
  STORAGE_FLOORS,
  SLOTS_PER_FLOOR,
  storageSlotKey,
  storageSlotLabel,
  type StorageFloorId,
  type StorageSlotRow,
  type HouseSideFilter,
} from '@/lib/storage-guide'

// Même ratio moyen que StorageOrganization.tsx (widget "Organisation des
// placards") pour les mêmes images de plan -- voir le commentaire
// d'origine là-bas pour le détail (~6200x2400px, ratio 2.56-2.62 d'un
// étage à l'autre, object-contain absorbe l'écart).

interface StorageSlotsAdminProps {
  initialSlots: StorageSlotRow[]
}

// Widget "Rangement indications" (Guide de la maison -> Organisation),
// reserve aux comptes admin -- demande par Nicolas le 04/10/2026. La
// maison est decoupee en 4 etages (pastilles RDC/1er/2e/3e, meme
// traitement que le selecteur de vue du Planning) x 12 emplacements
// numerotes chacun (2e ligne de pastilles, memes depend du RDC/etage
// selectionne). Une fois un etage ET un emplacement choisis (ex.
// RDC / 0.04), un encadre editable apparait -- traite esthetiquement
// comme le champ "Titre" de "Partager ce qui a ete fait" -- ou l'admin
// peut ecrire ou effacer librement ce qui est range a cet endroit.
// Chaque emplacement a aussi un cote de maison (Canat/Lalande), point
// ajoute par Claude (pas demande mot pour mot) pour que le filtre
// Canat/Lalande de la recherche du widget "Organisation des placards"
// (StorageOrganization.tsx) ait un sens -- a confirmer avec Nicolas.
//
// Enregistrement au blur du texte (pas a chaque frappe) : plus simple et
// plus fiable qu'un debounce, et laisse l'admin "ecrire ou supprimer
// tant qu'il veut" avant que quoi que ce soit ne parte au serveur.
//
// Plan de l'etage, affiche en bas du widget (23/10/2026, demande
// d'Aurelie : "fait apparaitre les plans de niveau reperage placards.
// quand on selectionne rez de chaussee, le plan du RDC apparait en bas
// du widget") -- memes images et memes fonctionnalites (vignette,
// plein ecran, pincement pour zoomer) que le widget "Organisation des
// placards" (StorageOrganization.tsx), via PlanViewer.tsx. `floor`
// valant toujours l'un des 4 etages (jamais null, voir useState plus
// bas), le plan s'affiche des l'ouverture du widget (RDC par defaut) et
// change des qu'un autre etage est choisi -- pas besoin d'un etat
// "aucun etage choisi".
const PLAN_ASPECT_RATIO = 2.6

export function StorageSlotsAdmin({ initialSlots }: StorageSlotsAdminProps) {
  const [slots, setSlots] = useState<Record<string, StorageSlotRow>>(() => {
    const map: Record<string, StorageSlotRow> = {}
    for (const s of initialSlots) map[s.slot_key] = s
    return map
  })
  const [floor, setFloor] = useState<StorageFloorId>('rdc')
  const [slotNumber, setSlotNumber] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullscreenPlan, setFullscreenPlan] = useState(false)

  const currentFloor = STORAGE_FLOORS.find((f) => f.id === floor)!

  const key = slotNumber !== null ? storageSlotKey(floor, slotNumber) : null
  const current = key ? slots[key] : undefined
  const content = current?.content ?? ''
  const houseSide: HouseSideFilter | null = current?.house_side ?? null

  const save = async (nextContent: string, nextHouseSide: HouseSideFilter | null) => {
    if (slotNumber === null) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/guide/storage-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ floor, slotNumber, houseSide: nextHouseSide, content: nextContent || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de l’enregistrement')
      const savedKey = storageSlotKey(floor, slotNumber)
      setSlots((prev) => ({
        ...prev,
        [savedKey]: {
          slot_key: savedKey,
          floor,
          slot_number: slotNumber,
          house_side: nextHouseSide,
          content: nextContent || null,
        },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-sm md:text-base font-medium uppercase tracking-wide text-muted-foreground">Étage</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {STORAGE_FLOORS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={viewTogglePillClass(floor === f.id)}
              onClick={() => {
                setFloor(f.id)
                setSlotNumber(null)
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm md:text-base font-medium uppercase tracking-wide text-muted-foreground">Emplacement</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {Array.from({ length: SLOTS_PER_FLOOR }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className={viewTogglePillClass(slotNumber === n)} onClick={() => setSlotNumber(n)}>
              {storageSlotLabel(floor, n)}
            </button>
          ))}
        </div>
      </div>

      {slotNumber !== null && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-foreground">
            Emplacement {storageSlotLabel(floor, slotNumber)}
          </p>

          <div>
            <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Côté de la maison</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                disabled={saving}
                className={viewTogglePillClass(houseSide === 'canat')}
                onClick={() => save(content, 'canat')}
              >
                Canat
              </button>
              <button
                type="button"
                disabled={saving}
                className={viewTogglePillClass(houseSide === 'lalande')}
                onClick={() => save(content, 'lalande')}
              >
                Lalande
              </button>
            </div>
          </div>

          <textarea
            key={key}
            defaultValue={content}
            onBlur={(e) => save(e.target.value, houseSide)}
            placeholder="Ex. : draps blancs, serviettes de bain…"
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none"
          />

          {saving && <p className="text-xs text-muted-foreground">Enregistrement…</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      <PlanThumbnail
        level={currentFloor}
        aspectRatio={PLAN_ASPECT_RATIO}
        altPrefix="Rangement"
        onToggle={() => setFullscreenPlan(true)}
      />

      {fullscreenPlan && (
        <FullscreenPlanViewer
          level={currentFloor}
          aspectRatio={PLAN_ASPECT_RATIO}
          altPrefix="Rangement"
          onClose={() => setFullscreenPlan(false)}
        />
      )}
    </div>
  )
}
