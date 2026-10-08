import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
// Card/CardContent/CardHeader/CardTitle, Badge, formatCurrency : ne
// servent plus qu'aux widgets masqués plus bas (18/09/2026) — depuis
// @/components/ui/card, @/components/ui/badge, @/lib/utils. À
// réimporter avec eux si on les remet. CotisationPill n'est plus utilisée
// ici (retirée de l'accueil le 27/09/2026 à la demande de Nicolas, voir
// plus bas) mais reste utilisée ailleurs — composant non supprimé.
import { TaxeSejourPill } from '@/components/dashboard/TaxeSejourPill'
import { computeTsBalance } from '@/lib/ts-balance'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // Widget "Aujourd'hui"/"Demain" de l'onglet "Activités" (08/10/2026,
  // voir migration_local_events.sql) : la RLS de local_events restreint
  // la lecture aux comptes admin (le reste de l'onglet leur est
  // intégralement réservé), mais ce widget doit rester visible de tous
  // les comptes connectés -- client service-role ici, comme pour le
  // webhook Stripe (src/lib/supabase/admin.ts), plutôt que le client de
  // session qui serait bloqué par la RLS pour un compte family/friend.
  // Fenêtre bornée à 30 jours en arrière (plutôt qu'un historique complet)
  // pour couvrir le cas d'un événement sur plusieurs jours déjà commencé,
  // sans scanner toute la table -- 30 jours est une marge large, à
  // ajuster si un événement dure plus longtemps.
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowISO = tomorrow.toISOString().slice(0, 10)
  const windowStart = new Date(today)
  windowStart.setDate(windowStart.getDate() - 30)
  const windowStartISO = windowStart.toISOString().slice(0, 10)
  // Borne haute de la colonne "À suivre" (test du 08/10/2026, voir
  // conversation avec Nicolas) : le reste de la semaine en cours, même
  // définition que la colonne "Cette semaine" de l'onglet Activités
  // (ActivitesBoard.tsx) -- 7 jours à partir d'aujourd'hui.
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndISO = weekEnd.toISOString().slice(0, 10)

  const supabaseAdmin = createAdminClient()
  const { data: upcomingEvents } = await supabaseAdmin
    .from('local_events')
    .select('title, event_date, event_end_date, location')
    .gte('event_date', windowStartISO)
    .lte('event_date', weekEndISO)

  const coversDay = (ev: { event_date: string; event_end_date: string | null }, dayISO: string) =>
    ev.event_date <= dayISO && (ev.event_end_date ?? ev.event_date) >= dayISO

  const todayEvents = (upcomingEvents ?? []).filter((e) => coversDay(e, todayISO))
  const tomorrowEvents = (upcomingEvents ?? []).filter((e) => coversDay(e, tomorrowISO))
  // "À suivre" : le reste de la semaine, donc à partir du surlendemain --
  // pas de doublon avec Aujourd'hui/Demain qui ont déjà leur colonne.
  const weekEvents = (upcomingEvents ?? [])
    .filter((e) => e.event_date > tomorrowISO && e.event_date <= weekEndISO)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
  const eventsLabel = (list: { title: string }[]) =>
    list.length === 0 ? '-' : list.length === 1 ? list[0].title : `${list[0].title} +${list.length - 1}`
  // Titre raccourci à 2-3 mots pour la colonne "À suivre" (demandé par
  // Nicolas le 08/10/2026) -- l'intitulé complet reste visible dans
  // l'onglet Activités lui-même.
  const shortTitle = (title: string) => title.split(' ').slice(0, 3).join(' ')

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
      <div className="pt-4">
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
            que l'EB Garamond variable propose). Couleur : text-background
            ("blanc cassé", le ton crème du fond de page ailleurs sur le
            site, oklch(0.98 0.007 75) — voir globals.css), pas blanc pur.
            Un premier essai en blanc à 60% d'opacité (text-white/60), le
            29/09/2026, a été jugé par Nicolas trop peu lisible sur la
            photo — remplacé le jour même par ce blanc cassé à pleine
            opacité, gardé aussi pour le bandeau du bas sur cette page
            (Membres/Suivi paiements/Se déconnecter, voir BottomNav.tsx).
            isFriend / CotisationPill :
            la pastille "Cotisation mensuelle" qui vivait ici est retirée
            de l'accueil (toujours utilisée ailleurs, composant non
            supprimé). */}
        <h1 className="text-2xl font-normal text-background md:text-3xl">
          Bonjour {profile.first_name}
        </h1>

        {/* "Votre prochain séjour" + dates + pastille "Total taxe de
            séjour" si un séjour à venir est inscrit au planning, sinon
            "Vous n'êtes pas venu depuis..." (jamais les deux à la fois,
            demandé par Nicolas). */}
        {nextBooking ? (
          <div className="mt-6">
            <p className="text-lg font-normal text-background md:text-xl">Votre prochain séjour</p>
            <p className="mt-2 text-sm font-extrabold uppercase tracking-[0.12em] text-background md:text-base">
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
            <p className="mt-6 text-sm font-light text-background md:text-base">{lastStaySentence}</p>
          )
        )}

        {/* "Aujourd'hui" / "Demain" / "À suivre" — branché le
            08/10/2026 sur l'onglet "Activités" (session de test, voir
            migration_local_events.sql). Test demandé par Nicolas le
            08/10/2026 : 3e colonne "À suivre" qui donne un aperçu des
            événements du reste de la semaine, une ligne par événement
            (date, lieu, titre raccourci à 2-3 mots) plutôt qu'un simple
            compteur comme les deux premières colonnes -- à ajuster
            (nombre de lignes affichées, format de date...) une fois que
            Nicolas voit le rendu réel. Lien direct vers l'onglet
            uniquement pour les admins (seuls à pouvoir y accéder — tout
            autre compte serait aussitôt redirigé vers cette page même,
            voir src/app/dashboard/activites/page.tsx) ; même contenu en
            simple <div>/<p> pour family/friend. */}
        <div className="mt-12 grid grid-cols-3 gap-x-4">
          {[
            { label: "Aujourd'hui", value: eventsLabel(todayEvents) },
            { label: 'Demain', value: eventsLabel(tomorrowEvents) },
          ].map(({ label, value }) =>
            profile.role === 'admin' ? (
              <Link key={label} href="/dashboard/activites" className="block w-fit">
                <p className="text-lg font-normal text-background md:text-xl">{label}</p>
                <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.08em] text-background md:text-sm">
                  {value}
                </p>
              </Link>
            ) : (
              <div key={label}>
                <p className="text-lg font-normal text-background md:text-xl">{label}</p>
                <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.08em] text-background md:text-sm">
                  {value}
                </p>
              </div>
            )
          )}
          {(() => {
            const shown = weekEvents.slice(0, 4)
            const content = (
              <>
                <p className="text-lg font-normal text-background md:text-xl">À suivre</p>
                {shown.length === 0 ? (
                  <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.08em] text-background md:text-sm">-</p>
                ) : (
                  <div className="mt-2 space-y-1">
                    {shown.map((ev, i) => (
                      <p key={i} className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-background md:text-xs">
                        {format(parseISO(ev.event_date), 'd MMM', { locale: fr })}
                        {ev.location ? ` · ${ev.location}` : ''} · {shortTitle(ev.title)}
                      </p>
                    ))}
                    {weekEvents.length > shown.length && (
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-background/70 md:text-xs">
                        +{weekEvents.length - shown.length}
                      </p>
                    )}
                  </div>
                )}
              </>
            )
            return profile.role === 'admin' ? (
              <Link href="/dashboard/activites" className="block w-fit">
                {content}
              </Link>
            ) : (
              <div>{content}</div>
            )
          })()}
        </div>

        {/* "Tâche ce mois ci" — widget relié à l'onglet Entretien,
            fonctionnera comme Aujourd'hui/Demain (la tâche du mois en
            cours, saisie en base, apparaîtra ici) — fonctionnement réel à
            développer plus tard, demandé par Nicolas : pour l'instant
            tiret "-" en attendant. */}
        <Link href="/dashboard/taches" className="mt-12 block w-fit">
          <p className="text-lg font-normal text-background md:text-xl">Tâche ce mois ci</p>
          <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.08em] text-background md:text-sm">-</p>
        </Link>

        {/* "Présents en ce moment" masqué (pas supprimé) le 27/09/2026 à la
            demande de Nicolas : "je verrai plus tard comment et où on
            l'affiche". presentSentence reste calculé plus haut. */}
        {/* <p className="mt-[85px] font-normal text-base md:text-lg text-background">{presentSentence}</p> */}
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
