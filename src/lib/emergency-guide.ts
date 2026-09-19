// Configuration du mini algorithme de dépannage affiché dans "Guide de la
// maison" → "Urgences". Deux mécanismes :
//
// - "diagnostic" (panne électrique, fuite d'eau) : on choisit une zone,
//   l'appli indique quoi vérifier (+ un plan si disponible), puis on
//   confirme si le problème est réglé ou si ça persiste (auquel cas la
//   liste des artisans concernés s'affiche).
// - "locator" (extincteurs) : on choisit un niveau, l'appli affiche
//   simplement le plan avec l'emplacement (pas de diagnostic, pas de
//   suivi de panne).
//
// `planImage` n'est PAS encore renseigné : Aurélie doit fournir les plans.
// Tant qu'il est absent, l'appli affiche un encadré "plan à venir" à la
// place. Chaque zone/niveau indique en commentaire le nom de fichier
// suggéré : il suffira de déposer l'image dans /public/images/plans/ et
// de renseigner `planImage: '/images/plans/<fichier>'` pour l'activer,
// sans toucher au reste du code.

export type DiagnosticZone = {
  id: string
  label: string
  // Ce qu'il faut vérifier concrètement (ex. "tableau électrique du hall").
  checkLabel: string
  planImage?: string
}

export type DiagnosticCategory = {
  kind: 'diagnostic'
  id: 'electrique' | 'eau'
  label: string
  // Mots-clés (minuscules) recherchés dans le rôle des contacts pour la
  // liste d'artisans affichée si le problème persiste.
  contactRoleKeywords: string[]
  zones: DiagnosticZone[]
}

export type LocatorLevel = {
  id: string
  label: string
  planImage?: string
}

export type LocatorCategory = {
  kind: 'locator'
  id: 'extincteurs'
  label: string
  levels: LocatorLevel[]
}

export type EmergencyCategory = DiagnosticCategory | LocatorCategory

export const EMERGENCY_CATEGORIES: EmergencyCategory[] = [
  {
    kind: 'diagnostic',
    id: 'electrique',
    label: 'Panne électrique',
    contactRoleKeywords: ['lectric'],
    zones: [
      {
        id: 'escalier-central-canat',
        label: 'Escalier central et 1er étage CANAT / salles de réception',
        checkLabel: 'Vérifier les fusibles du tableau électrique — Escalier central / CANAT',
        // plan suggéré : /images/plans/elec-escalier-central-canat.png
      },
      {
        id: 'escalier-lalande-3e',
        label: 'Escalier LALANDE / 3ème étage LALANDE',
        checkLabel: 'Vérifier les fusibles du tableau électrique — Escalier LALANDE / 3e étage',
        // plan suggéré : /images/plans/elec-escalier-lalande-3e.png
      },
      {
        id: '2e-etage-ouest',
        label: '2ème étage OUEST',
        checkLabel: 'Vérifier les fusibles du tableau électrique — 2e étage OUEST',
        // plan suggéré : /images/plans/elec-2e-ouest.png
      },
      {
        id: '2e-etage-est',
        label: '2ème étage EST',
        checkLabel: 'Vérifier les fusibles du tableau électrique — 2e étage EST',
        // plan suggéré : /images/plans/elec-2e-est.png
      },
      // Autres zones à ajouter avec Aurélie (liste donnée comme "etc.").
    ],
  },
  {
    kind: 'diagnostic',
    id: 'eau',
    label: "Fuite d'eau",
    contactRoleKeywords: ['plomb', 'eau'],
    zones: [
      // ⚠️ Zonage provisoire, calqué sur les zones électriques en
      // attendant le vrai plan des arrivées d'eau et des nourrices
      // qu'Aurélie doit fournir — à corriger avec elle avant mise en prod.
      {
        id: 'escalier-central-canat',
        label: 'Escalier central et 1er étage CANAT / salles de réception',
        checkLabel: 'Fermer la nourrice — Escalier central / CANAT',
        // plan suggéré : /images/plans/eau-escalier-central-canat.png
      },
      {
        id: 'escalier-lalande-3e',
        label: 'Escalier LALANDE / 3ème étage LALANDE',
        checkLabel: 'Fermer la nourrice — Escalier LALANDE / 3e étage',
        // plan suggéré : /images/plans/eau-escalier-lalande-3e.png
      },
    ],
  },
  {
    kind: 'locator',
    id: 'extincteurs',
    label: 'Extincteurs',
    levels: [
      { id: 'rdc', label: 'RDC' }, // plan suggéré : /images/plans/extincteurs-rdc.png
      { id: '1er', label: '1er étage' }, // plan suggéré : /images/plans/extincteurs-1er.png
      { id: '2e', label: '2ème étage' }, // plan suggéré : /images/plans/extincteurs-2e.png
      { id: '3e', label: '3ème étage' }, // plan suggéré : /images/plans/extincteurs-3e.png
    ],
  },
]
