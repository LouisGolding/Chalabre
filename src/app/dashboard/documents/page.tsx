import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, Download } from 'lucide-react'

const categoryLabels: Record<string, string> = {
  propriete: 'Propriété',
  contrats: 'Contrats',
  factures: 'Factures',
  plans: 'Plans',
  autre: 'Autre',
}

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'friend') redirect('/dashboard')

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .order('category')

  const grouped: Record<string, any[]> = documents?.reduce((acc: Record<string, any[]>, doc) => {
    if (!acc[doc.category]) acc[doc.category] = []
    acc[doc.category].push(doc)
    return acc
  }, {}) ?? {}

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold text-stone-800">Documents</h1>

      {Object.keys(grouped).length > 0 ? (
        Object.entries(grouped).map(([category, docs]) => (
          <div key={category}>
            <h2 className="text-base font-semibold text-stone-600 mb-3">{categoryLabels[category] ?? category}</h2>
            <div className="space-y-2">
              {docs.map(doc => (
                <Card key={doc.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-stone-400" />
                        <div>
                          <p className="font-medium text-stone-800">{doc.title}</p>
                          <p className="text-xs text-stone-400">{formatDate(doc.created_at)}</p>
                        </div>
                      </div>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                      >
                        <Download className="h-5 w-5" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      ) : (
        <p className="text-stone-400">Aucun document disponible.</p>
      )}
    </div>
  )
}
