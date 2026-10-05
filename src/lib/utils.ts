import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Style commun a toutes les pastilles de selection "texte simple" du site
// (categorie/urgence/periode/tri dans Entretien, age/cote de la maison
// dans le widget "Prochain sejour") : repris a l'identique du selecteur
// de vue du Planning ("Semaine / Quinzaine / Mois / Annee", voir
// PlanningView.tsx) a la demande de Nicolas le 04/10/2026 ("exactement
// comme ... meme typo, meme espacement, majuscules, dimension, [l'etat]
// selectionne ou non"). Pas d'encadre/fond, juste un texte en gras plein
// si selectionne, gris clair sinon.
export function viewTogglePillClass(selected: boolean): string {
  return cn(
    'text-xs uppercase tracking-[0.08em] transition-colors hover:text-foreground md:text-sm',
    selected ? 'font-semibold text-foreground' : 'font-normal text-foreground/60'
  )
}

// Style commun a toutes les pastilles D'ACTION du site (un bouton qui
// declenche une action -- pas un selecteur d'etat, voir
// viewTogglePillClass ci-dessus pour ceux-la). Harmonisation demandee par
// Nicolas le 04/10/2026 sur 6 pastilles reparties dans 3 onglets :
// "+ Ajouter" (Entretien, TasksBoard.tsx), "+ Ajouter des photos" et
// "Publier" (Realisations, RealisationsBoard.tsx), "Supprimer ce sejour"
// et "Modifier"/"Valider" (Planning, NextStayCard.tsx). Spec exacte :
// "petit encadre rectangulaire sans arrondi de la meme couleur que la
// typo. En majuscules 14px, espacement 0,08, gras 600. Meme couleur que
// les titres des widgets [...]. Lorsqu'on les survole a la souris, le
// fond change et devient la couleur de fond de l'onglet 'beige canson'"
// -- le survol reutilise donc directement la texture `pill-canson-hover`
// deja construite pour les pastilles du widget "Prochain sejour" (voir
// globals.css). A appliquer sur un <button> natif (pas le composant
// <Button>, dont le rounded-lg/bg-primary par defaut entrerait en
// conflit avec cette spec).
// Ajustement du 05/10/2026 (demande par Nicolas) : taille de police
// ramenee de 14px a 10px (text-[10px]), graisse de 600 a 500
// (font-medium), padding vertical de 6px a 2px (py-0.5) -- la largeur
// des encadres reste auto (w-fit).
export const actionPillClass =
  'pill-canson-hover inline-flex w-fit items-center justify-center gap-1.5 whitespace-nowrap rounded-none border border-foreground px-3 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-foreground transition-colors disabled:pointer-events-none disabled:opacity-50'

// Season logic: Summer = April 1 - October 30, Winter = October 31 - March 31
export function getSeason(date: Date): 'summer' | 'winter' {
  const month = date.getMonth() + 1 // 1-12
  const day = date.getDate()

  // Winter: Oct 31 - Mar 31
  if (month < 4) return 'winter'
  if (month === 4 && day === 1) return 'summer' // April 1 starts summer
  if (month > 10) return 'winter'
  if (month === 10 && day >= 31) return 'winter'
  return 'summer'
}

// TS rate calculation
export function calculateTSRate(date: Date, age: number, withParents: boolean): number {
  const season = getSeason(date)

  if (season === 'summer') {
    if (age >= 16) return 10
    if (age < 16 && withParents) return 5
    return 10 // under 16 without parents
  } else {
    if (age >= 16) return 15
    if (age < 16 && withParents) return 10
    return 15 // under 16 without parents
  }
}

export function calculateTotalTS(
  checkIn: Date,
  checkOut: Date,
  age: number,
  withParents: boolean
): number {
  let total = 0
  const current = new Date(checkIn)
  while (current < checkOut) {
    total += calculateTSRate(current, age, withParents)
    current.setDate(current.getDate() + 1)
  }
  return total
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(date))
}

// Certains champs de saisie (ex. "Nom Prénom" d'un accompagnant, voir
// StayEntry dans NextStayCard.tsx) peuvent contenir un nom de famille,
// mais celui-ci ne doit jamais s'afficher ailleurs sur le site (planning,
// pastilles de solde TS...) — seul le prénom, comme pour les titulaires de
// compte (profile.first_name). On ne garde donc que le premier mot saisi.
export function firstNameOnly(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}

