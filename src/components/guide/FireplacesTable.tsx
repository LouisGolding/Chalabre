import { Fragment } from 'react'

// Tableau "Cheminée" du Guide de la maison — remplace l'ancienne fiche à
// une seule cheminée (RDC - Bureau Antoine) par la liste complète des
// pièces équipées d'une cheminée dans la maison, groupées par zone puis
// par étage. Demandé par Nicolas le 29/09/2026 :
// - Pas de ligne verticale (uniquement des séparateurs horizontaux, sous
//   le nom de zone et sous le nom d'étage, pas sous le nom de pièce).
// - Zone en majuscules/gras, étage en majuscules/regular, pièce en
//   écriture normale (seule la première lettre est en majuscule).
// - 2 colonnes de statut : "Utilisable" / "Ne pas utiliser".
//
// Le statut par pièce (quelle case cocher) n'a pas été précisé par
// Nicolas — les deux colonnes sont donc laissées vides pour l'instant
// ("à compléter", même logique que le reste du Guide), à remplir une
// fois l'information communiquée.
interface Room {
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
      { label: 'R+1', rooms: [{ name: 'Salle à manger' }, { name: 'Salon' }] },
    ],
  },
  {
    label: 'Canat',
    floors: [
      { label: 'RDC', rooms: [{ name: 'Salle à manger' }] },
      { label: 'R+1', rooms: [{ name: 'Chambre Simone' }] },
    ],
  },
  {
    label: 'Lalande',
    floors: [
      { label: 'RDC', rooms: [{ name: "Bureau d'Antoine" }, { name: 'Salle à manger' }] },
      {
        label: 'R+2',
        rooms: [
          { name: 'Chambre Patrick' },
          { name: 'Chambre à colonnes' },
          { name: 'Chambre Mamita' },
          { name: 'Chambre Anglaise' },
          { name: 'Chambre aux oiseaux' },
        ],
      },
    ],
  },
]

export function FireplacesTable() {
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
              <td colSpan={3} className="border-b border-border pb-1 pt-3 font-bold uppercase text-foreground first:pt-1">
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
                {floor.rooms.map((room) => (
                  <tr key={room.name}>
                    <td className="py-1 pl-6 pr-2 font-normal text-foreground">{room.name}</td>
                    <td className="py-1 px-2 text-center text-muted-foreground">—</td>
                    <td className="py-1 pl-2 text-center text-muted-foreground">—</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}
