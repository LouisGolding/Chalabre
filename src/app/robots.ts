import type { MetadataRoute } from 'next'

// Site privé familial : aucune page ne doit être indexée ni explorée par
// un moteur de recherche (27/10/2026, demande d'Aurélie -- "il faut
// s'assurer que tout le contenu ... ne puisse pas être accessible par
// google ou autre"). En pratique, aucune donnée du tableau de bord n'est
// déjà lisible par un robot non connecté : src/lib/supabase/proxy.ts
// redirige toute page hors de '/' et '/bienvenue' vers /auth/login tant
// qu'il n'y a pas de session -- un robot qui suit un lien direct vers
// /dashboard/budget, par exemple, retombe donc déjà sur l'écran de
// connexion, pas sur les données. Ce fichier est une protection
// supplémentaire (défense en profondeur), pour qu'aucune page du site
// (même la page de connexion ou /bienvenue) n'apparaisse dans les
// résultats de recherche quand on tape "La Bâtisse" sur Google -- voir
// aussi le `robots` de src/app/layout.tsx (balise meta, même intention).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  }
}
