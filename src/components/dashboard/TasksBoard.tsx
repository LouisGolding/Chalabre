'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronDown, MessageCircle, Pencil, Phone, Trash2, X } from 'lucide-react'
import { actionPillClass, cn, properCase, viewTogglePillClass } from '@/lib/utils'
import { MONTH_OPTIONS, SEASON_OPTIONS, PERIOD_LABELS, TaskPeriod, isPeriodCurrent } from '@/lib/task-periods'
import { TaskContactTag, TaskNote } from '@/types'

// Refonte complète du 27/09/2026, demandée par Nicolas (l'onglet devient
// "Entretien" — voir taches/page.tsx). Résumé des règles, pour ne pas les
// reperdre :
// - Catégories : Réparation / Plomberie / Électricité / Jardin /
//   Manutention / Autres ("entretien" gardé en base pour les anciennes
//   lignes, plus proposé à la création — voir CATEGORY_LABEL).
// - Urgence : les 3 choix existants (inchangé).
// - Période : mois ou saison (inchangé, juste renommée "Période").
// - Récurrence : uniquement pour la catégorie "Jardin" — 1 fois / chaque
//   mois / chaque année.
// - Une fois ajoutée, une tâche apparaît dans "À faire ce mois-ci" ou
//   "À faire" (selon sa période), sauf le jardin qui a sa propre liste
//   ("Jardin", toutes ses tâches, actives ou récemment cochées).
// - Tâches non-jardin (donc sans récurrence) cochées : au bout de 30
//   jours, passent dans "Archives" (repliée par défaut, cliquable).
// - Tâches jardin cochées : jamais archivées ; disparaissent au bout de
//   15 jours, puis réapparaissent (redeviennent actives) au rythme de
//   leur récurrence — sauf "1 fois", qui ne réapparaît pas. Ce
//   "réveil" est recalculé au chargement de la page (useEffect
//   ci-dessous) : pas de tâche planifiée côté serveur pour l'instant,
//   donc une tâche jardin ne réapparaît vraiment que quand quelqu'un
//   rouvre cette page après l'échéance — suffisant pour l'usage prévu.
// - Tri au choix, par urgence ou par catégorie, appliqué aux 4 listes.
//
// Refonte du 19/10/2026 (demandée par Aurélie, maquette Artifact
// "Entretien — Suivi & Contact") -- remplace l'ancien commentaire
// unique proposé à la coche :
// - "Suivi" : plusieurs notes datées par tâche (table `task_notes`),
//   ajoutables à tout moment (pas seulement en cochant la tâche).
//   Chaque note peut porter une date de RDV facultative -- dès qu'elle
//   est à moins de 30 jours, le RDV apparaît sur la page d'accueil
//   (voir dashboard/page.tsx, widget "RDV à venir"). Append-only, comme
//   les commentaires de Réalisations : pas de modification, suppression
//   par l'auteur ou un admin.
// - "Contact" : un contact de la catégorie "Services" (Contacts)
//   associable à la tâche (table `task_contacts`) -- un seul suffit
//   (27/10/2026, demande d'Aurélie).
// - Les deux sont ouverts à l'admin ET à la famille (indépendant de
//   `canEdit`, réservé lui à l'ajout/suppression de tâche).
//
// Complement du 04/10/2026 (demande par Nicolas) :
// - Pastilles de categorie/urgence/periode/recurrence (formulaire
//   d'ajout) et pastilles de tri : meme traitement exact que le
//   selecteur de vue du Planning (voir viewTogglePillClass, utils.ts) --
//   la periode n'est plus un <select> mais des pastilles, au meme titre
//   que les autres.
// - Plus de mention "Trier par" : juste les 2 pastilles Urgence/
//   Categorie, alignees a droite sur la ligne de titre de chacune des
//   listes "A faire ce mois-ci", "A faire" et "Jardin"/"Periodique" (pas
//   sur Archives).
// - "A faire ce mois-ci" et "A faire" vivent desormais dans leur propre
//   widget ("Taches", nom provisoire choisi faute de consigne precise de
//   Nicolas sur ce point -- a confirmer), affiche avant "Entretien et
//   reparations" (qui garde le formulaire d'ajout, "Jardin" -- rebaptise
//   "Periodique" uniquement dans le libelle affiche, pas en base -- et
//   Archives).
// - Sous-libelles de chaque ligne de tache (categorie, periode, urgence)
//   desormais en majuscules, meme espacement (tracking-wide) que le
//   titre "Entretien et reparations".
// - Le titre d'une tache n'est plus tronque : il passe a la ligne quand
//   il est trop long, le reste de la ligne est inchange.
//
// Ouverture a la famille du 25/10/2026, demandee par Aurelie : "il faut
// que le widget 'entretien et reparations' soit accessible aussi aux
// comptes famille. il faut que dans la liste des taches, chacun puisse
// editer/corriger la ligne qu'il a rentre. Et il faut que les admins,
// puisse corriger chaque ligne si ils le souhaitent". La page elle-meme
// (dashboard/taches/page.tsx) autorisait deja les comptes famille a
// OUVRIR cette page, mais `canEdit` (reserve aux admins, voir policy
// "tasks_admin" en base) desactivait le formulaire d'ajout ET la case a
// cocher pour tout le monde sauf les admins -- en contradiction avec
// l'intention affichee dans api/tasks/route.ts ("le PATCH (coche) n'a
// volontairement pas de verification de role"). Changements :
// - Formulaire d'ajout et case a cocher : desormais toujours actifs des
//   qu'on peut ouvrir cette page (donc admin OU famille, "friend" etant
//   deja bloque plus haut) -- `canEdit` n'y intervient plus du tout.
// - Nouveau : chaque ligne devient editable (crayon a cote de la
//   poubelle) par son auteur (task.createdBy === currentUserId) OU par
//   un admin (canEdit) -- voir TaskRow plus bas. Cote serveur, voir
//   migration_tasks_family_access.sql (policies RLS, pas encore
//   appliquee) et la verification explicite dans le PATCH de
//   api/tasks/route.ts.
// - Inchange : `canEdit` garde son sens d'origine ("est admin") pour la
//   suppression de tache (poubelle) et pour la suppression de note de
//   suivi d'un autre auteur -- Aurelie n'a pas demande a changer ces
//   deux points.

type Category = 'entretien' | 'reparation' | 'plomberie' | 'electricite' | 'jardin' | 'manutention' | 'autre'
type Priority = 'low' | 'medium' | 'high'
type Recurrence = 'once' | 'monthly' | 'yearly'
type SortMode = 'urgence' | 'categorie'

