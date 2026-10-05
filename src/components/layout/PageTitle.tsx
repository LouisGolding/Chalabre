// Titre de page partage par tous les onglets (Guide de la maison, Planning,
// Suivi des paiements, Entretien, etc) -- cree le 05/10/2026 a la demande de
// Nicolas : harmoniser l'espace entre le titre et la ligne du bandeau du
// haut (TopBanner) sur tous les onglets, et centraliser cette esthetique
// dans un seul composant pour qu'une future modification se propage
// automatiquement partout, au lieu de la dupliquer dans chaque page.tsx.
//
// NE S'APPLIQUE PAS a l'accueil ("Bonjour {prenom}", dashboard/page.tsx) :
// ce titre est volontairement different (pas de ligne de bandeau sur cette
// page, texte non majuscule, sur fond photo).
export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-2xl md:text-3xl font-normal uppercase tracking-[0.08em] text-foreground mt-4 text-center md:text-left">
      {children}
    </h1>
  )
}
