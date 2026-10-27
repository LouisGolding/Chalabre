import { createClient } from '@/lib/supabase/server'

// Familles nucléaires (27/10/2026, demande d'Aurélie : "si un des deux
// parents rentre le sejour de son enfant, ce sejour apparait aussi sur
// le profil de l'autre parent [...] de sorte à ce que l'un des deux
// parents puisse payer") : deux comptes qui partagent la même colonne
// profiles.nuclear_family (texte libre, attribuée à l'inscription par
// handle_new_user() -- voir src/lib/colors.ts pour le détail et la liste
// de correspondance prénom -> famille nucléaire, ex. Nicolas et Aurélie
// partagent 'lal-nicolas-aurelie', Guillaume/Eva/Viktor/Sofia
// 'can-guillaume') voient et peuvent régler les mêmes séjours
// d'accompagnants (enfants), quel que soit celui des deux qui les a
// saisis -- voir src/lib/ts-balance.ts (computeTsBalance) et
// /api/stripe/checkout/route.ts (autorisation de paiement).
//
// Renvoie les ids des AUTRES comptes (jamais userId lui-même) partageant
// la même famille nucléaire que `userId` -- [] si ce compte n'a pas
// (encore) de nuclear_family enregistrée (comptes créés avant la mise en
// place de cette colonne, voir supabase/migration_palette_couleurs.sql)
// ou si aucun autre compte ne la partage.
export async function otherNuclearFamilyMemberIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  // Évite un aller-retour Supabase supplémentaire quand l'appelant
  // connaît déjà ce champ (ex. un profil déjà chargé ailleurs sur la
  // page). undefined : on va la chercher nous-mêmes à partir de userId.
  knownNuclearFamily?: string | null
): Promise<string[]> {
  let nuclearFamily = knownNuclearFamily
  if (nuclearFamily === undefined) {
    const { data } = await supabase.from('profiles').select('nuclear_family').eq('id', userId).single()
    nuclearFamily = data?.nuclear_family ?? null
  }
  if (!nuclearFamily) return []

  const { data: members } = await supabase
    .from('profiles')
    .select('id')
    .eq('nuclear_family', nuclearFamily)
    .neq('id', userId)

  return (members ?? []).map((m) => m.id)
}