export interface TaskItem {
  id: string
  title: string
  category: Category
  priority: Priority
  period: string | null
  recurrence: Recurrence | null
  completed: boolean
  completedAt: string | null
  // Auteur de la tache, pour determiner si l'utilisateur courant peut
  // l'editer sans etre admin (demande d'Aurelie du 25/10/2026, voir le
  // grand commentaire plus haut dans ce fichier). Distinct de
  // `authorName` ci-dessous (libelle affiche) : un id, pas un nom.
  createdBy: string | null
  authorName: string | null
  // Qui a coché la tâche, nom déjà formaté (26/10/2026, demande
  // d'Aurélie : widget "Tâches réalisées" ci-dessous, affiche "Fait le
  // ... par ..." à la place de Contact/Suivi quand la tâche est cochée)
  // -- null si jamais cochée, ou décochée depuis (voir
  // migration_tasks_completed_by.sql).
  completedByName: string | null
  // Suivi & Contact (19/10/2026, demandé par Aurélie) -- remplacent
  // l'ancien champ unique `comment` : plusieurs notes datées (chacune
  // pouvant porter une date de RDV), et un contact associé (Services,
  // ramené de plusieurs à un seul le 27/10/2026) -- voir
  // migration_task_notes_contacts.sql.
  notes: TaskNote[]
  contacts: TaskContactTag[]
}

// Un contact de la catégorie "Services" (Contacts), proposé dans le
// sélecteur de la pastille "Contact" -- juste ce qu'il faut pour
// l'afficher et l'associer.
export interface ServiceContact {
  id: string
  name: string
  role: string
}

// Ordre demandé par Nicolas pour la pastille catégorie et pour le tri
// "par catégorie". "entretien" (ancienne valeur, plus proposée à la
// création) est ajoutée à la fin pour que d'éventuelles vieilles lignes
// se trient quand même sans planter.
const SELECTABLE_CATEGORIES: Category[] = ['reparation', 'plomberie', 'electricite', 'jardin', 'manutention', 'autre']
const CATEGORY_ORDER: Category[] = [...SELECTABLE_CATEGORIES, 'entretien']

const CATEGORY_LABEL: Record<Category, string> = {
  reparation: 'Réparation',
  plomberie: 'Plomberie',
  electricite: 'Électricité',
  jardin: 'Jardin',
  manutention: 'Manutention',
  autre: 'Autres',
  entretien: 'Entretien',
}

// Suggestion "intelligente" de contact (19/10/2026, demande d'Aurélie) :
// pour les catégories qui ont un corps de métier évident, la pastille
// "Contact" ne propose que les contacts Services dont le rôle (texte libre,
// ex. "Plombier", "Électricité", "Jardinier / Débroussailleur") contient un
// des mots-clés ci-dessous -- comparaison insensible à la casse et aux
// accents. Les catégories absentes de cette liste (Réparation, Manutention)
// proposent tous les contacts Services, un travail de réparation pouvant
// nécessiter n'importe quel corps de métier. "Autres" n'a volontairement
// pas d'entrée : la pastille "+ Contact" est masquée pour cette catégorie
// (voir canAddContact dans TaskRow).
const CATEGORY_CONTACT_KEYWORDS: Partial<Record<Category, string[]>> = {
  plomberie: ['plomb'],
  electricite: ['electric'],
  jardin: ['jardin'],
}

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

// Plus de fond/encadre sur la pastille d'urgence -- demande par Nicolas
// le 05/10/2026 : seule la typo reste coloree (rouge/jaune/vert), comme
// les autres libelles de la ligne (categorie, periode).
const PRIORITY_STYLE: Record<Priority, string> = {
  low: 'text-green-600',
  medium: 'text-amber-600',
  high: 'text-red-600',
}

const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Urgente',
}

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  once: '1 fois',
  monthly: 'Chaque mois',
  yearly: 'Chaque année',
}

// Formulaire "Nouvelle tâche" en étapes (26/10/2026, demande d'Aurélie :
// "au debut, seul s'affiche 'nouvelle tache'... ainsi le choix de
// catégorie apparait, entrée ou valider, puis le choix de l'urgence,
// puis entrée ou valider, puis periode si c'est pour le jardin, puis
// PUBLIER ou entrée"). Chaque étape validée (bouton "Valider"/"Publier"
// ou touche Entrée -- les deux déclenchent le même onSubmit du <form>
// ci-dessous) révèle la suivante ; les champs déjà révélés restent
// affichés (pas de retour en arrière prévu). L'étape "période" n'existe
// que pour la catégorie "jardin" (regroupe Période + Récurrence) ; pour
// les autres catégories, on passe directement de "urgence" à "publier".
type WizardStep = 'title' | 'category' | 'urgency' | 'period' | 'recurrence' | 'ready'

function nextWizardStep(step: WizardStep, category: Category): WizardStep {
  switch (step) {
    case 'title':
      return 'category'
    case 'category':
      return 'urgency'
    case 'urgency':
      return category === 'jardin' ? 'period' : 'ready'
    // Periode et Recurrence sont deux etapes distinctes, l'une apres
    // l'autre (demande d'Aurelie du 26/10/2026 : "fait periode et
    // recurrence l'un apres l'autre") -- auparavant regroupees sous
    // une seule etape.
    case 'period':
      return 'recurrence'
    case 'recurrence':
    case 'ready':
      return 'ready'
  }
}

const DAY_MS = 1000 * 60 * 60 * 24

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return (Date.now() - new Date(iso).getTime()) / DAY_MS
}

function nextDueTime(completedAt: string, recurrence: Recurrence): number {
  const d = new Date(completedAt)
  if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (recurrence === 'yearly') d.setFullYear(d.getFullYear() + 1)
  return d.getTime()
}

function sortTasks(list: TaskItem[], mode: SortMode): TaskItem[] {
  const copy = [...list]
  if (mode === 'urgence') {
    copy.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  } else {
    copy.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
  }
  return copy
}

interface TasksBoardProps {
  initialTasks: TaskItem[]
  // Réservé aux admins côté base (policy "tasks_admin") pour ajouter ou
  // supprimer une tâche ; tout le monde peut voir la liste et cocher (le
  // "cocher" n'a jamais été réservé aux admins côté API, voir route.ts).
  canEdit: boolean
  // Contacts de la catégorie "Services" (Contacts), proposés dans le
  // sélecteur de la pastille "Contact" -- voir taches/page.tsx.
  servicesContacts: ServiceContact[]
  // Sert à savoir si on peut supprimer SA PROPRE note de suivi (en plus
  // d'un admin, qui peut toujours tout supprimer via `canEdit`).
  currentUserId: string
  // Nom (déjà formaté) du compte connecté -- pour afficher "Fait le ...
  // par ..." immédiatement à la coche, sans attendre la confirmation
  // serveur (26/10/2026, voir toggle() ci-dessous).
  currentUserName: string
}

