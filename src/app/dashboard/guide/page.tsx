import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { EmergencyGuide } from '@/components/guide/EmergencyGuide'
import { EMERGENCY_CATEGORIES } from '@/lib/emergency-guide'
import { GasBottlesCard } from '@/components/guide/GasBottlesCard'
import { GuideCard } from '@/components/guide/GuideCard'
import { FireplacesTable } from '@/components/guide/FireplacesTable'

// Widgets temporairement masqués à la demande de Nicolas le 29/09/2026 —
// le contenu / la logique restent en place (données, requêtes, imports),
// prêts à être réaffichés en repassant ces constantes à true.
const SHOW_ARRIVEE_SECTION = false
const SHOW_GAS_BOTTLES = false

const guideContent: { category: string; items: { title: string; content: ReactNode }[] }[] = [
  {
    category: 'Arrivée',
    items: [
      { title: 'Ouverture de la maison', content: 'Instructions à compléter par l\'administrateur.' },
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
      { title: 'Zoning des placards', content: 'Plan à compléter par l\'administrateur.' },
      {
        title: 'Poubelles',
        content: 'Les poubelles sont à déposer à l\'entrée du village, après le pont, ou bien au Cazal.',
      },
      {
        title: 'Déchetterie',
        // "Juillet / Août" et "Le reste de l'année" en gras majuscules —
        // demandé par Nicolas le 29/09/2026. Contenu enrichi (plus une
        // simple chaîne) : voir GuideCard/content en ReactNode.
        content: (
          <div className="space-y-3">
            <div>
              <p className="font-semibold uppercase text-foreground">Juillet / Août :</p>
              <p>· Mardi au vendredi de 8h à 13h30</p>
              <p>· Samedi de 8h à 12h</p>
            </div>
            <div>
              <p className="font-semibold uppercase text-foreground">Le reste de l&apos;année :</p>
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

  const arriveeItems = guideContent.find((c) => c.category === 'Arrivée')!.items
  const departItems = guideContent.find((c) => c.category === 'Départ')!.items
  const organisationItems = guideContent.find((c) => c.category === 'Organisation')!.items
  // "Bouteilles de gaz" est un widget éditable (voir GasBottlesCard),
  // inséré juste après "Déchetterie" — ordre demandé par Aurélie.
  const dechetterieIndex = organisationItems.findIndex((item) => item.title === 'Déchetterie')
  const organisationBeforeGas = organisationItems.slice(0, dechetterieIndex + 1)
  const organisationAfterGas = organisationItems.slice(dechetterieIndex + 1)

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl md:text-3xl font-normal uppercase tracking-[0.08em] text-foreground mt-4 text-center md:text-left">Guide de la maison</h1>

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
          <h2 className="text-lg font-semibold text-foreground mb-3">
            <Badge variant="outline" className="text-base px-3 py-1">Arrivée</Badge>
          </h2>
          <div className="space-y-3">
            {arriveeItems.map(item => (
              <GuideCard key={item.title} title={item.title} content={item.content} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          <Badge variant="outline" className="text-base px-3 py-1">Départ</Badge>
        </h2>
        <div className="space-y-3">
          {departItems.map(item => (
            <GuideCard key={item.title} title={item.title} content={item.content} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          <Badge variant="outline" className="text-base px-3 py-1">Urgences</Badge>
        </h2>
        <EmergencyGuide categories={EMERGENCY_CATEGORIES} contacts={contacts ?? []} />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          <Badge variant="outline" className="text-base px-3 py-1">Organisation</Badge>
        </h2>
        <div className="space-y-3">
          {organisationBeforeGas.map(item => (
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
  )
}
