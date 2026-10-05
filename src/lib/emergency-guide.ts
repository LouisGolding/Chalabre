// Configuration du mini algorithme de dépannage affiché dans "Guide de la
// maison" → "Urgences". Trois mécanismes :
//
// - "diagnostic" (panne électrique, fuite d'eau) : on choisit une zone,
//   l'appli indique quoi vérifier (+ un plan si disponible), puis on
//   confirme si le problème est réglé ou si ça persiste (auquel cas la
//   liste des artisans concernés s'affiche).
// - "locator" (extincteurs) : on choisit un niveau, l'appli affiche
//   simplement le plan avec l'emplacement (pas de diagnostic, pas de
//   suivi de panne).
// - "heater" (plus d'eau chaude, depuis le 05/10/2026) : on choisit un
//   côté de la maison (Canat/Lalande) puis un étage, l'appli affiche le
//   ou les ballon(s)/chauffe-eau concerné(s) pour cette combinaison (un
//   seul choix = mis en évidence automatiquement) et la photo zoomée de
//   son emplacement -- pas de suivi de panne ici non plus, c'est un pur
//   outil de repérage comme "locator", simplement avec deux niveaux de
//   sélection (côté + étage) au lieu d'un seul.
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

// "heater" (plus d'eau chaude) : deux niveaux de selection (cote de la
// maison, puis etage), chaque combinaison menant a une liste d'options
// (en general un ballon/chauffe-eau precis -- parfois plusieurs, quand
// une meme salle de bain/piece dessert plusieurs chambres). Une
// combinaison avec un seul choix est automatiquement selectionnee
// (mise en evidence), affichee en attendant que l'utilisateur clique
// quoi que ce soit -- demande explicite de Nicolas le 05/10/2026.
export type HeaterSide = 'canat' | 'lalande'
export type HeaterFloorId = 'rdc' | '1er' | '2e' | '3e'

export type HeaterOption = {
  id: string
  label: string
  planImage?: string
}

export type HeaterConfig = {
  side: HeaterSide
  floor: HeaterFloorId
  // Tableau vide = combinaison pas encore renseignee par Nicolas (voir
  // commentaires un peu plus bas, au niveau de chaque config).
  options: HeaterOption[]
}

export type HeaterCategory = {
  kind: 'heater'
  id: 'eau-chaude'
  label: string
  floors: { id: HeaterFloorId; label: string }[]
  configs: HeaterConfig[]
}

export type EmergencyCategory = DiagnosticCategory | LocatorCategory | HeaterCategory

