import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, Download } from 'lucide-react'
import { DocumentUploadForm, DeleteDocumentButton } from '@/components/documents/DocumentsAdmin'
import { Document } from '@/types'
import { DOCUMENT_CATEGORIES } from '@/lib/document-categories'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'friend') redirect('/dashboard')
  const isAdmin = profile?.role === 'admin'

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  const grouped: Record<string, Document[]> = (documents ?? []).reduce((acc: Record<string, Document[]>, doc) => {
    if (!acc[doc.category]) acc[doc.category] = []
    acc[doc.category].push(doc)
    return acc
  }, {})

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Documents</h1>

      {isAdmin && <DocumentUploadForm />}

      {/* Les dossiers sont toujours affichés, même vides, pour que la
          structure existe dès maintenant — le contenu viendra plus tard. */}
      {DOCUMENT_CATEGORIES.map(({ id: category, label }) => {
        const docs = grouped[category] ?? []
        return (
          <div key={category}>
            <h2 className="text-base font-medium text-muted-foreground mb-3">{label}</h2>
            {docs.length > 0 ? (
              <div className="space-y-2">
                {docs.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80"
                            aria-label="Télécharger ce document"
                          >
                            <Download className="h-5 w-5" />
                          </a>
                          {isAdmin && <DeleteDocumentButton id={doc.id} />}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70">Aucun document pour l’instant.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
