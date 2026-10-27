import { getCurrentUserAndProfile } from '@/lib/auth/current-user'
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
import { TachesUrgentesPill } from '@/components/dashboard/TachesUrgentesPill'
import { computeTsBalance } from '@/lib/ts-balance'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPeriodCurrent } from '@/lib/task-periods'
import { firstNameOnly, properCase, stayPhase } from '@/lib/utils'

// "25 décembre 2026" -> "25 DÉCEMBRE 2026", comme sur le visuel Photoshop
// de Nicolas (27/09/2026) pour les dates du prochain séjour.
function formatDateLong(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(date))
    .toUpperCase()
}

export default async function DashboardPage() {
  const { supabase, user, profile } = await getCurrentUserAndProfile()
  if (!user) redirect('/auth/login')

  if (!profile) redirect('/auth/login')

  const today = new Date()
  const todayISO = today.toISOString().slice(0, 10)

  // Fenêtre "Aujourd'hui"/"Demain"/"À suivre" (08/10/2026, voir
  // migration_local_events.sql) : bornée à 30 jours en arrière (plutôt
  // qu'un historique complet) pour couvrir le cas d'un événement sur
  // plusieurs jours déjà commencé, sans scanner toute la table -- 30
  // jours est une marge large, à ajuster si un événement dure plus
  // longtemps.
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

  // Latence (26/10/2026, demande d'Aurélie : "il y a toujours un temps
  // de latence [...] a revérifier pour que tout soit tres tres
  // rapide") : ces 4 requêtes sont toutes indépendantes les unes des
  // autres (aucune n'a besoin du résultat d'une autre) mais partaient
  // jusqu'ici en 4 aller-retours réseau successifs vers Supabase, l'un
  // après l'autre -- un Promise.all les lance de front, donc le total
  // ne coûte plus que le temps de la plus lente d'entre elles au lieu
  // de leur somme. Seuls tsBalance plus bas (a besoin de nextBooking,
  // donc de `bookings`) et la requête task_contacts dans le bloc RDV
  // ci-dessous (a besoin de rdvNotes) restent de vraies dépendances
  // séquentielles.
  const [
    { data: bookings },
    { data: upcomingEvents },
    { data: openTasks },
    { data: currentBookings },
  ] = await Promise.all([
    // Get user's past bookings (le widget "Prochain séjour" et le calcul
    // de taxe de séjour ont migré vers l'onglet Planning le 21/09/2026 —
    // voir ReserverSejour.tsx — donc seuls les séjours PASSÉS du
    // titulaire du compte sont encore utiles ici, pour "Vous n'êtes pas
    // venu depuis...").
    supabase
      .from('bookings')
      .select('check_out, check_in, guest_name')
      .eq('user_id', user.id)
      .order('check_in', { ascending: true }),
    // Widget "Aujourd'hui"/"Demain" de l'onglet "Activités" : la RLS de
    // local_events restreint la lecture aux comptes admin (le reste de
    // l'onglet leur est intégralement réservé), mais ce widget doit
    // rester visible de tous les comptes connectés -- client
    // service-role ici, comme pour le webhook Stripe
    // (src/lib/supabase/admin.ts), plutôt que le client de session qui
    // serait bloqué par la RLS pour un compte family/friend.
    supabaseAdmin
      .from('local_events')
      .select('title, event_date, event_end_date, location')
      .gte('event_date', windowStartISO)
      .lte('event_date', weekEndISO),
    // "Tâche ce mois-ci" / "Tâches urgentes" : policy "tasks_select"
    // ouverte à tout compte connecté (voir schema.sql) -- pas besoin du
    // client admin ici, contrairement à local_events.
    supabase
      .from('tasks')
      .select('id, title, period, completed, priority')
      .eq('completed', false),
    // "Présents en ce moment" (widget plus bas) : indépendante de tout
    // le reste, déplacée ici depuis sa place d'origine (juste avant son
    // utilisation) pour profiter du même Promise.all.
    supabase
      .from('bookings')
      .select('*, profiles(first_name, last_name)')
      .lte('check_in', todayISO)
      .gte('check_out', todayISO)
      .order('check_in', { ascending: true }),
  ])

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

  // "Tâche ce mois-ci" (câblée aux vraies tâches le 15/10/2026, à la
  // demande de Nicolas -- jusque-là simple placeholder "-"). Même
  // définition de "ce mois-ci" que l'onglet Entretien (mois ou saison en
  // cours, voir isPeriodCurrent dans task-periods.ts).
  const tasksThisMonth = (openTasks ?? []).filter((t) => isPeriodCurrent(t.period))

  // "Tâches urgentes" (23/10/2026, demandé par Aurélie : "si elles sont
  // urgentes, affiches les d'office dans la page d'accueil, et laisse la
  // tant qu'elle n'est pas cochée"). Même source que tasksThisMonth
  // ci-dessus (tâches d'Entretien non cochées), filtrée sur priority ===
  // 'high' ("Urgente" dans TasksBoard.tsx) au lieu de la période en
  // cours -- une tâche urgente reste donc affichée ici indéfiniment tant
  // qu'elle n'est pas cochée dans l'onglet Entretien, quelle que soit sa
  // période.
  const urgentTasks = (openTasks ?? []).filter((t) => t.priority === 'high')

  // Fusion des pastilles "Taches urgentes" et "Tache ce mois ci" en une
  // seule (26/10/2026, demande d'Aurelie : "beaucoup plus simple") --
  // l'urgence prime toujours sur la periode (meme principe qu'avant la
  // fusion), donc urgentTasks passe en premier et tasksThisMonth ne
  // complete qu'avec les taches pas deja comptees comme urgentes.
  const urgentTaskIds = new Set(urgentTasks.map((t) => t.id))
  const mergedTasks = [...urgentTasks, ...tasksThisMonth.filter((t) => !urgentTaskIds.has(t.id))]

  // "RDV à venir" (19/10/2026, demandé par Aurélie) : dès qu'une note de
  // suivi d'une tâche d'Entretien porte une date de RDV à moins de 30
  // jours, elle apparaît ici -- voir TasksBoard.tsx et
  // migration_task_notes_contacts.sql (pas encore appliquée, donc cette
  // requête ne renvoie rien tant qu'elle ne l'est pas). Réservé à
  // admin/family, jamais "friend" (même périmètre que l'onglet Entretien
  // lui-même -- voir taches/page.tsx), donc pas exécutée pour un compte
  // ami.
  let upcomingRdvs: { taskId: string; title: string; rdvDate: string; contacts: string }[] = []
  if (profile.role !== 'friend') {
    const in30DaysISO = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: rdvNotes } = await supabase
      .from('task_notes')
      .select('task_id, rdv_date, created_at, tasks(title)')
      .not('rdv_date', 'is', null)
      .order('created_at', { ascending: false })

    // Seule la note la plus récente de chaque tâche compte (ex. un RDV
    // reporté annule le précédent) -- `rdvNotes` est trié du plus récent
    // au plus ancien, donc le premier rencontré par tâche suffit.
    const latestByTask = new Map<string, { title: string; rdvDate: string }>()
    for (const n of rdvNotes ?? []) {
      if (latestByTask.has(n.task_id)) continue
      const taskTitle = (n.tasks as unknown as { title: string } | null)?.title
      if (taskTitle && n.rdv_date) latestByTask.set(n.task_id, { title: taskTitle, rdvDate: n.rdv_date })
    }

    const upcomingTaskIds = [...latestByTask.entries()]
      .filter(([, v]) => v.rdvDate >= todayISO && v.rdvDate <= in30DaysISO)
      .sort((a, b) => a[1].rdvDate.localeCompare(b[1].rdvDate))
      .map(([taskId]) => taskId)

    const contactsByTask = new Map<string, string>()
    if (upcomingTaskIds.length > 0) {
      const { data: taskContacts } = await supabase
        .from('task_contacts')
        .select('task_id, contacts(name)')
        .in('task_id', upcomingTaskIds)
      for (const tc of taskContacts ?? []) {
        const name = (tc.contacts as unknown as { name: string } | null)?.name
        if (!name) continue
        contactsByTask.set(tc.task_id, contactsByTask.has(tc.task_id) ? `${contactsByTask.get(tc.task_id)}, ${name}` : name)
      }
    }

    upcomingRdvs = upcomingTaskIds.map((taskId) => {
      const entry = latestByTask.get(taskId)!
      return { taskId, title: entry.title, rdvDate: entry.rdvDate, contacts: contactsByTask.get(taskId) ?? '' }
    })
  }

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
  const tsBalance = nextBooking ? await computeTsBalance(supabase, user.id, profile.nuclear_family) : null

  // currentBookings vient désormais du Promise.all plus haut (même
  // requête, juste déplacée pour partir en parallèle avec les 3 autres).

  // Prénoms des personnes actuellement à la Bâtisse, pour la phrase du
  // widget "Présents en ce moment" ci-dessous. On utilise guest_name quand
  // le séjour a été saisi pour un accompagnant (sinon profiles ne donnerait
  // que le nom du titulaire du compte qui a saisi ce séjour, pas celui de
  // l'accompagnant réellement présent).
  const presentNames = (currentBookings ?? []).map((b) =>
    // Casse normalisee (demande par Aurelie le 26/10/2026 : "Eva"
    // s'affichait "eVA") -- voir properCase/firstNameOnly dans
    // src/lib/utils.ts.
    b.guest_name ? firstNameOnly(b.guest_name) : (b.profiles?.first_name ? properCase(b.profiles.first_name) : null)
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
          Bonjour {properCase(profile.first_name)}
        </h1>

        {/* "Votre prochain séjour" + dates + pastille "Total taxe de
            séjour" si un séjour à venir est inscrit au planning, sinon
            "Vous n'êtes pas venu depuis..." (jamais les deux à la fois,
            demandé par Nicolas). */}
        {nextBooking ? (
          <div className="mt-6">
            {/* "Votre séjour en cours" si le séjour a déjà commencé
                (demandé par Aurélie le 26/10/2026 : "mon séjour indique
                que je suis à Chalabre, donc il faut [...] que soit
                affiché 'votre séjour en cours'") -- même distinction
                que dans NextStayCard.tsx (stayPhase), simplement jamais
                reprise ici où le titre était resté figé en "Votre
                prochain séjour" quelle que soit la phase du séjour. */}
            <p className="text-lg font-normal text-background md:text-xl">
              {stayPhase(nextBooking.check_in, nextBooking.check_out) === 'ongoing'
                ? 'Votre séjour en cours'
                : 'Votre prochain séjour'}
            </p>
            <p className="mt-2 text-sm font-extrabold uppercase tracking-[0.12em] text-background md:text-base">
              {formatDateLong(nextBooking.check_in)} - {formatDateLong(nextBooking.check_out)}
            </p>
            {tsBalance && (
              <div className="mt-6">
                {/* Pastille unique qui règle TOUT d'un coup (27/10/2026,
                    demande d'Aurélie : "la pastille 'payer vos ts'
                    additionne toutes ces taxes de séjour pour les payer
                    en une seule fois") -- additionne le solde propre du
                    titulaire ET celui de tous ses accompagnants (enfants
                    saisis par lui, ou par l'autre parent si même famille
                    nucléaire, voir computeTsBalance) en un seul montant
                    et une seule session Stripe. Côté "gestion" comme sur
                    la page Stripe elle-même, chaque personne garde sa
                    propre ligne (voir /api/stripe/checkout/route.ts :
                    un libellé par accompagnant, un ts_payments.update
                    distinct par personne) -- rien ne change de ce
                    côté-là, seul le geste de paiement est unifié ici. */}
                <TaxeSejourPill
                  amount={tsBalance.own.pending + tsBalance.guests.reduce((sum, g) => sum + g.pending, 0)}
                  ids={[
                    ...tsBalance.own.items.map((item) => item.id),
                    ...tsBalance.guests.flatMap((g) => g.items.map((item) => item.id)),
                  ]}
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
            compteur comme les deux premières colonnes. Lien direct vers
            l'onglet uniquement pour les admins (seuls à pouvoir y
            accéder — tout autre compte serait aussitôt redirigé vers
            cette page même, voir src/app/dashboard/activites/page.tsx) ;
            même contenu en simple <div>/<p> pour family/friend.
            15/10/2026 (demande de Nicolas) : plus de grille à 3 colonnes
            fixes -- une colonne vide (ex. "Aujourd'hui" sans rien de
            prévu) n'est plus affichée du tout, et les colonnes restantes
            se resserrent vers la gauche (flex plutôt que grid-cols-3, qui
            aurait réservé un tiers de largeur même pour une colonne
            absente). Toute la ligne disparaît s'il n'y a aucune activité
            nulle part (aujourd'hui/demain/cette semaine). */}
        {(todayEvents.length > 0 || tomorrowEvents.length > 0 || weekEvents.length > 0) && (
          <div className="mt-12 flex flex-wrap gap-x-4">
            {(
              [
                todayEvents.length > 0 && { label: "Aujourd'hui", value: eventsLabel(todayEvents) },
                tomorrowEvents.length > 0 && { label: 'Demain', value: eventsLabel(tomorrowEvents) },
              ].filter((c): c is { label: string; value: string } => !!c)
            ).map(({ label, value }) =>
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
            {weekEvents.length > 0 &&
              (() => {
                const shown = weekEvents.slice(0, 4)
                const content = (
                  <>
                    <p className="text-lg font-normal text-background md:text-xl">À suivre</p>
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
        )}

        {/* "Tâches urgentes" -- fusion le 26/10/2026 (demande d'Aurélie,
            "beaucoup plus simple") des anciennes pastilles "Tâches
            urgentes" et "Tâche ce mois ci" en une seule sous ce titre
            (voir mergedTasks plus haut : urgence d'abord, puis le reste
            de "ce mois-ci"). Même gating que l'ancienne pastille
            "Tâches urgentes" -- masqué pour un compte "friend", Entretien
            ne lui étant de toute façon pas accessible (TileNav.tsx) ; à
            confirmer avec Aurélie si elle préfère que "ce mois-ci" reste
            visible en lecture pour les amis comme avant la fusion.
            Rendu par un composant client (TachesUrgentesPill.tsx)
            uniquement pour l'effet "tapé à la machine" demandé par
            Aurélie à l'arrivée sur l'accueil (depuis un autre onglet ou
            depuis la page de connexion) -- un Server Component ne peut
            pas animer sa propre apparition au montage. */}
        {mergedTasks.length > 0 && profile.role !== 'friend' && (
          <TachesUrgentesPill
            title="Tâches urgentes"
            lines={mergedTasks.slice(0, 4).map((task) => task.title)}
            overflowLabel={mergedTasks.length > 4 ? `+${mergedTasks.length - 4}` : null}
          />
        )}

        {/* "RDV à venir" (19/10/2026, demandé par Aurélie) : notes de
            suivi des tâches d'Entretien portant une date de RDV à moins
            de 30 jours (voir upcomingRdvs plus haut, et TasksBoard.tsx
            pour l'ajout d'une telle note). Même principe que "À suivre"
            ci-dessus : une ligne par RDV (date, titre court de la tâche,
            contact(s) associé(s)), masqué entièrement s'il n'y en a
            aucun. Jamais affiché pour un compte "friend" (upcomingRdvs
            reste vide pour ce rôle, voir plus haut). */}
        {upcomingRdvs.length > 0 && (
          <Link href="/dashboard/taches" className="mt-12 block w-fit">
            <p className="text-lg font-normal text-background md:text-xl">RDV à venir</p>
            <div className="mt-2 space-y-1">
              {upcomingRdvs.slice(0, 4).map((rdv) => (
                <p key={rdv.taskId} className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-background md:text-xs">
                  {format(parseISO(rdv.rdvDate), 'd MMM', { locale: fr })} · {shortTitle(rdv.title)}
                  {rdv.contacts ? ` · ${rdv.contacts}` : ''}
                </p>
              ))}
              {upcomingRdvs.length > 4 && (
                <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-background/70 md:text-xs">
                  +{upcomingRdvs.length - 4}
                </p>
              )}
            </div>
          </Link>
        )}

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
