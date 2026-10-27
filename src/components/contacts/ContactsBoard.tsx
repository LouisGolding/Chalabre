'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, ChevronDown, Phone, Mail, ArrowRightLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { actionPillClass, cn } from '@/lib/utils'
import { CONTACT_CATEGORIES } from '@/lib/contact-categories'
import { Contact } from '@/types'

// Une cellule éditable en place : un admin clique dessus, elle devient un
// champ de saisie, l'enregistrement se fait à la perte du focus ou sur
// Entrée (Échap annule) — même interaction que la pastille "Cotisation
// mensuelle" du tableau de bord.
function EditableCell({
  value,
  editable,
  placeholder,
  onSave,
  type = 'text',
}: {
  value: string
  editable: boolean
  placeholder: string
  onSave: (next: string) => void
  type?: 'text' | 'tel' | 'email'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (!editable) {
    return <span className={cn('block truncate', value ? 'text-foreground' : 'text-muted-foreground/60')}>{value || '—'}</span>
  }

  if (editing) {
    return (
      <input
        type={type}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          if (draft !== value) onSave(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        placeholder={placeholder}
        className="h-7 w-full min-w-[100px] rounded-md border border-border bg-background px-1.5 text-sm text-foreground outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      className="w-full truncate rounded px-1.5 py-1 text-left text-sm hover:bg-muted"
    >
      {value ? <span className="text-foreground">{value}</span> : <span className="text-muted-foreground/60">{placeholder}</span>}
    </button>
  )
}

type SortKey = 'role' | 'name' | 'notes' | 'phone' | 'address' | 'email'
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortKey; label: string }[] = [
  // Nom avant Type de service (27/10/2026, demande d'Aurelie : "inverser
  // les colonnes NOM et Type de service") -- colonne Website retiree le
  // meme jour (demande d'Aurelie), le champ existe toujours en base mais
  // n'est plus affiche/editable dans ce tableau. Telephone juste apres
  // Type de service (27/10/2026, demande d'Aurelie) -- affiche desormais
  // toujours au meme format (voir formatPhoneFR plus bas).
  { key: 'name', label: 'Nom' },
  { key: 'role', label: 'Type de service' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'notes', label: 'Commentaire' },
  { key: 'address', label: 'Adresse' },
  { key: 'email', label: 'Email' },
]

// Formate un numero de telephone pour l'affichage, par paires de 2
// chiffres (27/10/2026, demande d'Aurelie : "il faut qu'ils aient tous
// la meme apparence avec des espaces entre 2 nombres: ex 06 78 76 76
// 65") -- ne touche jamais a la valeur enregistree en base (qui peut
// rester saisie sans espaces, avec des points, etc.), uniquement a ce
// qui est affiche : recalcule a chaque rendu a partir de la valeur
// brute, donc toujours coherent meme si plusieurs admins l'ont saisi
// differemment au fil du temps.
function formatPhoneFR(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
}

// Largeur des colonnes en version ordinateur (27/10/2026, demande
// d'Aurelie : "adapte la largeur des colonnes intelligemment pour que
// nous ne soyons jamais obliges d'aller a droite avec une fleche...
// comme sur excel, on pourra manuellement modifier la largeur des
// colonnes"). Deux mecanismes :
// 1) Largeur "naturelle" de chaque colonne = largeur du plus long
//    contenu (en-tete compris), mesuree avec Canvas.measureText --
//    puis ces largeurs sont comprimees ou au contraire elargies pour
//    occuper exactement la largeur disponible du tableau (jamais de
//    defilement en usage normal), l'espace en plus etant distribue en
//    priorite aux colonnes de texte libre (Commentaire/Adresse/Email).
// 2) Un utilisateur peut ensuite glisser la bordure d'une colonne (voir
//    la poignee dans chaque <th>) pour fixer sa largeur manuellement --
//    cette colonne sort alors du calcul automatique ci-dessus, les
//    autres se partagent l'espace restant. Double-clic sur la bordure =
//    retour a l'ajustement automatique. Mémorisé par categorie dans
//    localStorage (purement un confort d'affichage, aucune donnee).
const MIN_COL_WIDTH = 64
const ACTION_COL_WIDTH = 56 // w-14, colonne deplacer/supprimer
const CELL_PADDING_X = 30 // px-3 (12px*2) + marge pour la fleche de tri
const FLEX_COLUMN_KEYS: SortKey[] = ['notes', 'address', 'email']

let measureCanvas: HTMLCanvasElement | null = null
function measureTextWidth(text: string, font: string): number {
  if (typeof document === 'undefined') return text.length * 7
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return text.length * 7
  ctx.font = font
  return ctx.measureText(text).width
}

function cellText(row: Contact, key: SortKey): string {
  if (key === 'phone') return row.phone ? formatPhoneFR(row.phone) : ''
  return sortValue(row, key)
}

function sortValue(row: Contact, key: SortKey): string {
  switch (key) {
    case 'role':
      return row.role
    case 'name':
      return row.name
    case 'notes':
      return row.notes ?? ''
    case 'phone':
      return row.phone ?? ''
    case 'address':
      return row.address ?? ''
    case 'email':
      return row.email ?? ''
  }
}

// Tableau d'une catégorie de contacts — reprend le même tri que le
// tableau "Membres" (MembersTable.tsx) : plus de rangée de pastilles
// "Trier par :" au-dessus du tableau, le tri se fait en cliquant
// directement sur l'en-tête d'une colonne, un second clic sur la même
// colonne inverse l'ordre. Tri par défaut : Nom, ordre alphabétique.
// Mêmes caractéristiques visuelles que ce tableau (en-tête gris clair
// majuscules, bordures, espacements des cellules) — demandé par
// Nicolas le 30/09/2026.
function CategoryPanel({ categoryId, contacts, canEdit }: { categoryId: string; contacts: Contact[]; canEdit: boolean }) {
  const [rows, setRows] = useState(contacts)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [adding, setAdding] = useState(false)
  const [movingId, setMovingId] = useState<string | null>(null)

  // --- Largeur des colonnes (27/10/2026, demande d'Aurelie) : voir le
  //     grand commentaire au-dessus de MIN_COL_WIDTH plus haut. ---
  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setContainerWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const storageKey = `contacts-col-widths-${categoryId}`
  const [manualWidths, setManualWidths] = useState<Partial<Record<SortKey, number>>>({})
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setManualWidths(JSON.parse(raw))
    } catch {
      // silencieux -- navigation privee, stockage bloque... on repart
      // simplement de l'ajustement automatique.
    }
  }, [storageKey])

  const naturalWidths = useMemo(() => {
    const bodyFont = '14px Georgia, serif'
    const headerFont = '700 11px Georgia, serif'
    const widths = {} as Record<SortKey, number>
    for (const col of COLUMNS) {
      let max = measureTextWidth(col.label, headerFont) + 14 // + place pour la fleche de tri
      for (const row of rows) {
        const w = measureTextWidth(cellText(row, col.key), bodyFont)
        if (w > max) max = w
      }
      widths[col.key] = Math.max(MIN_COL_WIDTH, Math.round(max + CELL_PADDING_X))
    }
    return widths
  }, [rows])

  const columnWidths = useMemo(() => {
    const reserved = canEdit ? ACTION_COL_WIDTH : 0
    const available = Math.max(0, containerWidth - reserved)
    const result = {} as Record<SortKey, number>
    for (const col of COLUMNS) {
      const manual = manualWidths[col.key]
      if (manual != null) result[col.key] = manual
    }
    const autoKeys = COLUMNS.map((c) => c.key).filter((k) => manualWidths[k] == null)
    if (autoKeys.length === 0) return result
    const manualTotal = COLUMNS.reduce((sum, c) => sum + (manualWidths[c.key] ?? 0), 0)
    const autoAvailable = Math.max(0, available - manualTotal)
    const autoNaturalTotal = autoKeys.reduce((sum, k) => sum + naturalWidths[k], 0)
    if (autoNaturalTotal <= autoAvailable) {
      // Assez de place : la colonne garde sa largeur naturelle, l'espace
      // en trop est distribue en priorite aux colonnes de texte libre
      // (ou a toutes, proportionnellement, si aucune n'est "libre" parmi
      // les colonnes encore automatiques).
      const extra = autoAvailable - autoNaturalTotal
      const flexAuto = autoKeys.filter((k) => FLEX_COLUMN_KEYS.includes(k))
      const flexTotal = flexAuto.reduce((s, k) => s + naturalWidths[k], 0)
      for (const k of autoKeys) {
        const useFlex = flexTotal > 0
        const base = useFlex ? (flexAuto.includes(k) ? naturalWidths[k] : 0) : naturalWidths[k]
        const pool = useFlex ? flexTotal : autoNaturalTotal
        const bonus = pool > 0 ? Math.round(extra * (base / pool)) : 0
        result[k] = naturalWidths[k] + bonus
      }
    } else {
      // Pas assez de place : on comprime toutes les colonnes encore
      // automatiques proportionnellement, sans jamais descendre sous
      // MIN_COL_WIDTH (au pire, un defilement redevient necessaire --
      // cas rare, fenetre tres etroite ou beaucoup de colonnes deja
      // fixees manuellement a une grande largeur).
      const scale = autoNaturalTotal > 0 ? autoAvailable / autoNaturalTotal : 1
      for (const k of autoKeys) {
        result[k] = Math.max(MIN_COL_WIDTH, Math.round(naturalWidths[k] * scale))
      }
    }
    return result
  }, [containerWidth, manualWidths, naturalWidths, canEdit])

  const totalTableWidth =
    COLUMNS.reduce((sum, c) => sum + (columnWidths[c.key] ?? MIN_COL_WIDTH), 0) + (canEdit ? ACTION_COL_WIDTH : 0)

  const resizingRef = useRef<{ key: SortKey; startX: number; startWidth: number } | null>(null)
  const persistManualWidths = (next: Partial<Record<SortKey, number>>) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // silencieux
    }
  }
  const startResize = (key: SortKey, e: React.MouseEvent) => {
    e.preventDefault()
    const startWidth = columnWidths[key] ?? MIN_COL_WIDTH
    resizingRef.current = { key, startX: e.clientX, startWidth }
    const onMove = (ev: MouseEvent) => {
      const state = resizingRef.current
      if (!state) return
      const next = Math.max(MIN_COL_WIDTH, Math.round(state.startWidth + (ev.clientX - state.startX)))
      setManualWidths((prev) => ({ ...prev, [state.key]: next }))
    }
    const onUp = () => {
      resizingRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setManualWidths((prev) => {
        persistManualWidths(prev)
        return prev
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  // Double-clic sur la bordure = retour a l'ajustement automatique pour
  // cette colonne (comme un "auto-fit" Excel).
  const resetColumnWidth = (key: SortKey) => {
    setManualWidths((prev) => {
      const next = { ...prev }
      delete next[key]
      persistManualWidths(next)
      return next
    })
  }

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const copy = [...rows]
    copy.sort((a, b) => {
      const aVal = sortValue(a, sortKey)
      const bVal = sortValue(b, sortKey)
      // Une ligne sans valeur sur la colonne triee reste toujours en bas
      // du tableau, quel que soit le sens du tri (demande d'Aurelie le
      // 27/10/2026) : une ligne juste ajoutee via "Ajouter une ligne" a
      // un nom (et tout le reste) vide, donc sans ce cas particulier
      // elle remontait en tete de tableau en tri alphabetique croissant
      // (chaine vide < n'importe quel nom).
      const aEmpty = aVal === ''
      const bEmpty = bVal === ''
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
      if (!aEmpty) {
        const primary = aVal.localeCompare(bVal)
        if (primary !== 0) return dir * primary
      }
      // Egalite (ex. meme type de service, valeurs vides des deux
      // cotes, ou deux lignes vides nouvellement ajoutees) : on retombe
      // toujours sur Nom puis Type de service pour un ordre stable et
      // previsible (deux lignes vides restent alors dans leur ordre
      // d'ajout, la plus recente en dernier).
      return dir * (a.name.localeCompare(b.name) || a.role.localeCompare(b.role))
    })
    return copy
  }, [rows, sortKey, sortDir])

  const patch = async (id: string, field: keyof Contact, next: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: next } : r)))
    try {
      await fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: next }),
      })
    } catch {
      // silencieux — la valeur reste modifiée à l'écran, un rechargement
      // de page reviendrait à la dernière valeur enregistrée si ça a échoué
    }
  }

  const remove = async (id: string) => {
    // Confirmation avant suppression (25/10/2026, demande d'Aurélie, voir
    // le commentaire équivalent dans BudgetBoard.tsx pour le contexte
    // complet).
    if (!confirm('Supprimer ce contact ?')) return
    setRows((prev) => prev.filter((r) => r.id !== id))
    try {
      await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' })
    } catch {
      // silencieux
    }
  }

  // Déplace un contact vers une autre catégorie : il disparaît de cette
  // pastille-ci (comme une suppression côté affichage), et réapparaîtra
  // dans la pastille de destination à sa prochaine ouverture.
  const moveToCategory = async (id: string, newCategory: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
    setMovingId(null)
    try {
      await fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, category: newCategory }),
      })
    } catch {
      // silencieux
    }
  }

  const addRow = async () => {
    setAdding(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: categoryId, name: '', role: '' }),
      })
      const data = await res.json()
      if (res.ok) setRows((prev) => [...prev, data.contact])
    } catch {
      // silencieux
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-3">
      {sorted.length > 0 ? (
        <div ref={scrollRef} className="overflow-x-auto rounded-lg border border-border">
          <table className="text-left text-sm" style={{ tableLayout: 'fixed', width: totalTableWidth }}>
            <colgroup>
              {COLUMNS.map((col) => (
                <col key={col.key} style={{ width: columnWidths[col.key] ?? MIN_COL_WIDTH }} />
              ))}
              {canEdit && <col style={{ width: ACTION_COL_WIDTH }} />}
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                {COLUMNS.map((col) => (
                  <th key={col.key} className="relative overflow-hidden px-3 py-2 font-medium">
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="inline-flex max-w-full items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground"
                    >
                      <span className="truncate">{col.label}</span>
                      {sortKey === col.key && <span aria-hidden="true">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                    {/* Poignee de redimensionnement "a la Excel" (27/10/2026,
                        demande d'Aurelie) -- version ordinateur uniquement
                        (md:block), double-clic = retour a l'ajustement
                        automatique (resetColumnWidth). */}
                    <span
                      onMouseDown={(e) => startResize(col.key, e)}
                      onDoubleClick={() => resetColumnWidth(col.key)}
                      className="absolute right-0 top-0 hidden h-full w-2 translate-x-1/2 cursor-col-resize select-none md:block"
                    />
                  </th>
                ))}
                {canEdit && <th className="w-14" />}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="overflow-hidden px-3 py-2.5 font-medium text-foreground">
                    <EditableCell value={c.name} editable={canEdit} placeholder="Nom" onSave={(v) => patch(c.id, 'name', v)} />
                  </td>
                  <td className="overflow-hidden px-3 py-2.5">
                    <EditableCell value={c.role} editable={canEdit} placeholder="Type de service" onSave={(v) => patch(c.id, 'role', v)} />
                  </td>
                  <td className="overflow-hidden px-3 py-2.5">
                    {canEdit ? (
                      <EditableCell
                        value={formatPhoneFR(c.phone ?? '')}
                        editable
                        type="tel"
                        placeholder="Téléphone"
                        onSave={(v) => patch(c.id, 'phone', v)}
                      />
                    ) : c.phone ? (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                        <Phone className="h-3.5 w-3.5" />
                        {formatPhoneFR(c.phone)}
                      </a>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className="overflow-hidden px-3 py-2.5">
                    <EditableCell value={c.notes ?? ''} editable={canEdit} placeholder="Commentaire" onSave={(v) => patch(c.id, 'notes', v)} />
                  </td>
                  <td className="overflow-hidden px-3 py-2.5">
                    <EditableCell value={c.address ?? ''} editable={canEdit} placeholder="Adresse" onSave={(v) => patch(c.id, 'address', v)} />
                  </td>
                  <td className="overflow-hidden px-3 py-2.5">
                    {canEdit ? (
                      <EditableCell value={c.email ?? ''} editable type="email" placeholder="Email" onSave={(v) => patch(c.id, 'email', v)} />
                    ) : c.email ? (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-primary hover:underline">
                        <Mail className="h-3.5 w-3.5" />
                        {c.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="overflow-hidden px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {movingId === c.id ? (
                          <select
                            autoFocus
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) moveToCategory(c.id, e.target.value)
                              else setMovingId(null)
                            }}
                            onBlur={() => setMovingId(null)}
                            className="h-7 max-w-[140px] rounded-md border border-border bg-background px-1 text-xs text-foreground outline-none"
                          >
                            <option value="" disabled>
                              Déplacer vers…
                            </option>
                            {CONTACT_CATEGORIES.filter((cat) => cat.id !== categoryId).map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setMovingId(c.id)}
                            aria-label="Déplacer vers une autre catégorie"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </button>
                        )}
                        <button type="button" onClick={() => remove(c.id)} aria-label="Supprimer ce contact" className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Aucun contact dans cette catégorie pour l’instant.</p>
      )}

      {canEdit && (
        // Pastille "Ajouter une ligne" alignée le 23/10/2026 (demande
        // d'Aurélie) sur le style commun des pastilles d'action du site
        // (actionPillClass, voir utils.ts -- "Valider", "+ Ajouter des
        // photos", etc.), à la place de son style bespoke d'origine.
        <button type="button" onClick={addRow} disabled={adding} className={actionPillClass}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter une ligne
        </button>
      )}
    </div>
  )
}