export function TasksBoard({ initialTasks, canEdit, servicesContacts, currentUserId, currentUserName }: TasksBoardProps) {
  const [tasks, setTasks] = useState(initialTasks)
  // Widget "déroulant" (demandé par Nicolas le 27/09/2026) : replié par
  // défaut, un clic sur le titre du widget révèle le formulaire d'ajout.
  // Les listes elles-mêmes restent toujours visibles, indépendamment de
  // cet état.
  const [formOpen, setFormOpen] = useState(false)
  const [archivesOpen, setArchivesOpen] = useState(false)
  // Widget "Tâches réalisées" (26/10/2026, demande d'Aurélie) : repliée
  // par défaut, comme Archives et comme les autres widgets dépliables
  // du site (StaysHistory.tsx, etc.).
  const [doneOpen, setDoneOpen] = useState(false)
  const [sortMode] = useState<SortMode>('urgence')

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>('reparation')
  const [priority, setPriority] = useState<Priority>('medium')
  const [period, setPeriod] = useState<TaskPeriod | ''>('')
  const [recurrence, setRecurrence] = useState<Recurrence>('once')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wizardStep, setWizardStep] = useState<WizardStep>('title')

  // Suivi & Contact (19/10/2026, demandé par Aurélie) : état d'affichage
  // (panneau "Suivi" déplié ou non, sélecteur "Contact" ouvert ou non) et
  // brouillons (texte / date de RDV en cours de saisie), par tâche. Plus
  // lié à la coche -- une note peut s'ajouter à tout moment, pas
  // seulement en cochant la tâche (contrairement à l'ancien champ
  // `comment` unique qu'ils remplacent).
  const [suiviOpen, setSuiviOpen] = useState<Record<string, boolean>>({})
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null)
  const [draftText, setDraftText] = useState<Record<string, string>>({})
  const [draftDate, setDraftDate] = useState<Record<string, string>>({})

  // "Réveil" des tâches jardin récurrentes dont l'échéance est passée :
  // repassées à "non cochée" au chargement de la page (voir le grand
  // commentaire en tête de fichier — pas de tâche planifiée côté serveur
  // pour l'instant). Ne s'exécute qu'une fois au montage.
  useEffect(() => {
    const due = tasks.filter(
      (t) =>
        t.category === 'jardin' &&
        t.completed &&
        t.recurrence &&
        t.recurrence !== 'once' &&
        t.completedAt &&
        Date.now() >= nextDueTime(t.completedAt, t.recurrence)
    )
    if (due.length === 0) return
    setTasks((prev) =>
      prev.map((t) => (due.some((d) => d.id === t.id) ? { ...t, completed: false, completedAt: null } : t))
    )
    due.forEach((t) => {
      fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, completed: false }),
      }).catch(() => {})
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = async (task: TaskItem) => {
    const nextCompleted = !task.completed
    const nextCompletedAt = nextCompleted ? new Date().toISOString() : null
    // Affiché tout de suite dans "Fait le ... par ..." (26/10/2026) --
    // c'est forcément SOI qui vient de cocher, pas besoin d'attendre la
    // réponse serveur pour connaître ce nom. Décoché : repasse à null,
    // comme completedAt.
    const nextCompletedByName = nextCompleted ? currentUserName : null
    const previous = task
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, completed: nextCompleted, completedAt: nextCompletedAt, completedByName: nextCompletedByName }
          : t
      )
    )
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, completed: nextCompleted }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, completed: previous.completed, completedAt: previous.completedAt, completedByName: previous.completedByName }
            : t
        )
      )
      setError('Impossible de mettre à jour cette tâche.')
    }
  }

  // Édition en place d'une ligne (25/10/2026, demande d'Aurélie) --
  // réservée côté UI à l'auteur de la tâche ou à un admin (voir
  // TaskRow : canEditRow), et revérifiée côté serveur (voir le
  // commentaire en tête de api/tasks/route.ts). `updates` ne contient
  // que les champs effectivement modifiés par TaskRow.
  const editTask = async (
    id: string,
    updates: Partial<Pick<TaskItem, 'title' | 'category' | 'priority' | 'period' | 'recurrence'>>
  ) => {
    const previous = tasks
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
    } catch (err) {
      setTasks(previous)
      setError(err instanceof Error ? err.message : 'Impossible de modifier cette tâche.')
    }
  }

  // --- Suivi : plusieurs notes datées par tâche, chacune pouvant porter
  //     une date de RDV facultative (voir migration_task_notes_contacts.sql
  //     et dashboard/page.tsx pour le widget d'accueil "RDV à venir"). ---
  const toggleSuivi = (taskId: string) =>
    setSuiviOpen((prev) => ({ ...prev, [taskId]: !prev[taskId] }))

  const addNote = async (taskId: string) => {
    const text = (draftText[taskId] ?? '').trim()
    if (!text) return
    const rdv = draftDate[taskId] || null
    try {
      const res = await fetch('/api/tasks/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, text, rdv_date: rdv }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      const n = data.note
      const note: TaskNote = {
        id: n.id,
        task_id: n.task_id,
        user_id: n.user_id,
        text: n.text,
        rdv_date: n.rdv_date,
        created_at: n.created_at,
        // Casse normalisee (demande par Aurelie le 26/10/2026) : voir
        // properCase dans src/lib/utils.ts.
        profile: n.profile ? { first_name: properCase(n.profile.first_name), last_name: properCase(n.profile.last_name) } : undefined,
      }
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, notes: [...t.notes, note] } : t)))
      setDraftText((prev) => ({ ...prev, [taskId]: '' }))
      setDraftDate((prev) => ({ ...prev, [taskId]: '' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’ajout de la note')
    }
  }

  const deleteNote = async (taskId: string, noteId: string) => {
    const previous = tasks
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, notes: t.notes.filter((n) => n.id !== noteId) } : t))
    )
    try {
      const res = await fetch(`/api/tasks/notes?id=${noteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setTasks(previous)
      setError('Impossible de supprimer cette note.')
    }
  }

  // --- Contact : un artisan (catégorie "Services" de Contacts) associable
  //     à une tâche. Plusieurs étaient possibles jusqu'au 19/10/2026 ;
  //     ramené à un seul le 27/10/2026 (demande d'Aurélie : "un seul
  //     contact suffit pour chaque tâche") -- voir canAddContact dans
  //     TaskRow, qui masque la pastille "+ Contact" dès qu'un contact
  //     est déjà attaché. ---
  const attachContact = async (taskId: string, contact: ServiceContact) => {
    setPickerOpenFor(null)
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, contacts: [...t.contacts, { contact_id: contact.id, name: contact.name, role: contact.role }] }
          : t
      )
    )
    try {
      const res = await fetch('/api/tasks/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, contact_id: contact.id }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, contacts: t.contacts.filter((c) => c.contact_id !== contact.id) } : t
        )
      )
      setError('Impossible d’associer ce contact.')
    }
  }

  const detachContact = async (taskId: string, contactId: string) => {
    const previous = tasks
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, contacts: t.contacts.filter((c) => c.contact_id !== contactId) } : t))
    )
    try {
      const res = await fetch(`/api/tasks/contacts?task_id=${taskId}&contact_id=${contactId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setTasks(previous)
      setError('Impossible de retirer ce contact.')
    }
  }

  const addTask = async () => {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          priority,
          period: period || null,
          recurrence: category === 'jardin' ? recurrence : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      const t = data.task
      setTasks((prev) => [
        {
          id: t.id,
          title: t.title,
          category: t.category,
          priority: t.priority,
          period: t.period,
          recurrence: t.recurrence ?? null,
          completed: t.completed,
          completedAt: t.completed_at ?? null,
          // t.created_by vient de la reponse POST (.select().single())
          // donc toujours fiable ; currentUserId en repli si jamais
          // absent (ne devrait pas arriver).
          createdBy: t.created_by ?? currentUserId,
          authorName: null,
          completedByName: null,
          notes: [],
          contacts: [],
        },
        ...prev,
      ])
      setTitle('')
      setPriority('medium')
      setCategory('reparation')
      setPeriod('')
      setRecurrence('once')
      setWizardStep('title')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’ajout')
    } finally {
      setSaving(false)
    }
  }

  const deleteTask = async (id: string) => {
    // Confirmation avant suppression (25/10/2026, demande d'Aurélie, voir
    // le commentaire équivalent dans BudgetBoard.tsx pour le contexte
    // complet). Ne concerne que la poubelle de la tâche elle-même -- pas
    // le "X" qui supprime une note de suivi (symbole différent, action
    // plus légère, hors du périmètre de cette demande).
    if (!confirm('Supprimer cette tâche ?')) return
    const previous = tasks
    setTasks((prev) => prev.filter((t) => t.id !== id))
    try {
      const res = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setTasks(previous)
      setError('Impossible de supprimer cette tâche.')
    }
  }

  // --- Répartition dans les 4 listes (voir le grand commentaire en tête
  //     de fichier pour la logique complète) ---
  const jardinVisible = tasks.filter((t) => {
    if (t.category !== 'jardin') return false
    if (!t.completed) return true
    const d = daysSince(t.completedAt)
    return d === null || d < 15
  })

  const nonJardin = tasks.filter((t) => t.category !== 'jardin')

  const archived = nonJardin.filter((t) => {
    if (!t.completed) return false
    const d = daysSince(t.completedAt)
    return d !== null && d >= 30
  })
  const archivedIds = new Set(archived.map((t) => t.id))
  const nonJardinVisible = nonJardin.filter((t) => !archivedIds.has(t.id))

  // Une tâche cochée bascule dans "Tâches réalisées" (widget à part,
  // sous "Liste des tâches") au lieu de rester affichée, barrée, dans
  // "À faire ce mois-ci"/"À faire" -- confirmé par Aurélie le
  // 26/10/2026 après un aller-retour sur ce point (elle avait d'abord
  // demandé l'inverse -- garder la tâche dans les deux listes à la
  // fois -- avant de revenir au comportement d'origine : la tâche ne
  // doit apparaître QUE dans "Tâches réalisées" une fois cochée). La
  // décocher la fait revenir ici. Elle ne quitte "Tâches réalisées" que
  // 30 jours après, pour les Archives (inchangé ci-dessus,
  // archived/archivedIds).
  const nonJardinActive = nonJardinVisible.filter((t) => !t.completed)
  const nonJardinDone = nonJardinVisible.filter((t) => t.completed)

  const thisMonth = sortTasks(nonJardinActive.filter((t) => isPeriodCurrent(t.period)), sortMode)
  const general = sortTasks(nonJardinActive.filter((t) => !isPeriodCurrent(t.period)), sortMode)
  // Triée par date de clôture (la plus récente d'abord) plutôt que par
  // sortMode (urgence/catégorie) : une fois faite, ce qui compte pour
  // retrouver une tâche ici est surtout "quand", pas sa catégorie ou son
  // urgence d'origine.
  const done = [...nonJardinDone].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  const jardin = sortTasks(jardinVisible, sortMode)
  const archives = sortTasks(archived, sortMode)

  return (
    <div className="space-y-6">
      {/* Ordre des 2 widgets et position de "Periodique" inverses le
          05/10/2026 a la demande de Nicolas : "Entretien et reparations"
          passe en premier (etait en second depuis la refonte du
          04/10/2026, voir plus bas), et la liste "Periodique" (ex.
          "Jardin") quitte ce widget pour rejoindre "Taches", tout en bas
          (apres "A faire"). */}
      {/* Card alignee sur le gabarit "replie" des widgets du Guide de la
          maison (GuideCard.tsx : Card py-0, entete h-10, contenu masque
          plutot que simplement rempli quand replie) -- demande par
          Nicolas le 05/10/2026 : meme hauteur a l'etat replie que
          "Avant votre arrivee"/"Maison encore occupee"/etc. Avant ce
          changement, Archives restait visible meme replie (CardContent
          toujours rendu) : c'est desormais tout le contenu qui
          apparait/disparait ensemble avec formOpen, comme sur un
          GuideCard. */}
      <Card className="py-0">
        <CardHeader>
          <button
            type="button"
            onClick={() => {
              setFormOpen((v) => !v)
              setWizardStep('title')
            }}
            aria-expanded={formOpen}
            className="flex h-10 w-full items-center justify-between gap-2 text-left hover:opacity-80"
          >
            <CardTitle className="text-sm md:text-base uppercase tracking-wide">Entretien et réparations</CardTitle>
            <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', formOpen && 'rotate-180')} />
          </button>
        </CardHeader>
        {formOpen && (
          <CardContent className="space-y-5 pb-[10px]">
            {/* Plus de ligne grise ici -- demande par Nicolas le
                05/10/2026 : retiree du bas du widget. */}
            {/* Formulaire d'ajout ouvert a tous (admin + famille) depuis
                le 25/10/2026 -- auparavant reserve aux admins via
                `canEdit`, voir le grand commentaire en tete de fichier. */}
            {/* Assistant en étapes (26/10/2026, demande d'Aurélie --
                voir le commentaire sur WizardStep en tête de fichier) :
                un seul <form>, un seul bouton "Valider"/"Publier" à la
                fois (celui de l'étape courante), et la touche Entrée
                déclenche le même onSubmit quel que soit le champ
                actif -- donc toujours "valider l'étape en cours", pas
                "publier directement". */}
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (wizardStep === 'title' && !title.trim()) return
                if (wizardStep === 'ready') {
                  addTask()
                } else {
                  setWizardStep(nextWizardStep(wizardStep, category))
                }
              }}
            >
                {/* Un seul champ/groupe de pastilles visible a la fois
                    (correction d'Aurelie du 26/10/2026 : "il faut que
                    les elements arrivent les uns apres les autres...
                    quand on a fait entree ou valider le texte, celui ci
                    disparait pour laisser place a la categorie, et
                    ainsi de suite") -- chaque etape remplace la
                    precedente au lieu de s'accumuler ; la valeur saisie
                    reste en memoire (title/category/priority/period/
                    recurrence) meme une fois son champ masque, pour
                    etre envoyee par addTask() a l'etape finale. */}
                {wizardStep === 'title' && (
                /* Encadre traite exactement comme le champ "Titre" de
                   "Partager ce qui a ete fait" (RealisationsBoard.tsx) --
                   demande par Nicolas le 05/10/2026 : remplace le
                   composant <Input> (shadcn, rounded-md par defaut) par
                   le meme <input> natif + classes que ce champ. */
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nouvelle tâche…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />
                )}

              {wizardStep === 'category' && (
              <div>
                <p className="mb-1.5 text-sm md:text-base font-medium uppercase tracking-wide text-muted-foreground">Catégorie</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {SELECTABLE_CATEGORIES.map((c) => (
                    <button key={c} type="button" onClick={() => setCategory(c)} className={viewTogglePillClass(category === c)}>
                      {CATEGORY_LABEL[c]}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {wizardStep === 'urgency' && (
              <div>
                <p className="mb-1.5 text-sm md:text-base font-medium uppercase tracking-wide text-muted-foreground">Urgence</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                    <button key={p} type="button" onClick={() => setPriority(p)} className={viewTogglePillClass(priority === p)}>
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Periode : uniquement pour la catégorie "Jardin"
                  (demande d'Aurélie le 26/10/2026 : "puis periode si
                  c'est pour le jardin"), puis Récurrence dans une étape
                  séparée juste après (demande d'Aurélie : "fait periode
                  et recurrence l'un apres l'autre", 26/10/2026 --
                  auparavant regroupées sous une seule étape). Menu
                  Période déroulant (demande historique de Nicolas, voir
                  plus haut). */}
              {category === 'jardin' && wizardStep === 'period' && (
              <div>
                <p className="mb-1.5 text-sm md:text-base font-medium uppercase tracking-wide text-muted-foreground">Période</p>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as TaskPeriod | '')}
                  className={cn(
                    'h-8 rounded-full border border-input bg-background px-3 text-xs uppercase tracking-[0.08em] md:text-sm',
                    period === '' ? 'font-normal text-foreground/60' : 'font-semibold text-foreground'
                  )}
                >
                  <option value="">Pas de période précise</option>
                  <optgroup label="Mois">
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Saisons">
                    {SEASON_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              )}

              {/* Uniquement pour la catégorie "Jardin", demandé par Nicolas
                  le 27/09/2026 : une tâche jardin a toujours une récurrence
                  (1 fois par défaut), qui pilote sa réapparition après
                  clôture — voir le commentaire en tête de fichier. */}
              {category === 'jardin' && wizardStep === 'recurrence' && (
                <div>
                  <p className="mb-1.5 text-sm md:text-base font-medium uppercase tracking-wide text-muted-foreground">Récurrence</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((r) => (
                      <button key={r} type="button" onClick={() => setRecurrence(r)} className={viewTogglePillClass(recurrence === r)}>
                        {RECURRENCE_LABEL[r]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Traite et nomme comme le bouton "Publier" de "Partager ce
                  qui a ete fait" (RealisationsBoard.tsx) -- demande par
                  Nicolas le 05/10/2026 : plus d'icone, meme libelle/etat.
                  "Valider" sur les étapes intermédiaires, "Publier" sur
                  la dernière -- un seul bouton affiché à la fois, les
                  deux soumettent le même <form> (type="submit", voir
                  onSubmit ci-dessus) donc répondent aussi à la touche
                  Entrée (demande d'Aurélie du 26/10/2026). */}
              <button type="submit" disabled={saving} className={actionPillClass}>
                {wizardStep === 'ready' ? (saving ? 'Publication...' : 'Publier') : 'Valider'}
              </button>
            </form>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {archives.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setArchivesOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-sm md:text-base font-medium uppercase tracking-wide text-muted-foreground"
                >
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', archivesOpen && 'rotate-180')} />
                  Archives
                </button>
                {archivesOpen && (
                  <TaskList
                    title={null}
                    tasks={archives}
                    canEdit={canEdit}
                    currentUserId={currentUserId}
                    onToggle={toggle}
                    onDelete={deleteTask}
                    onEditTask={editTask}
                    servicesContacts={servicesContacts}
                    suiviOpen={suiviOpen}
                    pickerOpenFor={pickerOpenFor}
                    draftText={draftText}
                    draftDate={draftDate}
                    onToggleSuivi={toggleSuivi}
                    onOpenPicker={setPickerOpenFor}
                    onClosePicker={() => setPickerOpenFor(null)}
                    onDraftTextChange={(taskId, text) => setDraftText((prev) => ({ ...prev, [taskId]: text }))}
                    onDraftDateChange={(taskId, date) => setDraftDate((prev) => ({ ...prev, [taskId]: date }))}
                    onAddNote={addNote}
                    onDeleteNote={deleteNote}
                    onAttachContact={attachContact}
                    onDetachContact={detachContact}
                  />
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Widget separe pour "A faire ce mois-ci" / "A faire" / "Periodique"
          -- demande par Nicolas le 04/10/2026, "Periodique" ajoutee en bas
          le 05/10/2026. N'apparait pas si ces trois listes sont vides
          alors qu'il existe deja des taches ailleurs (pas besoin d'un
          widget vide) ; apparait avec le message "Aucune tache" quand il
          n'y a vraiment aucune tache nulle part. */}
      {(thisMonth.length > 0 || general.length > 0 || jardin.length > 0 || tasks.length === 0) && (
        <Card>
          <CardHeader>
            {/* Pastilles de tri Urgence/Categorie masquees le 26/10/2026
                (demande d'Aurelie : ce classement n'est plus tres utile
                a ce stade). sortMode reste cale sur 'urgence' par
                defaut (voir useState plus haut) -- le tri sous-jacent
                (sortTasks) continue donc de s'appliquer silencieusement,
                juste sans les pastilles pour en changer ; faciles a
                remettre si besoin plus tard (pastilles ci-dessous,
                inchangees). */}
            <CardTitle className="text-sm md:text-base uppercase tracking-wide">Liste des tâches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {error && <p className="text-sm text-destructive">{error}</p>}

            {tasks.length === 0 && (
              <p className="text-muted-foreground text-sm">Aucune tâche pour le moment.</p>
            )}

            {thisMonth.length > 0 && (
              <TaskList
                title="À faire ce mois-ci"
                tasks={thisMonth}
                canEdit={canEdit}
                currentUserId={currentUserId}
                onToggle={toggle}
                onDelete={deleteTask}
                onEditTask={editTask}
                servicesContacts={servicesContacts}
                suiviOpen={suiviOpen}
                pickerOpenFor={pickerOpenFor}
                draftText={draftText}
                draftDate={draftDate}
                onToggleSuivi={toggleSuivi}
                onOpenPicker={setPickerOpenFor}
                onClosePicker={() => setPickerOpenFor(null)}
                onDraftTextChange={(taskId, text) => setDraftText((prev) => ({ ...prev, [taskId]: text }))}
                onDraftDateChange={(taskId, date) => setDraftDate((prev) => ({ ...prev, [taskId]: date }))}
                onAddNote={addNote}
                onDeleteNote={deleteNote}
                onAttachContact={attachContact}
                onDetachContact={detachContact}
              />
            )}

            {general.length > 0 && (
              <TaskList
                title="À faire"
                tasks={general}
                canEdit={canEdit}
                currentUserId={currentUserId}
                onToggle={toggle}
                onDelete={deleteTask}
                onEditTask={editTask}
                servicesContacts={servicesContacts}
                suiviOpen={suiviOpen}
                pickerOpenFor={pickerOpenFor}
                draftText={draftText}
                draftDate={draftDate}
                onToggleSuivi={toggleSuivi}
                onOpenPicker={setPickerOpenFor}
                onClosePicker={() => setPickerOpenFor(null)}
                onDraftTextChange={(taskId, text) => setDraftText((prev) => ({ ...prev, [taskId]: text }))}
                onDraftDateChange={(taskId, date) => setDraftDate((prev) => ({ ...prev, [taskId]: date }))}
                onAddNote={addNote}
                onDeleteNote={deleteNote}
                onAttachContact={attachContact}
                onDetachContact={detachContact}
              />
            )}

            {jardin.length > 0 && (
              <TaskList
                title="Périodique"
                tasks={jardin}
                canEdit={canEdit}
                currentUserId={currentUserId}
                onToggle={toggle}
                onDelete={deleteTask}
                onEditTask={editTask}
                servicesContacts={servicesContacts}
                suiviOpen={suiviOpen}
                pickerOpenFor={pickerOpenFor}
                draftText={draftText}
                draftDate={draftDate}
                onToggleSuivi={toggleSuivi}
                onOpenPicker={setPickerOpenFor}
                onClosePicker={() => setPickerOpenFor(null)}
                onDraftTextChange={(taskId, text) => setDraftText((prev) => ({ ...prev, [taskId]: text }))}
                onDraftDateChange={(taskId, date) => setDraftDate((prev) => ({ ...prev, [taskId]: date }))}
                onAddNote={addNote}
                onDeleteNote={deleteNote}
                onAttachContact={attachContact}
                onDetachContact={detachContact}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Widget "Tâches réalisées" (26/10/2026, demande d'Aurélie) : une
          tâche cochée (hors Périodique, qui garde son propre
          fonctionnement -- voir le commentaire sur nonJardinActive/
          nonJardinDone plus haut) atterrit ici au lieu de rester
          affichée, barrée, dans "À faire ce mois-ci"/"À faire". La
          décocher ici la fait revenir dans "Liste des tâches". Repliée
          par défaut, même gabarit que les autres widgets dépliables du
          site (StaysHistory.tsx, etc.) -- widget séparé de "Liste des
          tâches" (pas une simple section dedans, comme Archives dans
          "Entretien et réparations") pour rester visible même repliée. */}
      {done.length > 0 && (
        <Card className="py-0">
          <CardHeader>
            <button
              type="button"
              onClick={() => setDoneOpen((v) => !v)}
              aria-expanded={doneOpen}
              className="flex h-10 w-full items-center justify-between gap-2 text-left hover:opacity-80"
            >
              <CardTitle className="text-sm md:text-base uppercase tracking-wide">
                Tâches réalisées ({done.length})
              </CardTitle>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', doneOpen && 'rotate-180')} />
            </button>
          </CardHeader>
          {doneOpen && (
            <CardContent className="pb-[10px]">
              <TaskList
                title={null}
                tasks={done}
                canEdit={canEdit}
                currentUserId={currentUserId}
                onToggle={toggle}
                onDelete={deleteTask}
                onEditTask={editTask}
                servicesContacts={servicesContacts}
                suiviOpen={suiviOpen}
                pickerOpenFor={pickerOpenFor}
                draftText={draftText}
                draftDate={draftDate}
                onToggleSuivi={toggleSuivi}
                onOpenPicker={setPickerOpenFor}
                onClosePicker={() => setPickerOpenFor(null)}
                onDraftTextChange={(taskId, text) => setDraftText((prev) => ({ ...prev, [taskId]: text }))}
                onDraftDateChange={(taskId, date) => setDraftDate((prev) => ({ ...prev, [taskId]: date }))}
                onAddNote={addNote}
                onDeleteNote={deleteNote}
                onAttachContact={attachContact}
                onDetachContact={detachContact}
              />
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}

function TaskList({
  title,
  tasks,
  canEdit,
  currentUserId,
  onToggle,
  onDelete,
  onEditTask,
  servicesContacts,
  suiviOpen,
  pickerOpenFor,
  draftText,
  draftDate,
  onToggleSuivi,
  onOpenPicker,
  onClosePicker,
  onDraftTextChange,
  onDraftDateChange,
  onAddNote,
  onDeleteNote,
  onAttachContact,
  onDetachContact,
}: {
  title: string | null
  tasks: TaskItem[]
  canEdit: boolean
  currentUserId: string
  onToggle: (task: TaskItem) => void
  onDelete: (id: string) => void
  onEditTask: (
    taskId: string,
    updates: Partial<Pick<TaskItem, 'title' | 'category' | 'priority' | 'period' | 'recurrence'>>
  ) => void
  servicesContacts: ServiceContact[]
  suiviOpen: Record<string, boolean>
  pickerOpenFor: string | null
  draftText: Record<string, string>
  draftDate: Record<string, string>
  onToggleSuivi: (taskId: string) => void
  onOpenPicker: (taskId: string) => void
  onClosePicker: () => void
  onDraftTextChange: (taskId: string, text: string) => void
  onDraftDateChange: (taskId: string, date: string) => void
  onAddNote: (taskId: string) => void
  onDeleteNote: (taskId: string, noteId: string) => void
  onAttachContact: (taskId: string, contact: ServiceContact) => void
  onDetachContact: (taskId: string, contactId: string) => void
}) {
  return (
    <div className="space-y-2">
      {/* Les pastilles de tri Urgence/Categorie ne sont plus affichees ici
          -- deplacees une seule fois sur le titre du widget "Liste des
          taches" le 05/10/2026 (demande par Nicolas). */}
      {title && (
        <p className="text-[12px] md:text-[14px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      )}
      {/* Ligne 1px grise claire sous le titre de la liste -- demande par
          Nicolas le 05/10/2026. Absente pour Archives (title deja null). */}
      {title && <div className="border-b border-border" />}
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          canEdit={canEdit}
          currentUserId={currentUserId}
          onToggle={() => onToggle(task)}
          onDelete={() => onDelete(task.id)}
          onEditSave={(updates) => onEditTask(task.id, updates)}
          servicesContacts={servicesContacts}
          suiviOpen={!!suiviOpen[task.id]}
          showPicker={pickerOpenFor === task.id}
          draftText={draftText[task.id] ?? ''}
          draftDate={draftDate[task.id] ?? ''}
          onToggleSuivi={() => onToggleSuivi(task.id)}
          onOpenPicker={() => onOpenPicker(task.id)}
          onClosePicker={onClosePicker}
          onDraftTextChange={(text) => onDraftTextChange(task.id, text)}
          onDraftDateChange={(date) => onDraftDateChange(task.id, date)}
          onAddNote={() => onAddNote(task.id)}
          onDeleteNote={(noteId) => onDeleteNote(task.id, noteId)}
          onAttachContact={(contact) => onAttachContact(task.id, contact)}
          onDetachContact={(contactId) => onDetachContact(task.id, contactId)}
        />
      ))}
    </div>
  )
}

function formatNoteDate(iso: string): string {
  try {
    return format(parseISO(iso), 'd MMM', { locale: fr })
  } catch {
    return ''
  }
}

// "Fait le ... par ..." (26/10/2026, voir TaskRow plus bas) -- avec
// l'année, contrairement à formatNoteDate ci-dessus : une tâche réalisée
// peut rester affichée longtemps (jusqu'à 30 jours avant Archives), "3
// nov." tout court deviendrait vite ambigu.
function formatCompletedDate(iso: string): string {
  try {
    return format(parseISO(iso), 'd MMM yyyy', { locale: fr })
  } catch {
    return ''
  }
}

// Ordre des colonnes demandé par Nicolas le 27/09/2026 : case à cocher,
// catégorie, tâche, période, urgence, puis la poubelle. Pastilles
// "Contact"/"Suivi" ajoutées le 19/10/2026 (demandé par Aurélie) : voir
// la maquette Artifact "Entretien — Suivi & Contact" -- associent la
// tâche à un ou plusieurs artisans (Contacts → Services) et tiennent un
// historique de notes datées, chacune pouvant porter une date de RDV.
// Ouvert à l'admin ET à la famille (indépendant de `canEdit`, réservé
// lui à la suppression de tâche et à l'édition de n'importe quelle
// ligne -- voir `canEditRow` ci-dessous pour l'édition "limitée à sa
// propre ligne", ajoutée le 25/10/2026).
function TaskRow({
  task,
  canEdit,
  currentUserId,
  onToggle,
  onDelete,
  onEditSave,
  servicesContacts,
  suiviOpen,
  showPicker,
  draftText,
  draftDate,
  onToggleSuivi,
  onOpenPicker,
  onClosePicker,
  onDraftTextChange,
  onDraftDateChange,
  onAddNote,
  onDeleteNote,
  onAttachContact,
  onDetachContact,
}: {
  task: TaskItem
  canEdit: boolean
  currentUserId: string
  onToggle: () => void
  onDelete: () => void
  onEditSave: (
    updates: Partial<Pick<TaskItem, 'title' | 'category' | 'priority' | 'period' | 'recurrence'>>
  ) => void
  servicesContacts: ServiceContact[]
  suiviOpen: boolean
  showPicker: boolean
  draftText: string
  draftDate: string
  onToggleSuivi: () => void
  onOpenPicker: () => void
  onClosePicker: () => void
  onDraftTextChange: (text: string) => void
  onDraftDateChange: (date: string) => void
  onAddNote: () => void
  onDeleteNote: (noteId: string) => void
  onAttachContact: (contact: ServiceContact) => void
  onDetachContact: (contactId: string) => void
}) {
  const attachedIds = new Set(task.contacts.map((c) => c.contact_id))
  const categoryKeywords = CATEGORY_CONTACT_KEYWORDS[task.category]
  const pickerOptions = servicesContacts
    .filter((c) => !attachedIds.has(c.id))
    .filter((c) => !categoryKeywords || categoryKeywords.some((kw) => normalizeForMatch(c.role).includes(kw)))
  // "Autres" : pas de corps de métier évident -- pas de proposition de
  // contact du tout pour cette catégorie (demande d'Aurélie). Un seul
  // contact par tâche (27/10/2026, demande d'Aurélie : "un seul contact
  // suffit pour chaque tâche") -- la pastille "+ Contact" disparaît dès
  // qu'un contact est attaché, elle réapparaît si on le retire (croix
  // sur la pastille du contact, voir onDetachContact).
  const canAddContact = task.category !== 'autre' && task.contacts.length === 0

  // Édition en place d'une ligne (25/10/2026, demande d'Aurélie) :
  // l'auteur de la tâche (task.createdBy) peut corriger sa propre ligne,
  // un admin (canEdit) peut corriger n'importe laquelle. Brouillon
  // réinitialisé depuis `task` à chaque ouverture du panneau (openEdit),
  // pas seulement au montage, pour repartir des valeurs à jour si la
  // tâche a changé entre-temps (ex. coche par quelqu'un d'autre).
  const canEditRow = canEdit || task.createdBy === currentUserId
  const [editOpen, setEditOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState(task.title)
  const [draftCategory, setDraftCategory] = useState<Category>(task.category)
  const [draftPriority, setDraftPriority] = useState<Priority>(task.priority)
  const [draftPeriod, setDraftPeriod] = useState<TaskPeriod | ''>((task.period as TaskPeriod) ?? '')
  const [draftRecurrence, setDraftRecurrence] = useState<Recurrence>(task.recurrence ?? 'once')

  const openEdit = () => {
    setDraftTitle(task.title)
    setDraftCategory(task.category)
    setDraftPriority(task.priority)
    setDraftPeriod((task.period as TaskPeriod) ?? '')
    setDraftRecurrence(task.recurrence ?? 'once')
    setEditOpen(true)
  }

  const saveEdit = () => {
    if (!draftTitle.trim()) return
    onEditSave({
      title: draftTitle.trim(),
      category: draftCategory,
      priority: draftPriority,
      period: draftPeriod || null,
      // Uniquement pertinent pour la catégorie "jardin", comme à l'ajout
      // (voir le formulaire plus haut) -- null pour les autres.
      recurrence: draftCategory === 'jardin' ? draftRecurrence : null,
    })
    setEditOpen(false)
  }

  return (
    <div className="py-2 border-b border-border last:border-0">
      {/* Version bureau (md et plus) : une seule ligne, inchangee. */}
      <div className="hidden md:flex items-baseline gap-3">
        {/* Coche ouverte a tous depuis toujours cote API (voir route.ts) ;
            desormais aussi cote UI -- n'est plus desactivee pour les
            comptes famille (25/10/2026, demande d'Aurelie). */}
        <input
          type="checkbox"
          checked={task.completed}
          onChange={onToggle}
          className="self-center h-4 w-4 shrink-0 rounded border-input accent-primary"
        />
        {/* Largeur fixe (au lieu d'un simple shrink-0 qui s'ajuste au texte)
            -- demande par Nicolas le 05/10/2026 : "Electricite"/"Manutention"
            (les libelles de categorie les plus longs) calent cette colonne,
            si bien que le texte de description de chaque tache commence
            desormais systematiquement a la meme position horizontale, quelle
            que soit la categorie affichee sur la ligne. */}
        <span className="w-28 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{CATEGORY_LABEL[task.category]}</span>
        {/* Plus de troncage (truncate) -- demande par Nicolas le
            04/10/2026 : un titre trop long passe a la ligne au lieu
            d'etre coupe, le reste de la ligne reste inchange. */}
        <p className={`flex-1 min-w-0 text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {task.title}
        </p>
        {task.period && (
          <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
            {PERIOD_LABELS[task.period as keyof typeof PERIOD_LABELS] ?? task.period}
          </span>
        )}
        <span className={`text-xs uppercase tracking-wide shrink-0 ${PRIORITY_STYLE[task.priority]}`}>
          {PRIORITY_LABEL[task.priority]}
        </span>
      </div>

      {/* Version mobile (en dessous de md) : demande par Nicolas le
          07/10/2026, l'ancien affichage sur une seule ligne rendait le
          texte de la tache illisible (trop comprime entre categorie,
          periode et urgence). Desormais sur 2 lignes : ligne 1 =
          categorie (gauche) / periode (centre) / urgence (droite),
          ligne 2 = le texte complet de la tache, qui retourne a la
          ligne si besoin (plus de compression du texte). */}
      <div className="flex md:hidden flex-col gap-1">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={onToggle}
            className="h-4 w-4 shrink-0 rounded border-input accent-primary"
          />
          <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{CATEGORY_LABEL[task.category]}</span>
          <span className="flex-1 text-center text-xs uppercase tracking-wide text-muted-foreground">
            {task.period ? (PERIOD_LABELS[task.period as keyof typeof PERIOD_LABELS] ?? task.period) : ''}
          </span>
          <span className={`text-xs uppercase tracking-wide shrink-0 ${PRIORITY_STYLE[task.priority]}`}>
            {PRIORITY_LABEL[task.priority]}
          </span>
        </div>
        <p className={`pl-7 text-sm font-medium break-words ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {task.title}
        </p>
      </div>

      {/* Pastilles "Contact" et "Suivi" (19/10/2026) -- voir le grand
          commentaire au-dessus de TaskRow. Remplacees par "Fait le ...
          par ..." une fois la tache cochee (26/10/2026, demande
          d'Aurelie : widget "Taches realisees") -- voir le bloc
          !task.completed ci-dessous. */}
      {!task.completed ? (
      <div className="pl-0 md:pl-[46px] mt-2 flex flex-wrap items-center gap-2 relative">
        {task.contacts.map((c) => (
          <div
            key={c.contact_id}
            className="inline-flex items-center gap-1.5 border border-foreground px-2 py-0.5 text-[11px] text-foreground"
          >
            <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-medium">{c.role}</span> — {c.name}
            </span>
            <button
              type="button"
              onClick={() => onDetachContact(c.contact_id)}
              aria-label={`Retirer ${c.name}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {canAddContact && (
          <button
            type="button"
            onClick={showPicker ? onClosePicker : onOpenPicker}
            className="inline-flex items-center gap-1.5 border border-dashed border-muted-foreground px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:border-foreground hover:text-foreground"
          >
            <Phone className="h-3 w-3" aria-hidden="true" />
            Contact
          </button>
        )}

        <button
          type="button"
          onClick={onToggleSuivi}
          className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Suivi{task.notes.length > 0 ? ` (${task.notes.length})` : ''}
          <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', suiviOpen && 'rotate-180')} />
        </button>

        {/* Editer/Supprimer deplaces ici, sur la ligne Contact/Suivi,
            alignes a droite (26/10/2026, demande d'Aurelie) -- avant,
            colonne a part en bout de ligne principale (bureau) ou de la
            1ere ligne (mobile). Comme tout ce bloc n'est rendu que pour
            !task.completed (voir plus haut), ces icones disparaissent
            d'elles-memes une fois la tache basculee dans "Taches
            realisees", sans condition supplementaire a ecrire. */}
        <div className="ml-auto flex items-center gap-2">
          {canEditRow && (
            <button
              type="button"
              onClick={editOpen ? () => setEditOpen(false) : openEdit}
              aria-label={editOpen ? 'Fermer l\'édition' : 'Corriger cette tâche'}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Supprimer cette tâche"
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {showPicker && (
          <div className="absolute left-0 top-7 z-10 min-w-[220px] rounded-md border border-border bg-card p-2 shadow-lg">
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Choisir un contact (Services)
            </p>
            {pickerOptions.length === 0 ? (
              <p className="px-1 py-1 text-xs text-muted-foreground">
                {categoryKeywords
                  ? `Aucun contact "${CATEGORY_LABEL[task.category]}" enregistré dans Services.`
                  : 'Aucun contact disponible.'}
              </p>
            ) : (
              // Défilable (19/10/2026, demande d'Aurélie) : la liste peut
              // dépasser la hauteur visible quand le widget Services compte
              // beaucoup de contacts.
              <div className="max-h-56 overflow-y-auto">
                {pickerOptions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onAttachContact(c)}
                    className="flex w-full items-center justify-between gap-2 border-b border-border px-1 py-1.5 text-left text-sm last:border-0 hover:bg-muted"
                  >
                    <span>{c.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.role}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={onClosePicker}
              className="mt-1.5 px-1 text-[10px] uppercase tracking-[0.06em] text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
      ) : (
        <p className="pl-0 md:pl-[46px] mt-2 text-[11px] text-muted-foreground">
          Fait le {task.completedAt ? formatCompletedDate(task.completedAt) : '—'}
          {task.completedByName ? ` par ${task.completedByName}` : ''}
        </p>
      )}

      {/* Panneau d'edition en place (25/10/2026, demande d'Aurelie) --
          memes pastilles que le formulaire d'ajout en tete de widget,
          pre-remplies avec les valeurs actuelles de la tache. */}
      {editOpen && (
        <div className="pl-0 md:pl-[46px] mt-2 space-y-3 rounded-md border border-border bg-muted/40 p-3">
          <input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Titre de la tâche…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Catégorie</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {SELECTABLE_CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setDraftCategory(c)} className={viewTogglePillClass(draftCategory === c)}>
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Urgence</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((pr) => (
                <button key={pr} type="button" onClick={() => setDraftPriority(pr)} className={viewTogglePillClass(draftPriority === pr)}>
                  {PRIORITY_LABEL[pr]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Période</p>
            <select
              value={draftPeriod}
              onChange={(e) => setDraftPeriod(e.target.value as TaskPeriod | '')}
              className={cn(
                'h-8 rounded-full border border-input bg-background px-3 text-xs uppercase tracking-[0.08em]',
                draftPeriod === '' ? 'font-normal text-foreground/60' : 'font-semibold text-foreground'
              )}
            >
              <option value="">Pas de période précise</option>
              <optgroup label="Mois">
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </optgroup>
              <optgroup label="Saisons">
                {SEASON_OPTIONS.map((s2) => (
                  <option key={s2.value} value={s2.value}>{s2.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
          {draftCategory === 'jardin' && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Récurrence</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((r) => (
                  <button key={r} type="button" onClick={() => setDraftRecurrence(r)} className={viewTogglePillClass(draftRecurrence === r)}>
                    {RECURRENCE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button type="button" onClick={saveEdit} className={actionPillClass}>
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="text-xs uppercase tracking-[0.06em] text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {!task.completed && suiviOpen && (
        <div className="pl-0 md:pl-[46px] mt-2 space-y-2 rounded-md border border-border bg-muted/40 p-3">
          {task.notes.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">Aucune note de suivi pour l&apos;instant.</p>
          ) : (
            task.notes.map((note) => {
              const authorName = note.profile ? `${properCase(note.profile.first_name)} ${properCase(note.profile.last_name)}`.trim() : null
              const canDelete = note.user_id === currentUserId || canEdit
              return (
                <p key={note.id} className="flex items-start justify-between gap-2 text-xs text-foreground/90">
                  <span>
                    <span className="text-muted-foreground">{formatNoteDate(note.created_at)}</span>
                    {authorName && <> — <span className="font-medium">{authorName}</span></>} :{' '}
                    {note.rdv_date && (
                      <span className="mr-1 font-semibold uppercase tracking-wide text-primary">
                        RDV {formatNoteDate(note.rdv_date)}
                      </span>
                    )}
                    {note.text}
                  </span>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDeleteNote(note.id)}
                      aria-label="Supprimer cette note"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </p>
              )
            })
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="text"
              value={draftText}
              onChange={(e) => onDraftTextChange(e.target.value)}
              placeholder="Ajouter une note de suivi…"
              onKeyDown={(e) => e.key === 'Enter' && onAddNote()}
              className="min-w-[180px] flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground"
            />
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">RDV (facult.)</span>
            <input
              type="date"
              value={draftDate}
              onChange={(e) => onDraftDateChange(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            />
            <button type="button" onClick={onAddNote} className={actionPillClass}>
              Ajouter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
