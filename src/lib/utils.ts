import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