export const EMERGENCY_CATEGORIES: EmergencyCategory[] = [
  {
    // Ordre des catégories Urgence demandé par Nicolas le 27/09/2026 :
    // fuite d'eau / eau chaude / panne électrique / extincteurs
    // (auparavant : panne électrique / fuite d'eau / extincteurs).
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
    // Refondue le 05/10/2026 a la demande de Nicolas : ce n'etait, jusque
    // la, qu'un "diagnostic" generique (zones provisoires recopiees de
    // "Panne electrique", jamais confirmees -- voir l'historique via
    // `git log` sur ce fichier si besoin de retrouver l'ancienne version).
    // Remplace par un vrai outil de reperage "cote de la maison + etage
    // -> ballon(s) d'eau chaude concerne(s) + photo de son emplacement",
    // calque sur le widget "Organisation des placards"
    // (StorageOrganization.tsx) pour le traitement des pastilles
    // Canat/Lalande. Plus de suivi de panne (reglee/persistante,
    // contacts) pour cette categorie precise -- ce n'est plus un
    // diagnostic de panne mais un pur outil de localisation, comme
    // "Extincteurs". A confirmer aupres de Nicolas que cette
    // interpretation (abandon du suivi de panne pour "Plus d'eau
    // chaude" uniquement) lui convient.
    kind: 'heater',
    id: 'eau-chaude',
    label: "Plus d'eau chaude",
    floors: [
      { id: 'rdc', label: 'RDC' },
      { id: '1er', label: '1er étage' },
      { id: '2e', label: '2ème étage' },
      { id: '3e', label: '3ème étage' },
    ],
    configs: [
      // ⚠️ Les 8 combinaisons possibles (2 côtés × 4 étages) ne sont pas
      // toutes renseignées. Celles ci-dessous avec `options: []` sont en
      // attente d'informations de Nicolas :
      // - CANAT + 1er étage et CANAT + RDC : options déjà données par
      //   Nicolas le 05/10/2026, mais sans les photos ni le détail de
      //   quelle option correspond à quelle photo -- il a dit vouloir
      //   fournir ça plus tard, et a explicitement demandé qu'on le lui
      //   rappelle (voir points-a-regler-avec-louis.md).
      // - LALANDE + 1er étage et CANAT + 2ème étage : combinaisons même
      //   pas mentionnées par Nicolas -- à lui demander.
      {
        side: 'canat',
        floor: 'rdc',
        options: [{ id: 'cuisine', label: 'Cuisine' }],
        // Un seul choix -> mis en évidence automatiquement. Photo pas
        // encore fournie (voir note ci-dessus, infos à venir).
      },
      {
        side: 'canat',
        floor: '1er',
        options: [
          { id: 'sdb-simone', label: 'Sdb Simone' },
          { id: 'buanderie', label: 'Buanderie' },
          { id: 'sdb-ferme', label: 'Sdb Ferme' },
          { id: 'sdb-jean-pierre', label: 'Sdb Jean Pierre' },
          { id: 'sdb-jacques', label: 'Sdb Jacques' },
        ],
        // Infos (quelle option -> quelle photo) pas encore données par
        // Nicolas -- voir note ci-dessus, à lui redemander.
      },
      {
        side: 'canat',
        floor: '2e',
        options: [],
        // Combinaison pas mentionnée par Nicolas -- à lui demander.
      },
      {
        side: 'canat',
        floor: '3e',
        options: [{ id: 'sdb-blanche', label: 'Sdb Blanche' }],
        // Un seul choix -> mis en évidence automatiquement.
        // Photo annoncée par Nicolas sous le nom "ZOOM BALLON SDB 3EME"
        // (pas encore fournie) : une fois reçue, la déposer dans
        // /public/images/plans/ et renseigner `planImage` ici.
      },
      {
        side: 'lalande',
        floor: 'rdc',
        options: [{ id: 'cuisine-buanderie', label: 'Cuisine & Buanderie' }],
        // Un seul choix -> mis en évidence automatiquement.
        // Photo annoncée sous le nom "ZOOM BALLON OFFICE" (pas encore
        // fournie) : une fois reçue, la déposer dans
        // /public/images/plans/ et renseigner `planImage` ici.
      },
      {
        side: 'lalande',
        floor: '1er',
        options: [],
        // Combinaison pas mentionnée par Nicolas -- à lui demander.
      },
      {
        side: 'lalande',
        floor: '2e',
        options: [
          // Ces 3 options partagent la même photo, annoncée sous le nom
          // "ZOOM BALLON OFFICE" (pas encore fournie) : une fois reçue,
          // déposer le fichier et renseigner `planImage` sur les 3.
          { id: 'sdb-patrick', label: 'Sdb Patrick' },
          { id: 'sdb-chambre-a-colonnes', label: 'Sdb Chambre à Colonnes' },
          { id: 'sdb-verte', label: 'Sdb Verte' },
          // Photo annoncée sous le nom "ZOOM BALLON CH NORD" (pas
          // encore fournie).
          { id: 'sdb-chambre-anglaise', label: 'Sdb Chambre Anglaise' },
          // Photo annoncée sous le nom "ZOOM BALLON CUISINE 2EME" (pas
          // encore fournie) -- Nicolas a donné ce même nom de photo pour
          // "Sdb Mamita" ici ET pour "Sdb Grise" (Lalande + 3e étage,
          // plus bas) : à confirmer si c'est bien la même photo pour les
          // deux, ou une coquille de sa part.
          { id: 'sdb-mamita', label: 'Sdb Mamita' },
        ],
      },
      {
        side: 'lalande',
        floor: '3e',
        options: [{ id: 'sdb-grise', label: 'Sdb Grise' }],
        // Un seul choix -> mis en évidence automatiquement.
        // Photo annoncée sous le nom "ZOOM BALLON CUISINE 2EME" (pas
        // encore fournie) -- voir la remarque ci-dessus sur "Sdb Mamita".
      },
    ],
  },
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
    kind: 'locator',
    id: 'extincteurs',
    label: 'Extincteurs',
    // Plans fournis par Nicolas le 02/10/2026 (captures "PREMIER ÉTAGE",
    // "DEUXIÈME ÉTAGE", "REZ-DE-CHAUSSÉE", "TROISIÈME ÉTAGE", pastille rouge =
    // emplacement d'un extincteur) -- déposés dans /public/images/plans/.
    levels: [
      { id: 'rdc', label: 'RDC', planImage: '/images/plans/extincteurs-rdc.jpg' },
      { id: '1er', label: '1er étage', planImage: '/images/plans/extincteurs-1er.jpg' },
      { id: '2e', label: '2ème étage', planImage: '/images/plans/extincteurs-2e.jpg' },
      { id: '3e', label: '3ème étage', planImage: '/images/plans/extincteurs-3e.jpg' },
    ],
  },
]
