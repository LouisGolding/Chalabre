import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmergencyGuide } from '@/components/guide/EmergencyGuide'
import { EMERGENCY_CATEGORIES } from '@/lib/emergency-guide'

const guideContent = [
  {
    category: 'Arrivée',
    items: [
      { title: 'Ouverture de la maison', content: 'Instructions à compléter par l\'administrateur.' },
      { title: 'Accès au portail', content: 'Instructions à compléter par l\'administrateur.' },
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
    ]
  },
]

export default async function GuidePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: contacts } = await supabase.from('contacts').select('*')

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Guide de la maison</h1>
      <p className="text-muted-foreground">Toutes les informations pratiques pour votre séjour à La Bâtisse.</p>

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
                <p className="text-sm text-muted-foreground">{item.content}</p>
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
                <p className="text-sm text-muted-foreground">{item.content}</p>
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

      {guideContent.slice(2).map(section => (
        <div key={section.category}>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            <Badge variant="outline" className="text-base px-3 py-1">{section.category}</Badge>
          </h2>
          <div className="space-y-3">
            {section.items.map(item => (
              <Card key={item.title}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
