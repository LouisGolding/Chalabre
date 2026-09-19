'use client'

import { useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, X, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { HouseLogEntry } from '@/types'

export type RealisationEntry = Omit<HouseLogEntry, 'photos'> & { photos: { id: string; url: string }[] }

const PHOTO_BUCKET = 'house-log'
const SIGNED_URL_TTL = 60 * 60

// Fil façon blog de l'onglet "Réalisations" (19/09/2026 — voir le point
// correspondant dans points-a-regler-avec-louis.md pour le contexte
// complet). Règles reprises telles que demandées par Nicolas :
//   - tout membre de la famille (admin/family) peut poster ;
//   - un post affiche la date et l'auteur ;
//   - on peut ajouter/retirer des photos avec un "+" ;
//   - un post d'un autre membre n'est éditable/supprimable que par un
//     admin — le sien reste éditable/supprimable par soi-même ;
//   - les posts s'affichent du plus récent au plus ancien ; l'année en
//     cours et l'année précédente restent à plat dans le fil, les années
//     plus anciennes sont regroupées chacune dans une pastille repliable
//     "Réalisations année N-2", "Réalisations année N-3", etc.
//     (Choix d'implémentation non revu avec Nicolas dans le détail : la
//     citation d'origine ne précise que l'exemple "N-2", généralisé ici à
//     "chaque année ≤ N-2 a sa propre pastille".)
//
// Toutes les mutations (poster, éditer, supprimer, ajouter/retirer une
// photo) mettent à jour l'état local `entries` directement plutôt que de
// s'appuyer sur router.refresh() : ce composant garde son propre état
// (useState(initialEntries)) une fois monté, donc un refresh serveur seul
// ne le mettrait pas à jour. Le bucket "house-log" étant privé, les URLs
// signées des nouvelles photos sont générées ici, côté client, via le
// client Supabase du navigateur (autorisé par RLS comme depuis le
// serveur) — évite un aller-retour serveur complet à chaque photo.
export function RealisationsBoard({
  initialEntries,
  currentUserId,
  isAdmin,
}: {
  initialEntries: RealisationEntry[]
  currentUserId: string
  isAdmin: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const [entries, setEntries] = useState(initialEntries)
  const [content, setContent] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentYear = new Date().getFullYear()

  const { flat, olderByYear } = useMemo(() => {
    const flatEntries: RealisationEntry[] = []
    const older = new Map<number, RealisationEntry[]>()
    for (const entry of entries) {
      const year = new Date(entry.created_at).getFullYear()
      if (year >= currentYear - 1) {
        flatEntries.push(entry)
      } else {
        const list = older.get(year) ?? []
        list.push(entry)
        older.set(year, list)
      }
    }
    const sortedOlder = Array.from(older.entries()).sort((a, b) => b[0] - a[0])
    return { flat: flatEntries, olderByYear: sortedOlder }
  }, [entries, currentYear])

  const canEdit = (entry: RealisationEntry) => entry.created_by === currentUserId || isAdmin

  const signPhotos = async (paths: string[]) => {
    if (paths.length === 0) return new Map<string, string>()
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
    const byPath = new Map<string, string>()
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) byPath.set(entry.path, entry.signedUrl)
    }
    return byPath
  }

  const uploadPhotos = async (houseLogId: string, files: File[]) => {
    const formData = new FormData()
    formData.append('house_log_id', houseLogId)
    for (const file of files) formData.append('files', file)
    const res = await fetch('/api/house-log/photos', { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Erreur lors de l'envoi des photos")

    const rows = data.photos as { id: string; storage_path: string }[]
    const signedByPath = await signPhotos(rows.map((r) => r.storage_path))
    return rows
      .map((r) => ({ id: r.id, url: signedByPath.get(r.storage_path) }))
      .filter((p): p is { id: string; url: string } => Boolean(p.url))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) {
      setError('Écris un mot sur ce qui a été fait.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/house-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de la publication')

      const photos = pendingFiles.length > 0 ? await uploadPhotos(data.entry.id, pendingFiles) : []

      setEntries((prev) => [{ ...data.entry, photos }, ...prev])
      setContent('')
      setPendingFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la publication')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Supprimer ce post ?')) return
    const res = await fetch(`/api/house-log?id=${id}`, { method: 'DELETE' })
    if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const handleSaveEntry = async (id: string, newContent: string) => {
    const res = await fetch('/api/house-log', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, content: newContent }),
    })
    if (!res.ok) return false
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, content: newContent, updated_at: new Date().toISOString() } : e))
    )
    return true
  }

  const handleAddPhotos = async (entryId: string, files: FileList | null) => {
    if (!files || files.length === 0) return
    try {
      const photos = await uploadPhotos(entryId, Array.from(files))
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, photos: [...e.photos, ...photos] } : e))
      )
    } catch {
      // silencieux — l'ajout de photo n'est pas une action bloquante
    }
  }

  const handleDeletePhoto = async (entryId: string, photoId: string) => {
    const res = await fetch(`/api/house-log/photos?id=${photoId}`, { method: 'DELETE' })
    if (res.ok) {
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, photos: e.photos.filter((p) => p.id !== photoId) } : e))
      )
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl bg-card/60 backdrop-blur-sm p-4 ring-1 ring-foreground/10"
      >
        <p className="text-sm font-medium text-foreground">Partager ce qui a été fait</p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Ex. : tonte du jardin, réparation d'un carreau, réagencement de la chambre bleue..."
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground hover:border-foreground/40 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            {pendingFiles.length > 0 ? `${pendingFiles.length} photo(s)` : 'Ajouter des photos'}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => setPendingFiles(Array.from(e.target.files ?? []))}
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-foreground px-4 text-xs font-medium text-background transition-opacity disabled:opacity-50"
          >
            {submitting ? 'Publication...' : 'Publier'}
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>

      <div className="space-y-4">
        {flat.map((entry) => (
          <RealisationCard
            key={entry.id}
            entry={entry}
            canEdit={canEdit(entry)}
            onDelete={() => handleDeleteEntry(entry.id)}
            onSave={(newContent) => handleSaveEntry(entry.id, newContent)}
            onAddPhotos={(files) => handleAddPhotos(entry.id, files)}
            onDeletePhoto={(photoId) => handleDeletePhoto(entry.id, photoId)}
          />
        ))}
        {flat.length === 0 && olderByYear.length === 0 && (
          <p className="text-sm text-muted-foreground/70 text-center py-8">
            Rien encore — soyez le premier à partager une réalisation.
          </p>
        )}
      </div>

      {olderByYear.map(([year, yearEntries]) => (
        <YearGroup
          key={year}
          year={year}
          entries={yearEntries}
          canEdit={canEdit}
          onDeleteEntry={handleDeleteEntry}
          onSaveEntry={handleSaveEntry}
          onAddPhotos={handleAddPhotos}
          onDeletePhoto={handleDeletePhoto}
        />
      ))}
    </div>
  )
}

