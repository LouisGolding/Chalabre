// Période (mois ou saison) facultative sur une tâche, pour distinguer
// "À faire ce mois-ci" de "À faire" dans l'onglet Tâches.

export type TaskPeriod =
  | 'janvier' | 'fevrier' | 'mars' | 'avril' | 'mai' | 'juin'
  | 'juillet' | 'aout' | 'septembre' | 'octobre' | 'novembre' | 'decembre'
  | 'printemps' | 'ete' | 'automne' | 'hiver'

export const MONTH_OPTIONS: { value: TaskPeriod; label: string }[] = [
  { value: 'janvier', label: 'Janvier' },
  { value: 'fevrier', label: 'Février' },
  { value: 'mars', label: 'Mars' },
  { value: 'avril', label: 'Avril' },
  { value: 'mai', label: 'Mai' },
  { value: 'juin', label: 'Juin' },
  { value: 'juillet', label: 'Juillet' },
  { value: 'aout', label: 'Août' },
  { value: 'septembre', label: 'Septembre' },
  { value: 'octobre', label: 'Octobre' },
  { value: 'novembre', label: 'Novembre' },
  { value: 'decembre', label: 'Décembre' },
]

export const SEASON_OPTIONS: { value: TaskPeriod; label: string }[] = [
  { value: 'printemps', label: 'Printemps' },
  { value: 'ete', label: 'Été' },
  { value: 'automne', label: 'Automne' },
  { value: 'hiver', label: 'Hiver' },
]

export const PERIOD_LABELS: Record<TaskPeriod, string> = Object.fromEntries(
  [...MONTH_OPTIONS, ...SEASON_OPTIONS].map((o) => [o.value, o.label])
) as Record<TaskPeriod, string>

const MONTH_BY_INDEX: TaskPeriod[] = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
]

// Saisons météorologiques : déc-jan-fév = hiver, etc.
function currentSeason(date: Date): TaskPeriod {
  const m = date.getMonth() // 0 = janvier
  if (m === 11 || m === 0 || m === 1) return 'hiver'
  if (m >= 2 && m <= 4) return 'printemps'
  if (m >= 5 && m <= 7) return 'ete'
  return 'automne'
}

// Une tâche est "à faire ce mois-ci" si sa période est le mois en cours,
// ou la saison en cours. Sans période renseignée, elle reste dans "À faire".
export function isPeriodCurrent(period: string | null | undefined, date: Date = new Date()): boolean {
  if (!period) return false
  return period === MONTH_BY_INDEX[date.getMonth()] || period === currentSeason(date)
}
