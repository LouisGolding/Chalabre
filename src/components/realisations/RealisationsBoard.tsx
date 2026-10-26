'use client'

import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, X, Pencil, Trash2, ChevronDown, ChevronRight, ChevronLeft, Heart, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { actionPillClass, cn, properCase } from '@/lib/utils'
import type { HouseLogEntry, HouseLogComment } from '@/types'

export type RealisationComment = HouseLogComment

// Likes/commentaires (19/10/2026, demandé par Aurélie, "à la manière
// d'Instagram") -- likeCount/likedByMe calculés côté serveur
// (dashboard/realisations/page.tsx) à partir de house_log_likes ;
// comments préchargés en entier comme les photos, pas de pagination.
export type RealisationEntry = Omit<HouseLogEntry, 'photos'> & {
  photos: { id: string; url: string }[]
  likeCount: number
  likedByMe: boolean
  comments: RealisationComment[]
}

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
  const [title, setTitle] = useState('')
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
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de la publication')

      const photos = pendingFiles.length > 0 ? await uploadPhotos(data.entry.id, pendingFiles) : []

      setEntries((prev) => [{ ...data.entry, photos }, ...prev])
      setTitle('')
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

  const handleSaveEntry = async (id: string, newTitle: string, newContent: string) => {
    const res = await fetch('/api/house-log', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title: newTitle, content: newContent }),
    })
    if (!res.ok) return false
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, title: newTitle.trim() || null, content: newContent, updated_at: new Date().toISOString() }
          : e
      )
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

  // "J'aime" optimiste (change dans l'interface avant la reponse du
  // serveur, revert si la requete echoue) -- meme principe que les
  // enregistrements auto-debounces ailleurs sur le site (EditableTmTier.tsx),
  // simplifie ici puisqu'il n'y a qu'un aller-retour, pas de debounce.
  const handleToggleLike = async (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId)
    if (!entry) return
    const wasLiked = entry.likedByMe
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, likedByMe: !wasLiked, likeCount: e.likeCount + (wasLiked ? -1 : 1) }
          : e
      )
    )
    try {
      const res = wasLiked
        ? await fetch(`/api/house-log/likes?house_log_id=${entryId}`, { method: 'DELETE' })
        : await fetch('/api/house-log/likes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ house_log_id: entryId }),
          })
      if (!res.ok) throw new Error()
    } catch {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, likedByMe: wasLiked, likeCount: e.likeCount + (wasLiked ? 1 : -1) }
            : e
        )
      )
    }
  }

  const handleAddComment = async (entryId: string, content: string) => {
    const res = await fetch('/api/house-log/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ house_log_id: entryId, content }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Erreur lors de l'envoi du commentaire")
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, comments: [...e.comments, data.comment] } : e))
    )
  }

  const handleDeleteComment = async (entryId: string, commentId: string) => {
    const res = await fetch(`/api/house-log/comments?id=${commentId}`, { method: 'DELETE' })
    if (res.ok) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, comments: e.comments.filter((c) => c.id !== commentId) } : e
        )
      )
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl bg-card/60 backdrop-blur-sm p-4 ring-1 ring-foreground/10"
      >
        <p className="text-sm md:text-base font-medium uppercase tracking-wide text-foreground">Partager ce qui a été fait</p>
        {/* Plus de libelle "Titre" au-dessus : induit par la presence de
            l'encadre editable -- demande par Nicolas le 04/10/2026. */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Ex. : réagencement de la chambre nord"
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          <label className={cn(actionPillClass, 'cursor-pointer')}>
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
          <button type="submit" disabled={submitting} className={actionPillClass}>
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
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onDelete={() => handleDeleteEntry(entry.id)}
            onSave={(newTitle, newContent) => handleSaveEntry(entry.id, newTitle, newContent)}
            onAddPhotos={(files) => handleAddPhotos(entry.id, files)}
            onDeletePhoto={(photoId) => handleDeletePhoto(entry.id, photoId)}
            onToggleLike={() => handleToggleLike(entry.id)}
            onAddComment={(content) => handleAddComment(entry.id, content)}
            onDeleteComment={(commentId) => handleDeleteComment(entry.id, commentId)}
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
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onDeleteEntry={handleDeleteEntry}
          onSaveEntry={handleSaveEntry}
          onAddPhotos={handleAddPhotos}
          onDeletePhoto={handleDeletePhoto}
          onToggleLike={handleToggleLike}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
        />
      ))}
    </div>
  )
}

