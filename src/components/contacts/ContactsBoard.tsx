'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Trash2,
  ChevronDown,
  Phone,
  Mail,
  ArrowRightLeft,
  Pencil,
  Briefcase,
  Zap,
  Droplet,
  Flame,
  Home,
  HardHat,
  Trees,
  KeyRound,
  Paintbrush,
  Sparkles,
  Waves,
  Wind,
  Wifi,
  Stethoscope,
  Pill,
  Cross,
  PawPrint,
  UtensilsCrossed,
  ShoppingBasket,
  Store,
  Mountain,
  Truck,
  Car,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { actionPillClass, cn } from '@/lib/utils'
import { CONTACT_CATEGORIES } from '@/lib/contact-categories'
import { Contact } from '@/types'

// Une cellule éditable en place : un admin clique dessus, elle devient un
// champ de saisie, l'enregistrement se fait à la perte du focus ou sur
// Entrée (Échap annule) — même interaction que la pastille "Cotisation
// mensuelle" du tableau de bord.
//
// Variante "multiline" (02/11/2026, demande de Nicolas pour la colonne
// "Historique" -- ex-"Commentaire" -- "il ne faut pas que les textes
// soient tronqués [...] si on fait un passage à la ligne [...] cela
// crée une nouvelle ligne également, de sorte à pouvoir faire des
// listes d'interventions") : affichage en `whitespace-pre-wrap` au lieu
// de `truncate` (plus de texte coupé, la cellule grandit en hauteur
// selon son contenu comme le reste du tableau), et édition dans un
// <textarea> plutôt qu'un <input> -- Entrée y insère un retour à la
// ligne normalement (comportement natif, aucune interception
// particulière, à la différence de la variante <input> ci-dessous qui
// valide sur Entrée) ; Échap annule toujours, et l'enregistrement se
// fait à la perte du focus, comme pour les autres colonnes.
function EditableCell({
  value,
  editable,
  placeholder,
  onSave,
  type = 'text',
  multiline = false,
  // Zone cliquable reduite au texte lui-meme plutot qu'a toute la
  // largeur du conteneur (03/11/2026, demande de Nicolas, carte contact
  // mobile depliee : "si on clique sur la zone rouge [le nom], elle
  // devient editable. Si on clique sur la zone verte [l'espace vide a
  // cote], rien ne se passe") -- par defaut false (comportement inchange
  // partout ailleurs, ex. les cellules du tableau desktop, qui veulent
  // au contraire toute la largeur de la colonne cliquable).
  fitContent = false,
}: {
  value: string
  editable: boolean
  placeholder: string
  onSave: (next: string) => void
  type?: 'text' | 'tel' | 'email'
  multiline?: boolean
  fitContent?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (!editable) {
    return (
      <span
        className={cn('block', multiline ? 'whitespace-pre-wrap break-words' : 'truncate', value ? 'text-foreground' : 'text-muted-foreground/60')}
      >
        {value || '—'}
      </span>
    )
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false)
            if (draft !== value) onSave(draft)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
          }}
          placeholder={placeholder}
          rows={Math.max(2, draft.split('\n').length)}
          className="w-full min-w-[100px] resize-y rounded-md border border-border bg-background px-1.5 py-1 text-sm text-foreground outline-none"
        />
      )
    }
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
      className={cn(
        fitContent ? 'inline-block w-auto max-w-full' : 'w-full',
        'rounded px-1.5 py-1 text-left text-sm hover:bg-muted',
        multiline ? 'whitespace-pre-wrap break-words' : 'truncate'
      )}
    >
      {value ? <span className="text-foreground">{value}</span> : <span className="text-muted-foreground/60">{placeholder}</span>}
    </button>
  )
}

