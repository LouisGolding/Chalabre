import Link from 'next/link'
import { XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function PaiementAnnulePage() {
  return (
    <div className="max-w-md mx-auto mt-16">
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-7 w-7 text-red-500" />
          </div>
          <CardTitle>Paiement annulé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-stone-500 text-sm">
            Votre paiement n&apos;a pas été effectué. Vous pouvez réessayer depuis votre tableau de bord.
          </p>
          <Button asChild className="w-full">
            <Link href="/dashboard">Retour à l&apos;accueil</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
