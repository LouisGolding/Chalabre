import Link from 'next/link'
import { XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
        <CardContent className="space-y-3">
          <p className="text-stone-500 text-sm">
            Votre paiement n&apos;a pas été effectué. Vous pouvez réessayer depuis votre tableau de bord.
          </p>
          <Link href="/dashboard" className="inline-flex items-center justify-center w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
            Retour à l&apos;accueil
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