// Pictogramme par type de service (06/11/2026, demande de Nicolas : "à
// côté de chaque type de service, propose un petit pictogramme juste
// avant, pour qu'on se repère plus facilement, à la manière des pannes
// électriques ou fuites d'eau") -- même principe que CATEGORY_ICONS dans
// EmergencyGuide.tsx, mais ici le "type de service" est un texte libre
// (pas une catégorie fixe comme dans le Guide ou dans TasksBoard.tsx),
// donc la correspondance se fait par mots-clés plutôt que par identifiant
// exact. roleIconKey() ne renvoie qu'une clé (jamais le composant icône
// lui-même) : le choix du composant se fait par un lookup direct dans
// ROLE_ICON_MAP au moment du rendu (voir MobileContactCard) -- seule forme
// qu'accepte le linter (règle react-hooks/static-components) pour un
// composant choisi dynamiquement. Comparaison insensible à la casse et
// aux accents, première entrée dont un mot-clé est contenu dans le rôle
// qui l'emporte ; Briefcase sert de pictogramme par défaut pour tout rôle
// qui ne correspond à rien ici (texte libre, donc forcément incomplet --
// le compléter au besoin plutôt que d'en faire un champ figé).
const ROLE_ICON_MAP: Record<string, LucideIcon> = {
  electricite: Zap,
  plomberie: Droplet,
  chauffage: Flame,
  toiture: Home,
  maconnerie: HardHat,
  jardin: Trees,
  serrurerie: KeyRound,
  peinture: Paintbrush,
  menage: Sparkles,
  piscine: Waves,
  climatisation: Wind,
  informatique: Wifi,
  medecin: Stethoscope,
  pharmacie: Pill,
  sante: Cross,
  veterinaire: PawPrint,
  restauration: UtensilsCrossed,
  alimentation: ShoppingBasket,
  boutique: Store,
  tourisme: Mountain,
  transport: Truck,
  automobile: Car,
  bricolage: Wrench,
}

const ROLE_ICON_KEYWORDS: { key: string; keywords: string[] }[] = [
  { key: 'electricite', keywords: ['electric'] },
  { key: 'plomberie', keywords: ['plomb', 'fuite', 'eau'] },
  { key: 'chauffage', keywords: ['chauffage', 'chaudiere', 'cheminee', 'ramon'] },
  { key: 'toiture', keywords: ['couvert', 'toitur', 'toit', 'charpent', 'facade', 'ravalement'] },
  { key: 'maconnerie', keywords: ['macon', 'construction', 'batiment', 'terrassement'] },
  { key: 'jardin', keywords: ['jardin', 'elagu', 'tond', 'tonte', 'paysag', 'arbre'] },
  { key: 'serrurerie', keywords: ['serrur'] },
  { key: 'peinture', keywords: ['peintre', 'peinture'] },
  { key: 'menage', keywords: ['menage', 'nettoyage'] },
  { key: 'piscine', keywords: ['piscine'] },
  { key: 'climatisation', keywords: ['climatisation', 'clim'] },
  { key: 'informatique', keywords: ['internet', 'informatique', 'reseau', 'wifi'] },
  { key: 'medecin', keywords: ['medecin', 'docteur', 'generaliste'] },
  { key: 'pharmacie', keywords: ['pharmaci'] },
  { key: 'sante', keywords: ['dentist', 'infirmi', 'kine', 'osteopath'] },
  { key: 'veterinaire', keywords: ['veterinaire', 'veto'] },
  { key: 'restauration', keywords: ['restaurant', 'pizzeria', 'bar', 'auberge', 'bistrot'] },
  { key: 'alimentation', keywords: ['boulanger', 'patissier', 'epicerie', 'marche', 'primeur', 'fromager', 'maraich', 'vigneron', 'producteur'] },
  { key: 'boutique', keywords: ['brocante', 'boutique', 'potier', 'artisan'] },
  { key: 'tourisme', keywords: ['rando', 'musee', 'chateau', 'visite', 'tourisme'] },
  { key: 'transport', keywords: ['livraison', 'transport', 'demenag'] },
  { key: 'automobile', keywords: ['garage', 'mecanicien', 'automobile'] },
  { key: 'bricolage', keywords: ['bricolage', 'homme a tout faire', 'multiservice', 'reparation'] },
]

function normalizeRoleForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function roleIconKey(role: string): string {
  const normalized = normalizeRoleForMatch(role)
  const match = ROLE_ICON_KEYWORDS.find(({ keywords }) => keywords.some((k) => normalized.includes(k)))
  return match ? match.key : ''
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
  { key: 'notes', label: 'Historique' },
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
  // Carte dépliée dans la pile "Wallet" de la version mobile
  // (02/11/2026, demande de Nicolas) -- une seule à la fois, voir
  // MobileContactCard.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Carte en cours d'édition explicite (06/11/2026, demande de Nicolas :
  // symbole d'édition dédié plutôt que des champs cliquables directement
  // -- voir le gros commentaire dans MobileContactCard). Toujours remise à
  // null quand on déplie/replie une carte, pour ne jamais rouvrir une
  // carte déjà en mode édition par surprise.
  const [editingId, setEditingId] = useState<string | null>(null)

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

  // Tri dedie a la pile de cartes mobile (03/11/2026, demande de
  // Nicolas : "classe les cartes par ordre alphabetique de service") --
  // independant de `sorted` ci-dessus (tri cliquable du tableau
  // desktop, inchange, toujours Nom par defaut).
  const mobileSorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const aVal = a.role.trim()
      const bVal = b.role.trim()
      const aEmpty = aVal === ''
      const bEmpty = bVal === ''
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
      if (!aEmpty) {
        const primary = aVal.localeCompare(bVal)
        if (primary !== 0) return primary
      }
      return a.name.localeCompare(b.name)
    })
    return copy
  }, [rows])

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
        <>
        {/* Version ordinateur : tableau existant, inchangé, md+
            uniquement (02/11/2026, demande de Nicolas : la version
            mobile ci-dessous remplace ce tableau sous md, le tableau
            desktop ne change pas). */}
        <div ref={scrollRef} className="hidden overflow-x-auto rounded-lg border border-border md:block">
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
                  {/* Pas d'overflow-hidden ici (contrairement aux autres
                      cellules) : la colonne "Historique" doit pouvoir
                      grandir en hauteur sur plusieurs lignes sans que
                      rien ne la rogne (demande de Nicolas le 02/11/2026). */}
                  <td className="px-3 py-2.5 align-top">
                    <EditableCell value={c.notes ?? ''} editable={canEdit} placeholder="Historique" onSave={(v) => patch(c.id, 'notes', v)} multiline />
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

        {/* Version mobile : pile de cartes façon Wallet (02/11/2026,
            demande de Nicolas, maquette validée en amont) -- la carte du
            dessus reste toujours visible (nom, type de service,
            téléphone), le reste (email, adresse, historique) est caché,
            recouvert par la carte suivante ; on touche une carte pour la
            déplier. Voir MobileContactCard. */}
        <div className="md:hidden">
          {mobileSorted.map((c, i) => {
            const isExpanded = expandedId === c.id
            const isFirst = i === 0
            const isLast = i === mobileSorted.length - 1
            const prevExpanded = i > 0 && mobileSorted[i - 1].id === expandedId
            const nextExpanded = i < mobileSorted.length - 1 && mobileSorted[i + 1].id === expandedId
            return (
              <MobileContactCard
                key={c.id}
                contact={c}
                isExpanded={isExpanded}
                onToggle={() => {
                  setExpandedId(isExpanded ? null : c.id)
                  setEditingId(null)
                }}
                isEditing={canEdit && editingId === c.id}
                onToggleEdit={() => setEditingId(editingId === c.id ? null : c.id)}
                topRound={isFirst || isExpanded || prevExpanded}
                bottomRound={isLast || isExpanded || nextExpanded}
                flushTop={!(isFirst || isExpanded || prevExpanded)}
                canEdit={canEdit}
                categoryId={categoryId}
                patch={patch}
                remove={remove}
                moveToCategory={moveToCategory}
                movingId={movingId}
                setMovingId={setMovingId}
              />
            )
          })}
        </div>
        </>
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

