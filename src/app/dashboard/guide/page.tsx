import { PageTitle } from '@/components/layout/PageTitle'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EmergencyGuide } from '@/components/guide/EmergencyGuide'
import { EMERGENCY_CATEGORIES } from '@/lib/emergency-guide'
import { GasBottlesCard } from '@/components/guide/GasBottlesCard'
import { GuideCard } from '@/components/guide/GuideCard'
import { GuideAccordionProvider } from '@/components/guide/GuideAccordionContext'
import { FireplacesTable } from '@/components/guide/FireplacesTable'
import { StorageOrganization } from '@/components/guide/StorageOrganization'
import { StorageSlotsAdmin } from '@/components/guide/StorageSlotsAdmin'
import type { StorageSlotRow } from '@/lib/storage-guide'

// Widget temporairement masqué à la demande de Nicolas le 29/09/2026 —
// le contenu / la logique restent en place (données, requêtes, imports),
// prêt à être réaffiché en repassant cette constante à true. "Arrivée" a
// été remasqué puis, plus tard le même jour, redemandé avec un nouveau
// contenu (gares/taxis, voir "Avant votre arrivée" ci-dessous) — repassé
// à true à ce moment-là.
const SHOW_ARRIVEE_SECTION = true
const SHOW_GAS_BOTTLES = false
// Widget "Draps et linge" temporairement masque a la demande de Nicolas
// le 05/10/2026 -- meme convention que SHOW_GAS_BOTTLES ci-dessus : le
// contenu reste dans guideContent, pret a etre reaffiche en repassant
// cette constante a true.
const SHOW_DRAPS_LINGE = false
// Widget "Fuite d'eau" (Urgences) temporairement masque a la demande de
// Nicolas le 05/10/2026 -- meme convention : la categorie reste dans
// EMERGENCY_CATEGORIES (emergency-guide.ts), simplement filtree avant
// d'etre passee a <EmergencyGuide>, prete a etre reaffichee en repassant
// cette constante a true.
const SHOW_FUITE_EAU = false

