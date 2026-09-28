import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmergencyGuide } from '@/components/guide/EmergencyGuide'
import { EMERGENCY_CATEGORIES } from '@/lib/emergency-guide'
import { GasBottlesCard } from '@/components/guide/GasBottlesCard'

const guideContent = [
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
          '1. Mêmes actions pour votre chambre',
          '2. Vérifiez que chaque chambre ait un couvre-lit, des volets et fenêtres fermées',
          '3. Videz les 3 réfrigérateurs (Cave / Cuisine RDC / Cuisine 2ème)',
          '4. Rentrez et rangez le mobilier de jardin',
          '5. Prévoyez un passage de la femme de ménage si nécessaire',
        ].join('\n'),
      },
    ]
  },
  {
    category: 'Organisation',
    items: [
      { title: 'Draps et linge', content: 'Emplacement à compléter.' },
      { title: 'Zoning des placards', content: 'Plan à compléter par l\'administrateur.' },
      {
        title: 'Poubelles',
        content: 'À déposer à l\'entrée du village, après le pont, ou bien au Cazal.',
      },
      {
        title: 'Déchetterie',
        content: [
          'Juillet / Août :',
          '· Mardi au vendredi de 8h à 13h30',
          '· Samedi de 8h à 12h',
          '',
          'Le reste de l\'année :',
          '· Mardi 13h-16h30',
          '· Mercredi, jeudi et vendredi 9h30-12h30 et 13h-16h30',
          '· Samedi 9h30-12h30',
          '',
          'Se munir de la carte Nomitaove pour accéder à la déchetterie.',
        ].join('\n'),
      },
      {
        title: 'Cheminée',
        content: [
          'RDC – Bureau Antoine',
          '· Ramonée : à compléter (oui/non)',
          '· Date de dernier ramonage : à compléter',
          '· Utilisable : à compléter (oui/non)',
        ].join('\n'),
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
  // jamais les amis — demandé par Aurélie le 22/09/2026.
  const canEditGasBottles = profile?.role === 'admin' || profile?.role === 'family'

  const { data: gasBottlesStatus } = await supabase
    .from('gas_bottles_status')
    .select('count, last_refill_date')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const arriveeItems = guideContent.find((c) => c.category === 'Arrivée')!.items
  const departItems = guideContent.find((c) => c.category === 'Départ')!.items
  const organisationItems = guideContent.find((c) => c.category === 'Organisation')!.items
  // "Bouteilles de gaz" est un widget éditable (voir GasBottlesCard),
  // inséré entre "Déchetterie" et "Cheminée" — ordre demandé par Aurélie.
  const dechetterieIndex = organisationItems.findIndex((item) => item.title === 'Déchetterie')
  const organisationBeforeGas = organisationItems.slice(0, dechetterieIndex + 1)
  const organisationAfterGas = organisationItems.slice(dechetterieIndex + 1)

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl md:text-3xl font-normal uppercase tracking-[0.08em] text-foreground">Guide de la maison</h1>

      {/* Adresse de la maison — reprise ici depuis l'ancien onglet "Adresse"
          (retiré le 19/09/2026, jugé redondant par Nicolas une fois cette
          info replacée juste sous le titre du Guide). Contenu statique :
          l'adresse ne change pas, pas besoin d'aller la chercher en base. */}
      <div>
        <p className="text-lg font-semibold text-foreground">La Bâtisse</p>
        <p className="text-sm text-muted-foreground">15, route de Lavelanet · Chalabre, 11230</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          <Badge variant="outline" className="text-base px-3 py-1">Arrivée</Badge>
        </h2>
        <div className="space-y-3">
          {arriveeItems.map(item => (
            <Card key={item.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{item.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          <Badge variant="outline" className="text-base px-3 py-1">Départ</Badge>
        </h2>
        <div className="space-y-3">
          {departItems.map(item => (
            <Card key={item.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{item.content}</p>
              </CardContent>
            </Card>
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
            <Card key={item.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{item.content}</p>
              </CardContent>
            </Card>
          ))}
          <GasBottlesCard
            editable={canEditGasBottles}
            initialCount={gasBottlesStatus?.count ?? null}
            initialLastRefillDate={gasBottlesStatus?.last_refill_date ?? null}
          />
          {organisationAfterGas.map(item => (
            <Card key={item.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{item.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