// Carte "Wallet" d'un contact, version mobile (02/11/2026, demande de
// Nicolas, maquette validée en amont -- "exactement comme dans Wallet") :
// repliée, elle ne montre que le haut (nom, type de service, téléphone)
// -- le reste (email, adresse, historique) est caché, recouvert par la
// carte suivante. Les cartes d'une catégorie forment un seul bloc (coins
// arrondis seulement en haut de la première et en bas de la dernière,
// jointes par une bordure commune entre les autres -- topRound/
// bottomRound/flushTop calculés par l'appelant) ; la carte dépliée se
// détache du tas (coins arrondis, ombre) et ses voisines regagnent
// l'arrondi du côté qui la touche.
function MobileContactCard({
  contact: c,
  isExpanded,
  onToggle,
  isEditing,
  onToggleEdit,
  topRound,
  bottomRound,
  flushTop,
  canEdit,
  categoryId,
  patch,
  remove,
  moveToCategory,
  movingId,
  setMovingId,
}: {
  contact: Contact
  isExpanded: boolean
  onToggle: () => void
  isEditing: boolean
  onToggleEdit: () => void
  topRound: boolean
  bottomRound: boolean
  flushTop: boolean
  canEdit: boolean
  categoryId: string
  patch: (id: string, field: keyof Contact, next: string) => void
  remove: (id: string) => void
  moveToCategory: (id: string, newCategory: string) => void
  movingId: string | null
  setMovingId: (id: string | null) => void
}) {
  const RoleIcon = ROLE_ICON_MAP[roleIconKey(c.role)] ?? Briefcase
  return (
    <div
      className={cn('relative border border-border bg-card px-4 py-3 transition-shadow', isExpanded ? 'z-10 shadow-md' : 'shadow-none')}
      style={{
        borderTopLeftRadius: topRound ? 16 : 0,
        borderTopRightRadius: topRound ? 16 : 0,
        borderBottomLeftRadius: bottomRound ? 16 : 0,
        borderBottomRightRadius: bottomRound ? 16 : 0,
        marginTop: flushTop ? -1 : 0,
      }}
    >
      {isExpanded ? (
        // Carte dépliée (06/11/2026, demande de Nicolas) : en dehors du
        // mode édition, cliquer n'importe où sur la carte la referme --
        // le nom, le type de service, l'email et l'historique ne sont
        // donc plus directement cliquables (ancien comportement du
        // 03/11/2026 pour le nom, remplacé ici). Deux exceptions
        // explicitement demandées, chacune en stopPropagation pour ne
        // pas aussi refermer la carte : le téléphone (appel direct) et
        // l'adresse (recherche Google Maps). L'édition elle-même passe
        // maintenant par le bouton crayon dédié ci-dessous (onToggleEdit),
        // qui désactive ce "clic pour refermer" tant que la carte est en
        // édition.
        <div onClick={!isEditing ? onToggle : undefined}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              {isEditing ? (
                <EditableCell value={c.name} editable placeholder="Nom" onSave={(v) => patch(c.id, 'name', v)} fitContent />
              ) : (
                <div className="truncate font-medium text-foreground">
                  {c.name || <span className="text-muted-foreground/60">Nom</span>}
                </div>
              )}
              <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <RoleIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{c.role || <span className="text-muted-foreground/40">Type de service</span>}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              aria-label="Replier"
              className="mt-1 shrink-0 text-muted-foreground"
            >
              <ChevronDown className="h-4 w-4 rotate-180" />
            </button>
          </div>
          <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Téléphone</div>
              {isEditing ? (
                <EditableCell
                  value={formatPhoneFR(c.phone ?? '')}
                  editable
                  type="tel"
                  placeholder="Téléphone"
                  onSave={(v) => patch(c.id, 'phone', v)}
                />
              ) : c.phone ? (
                <a
                  href={`tel:${c.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-primary"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {formatPhoneFR(c.phone)}
                </a>
              ) : (
                <span className="text-muted-foreground/60">—</span>
              )}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Email</div>
              {isEditing ? (
                <EditableCell value={c.email ?? ''} editable type="email" placeholder="Email" onSave={(v) => patch(c.id, 'email', v)} />
              ) : (
                <span className={cn('block truncate', c.email ? 'text-foreground' : 'text-muted-foreground/60')}>
                  {c.email || '—'}
                </span>
              )}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Adresse</div>
              {isEditing ? (
                <EditableCell value={c.address ?? ''} editable placeholder="Adresse" onSave={(v) => patch(c.id, 'address', v)} />
              ) : c.address ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="block text-primary"
                >
                  {c.address}
                </a>
              ) : (
                <span className="text-muted-foreground/60">—</span>
              )}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Historique</div>
              {isEditing ? (
                <EditableCell value={c.notes ?? ''} editable placeholder="Historique" onSave={(v) => patch(c.id, 'notes', v)} multiline />
              ) : (
                <span className={cn('block whitespace-pre-wrap break-words', c.notes ? 'text-foreground' : 'text-muted-foreground/60')}>
                  {c.notes || '—'}
                </span>
              )}
            </div>
            {canEdit && (
              <div className="flex items-center gap-4 pt-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={onToggleEdit}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {isEditing ? 'Terminer' : 'Modifier'}
                </button>
                {movingId === c.id ? (
                  <select
                    autoFocus
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) moveToCategory(c.id, e.target.value)
                      else setMovingId(null)
                    }}
                    onBlur={() => setMovingId(null)}
                    className="h-8 max-w-[180px] rounded-md border border-border bg-background px-1.5 text-xs text-foreground outline-none"
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
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Déplacer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-2 text-left">
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">
              {c.name || <span className="text-muted-foreground/60">Nom</span>}
            </div>
            <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <RoleIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{c.role || <span className="text-muted-foreground/40">Type de service</span>}</span>
            </div>
          </div>
          <div className="shrink-0 text-xs text-primary">{c.phone ? formatPhoneFR(c.phone) : ''}</div>
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
