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

  // Le bucket "documents" est privé (migration_documents_storage.sql) :
  // file_url stocke le chemin du fichier, et on génère ici, côté serveur,
  // une URL signée valable 1 h par document. La signature passe par la
  // session de l'utilisateur, donc par les policies Storage (admin/family
  // uniquement) — un lien expiré se régénère au simple rechargement de la
  // page. Les éventuelles lignes historiques au format URL complète sont
  // utilisées telles quelles.
  const paths = (documents ?? [])
    .map((d) => d.file_url)
    .filter((u): u is string => typeof u === 'string' && !u.startsWith('http'))
  const signedByPath = new Map<string, string>()
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from('documents').createSignedUrls(paths, 60 * 60)
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) signedByPath.set(entry.path, entry.signedUrl)
    }
  }
  const downloadUrl = (doc: Document) =>
    doc.file_url.startsWith('http') ? doc.file_url : signedByPath.get(doc.file_url) ?? null

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
                          {downloadUrl(doc) && (
                            <a
                              href={downloadUrl(doc)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                              aria-label="Télécharger ce document"
                            >
                              <Download className="h-5 w-5" />
                            </a>
                          )}
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
