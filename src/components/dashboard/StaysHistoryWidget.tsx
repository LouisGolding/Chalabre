'use client'

import { useState } from 'react'
import { cn, formatFrenchDateInput } from '@/lib/utils'
import { shouldUseWhiteText } from '@/lib/colors'
import { StayBanner, balancePillOuterClass } from '@/components/dashboard/NextStayCard'
import { CSBalancePayButton } from '@/components/payment/CSBalancePayButton'

// Widget "Votre historique" (demandé par Aurélie le 01/11/2026) : sous le
// widget "Réserver un séjour" de l'onglet Planning, un widget repliable
// par personne (couleur = color_hue de cette personne, même système que
// partout ailleurs) listant ses séjours PASSÉS (check_out < aujourd'hui),
// du plus récent au plus ancien, en lecture seule -- seule la pastille CS
// de chaque ligne est actionnable (reglement si impayée, "CS PAYÉE" sinon).
//
// Un widget par personne, y compris pour chaque enfant sans compte
// (has_login = false) de la famille nucléaire -- "Historique de <prénom>",
// affiché sur le tableau de bord de CHAQUE parent ayant un vrai compte
// (voir planning/page.tsx pour le regroupement, même mécanisme que
// l'option Famille) -- jamais un seul widget combiné pour toute la
// famille, pour rester cohérent avec "chacun en a l'historique sur son
// profil" (défaut choisi par Claude, pas explicitement confirmé par
// Aurélie -- à corriger si elle préfère un regroupement).
export interface HistoryStay {
  id: string
  checkIn: string
  checkOut: string
  pending: number
  ids: string[]
}

function compactAmount(amount: number): string {
  return Number.isInteger(amount) ? `${amount}` : amount.toFixed(2).replace('.', ',')
}

// Pastille CS d'une ligne d'historique : montant restant (rouge,
// cliquable -- ouvre le paiement, même mécanisme que partout ailleurs)
// si impayé, sinon "CS PAYÉE" en lecture seule (pas de bouton, pas de
// clic) -- demande explicite d'Aurélie pour ce widget précisément.
function HistoryCsPill({ pending, ids, darkBg }: { pending: number; ids: string[]; darkBg: boolean }) {
  const outerClass = cn(balancePillOuterClass, darkBg && 'border-white/40')
  if (pending > 0 && ids.length > 0) {
    return (
      <CSBalancePayButton ids={ids} className={outerClass}>
        <span className="font-extrabold text-red-600">-{compactAmount(pending)}€</span>
      </CSBalancePayButton>
    )
  }
  return (
    <span className={outerClass}>
      <span className={cn('font-semibold', darkBg ? 'text-white' : 'text-foreground/60')}>CS PAYÉE</span>
    </span>
  )
}

export function StaysHistoryWidget({
  label,
  personColor,
  stays,
}: {
  label: string
  personColor: string
  stays: HistoryStay[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const darkBg = shouldUseWhiteText(personColor)
  // Pastille repliée : juste le nombre de séjours, pas de montant agrégé
  // (le solde global existe déjà par ailleurs -- "CS: X€" sur le widget
  // "Réserver un séjour") -- évite de dupliquer un total qui pourrait
  // sembler contredire l'autre si lu trop vite.
  const closedPill = (
    <span className={cn('text-xs uppercase tracking-[0.08em] md:text-sm', darkBg ? 'text-white/80' : 'text-foreground/60')}>
      {stays.length} séjour{stays.length > 1 ? 's' : ''}
    </span>
  )

  return (
    <StayBanner title={label} pill={closedPill} isOpen={isOpen} onToggle={() => setIsOpen((o) => !o)} bgColor={personColor}>
      {stays.length === 0 ? (
        <p className={cn('text-sm', darkBg ? 'text-white/70' : 'text-muted-foreground')}>Aucun séjour passé enregistré.</p>
      ) : (
        <div className="space-y-2">
          {stays.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={cn(
                  'text-xs font-extrabold uppercase tracking-[0.08em] md:text-sm',
                  darkBg ? 'text-white' : 'text-foreground/60'
                )}
              >
                Du {formatFrenchDateInput(s.checkIn)} au {formatFrenchDateInput(s.checkOut)}
              </span>
              <HistoryCsPill pending={s.pending} ids={s.ids} darkBg={darkBg} />
            </div>
          ))}
        </div>
      )}
    </StayBanner>
  )
}
