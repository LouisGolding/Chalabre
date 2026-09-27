import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
// Card/CardContent/CardHeader/CardTitle, Badge, formatCurrency : ne
// servent plus qu'aux widgets masqués plus bas (18/09/2026) — depuis
// @/components/ui/card, @/components/ui/badge, @/lib/utils. À
// réimporter avec eux si on les remet. CotisationPill n'est plus utilisée
// ici (retirée de l'accueil le 27/09/2026 à la demande de Nicolas, voir
// plus bas) mais reste utilisée ailleurs — composant non supprimé.
import { TaxeSejourPill } from '@/components/dashboard/TaxeSejourPill'
import { computeTsBalance } from '@/lib/ts-balance'

// "25 décembre 2026" -> "25 DÉCEMBRE 2026", comme sur le visuel Photoshop
// de Nicolas (27/09/2026) pour les dates du prochain séjour.
function formatDateLong(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(date))
    .toUpperCase()
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  // Get user's past bookings (le widget "Prochain séjour" et le calcul de
  // taxe de séjour ont migré vers l'onglet Planning le 21/09/2026 — voir
  // ReserverSejour.tsx — donc seuls les séjours PASSÉS du titulaire du
  // compte sont encore utiles ici, pour "Vous n'êtes pas venu depuis...").
  const { data: bookings } = await supabase
    .from('bookings')
    .select('check_out, check_in, guest_name')
    .eq('user_id', user.id)
    .order('check_in', { ascending: true })

  const today = new Date()
  const todayISO = today.toISOString().slice(0, 10)

  // Prochain séjour du titulaire du compte (hors accompagnants) — remis
  // sur l'accueil le 27/09/2026 à la demande de Nicolas, sur le modèle
  // exact de l'onglet Planning (voir planning/page.tsx : nextBooking).
  // check_out >= aujourd'hui (pas check_in) pour garder un séjour en
  // cours affiché ici tant qu'il n'est pas terminé, même logique que
  // là-bas.
  const nextBooking = (bookings ?? []).find((b) => !b.guest_name && b.check_out >= todayISO) ?? null

  const pastBookings = bookings?.filter(b => new Date(b.check_out) < today) ?? []
  // Séjour du titulaire du compte (widgets principaux) vs séjours ajoutés
  // pour des accompagnants (guest_name renseigné) via le bouton "+" : pour
  // "Vous n'êtes pas venu depuis...", seuls les séjours du titulaire
  // lui-même comptent.
  const myPastBookings = pastBookings.filter(b => !b.guest_name)
  const lastBooking = myPastBookings[myPastBookings.length - 1]

  // Widget "Vous n'êtes pas venu depuis X jours" (demandé par Aurélie le
  // 18/09/2026), affiché sous "Bonjour, ..." : nombre de jours entiers
  // depuis la fin du dernier séjour du titulaire du compte. Rien ne
  // s'affiche s'il n'y a jamais eu de séjour passé.
  const daysSinceLastStay = lastBooking
    ? Math.floor((today.getTime() - new Date(lastBooking.check_out).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const lastStaySentence =
    daysSinceLastStay !== null && daysSinceLastStay > 0
      ? `Vous n'êtes pas venu depuis ${daysSinceLastStay} jour${daysSinceLastStay > 1 ? 's' : ''}.`
      : null

  // Solde de taxe de séjour du titulaire (voir src/lib/ts-balance.ts),
  // pour la pastille "TOTAL TAXE DE SÉJOUR" à côté du prochain séjour —
  // calculé uniquement quand il y a un prochain séjour à afficher, pour
  // ne pas ajouter cette requête à chaque chargement de l'accueil sinon.
  const tsBalance = nextBooking ? await computeTsBalance(supabase, user.id) : null

  // Get current occupants
  const { data: currentBookings } = await supabase
    .from('bookings')
    .select('*, profiles(first_name, last_name)')
    .lte('check_in', today.toISOString().split('T')[0])
    .gte('check_out', today.toISOString().split('T')[0])
    .order('check_in', { ascending: true })

  // Prénoms des personnes actuellement à la Bâtisse, pour la phrase du
  // widget "Présents en ce moment" ci-dessous. On utilise guest_name quand
  // le séjour a été saisi pour un accompagnant (sinon profiles ne donnerait
  // que le nom du titulaire du compte qui a saisi ce séjour, pas celui de
  // l'accompagnant réellement présent).
  const presentNames = (currentBookings ?? []).map((b) =>
    b.guest_name ? b.guest_name : (b.profiles?.first_name ?? null)
  ).filter((name): name is string => !!name)

  const presentSentence =
    presentNames.length === 0
      ? 'Personne n\'est à la Bâtisse en ce moment.'
      : presentNames.length === 1
        ? `${presentNames[0]} est en ce moment à la Bâtisse.`
        : `${presentNames.slice(0, -1).join(', ')} & ${presentNames[presentNames.length - 1]} sont en ce moment à la Bâtisse.`

  return (
    <>
      {/* Photo de la maison en fond, sur toute la page d'accueil (hors
          bandeau du haut, transparent) — le contenu et la grille de tuiles
          défilent/sont épinglés par-dessus. Remplacée le 27/09/2026 à la
          demande de Nicolas par la photo qu'il a fournie (photo d'origine,
          seule la luminosité est baissée de 30% — pas de changement de
          saturation), centrée, la même sur mobile et bureau (les deux
          anciens recadrages distincts d'Aurélie sont remplacés par ce
          fichier unique). Avant, cette photo ne vivait que derrière la
          grille de tuiles (TileNav) ; elle couvre maintenant toute la page,
          donc TileNav n'a plus besoin de son propre fond.
          En CSS background-image (comme le bandeau) plutôt qu'en next/image :
          le composant Image ne chargeait pas de façon fiable cette photo de
          fond plein écran au premier affichage (elle ne se voyait alors que
          derrière le bandeau, qui utilise déjà cette technique). */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/images/accueil-bg-v2.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
          }}
        />
      </div>
      {/* Voile clair retiré le 27/09/2026 à la demande de Nicolas : la
          photo (luminosité -30%, voir plus haut) doit apparaître telle
          quelle, sans éclaircissement supplémentaire par-dessus. */}

      {/* TileNav (grille "onglets") et son espace de dégagement en bas
          vivent désormais dans layout.tsx, communs à toutes les pages
          (demandé par Nicolas le 27/09/2026) — plus besoin de les gérer
          ici spécifiquement pour l'accueil. */}
      <div className="pt-6">
        {/* Espacements ajustés le 27/09/2026 à la demande de Nicolas,
            exprimés en multiples d'une seule unité G = l'espace entre la
            ligne de dates ("25 DÉCEMBRE...") et la pastille "Total taxe de
            séjour" (mt-6, 24px — inchangé, c'est la référence que Nicolas
            a demandé de garder). Repris :
            - bandeau -> "Bonjour" : G (= aussi le padding gauche p-6 de
              <main>, demandé égal)
            - "Bonjour" -> "Votre prochain séjour" : G
            - "Votre prochain séjour" -> dates, et titre -> activité pour
              Aujourd'hui/Demain/Tâche ce mois ci : mt-2 (8px, inchangé)
            - dates -> pastille taxe de séjour : G (inchangé, référence)
            - pastille taxe de séjour -> Aujourd'hui/Demain : 2×G (mt-12)
            - activité (tiret) -> "Tâche ce mois ci" : 2×G (mt-12)
            Texte courant en casse normale, lignes de données en
            MAJUSCULES super bold (font-extrabold — le poids le plus fort
            que l'EB Garamond variable propose), tout en blanc (la photo
            n'a plus de voile, voir plus haut). isFriend / CotisationPill :
            la pastille "Cotisation mensuelle" qui vivait ici est retirée
            de l'accueil (toujours utilisée ailleurs, composant non
            supprimé). */}
        <h1 className="text-2xl font-normal text-white md:text-3xl">
          Bonjour {profile.first_name}
        </h1>

        {/* "Votre prochain séjour" + dates + pastille "Total taxe de
            séjour" si un séjour à venir est inscrit au planning, sinon
            "Vous n'êtes pas venu depuis..." (jamais les deux à la fois,
            demandé par Nicolas). */}
        {nextBooking ? (
          <div className="mt-6">
            <p className="text-lg font-normal text-white md:text-xl">Votre prochain séjour</p>
            <p className="mt-2 text-sm font-extrabold uppercase tracking-[0.12em] text-white md:text-base">
              {formatDateLong(nextBooking.check_in)} - {formatDateLong(nextBooking.check_out)}
            </p>
            {tsBalance && (
              <div className="mt-6">
                <TaxeSejourPill
                  amount={tsBalance.own.pending}
                  ids={tsBalance.own.items.map((item) => item.id)}
                />
              </div>
            )}
          </div>
        ) : (
          lastStaySentence && (
            <p className="mt-6 text-sm font-light text-white md:text-base">{lastStaySentence}</p>
          )
        )}

        {/* "Aujourd'hui" / "Demain" — deviendront des liens directs vers
            l'onglet dont Nicolas a parlé le week-end du 20-21/09/2026, pas
            encore construit : pour l'instant tiret "-" en attendant une
            vraie source de données (demandé par Nicolas le 27/09/2026, à
            la place d'un espace vide — ça l'aide à donner les indications
            de mise en page). Grille CSS : les deux colonnes restent
            alignées automatiquement (même hauteur de ligne) quel que soit
            le contenu de chaque côté, à garder en tête pour plus tard
            (demandé par Nicolas : "doivent toujours être alignées"). */}
        <div className="mt-12 grid grid-cols-2 gap-x-4">
          <div>
            <p className="text-lg font-normal text-white md:text-xl">Aujourd&rsquo;hui</p>
            <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.08em] text-white md:text-sm">-</p>
          </div>
          <div>
            <p className="text-lg font-normal text-white md:text-xl">Demain</p>
            <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.08em] text-white md:text-sm">-</p>
          </div>
        </div>

        {/* "Tâche ce mois ci" — widget relié à l'onglet Entretien,
            fonctionnera comme Aujourd'hui/Demain (la tâche du mois en
            cours, saisie en base, apparaîtra ici) — fonctionnement réel à
            développer plus tard, demandé par Nicolas : pour l'instant
            tiret "-" en attendant. */}
        <Link href="/dashboard/taches" className="mt-12 block w-fit">
          <p className="text-lg font-normal text-white md:text-xl">Tâche ce mois ci</p>
          <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.08em] text-white md:text-sm">-</p>
        </Link>

        {/* "Présents en ce moment" masqué (pas supprimé) le 27/09/2026 à la
            demande de Nicolas : "je verrai plus tard comment et où on
            l'affiche". presentSentence reste calculé plus haut. */}
        {/* <p className="mt-[85px] font-normal text-base md:text-lg text-white">{presentSentence}</p> */}
      </div>


      {/* Upcoming bookings — widget "Mes prochains séjours" masqué à la
          demande d'Aurélie le 18/09/2026. JSX laissé en commentaire pour
          pouvoir le remettre facilement si besoin. */}
      {/*
      {futureBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mes prochains séjours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {futureBookings.slice(0, 3).map((booking) => (
                <div key={booking.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-stone-700">
                      {booking.guest_name && (
                        <span className="text-stone-400 font-normal">{booking.guest_name} · </span>
                      )}
                      {formatDate(booking.check_in)} → {formatDate(booking.check_out)}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {Math.ceil((new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / (1000 * 60 * 60 * 24))} nuits
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      */}
    </>
  )
}