function YearGroup({
  year,
  entries,
  canEdit,
  currentUserId,
  isAdmin,
  onDeleteEntry,
  onSaveEntry,
  onAddPhotos,
  onDeletePhoto,
  onToggleLike,
  onAddComment,
  onDeleteComment,
}: {
  year: number
  entries: RealisationEntry[]
  canEdit: (entry: RealisationEntry) => boolean
  currentUserId: string
  isAdmin: boolean
  onDeleteEntry: (id: string) => void
  onSaveEntry: (id: string, title: string, content: string) => Promise<boolean>
  onAddPhotos: (entryId: string, files: FileList | null) => void
  onDeletePhoto: (entryId: string, photoId: string) => void
  onToggleLike: (entryId: string) => void
  onAddComment: (entryId: string, content: string) => Promise<void>
  onDeleteComment: (entryId: string, commentId: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="card-canson inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 hover:text-foreground transition-colors"
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
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onDelete={() => onDeleteEntry(entry.id)}
              onSave={(newTitle, newContent) => onSaveEntry(entry.id, newTitle, newContent)}
              onAddPhotos={(files) => onAddPhotos(entry.id, files)}
              onDeletePhoto={(photoId) => onDeletePhoto(entry.id, photoId)}
              onToggleLike={() => onToggleLike(entry.id)}
              onAddComment={(content) => onAddComment(entry.id, content)}
              onDeleteComment={(commentId) => onDeleteComment(entry.id, commentId)}
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
  currentUserId,
  isAdmin,
  onDelete,
  onSave,
  onAddPhotos,
  onDeletePhoto,
  onToggleLike,
  onAddComment,
  onDeleteComment,
}: {
  entry: RealisationEntry
  canEdit: boolean
  currentUserId: string
  isAdmin: boolean
  onDelete: () => void
  onSave: (title: string, content: string) => Promise<boolean>
  onAddPhotos: (files: FileList | null) => void
  onDeletePhoto: (photoId: string) => void
  onToggleLike: () => void
  onAddComment: (content: string) => Promise<void>
  onDeleteComment: (commentId: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(entry.title ?? '')
  const [editContent, setEditContent] = useState(entry.content)
  const [saving, setSaving] = useState(false)
  const addPhotoInputRef = useRef<HTMLInputElement>(null)

  const authorName = entry.profile
    ? `${properCase(entry.profile.first_name)} ${properCase(entry.profile.last_name)}`.trim()
    : 'Un membre de la famille'

  const handleSave = async () => {
    if (!editContent.trim()) return
    setSaving(true)
    try {
      const ok = await onSave(editTitle.trim(), editContent.trim())
      if (ok) setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="rounded-xl bg-card/60 backdrop-blur-sm p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm md:text-base font-normal uppercase text-foreground">{entry.title || 'Réalisation'}</p>
          <p className="text-xs text-muted-foreground">
            {authorName}, {format(parseISO(entry.created_at), 'd MMMM yyyy', { locale: fr })}
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
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Titre"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
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
                setEditTitle(entry.title ?? '')
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

      {entry.photos.length > 0 && (
        <PhotoCarousel photos={entry.photos} canEdit={canEdit} onDeletePhoto={onDeletePhoto} />
      )}

      {canEdit && (
        <label className={cn(actionPillClass, 'mt-3 cursor-pointer')}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter des photos
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

      {/* Likes/commentaires (19/10/2026, demande d'Aurelie, "a la
          maniere d'Instagram") -- coeur plein + rouge quand on a deja
          like (fill-current reprend la couleur du texte, ici
          text-destructive), icone de commentaire a cote en simple
          compteur (ouvre pas de panneau separe, les commentaires sont
          deja tous affiches juste en dessous). */}
      <div className="mt-3 flex items-center gap-4 border-t border-border/60 pt-3">
        <button
          type="button"
          onClick={onToggleLike}
          aria-pressed={entry.likedByMe}
          aria-label={entry.likedByMe ? "Je n'aime plus" : "J'aime"}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium transition-colors',
            entry.likedByMe ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Heart className={cn('h-4 w-4', entry.likedByMe && 'fill-current')} />
          {entry.likeCount > 0 && entry.likeCount}
        </button>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          {entry.comments.length > 0 && entry.comments.length}
        </span>
      </div>

      {entry.comments.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {entry.comments.map((comment) => {
            const commentAuthor = comment.profile
              ? `${properCase(comment.profile.first_name)} ${properCase(comment.profile.last_name)}`.trim()
              : 'Un membre de la famille'
            const canDeleteComment = comment.user_id === currentUserId || isAdmin
            return (
              <li key={comment.id} className="flex items-start justify-between gap-2 text-sm">
                <p className="text-foreground">
                  <span className="font-medium">{commentAuthor}</span>{' '}
                  <span className="text-foreground/90">{comment.content}</span>
                </p>
                {canDeleteComment && (
                  <button
                    type="button"
                    onClick={() => onDeleteComment(comment.id)}
                    aria-label="Supprimer ce commentaire"
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <CommentForm onSubmit={onAddComment} />
    </article>
  )
}

// Champ "Ajouter un commentaire..." en bas de chaque post -- son propre
// etat local (texte en cours de frappe), independant du reste du post,
// pour ne pas re-render toute la carte a chaque frappe.
function CommentForm({ onSubmit }: { onSubmit: (content: string) => Promise<void> }) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim() || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(value.trim())
      setValue('')
    } catch {
      // silencieux -- le texte reste dans le champ si l'envoi echoue,
      // pour pouvoir retenter sans tout retaper
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ajouter un commentaire..."
        className="h-8 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
      />
      <button type="submit" disabled={!value.trim() || submitting} className={actionPillClass}>
        Publier
      </button>
    </form>
  )
}

// Photos sous le texte du post, pleine largeur du widget, une à la fois —
// flèches gauche/droite pour parcourir les autres (demandé par Nicolas le
// 19/09/2026, en remplacement d'une première version en grille de
// vignettes). L'index local se recale automatiquement si le nombre de
// photos change (ex. suppression) pour ne jamais pointer hors limites.
function PhotoCarousel({
  photos,
  canEdit,
  onDeletePhoto,
}: {
  photos: { id: string; url: string }[]
  canEdit: boolean
  onDeletePhoto: (photoId: string) => void
}) {
  const [index, setIndex] = useState(0)
  // Plein ecran au clic, comme les plans d'extincteur (25/10/2026,
  // demande d'Aurelie) -- voir le commentaire au-dessus du composant.
  const [fullscreen, setFullscreen] = useState(false)
  const safeIndex = Math.min(index, photos.length - 1)
  const photo = photos[safeIndex]
  if (!photo) return null

  const goTo = (delta: number) => {
    setIndex(((safeIndex + delta) % photos.length + photos.length) % photos.length)
  }

  return (
    <div className="relative mt-3 w-full aspect-[4/3] overflow-hidden rounded-lg bg-muted">
      <button
        type="button"
        onClick={() => setFullscreen(true)}
        aria-label="Agrandir la photo"
        className="block h-full w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- URLs signées temporaires, next/image n'apporte rien ici */}
        <img src={photo.url} alt="" className="h-full w-full object-cover" />
      </button>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(-1)}
            aria-label="Photo précédente"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-foreground/60 p-1.5 text-background hover:bg-foreground/80 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => goTo(1)}
            aria-label="Photo suivante"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-foreground/60 p-1.5 text-background hover:bg-foreground/80 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-foreground/60 px-2 py-0.5 text-[10px] font-medium text-background">
            {safeIndex + 1} / {photos.length}
          </div>
        </>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={() => onDeletePhoto(photo.id)}
          aria-label="Supprimer cette photo"
          className="absolute right-2 top-2 rounded-full bg-foreground/60 p-1 text-background hover:bg-destructive transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Rendu via portail dans document.body (25/10/2026) : la carte
          d'une Réalisation (ARTICLE plus haut dans l'arbre) a
          `backdrop-blur-sm`, qui crée un nouveau "containing block" pour
          tout descendant en position fixed (même règle CSS que
          `transform`/`filter`) -- sans portail, ce plein écran restait
          coincé dans les limites de la carte au lieu de couvrir tout
          l'écran (bug constaté en vérifiant cette fonctionnalité). */}
      {fullscreen &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/95" onClick={() => setFullscreen(false)}>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              aria-label="Réduire la photo"
              className="absolute right-4 top-4 z-10 text-white/80 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- URLs signées temporaires, next/image n'apporte rien ici */}
            <img src={photo.url} alt="" className="h-full w-full object-contain" />
          </div>,
          document.body
        )}
    </div>
  )
}
