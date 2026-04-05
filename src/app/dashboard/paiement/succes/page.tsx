import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PaiementSuccesPage() {
  return (
    <div className="max-w-md mx-auto mt-16">
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-7 w-7 text-green-600" />
          </div>
          <CardTitle>Paiement confirmé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-stone-500 text-sm">
            Votre paiement a bien été reçu. Votre solde a été mis à jour.
          </p>
          <Link href="/dashboard" className="inline-flex items-center justify-center w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
            Retour à l&apos;accueil
          </Link>
          <Link href="/dashboard/mes-paiements" className="inline-flex items-center justify-center w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
            Voir mes paiements
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
