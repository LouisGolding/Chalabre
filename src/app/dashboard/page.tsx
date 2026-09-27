import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
// formatCurrency, formatDate, Card/CardContent/CardHeader/CardTitle et
// Badge ne sont plus utilisés que par les widgets masqués plus bas
// (18/09/2026) ou déplacés depuis (21/09/2026, voir ReserverSejour.tsx) :
// formatCurrency et formatDate depuis @/lib/utils, Card depuis
// @/components/ui/card, Badge depuis @/components/ui/badge, Users depuis
// lucide-react. À réimporter avec eux si on les remet.
import { CotisationPill } from '@/components/dashboard/CotisationPill'
import { TileNav } from '@/components/layout/TileNav'

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

  const isFriend = profile.role === 'friend'

  return (
    <>
      {/* Photo de la maison en fond, uniquement sur l'accueil — le bandeau
          (transparent) et le contenu défilent par-dessus. Deux recadrages
          fournis par Aurélie : un pour le format paysage/bureau, un pour
          le format portrait/mobile.
          En CSS background-image (comme le bandeau) plutôt qu'en next/image :
          le composant Image ne chargeait pas de façon fiable cette photo de
          fond plein écran au premier affichage (elle ne se voyait alors que
          derrière le bandeau, qui utilise déjà cette technique). */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 md:hidden"
          style={{
            backgroundImage: "url('/images/accueil-bg-mobile.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: '43% 38%',
          }}
        />
        <div
          className="absolute inset-0 hidden md:block"
          style={{
            backgroundImage: "url('/images/accueil-bg-desktop.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: '39% 40%',
          }}
        />
        {/* Voile clair pour garder le texte lisible, comme sur le montage
            d'Aurélie (photo légèrement éclaircie sous le bandeau/le texte). */}
        <div className="absolute inset-0 bg-background/40" />
      </div>

      {/* Espace en bas ajouté le 27/09/2026 : TileNav est désormais épinglée
          en bas de l'écran (fixed) par-dessus ce contenu, il faut donc que
          le dernier texte ("Personne n'est à la Bâtisse...") ne se
          retrouve pas caché dessous. Valeurs = hauteur de TileNav sur
          mobile (222px) / bureau (266px), BottomNav déjà pris en compte
          par ailleurs (padding du <main>, layout.tsx). */}
      <div className="space-y-6 pb-[222px] md:pb-[266px]">
        {/* Welcome — "Bonjour ..." et la pastille "Cotisation mensuelle" sur la
            même ligne, alignés à gauche. Espace avant "Prochain séjour"
            (demandé par Aurélie le 18/09/2026) : mb-2 initialement,
            quadruplé en mb-8, quadruplé une seconde fois en mb-32, puis
            réduit d'un tiers (128px → 85px) le même jour. */}
        {/* Welcome, en grille à 2 colonnes / 2 lignes partagées : ligne 1
            "Bonjour, ..." (gauche) / "Cotisation mensuelle" (droite), ligne
            2 "Vous n'êtes pas venu depuis..." seule (gauche) — la pastille
            "Solde taxe de séjour" qui occupait la colonne de droite de
            cette 2e ligne a déménagé sur l'onglet Planning le 21/09/2026,
            à côté de "Prochain séjour" (demandé par Aurélie — voir
            ReserverSejour.tsx), puisque tout ce qui concerne les séjours et
            leur taxe de séjour est désormais réuni là-bas. col-start/
            row-start explicites conservés malgré tout : sans ça, l'absence
            de "Vous n'êtes pas venu..." (aucun séjour passé) décalerait la
            grille de façon imprévisible. */}
        <div className="mb-[85px] grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-2">
          <h1 className="col-start-1 row-start-1 text-xl md:text-2xl font-semibold text-foreground">
            Bonjour, {profile.first_name} {profile.last_name}
          </h1>
          <div className="col-start-2 row-start-1 flex justify-end">
            {!isFriend && (
              <CotisationPill profileId={profile.id} initialAmount={profile.tm_tier} />
            )}
          </div>

          {/* Typo semi light, même taille que le texte de la pastille
              "Cotisation mensuelle" (text-sm), sans pastille/fond. */}
          {lastStaySentence && (
            <p className="col-start-1 row-start-2 self-center text-sm font-light text-foreground">
              {lastStaySentence}
            </p>
          )}
        </div>

      {/* Quick stats — "Solde TS" est dans la pastille juste au-dessus, à
          côté de "Cotisation mensuelle" (demandé par Aurélie le
          18/09/2026). Le widget "Prochain séjour + Taxe de séjour" qui
          s'affichait ici a migré vers l'onglet Planning le 21/09/2026
          (demandé par Nicolas — voir ReserverSejour.tsx, sous le bouton
          "Réserver un séjour"). Le widget "Dernier séjour" qui suivait ici
          a été masqué à sa demande
          le 18/09/2026 (le const lastBooking est réutilisé depuis, pour la
          phrase "Vous n'êtes pas venu depuis..." sous "Bonjour, ...") :
          <Card className="md:max-w-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dernier séjour</CardTitle>
              <Calendar className="h-4 w-4 text-stone-400" />
            </CardHeader>
            <CardContent>
              {lastBooking ? (
                <div className="text-lg font-semibold text-stone-700">
                  {formatDate(lastBooking.check_out)}
                </div>
              ) : (
                <p className="text-stone-400 text-sm">Aucun séjour</p>
              )}
            </CardContent>
          </Card>
      */}

      {/* "Présents en ce moment" — repensé le 18/09/2026 à la demande
          d'Aurélie : plus de carte ni de fond coloré, directement sur la
          photo, une simple phrase en graisse regular ("Nicolas, Louis &
          Aurélie sont en ce moment à la Bâtisse.", ou "Personne n'est à la
          Bâtisse en ce moment." si personne — calculé plus haut via
          presentSentence, à partir des séjours dont la date du jour tombe
          entre check_in et check_out). */}
      {/* Même traitement que l'espace "Bonjour" / "Prochain séjour"
          ci-dessus (quadruplé, puis réduit d'un tiers à 85px), appliqué
          ici entre "Supprimer ce séjour" et cette phrase, demandé par
          Aurélie le 18/09/2026. */}
      <p className="mt-[85px] font-normal text-base md:text-lg text-foreground">{presentSentence}</p>

      {/* Grille de navigation — refonte du 27/09/2026 demandée par
          Nicolas (voir TileNav.tsx) : les onglets qui vivaient dans le
          bandeau du haut vivent maintenant ici, sur l'accueil. */}
      <TileNav role={profile.role} />

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
      </div>
    </>
  )
}