// Phase d'un séjour par rapport à aujourd'hui (demandé par Nicolas le
// 23/09/2026, pour le titre évolutif des bannières "Votre séjour" /
// "Ajouter un séjour" du Planning) : 'upcoming' tant qu'il n'a pas
// commencé, 'ongoing' entre le jour d'arrivée (inclus) et le jour de
// départ (exclu — le départ a lieu ce jour-là, le séjour n'est plus "en
// cours" ce jour), 'past' sinon. Comparaison en chaînes ISO (YYYY-MM-DD),
// pas d'objets Date : évite tout souci de fuseau horaire, une comparaison
// lexicographique suffit pour des dates au même format.
export type StayPhase = 'upcoming' | 'ongoing' | 'past'

export function stayPhase(checkIn: string, checkOut: string, today: Date = new Date()): StayPhase {
  const todayISO = today.toISOString().slice(0, 10)
  if (todayISO < checkIn) return 'upcoming'
  if (todayISO < checkOut) return 'ongoing'
  return 'past'
}

// Comparaison de noms insensible à la casse et aux espaces superflus —
// même convention que guest_people (voir migration_guest_people.sql) et
// ensureGuestColor dans /api/bookings/quick : Nicolas a confirmé qu'une
// correspondance exacte du nom complet suffit, le nom et prénom complets
// étant toujours saisis (pas de risque réel d'homonymie). Réutilisée ici
// pour relier le solde TS d'un accompagnant (guest_name en texte libre) à
// son propre compte quand il en a un — demandé par Aurélie le 22/09/2026
// (voir src/lib/ts-balance.ts).
export function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

// Mois sur 3 lettres, toujours dans cet ordre — demandé par Aurélie le
// 22/09/2026 pour le libellé bancaire des paiements de taxe de séjour
// (voir buildTsStatementDescriptor ci-dessous).
export const MONTHS_3 = [
  'JAN', 'FEV', 'MAR', 'AVR', 'MAI', 'JUN',
  'JUL', 'AOU', 'SEP', 'OCT', 'NOV', 'DEC',
] as const

export interface TsPeriod {
  year: number
  monthIndex: number // 0-11
}

// Période (année/mois) d'un séjour pour le libellé de paiement de sa taxe
// de séjour — on prend le DERNIER jour du séjour (check_out), demandé par
// Aurélie le 22/09/2026 : "TS_PRENOM_ANNEE/MOIS DU DERNIER JOUR DU
// SEJOUR".
export function tsPeriodFromCheckOut(checkOutISO: string): TsPeriod {
  const d = new Date(checkOutISO)
  return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() }
}

// Libellé bancaire ("statement descriptor" Stripe) d'un règlement de taxe
// de séjour, ex. TS_OSCAR_2026/JUN — ou, si plusieurs séjours impayés
// d'une même personne sont réglés en un seul paiement groupé,
// TS_OSCAR_2026/JUN+2025/DEC (demandé par Aurélie le 22/09/2026 : "un seul
// paiement groupé, mais le libellé affichera les deux mois qui
// correspondent aux 2 différents séjours").
//
// Stripe limite ce libellé à 22 caractères et interdit certains
// caractères spéciaux (< > \ ' " *) — le prénom est ici toujours réduit
// aux lettres non accentuées, et si le résultat dépasse 22 caractères, on
// raccourcit d'abord le prénom (jusqu'à 3 lettres minimum), puis, en tout
// dernier recours seulement, on retire les séjours les plus anciens —
// choix confirmé par Aurélie.
export function buildTsStatementDescriptor(firstName: string, periods: TsPeriod[]): string {
  const uniqueSorted = Array.from(
    new Map(periods.map((p) => [`${p.year}-${p.monthIndex}`, p])).values()
  ).sort((a, b) => a.year - b.year || a.monthIndex - b.monthIndex)

  let segments = uniqueSorted.map((p) => `${p.year}/${MONTHS_3[p.monthIndex]}`)

  let name = firstName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retire les accents (é -> e, etc.)
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
  if (!name) name = 'X'

  const build = () => `TS_${name}_${segments.join('+')}`
  let result = build()

  while (result.length > 22 && name.length > 3) {
    name = name.slice(0, -1)
    result = build()
  }
  while (result.length > 22 && segments.length > 1) {
    segments = segments.slice(1) // retire le séjour le plus ancien en premier
    result = build()
  }

  return result
}