const guideContent: { category: string; items: { title: string; content: ReactNode }[] }[] = [
  {
    category: 'Arrivée',
    items: [
      {
        title: 'Avant votre arrivée',
        // Gares les plus proches + taxi local, donnés par Nicolas le
        // 29/09/2026 (remplace "Ouverture de la maison", qui restait
        // "à compléter" depuis le début). Les deux sous-titres partagent
        // la même graisse (normale) depuis le 30/09/2026 -- harmonisation
        // typo, voir "Typographie La Batisse.pdf".
        content: (
          <div className="space-y-3">
            <div>
              <p className="text-sm md:text-base font-normal uppercase text-foreground">Gares les plus proches</p>
              <p>Limoux - 25 km</p>
              <p>Pamiers - 43 km</p>
              <p>Carcassonne - 50 km</p>
              <p>Toulouse Matabiau - 110 km</p>
            </div>
            <div>
              <p className="text-sm md:text-base font-normal uppercase text-foreground">Taxis</p>
              <p>
                Taxis du Kercorb - <a href="tel:0681787587" className="underline">06 81 78 75 87</a>
              </p>
            </div>
          </div>
        ),
      },
    ]
  },
  {
    category: 'Départ',
    items: [
      {
        title: 'Maison encore occupée',
        content: [
          '1. Lavez / séchez / rangez vos draps',
          '2. Faites le ménage de votre chambre à fond : poussière au-dessus / en dessous des meubles. Passez l\'aspirateur partout / sous le lit / sur les plinthes.',
          '3. Replacez 2 oreillers, 1 couette pliée en 4 sur le lit',
          '4. Replacez votre couvre-lit',
          '5. Fermez vos volets',
          '6. Fermez vos fenêtres',
          '7. Fermez la porte de la chambre correctement',
        ].join('\n'),
      },
      {
        title: 'Dernier occupant',
        content: [
          // "ait" -> "a" (faute de conjugaison : "vérifiez que" appelle
          // l'indicatif, pas le subjonctif) + nouvel item 4 "Videz les
          // poubelles de la souillarde", numéros suivants décalés —
          // demandé par Nicolas le 29/09/2026.
          '1. Mêmes actions pour votre chambre',
          '2. Vérifiez que chaque chambre a un couvre-lit, des volets et fenêtres fermées',
          '3. Videz les 3 réfrigérateurs (Cave / Cuisine RDC / Cuisine 2ème)',
          '4. Videz les poubelles de la souillarde',
          '5. Rentrez et rangez le mobilier de jardin',
          '6. Prévoyez un passage de la femme de ménage si nécessaire',
        ].join('\n'),
      },
    ]
  },
  {
    category: 'Organisation',
    items: [
      {
        title: 'Draps et linge',
        content: 'Vos draps doivent être lavés, pliés et rangés avant votre départ.',
      },
      {
        title: 'Poubelles',
        content: 'Les poubelles sont à déposer à l\'entrée du village, après le pont, ou bien au Cazal.',
      },
      {
        title: 'Déchetterie',
        // "Juillet / Août" et "Le reste de l'année" en majuscules, graisse
        // normale depuis le 30/09/2026 (harmonisation typo, voir
        // "Typographie La Batisse.pdf"). Contenu enrichi (plus une simple
        // chaîne) : voir GuideCard/content en ReactNode.
        content: (
          <div className="space-y-3">
            <div>
              <p className="text-sm md:text-base font-normal uppercase text-foreground">Juillet / Août :</p>
              <p>· Mardi au vendredi de 8h à 13h30</p>
              <p>· Samedi de 8h à 12h</p>
            </div>
            <div>
              <p className="text-sm md:text-base font-normal uppercase text-foreground">Le reste de l&apos;année :</p>
              <p>· Mardi 13h-16h30</p>
              <p>· Mercredi, jeudi et vendredi 9h30-12h30 et 13h-16h30</p>
              <p>· Samedi 9h30-12h30</p>
            </div>
            <p>Se munir de la carte Nomitaove pour accéder à la déchetterie.</p>
          </div>
        ),
      },
    ]
  },
]

