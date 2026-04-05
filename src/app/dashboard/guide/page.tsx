import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
    category: 'Urgences',
    items: [
      { title: 'Panne électrique', content: 'Vérifier les tableaux électriques. Emplacements à compléter.' },
      { title: 'Fuite d\'eau', content: 'Couper l\'arrivée d\'eau principale. Emplacement à compléter.' },
      { title: 'Extincteurs', content: 'Emplacements à compléter par l\'administrateur.' },
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

export default function GuidePage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold text-stone-800">Guide de la maison</h1>
      <p className="text-stone-500">Toutes les informations pratiques pour votre séjour à La Bâtisse.</p>

      {guideContent.map(section => (
        <div key={section.category}>
          <h2 className="text-lg font-semibold text-stone-700 mb-3">
            <Badge variant="outline" className="text-base px-3 py-1">{section.category}</Badge>
          </h2>
          <div className="space-y-3">
            {section.items.map(item => (
              <Card key={item.title}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-stone-600">{item.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
