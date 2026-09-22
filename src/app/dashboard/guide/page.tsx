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
      { title: 'Fermeture de la maison', content: 'Fermer toutes les portes · Vérifier les fenêtres · Fermer les volets · Couper l\'eau si hors saison.' },
    ]
  },
  {
    category: 'Installations',
    items: [
      { title: 'Arrivée gaz', content: 'Emplacement à compléter.' },
      { title: 'Arrivée eau', content: 'Emplacement à compléter.' },
      { title: 'Tableaux électriques', content: 'Emplacements à compléter.' },
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

  const organisationItems = guideContent[3].items
  // "Bouteilles de gaz" est un widget éditable (voir GasBottlesCard),
  // inséré entre "Déchetterie" et "Cheminée" — ordre demandé par Aurélie.
  const dechetterieIndex = organisationItems.findIndex((item) => item.title === 'Déchetterie')
  const organisationBeforeGas = organisationItems.slice(0, dechetterieIndex + 1)
  const organisationAfterGas = organisationItems.slice(dechetterieIndex + 1)

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Guide de la maison</h1>

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
          {guideContent[0].items.map(item => (
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
          {guideContent[1].items.map(item => (
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
          <Badge variant="outline" className="text-base px-3 py-1">Installations</Badge>
        </h2>
        <div className="space-y-3">
          {guideContent[2].items.map(item => (
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
