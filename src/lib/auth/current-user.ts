import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types'

// Dédoublonnage par requête (23/10/2026, demande d'Aurélie : "il y a un
// temps de latence lorsqu'on clique sur un onglet, il met 3 secondes à
// apparaitre"). Avant ce fichier, dashboard/layout.tsx ET chaque
// page.tsx de /dashboard/* appelaient chacun séparément
// supabase.auth.getUser() puis un select sur `profiles` -- soit 4
// aller-retours réseau vers Supabase rien que pour savoir qui est
// connecté et quel est son rôle, répétés en série (pas en parallèle)
// À CHAQUE navigation, puisque layout.tsx et le page.tsx de l'onglet
// cible sont tous deux des Server Components exécutés côté serveur à
// chaque clic sur un onglet.
//
// `cache()` (React, pas une balise HTML) mémorise le résultat de cette
// fonction pour la durée d'une seule requête serveur : layout.tsx et le
// page.tsx qui l'appellent tous les deux ne déclenchent plus qu'un seul
// aller-retour réel vers Supabase pour `getUser()` et un seul pour le
// profil, partagés entre eux -- c'est le pattern recommandé par Supabase
// lui-même pour Next.js App Router. Les pages qui ont besoin d'un select
// différent sur `profiles` (ex. mes-paiements/page.tsx, qui embarque
// `bookings(*, ts_payments(*))`) continuent d'appeler leur propre
// requête, mais profitent quand même du `getUser()` partagé.
export const getCurrentUserAndProfile = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, profile: null as Profile | null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  return { supabase, user, profile: profile ?? null }
})
