'use client'

import { Fragment, useState } from 'react'

// Tableau "Cheminées" du Guide de la maison — liste des pièces équipées
// d'une cheminée dans la maison, groupées par zone puis par étage.
// Demandé par Nicolas le 29/09/2026 :
// - Pas de ligne verticale (uniquement des séparateurs horizontaux, sous
//   le nom de zone et sous le nom d'étage, pas sous le nom de pièce).
// - Zone en majuscules/semi-gras, étage en majuscules/regular, pièce en
//   écriture normale (seule la première lettre est en majuscule).
// - 2 cases à cocher par ligne, "Utilisable" / "Ne pas utiliser",
//   mutuellement exclusives : une seule cochée par ligne, jamais les
//   deux, et une fois choisie elle ne peut plus repasser à "aucune" (on
//   ne peut que basculer sur l'autre case) — précisé par Nicolas le
//   29/09/2026. Éditables par les comptes admin uniquement, fixes pour
//   tous les autres (lecture seule) — voir /api/guide/fireplace-status
//   et migration_fireplace_status.sql. Tant qu'un admin n'a pas encore
//   fait son premier choix sur une ligne, aucune case n'est cochée
//   ("à compléter", pas de statut par défaut communiqué par Nicolas).
interface Room {
  key: string
  name: string
}

interface Floor {
  label: string
  rooms: Room[]
}

interface Zone {
  label: string
  floors: Floor[]
}

const ZONES: Zone[] = [
  {
    label: 'Commun',
    floors: [
      {
        label: 'R+1',
        rooms: [
          { key: 'commun-r1-salle-a-manger', name: 'Salle à manger' },
          { key: 'commun-r1-salon', name: 'Salon' },
        ],
      },
    ],
  },
  {
    label: 'Canat',
    floors: [
      { label: 'RDC', rooms: [{ key: 'canat-rdc-salon', name: 'Salon' }] },
      { label: 'R+1', rooms: [{ key: 'canat-r1-chambre-simone', name: 'Chambre Simone' }] },
    ],
  },
  {
    label: 'Lalande',
    floors: [
      {
        label: 'RDC',
        rooms: [
          { key: 'lalande-rdc-bureau-antoine', name: "Bureau d'Antoine" },
          { key: 'lalande-rdc-salle-a-manger', name: 'Salle à manger' },
        ],
      },
      {
        label: 'R+2',
        rooms: [
          { key: 'lalande-r2-chambre-patrick', name: 'Chambre Patrick' },
          { key: 'lalande-r2-chambre-colonnes', name: 'Chambre à colonnes' },
          { key: 'lalande-r2-chambre-mamita', name: 'Chambre Mamita' },
          { key: 'lalande-r2-chambre-anglaise', name: 'Chambre Anglaise' },
          { key: 'lalande-r2-chambre-oiseaux', name: 'Chambre aux oiseaux' },
        ],
      },
    ],
  },
]

type Status = 'usable' | 'not_usable' | null

interface FireplacesTableProps {
  isAdmin: boolean
  initialStatuses: Record<string, Status>
}

export function FireplacesTable({ isAdmin, initialStatuses }: FireplacesTableProps) {
  const [statuses, setStatuses] = useState<Record<string, Status>>(initialStatuses)
  const [pending, setPending] = useState<string | null>(null)

  // Toujours exactement une case cochée par ligne une fois choisie,
  // jamais zéro et jamais deux — demandé par Nicolas le 29/09/2026.
  // Cliquer sur la case déjà cochée ne fait donc rien (pas de "toggle
  // off") ; cliquer sur l'autre case de la ligne bascule directement
  // dessus.
  const toggle = async (roomKey: string, column: 'usable' | 'not_usable') => {
    if (!isAdmin) return
    const current = statuses[roomKey] ?? null
    if (current === column) return
    const next: Status = column

    const previous = statuses
    setStatuses((s) => ({ ...s, [roomKey]: next }))
    setPending(roomKey)
    try {
      const res = await fetch('/api/guide/fireplace-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomKey, status: next }),
      })
      if (!res.ok) throw new Error('Erreur lors de l’enregistrement')
    } catch {
      // Échec : on revient à l'état précédent plutôt que de laisser
      // l'écran mentir sur ce qui est réellement enregistré.
      setStatuses(previous)
    } finally {
      setPending(null)
    }
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          <th className="py-1.5 pr-2 text-left font-medium"> </th>
          <th className="py-1.5 px-2 text-center font-medium">Utilisable</th>
          <th className="py-1.5 pl-2 text-center font-medium">Ne pas utiliser</th>
        </tr>
      </thead>
      <tbody>
        {ZONES.map((zone) => (
          <Fragment key={zone.label}>
            <tr>
              <td colSpan={3} className="border-b border-border pb-1 pt-3 font-semibold uppercase text-foreground first:pt-1">
                {zone.label}
              </td>
            </tr>
            {zone.floors.map((floor) => (
              <Fragment key={floor.label}>
                <tr>
                  <td colSpan={3} className="border-b border-border py-1 pl-3 font-normal uppercase text-foreground">
                    {floor.label}
                  </td>
                </tr>
                {floor.rooms.map((room) => {
                  const status = statuses[room.key] ?? null
                  return (
                    <tr key={room.key}>
                      <td className="py-1 pl-6 pr-2 font-normal text-foreground">{room.name}</td>
                      <td className="py-1 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={status === 'usable'}
                          disabled={!isAdmin || pending === room.key}
                          onChange={() => toggle(room.key, 'usable')}
                          aria-label={`${room.name} — utilisable`}
                          className="h-4 w-4 accent-foreground disabled:cursor-default"
                        />
                      </td>
                      <td className="py-1 pl-2 text-center">
                        <input
                          type="checkbox"
                          checked={status === 'not_usable'}
                          disabled={!isAdmin || pending === room.key}
                          onChange={() => toggle(room.key, 'not_usable')}
                          aria-label={`${room.name} — ne pas utiliser`}
                          className="h-4 w-4 accent-foreground disabled:cursor-default"
                        />
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}
