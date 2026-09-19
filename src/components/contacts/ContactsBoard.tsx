'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2, ChevronDown, Phone, Mail } from 'lucide-react'
import { CONTACT_CATEGORIES } from '@/lib/contact-categories'
import { Contact } from '@/types'

type SortKey = 'nom' | 'service'

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
    return <span className={value ? 'text-foreground' : 'text-muted-foreground/60'}>{value || '—'}</span>
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

function CategoryPanel({ categoryId, contacts, isAdmin }: { categoryId: string; contacts: Contact[]; isAdmin: boolean }) {
  const [rows, setRows] = useState(contacts)
  const [sortKey, setSortKey] = useState<SortKey>('nom')
  const [adding, setAdding] = useState(false)

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) =>
      sortKey === 'nom' ? a.name.localeCompare(b.name) : a.role.localeCompare(b.role)
    )
    return copy
  }, [rows, sortKey])

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
    setRows((prev) => prev.filter((r) => r.id !== id))
    try {
      await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' })
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
    <div className="space-y-3 rounded-xl border border-border bg-card/60 backdrop-blur-sm p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Trier par :</span>
        {(['nom', 'service'] as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortKey(key)}
            className={`inline-flex h-6 items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors ${sortKey === key ? 'bg-foreground text-background' : 'border border-border bg-background text-foreground hover:bg-muted'}`}
          >
            {key === 'nom' ? 'Nom' : 'Type de service'}
          </button>
        ))}
      </div>

      {sorted.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-1.5 py-1.5 font-medium">Type de service</th>
                <th className="px-1.5 py-1.5 font-medium">Nom</th>
                <th className="px-1.5 py-1.5 font-medium">Téléphone</th>
                <th className="px-1.5 py-1.5 font-medium">Adresse</th>
                <th className="px-1.5 py-1.5 font-medium">Email</th>
                <th className="px-1.5 py-1.5 font-medium">Commentaire</th>
                {isAdmin && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-1.5 py-1">
                    <EditableCell value={c.role} editable={isAdmin} placeholder="Type de service" onSave={(v) => patch(c.id, 'role', v)} />
                  </td>
                  <td className="px-1.5 py-1">
                    <EditableCell value={c.name} editable={isAdmin} placeholder="Nom" onSave={(v) => patch(c.id, 'name', v)} />
                  </td>
                  <td className="px-1.5 py-1">
                    {isAdmin ? (
                      <EditableCell value={c.phone ?? ''} editable type="tel" placeholder="Téléphone" onSave={(v) => patch(c.id, 'phone', v)} />
                    ) : c.phone ? (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                        <Phone className="h-3.5 w-3.5" />
                        {c.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className="px-1.5 py-1">
                    <EditableCell value={c.address ?? ''} editable={isAdmin} placeholder="Adresse" onSave={(v) => patch(c.id, 'address', v)} />
                  </td>
                  <td className="px-1.5 py-1">
                    {isAdmin ? (
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
                  <td className="px-1.5 py-1">
                    <EditableCell value={c.notes ?? ''} editable={isAdmin} placeholder="Commentaire" onSave={(v) => patch(c.id, 'notes', v)} />
                  </td>
                  {isAdmin && (
                    <td className="px-1.5 py-1">
                      <button type="button" onClick={() => remove(c.id)} aria-label="Supprimer ce contact" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
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

      {isAdmin && (
        <button
          type="button"
          onClick={addRow}
          disabled={adding}
          className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter une ligne
        </button>
      )}
    </div>
  )
}

export function ContactsBoard({ contacts, isAdmin }: { contacts: Contact[]; isAdmin: boolean }) {
  const [openCategory, setOpenCategory] = useState<string | null>(null)

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
      <div className="flex flex-wrap gap-2">
        {CONTACT_CATEGORIES.map((cat) => {
          const count = byCategory[cat.id]?.length ?? 0
          const active = openCategory === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setOpenCategory(active ? null : cat.id)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${active ? 'bg-foreground text-background' : 'border border-border bg-card/60 backdrop-blur-sm text-foreground hover:bg-muted'}`}
            >
              {cat.label}
              {count > 0 && <span className="text-xs opacity-70">({count})</span>}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${active ? 'rotate-180' : ''}`} />
            </button>
          )
        })}
      </div>

      {openCategory && (
        // key=openCategory force un remount au changement de catégorie,
        // pour que l'état interne (lignes, tri) reparte à zéro plutôt que
        // de garder les lignes de la catégorie précédente.
        <CategoryPanel key={openCategory} categoryId={openCategory} contacts={byCategory[openCategory] ?? []} isAdmin={isAdmin} />
      )}
    </div>
  )
}
