'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { DOCUMENT_CATEGORIES } from '@/lib/document-categories'
import { actionPillClass, cn } from '@/lib/utils'

// Esthétique alignée le 06/10/2026 à la demande de Nicolas sur le widget
// "Partager ce qui a été fait" (Réalisations, voir RealisationsBoard.tsx) :
// titre en majuscules/tracking-wide, bouton de sélection de fichier et
// bouton d'envoi en pastille d'action (actionPillClass, voir utils.ts)
// au lieu du style ad hoc précédent (file input natif stylé, bouton
// rempli rounded-lg).
export function DocumentUploadForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0].id)
  const [fileName, setFileName] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const file = fileInputRef.current?.files?.[0]
    if (!file || !title.trim()) {
      setError('Merci de choisir un fichier et de donner un titre.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title.trim())
      formData.append('category', category)
      const res = await fetch('/api/documents', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de l’envoi')
      setTitle('')
      setFileName(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’envoi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl bg-card/60 backdrop-blur-sm p-4 ring-1 ring-foreground/10"
    >
      <p className="text-sm md:text-base font-medium uppercase tracking-wide text-foreground">Ajouter un document</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre du document"
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        >
          {DOCUMENT_CATEGORIES.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between gap-3">
        <label className={cn(actionPillClass, 'cursor-pointer')}>
          <Plus className="h-3.5 w-3.5" />
          {fileName ?? 'Choisir un fichier'}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        <button type="submit" disabled={submitting} className={actionPillClass}>
          {submitting ? 'Envoi...' : 'Uploader'}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  )
}

export function DeleteDocumentButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const handleDelete = async () => {
    setPending(true)
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erreur lors de la suppression')
      }
      router.refresh()
    } catch {
      // silencieux — le document reste affiché si la suppression échoue
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      aria-label="Supprimer ce document"
      className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