// Pastille de catégorie repliable — reprend exactement le style et le
// comportement des widgets du "Guide de la maison" (GuideCard.tsx) :
// une pastille par ligne, pleine largeur du conteneur (donc pleine
// largeur d'écran en mobile, où c'est le seul format demandé), et le
// tableau de cette catégorie apparaît directement en dessous d'elle au
// clic, indépendamment des autres. Remplace l'ancienne barre de
// pastilles en ligne (largeur au contenu) + panneau unique affiché tout
// en bas de la liste — demandé par Nicolas le 30/09/2026.
function ContactCategoryCard({
  category,
  contacts,
  canEdit,
}: {
  category: (typeof CONTACT_CATEGORIES)[number]
  contacts: Contact[]
  canEdit: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Card className="py-0">
      {/* Entete replie cale a exactement 40px de hauteur totale, titre
          centre verticalement -- voir GuideCard.tsx, meme traitement,
          demande par Nicolas le 01/10/2026. */}
      <CardHeader>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          className="flex h-10 w-full items-center justify-between gap-2 text-left hover:opacity-80"
        >
          <CardTitle className="text-sm md:text-base uppercase tracking-wide">
            {category.label}
            {contacts.length > 0 && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">({contacts.length})</span>
            )}
          </CardTitle>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </button>
      </CardHeader>
      {isOpen && (
        <CardContent className="pb-4">
          {/* key=category.id : force un remount à la réouverture, pour
              repartir des données à jour plutôt que de garder l'état
              (lignes, tri) de la dernière fois où cette pastille était
              ouverte — même logique que l'ancien remount par catégorie. */}
          <CategoryPanel key={category.id} categoryId={category.id} contacts={contacts} canEdit={canEdit} />
        </CardContent>
      )}
    </Card>
  )
}

// `canEdit` (ex-`isAdmin`, renomme le 23/10/2026) : ajouter, modifier ou
// supprimer un contact dans un widget (Services/Restaurants/etc.) est
// desormais ouvert aux comptes Admin ET Famille -- demande d'Aurelie le
// 23/10/2026, qui remplace le precedent reglage reserve aux seuls
// admins. Calcule dans dashboard/contacts/page.tsx a partir du role du
// profil ; les comptes 'friend' restent en lecture seule (canEdit=false).
export function ContactsBoard({ contacts, canEdit }: { contacts: Contact[]; canEdit: boolean }) {
  const byCategory = useMemo(() => {
    const map: Record<string, Contact[]> = {}
    for (const c of contacts) {
      if (!map[c.category]) map[c.category] = []
      map[c.category].push(c)
    }
    return map
  }, [contacts])

  return (
    <div className="space-y-3">
      {CONTACT_CATEGORIES.map((cat) => (
        <ContactCategoryCard
          key={cat.id}
          category={cat}
          contacts={byCategory[cat.id] ?? []}
          canEdit={canEdit}
        />
      ))}
    </div>
  )
}
