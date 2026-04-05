import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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
        <CardContent className="space-y-4">
          <p className="text-stone-500 text-sm">
            Votre paiement a bien été reçu. Votre solde a été mis à jour.
          </p>
          <Button asChild className="w-full">
            <Link href="/dashboard">Retour à l&apos;accueil</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard/budget">Voir mes paiements</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