function YearGroup({
  year,
  entries,
  canEdit,
  onDeleteEntry,
  onSaveEntry,
  onAddPhotos,
  onDeletePhoto,
}: {
  year: number
  entries: RealisationEntry[]
  canEdit: (entry: RealisationEntry) => boolean
  onDeleteEntry: (id: string) => void
  onSaveEntry: (id: string, content: string) => Promise<boolean>
  onAddPhotos: (entryId: string, files: FileList | null) => void
  onDeletePhoto: (entryId: string, photoId: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full bg-card/60 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Réalisations année {year} ({entries.length})
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          {entries.map((entry) => (
            <RealisationCard
              key={entry.id}
              entry={entry}
              canEdit={canEdit(entry)}
              onDelete={() => onDeleteEntry(entry.id)}
              onSave={(newContent) => onSaveEntry(entry.id, newContent)}
              onAddPhotos={(files) => onAddPhotos(entry.id, files)}
              onDeletePhoto={(photoId) => onDeletePhoto(entry.id, photoId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RealisationCard({
  entry,
  canEdit,
  onDelete,
  onSave,
  onAddPhotos,
  onDeletePhoto,
}: {
  entry: RealisationEntry
  canEdit: boolean
  onDelete: () => void
  onSave: (content: string) => Promise<boolean>
  onAddPhotos: (files: FileList | null) => void
  onDeletePhoto: (photoId: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(entry.content)
  const [saving, setSaving] = useState(false)
  const addPhotoInputRef = useRef<HTMLInputElement>(null)

  const authorName = entry.profile
    ? `${entry.profile.first_name} ${entry.profile.last_name}`.trim()
    : 'Un membre de la famille'

  const handleSave = async () => {
    if (!editContent.trim()) return
    setSaving(true)
    try {
      const ok = await onSave(editContent.trim())
      if (ok) setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="rounded-xl bg-card/60 backdrop-blur-sm p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{authorName}</p>
          <p className="text-xs text-muted-foreground">
            {format(parseISO(entry.created_at), 'd MMMM yyyy', { locale: fr })}
          </p>
        </div>
        {canEdit && !editing && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Modifier ce post"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Supprimer ce post"
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-7 items-center justify-center rounded-lg bg-foreground px-3 text-xs font-medium text-background disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setEditContent(entry.content)
              }}
              className="inline-flex h-7 items-center justify-center rounded-lg px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-foreground whitespace-pre-wrap">{entry.content}</p>
      )}

      {(entry.photos.length > 0 || canEdit) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <a href={photo.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- URLs signées temporaires, next/image n'apporte rien ici */}
                <img src={photo.url} alt="" className="h-20 w-20 rounded-lg object-cover" />
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onDeletePhoto(photo.id)}
                  aria-label="Supprimer cette photo"
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-foreground text-background p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {canEdit && (
            <label className="h-20 w-20 flex items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground cursor-pointer hover:text-foreground hover:border-foreground/40 transition-colors">
              <Plus className="h-5 w-5" />
              <input
                ref={addPhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  onAddPhotos(e.target.files)
                  if (addPhotoInputRef.current) addPhotoInputRef.current.value = ''
                }}
              />
            </label>
          )}
        </div>
      )}
    </article>
  )
}
