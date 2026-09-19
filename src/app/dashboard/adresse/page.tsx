// Onglet "Adresse", commun à tous les comptes (pas réservé aux admins,
// contrairement à "Membres" / "Suivi paiements" dans le même bandeau du
// bas) — demandé par Aurélie le 18/09/2026. Contenu statique : l'adresse
// de la maison ne change pas, pas besoin d'aller la chercher en base.
export default function AdressePage() {
  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Adresse</h1>

      <div>
        <p className="text-xl md:text-2xl font-semibold text-foreground">La Bâtisse</p>
        <p className="mt-1 text-lg font-light text-foreground">15, route de Lavelanet</p>
        <p className="text-lg font-light text-foreground">Chalabre, 11230</p>
      </div>
    </div>
  )
}