export default async function GuidePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: contacts } = await supabase.from('contacts').select('*')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  // "Bouteilles de gaz" : modifiable par tout compte famille ou admin,
  // jamais les amis — demandé par Aurélie le 22/09/2026. Widget masqué
  // pour le moment (voir SHOW_GAS_BOTTLES) mais logique conservée.
  const canEditGasBottles = profile?.role === 'admin' || profile?.role === 'family'
  // Tout l'onglet Guide sera à terme éditable par les comptes admin
  // uniquement, fixe pour tous les autres — demandé par Nicolas le
  // 29/09/2026. Premier widget concerné : "Cheminées" (voir plus bas).
  const isAdmin = profile?.role === 'admin'

  const { data: gasBottlesStatus } = await supabase
    .from('gas_bottles_status')
    .select('count, last_refill_date')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: fireplaceRows } = await supabase.from('fireplace_status').select('room_key, status')
  const fireplaceStatuses: Record<string, 'usable' | 'not_usable' | null> = {}
  for (const row of fireplaceRows ?? []) {
    fireplaceStatuses[row.room_key] = row.status as 'usable' | 'not_usable' | null
  }

  const { data: storageSlotRows } = await supabase
    .from('storage_slots')
    .select('slot_key, floor, slot_number, house_side, content')
  const storageSlots: StorageSlotRow[] = storageSlotRows ?? []

  const arriveeItems = guideContent.find((c) => c.category === 'Arrivée')!.items
  const departItems = guideContent.find((c) => c.category === 'Départ')!.items
  const organisationItems = guideContent.find((c) => c.category === 'Organisation')!.items
  // "Bouteilles de gaz" est un widget éditable (voir GasBottlesCard),
  // inséré juste après "Déchetterie" — ordre demandé par Aurélie.
  const dechetterieIndex = organisationItems.findIndex((item) => item.title === 'Déchetterie')
  const organisationBeforeGas = organisationItems.slice(0, dechetterieIndex + 1)
  const organisationAfterGas = organisationItems.slice(dechetterieIndex + 1)
  // "Organisation des placards"/"Rangement indications" (voir plus bas)
  // reprennent exactement la place de l'ancienne pastille statique
  // "Zoning des placards" : juste après "Draps et linge", avant
  // "Poubelles" -- donc avant "Déchetterie" lui aussi, pas après.
  const drapsIndex = organisationBeforeGas.findIndex((item) => item.title === 'Draps et linge')
  const organisationBeforePlacards = organisationBeforeGas.slice(0, drapsIndex + 1)
  const organisationAfterPlacards = organisationBeforeGas.slice(drapsIndex + 1)

  return (
    // Un seul widget repliable ouvert à la fois sur toute cette page --
    // demandé par Nicolas le 06/10/2026, voir GuideAccordionContext.tsx
    // et le commentaire en tête de GuideCard.tsx pour le détail.
    <GuideAccordionProvider>
    <div className="space-y-6 max-w-3xl">
      <PageTitle>Guide de la maison</PageTitle>

      {/* Adresse de la maison — reprise ici depuis l'ancien onglet "Adresse"
          (retiré le 19/09/2026, jugé redondant par Nicolas une fois cette
          info replacée juste sous le titre du Guide). Contenu statique :
          l'adresse ne change pas, pas besoin d'aller la chercher en base. */}
      <div>
        <p className="text-lg font-semibold text-foreground">La Bâtisse</p>
        <p className="text-sm text-muted-foreground">15, route de Lavelanet · Chalabre, 11230</p>
      </div>

      {SHOW_ARRIVEE_SECTION && (
        <div>
          <h2 className="text-sm md:text-base font-extrabold text-foreground mb-3">Arrivée</h2>
          <div className="space-y-3">
            {arriveeItems.map(item => (
              <GuideCard key={item.title} title={item.title} content={item.content} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm md:text-base font-extrabold text-foreground mb-3">Départ</h2>
        <div className="space-y-3">
          {departItems.map(item => (
            <GuideCard key={item.title} title={item.title} content={item.content} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm md:text-base font-extrabold text-foreground mb-3">Urgences</h2>
        <EmergencyGuide
          categories={EMERGENCY_CATEGORIES.filter((c) => SHOW_FUITE_EAU || c.id !== 'eau')}
          contacts={contacts ?? []}
        />
      </div>

      <div>
        <h2 className="text-sm md:text-base font-extrabold text-foreground mb-3">Organisation</h2>
        <div className="space-y-3">
          {organisationBeforePlacards
            .filter(item => SHOW_DRAPS_LINGE || item.title !== 'Draps et linge')
            .map(item => (
              <GuideCard key={item.title} title={item.title} content={item.content} />
            ))}
          <GuideCard title="Organisation des placards" content={<StorageOrganization slots={storageSlots} />} />
          {isAdmin && (
            <GuideCard title="Rangement indications" content={<StorageSlotsAdmin initialSlots={storageSlots} />} />
          )}
          {organisationAfterPlacards.map(item => (
            <GuideCard key={item.title} title={item.title} content={item.content} />
          ))}
          {SHOW_GAS_BOTTLES && (
            <GasBottlesCard
              editable={canEditGasBottles}
              initialCount={gasBottlesStatus?.count ?? null}
              initialLastRefillDate={gasBottlesStatus?.last_refill_date ?? null}
            />
          )}
          {organisationAfterGas.map(item => (
            <GuideCard key={item.title} title={item.title} content={item.content} />
          ))}
          {/* "Cheminées" : rendu à part (pas dans guideContent) car son
              contenu dépend de données chargées ici (statuts + rôle admin)
              — voir FireplacesTable.tsx. */}
          <GuideCard
            title="Cheminées"
            content={<FireplacesTable isAdmin={isAdmin} initialStatuses={fireplaceStatuses} />}
          />
        </div>
      </div>
    </div>
    </GuideAccordionProvider>
  )
}
