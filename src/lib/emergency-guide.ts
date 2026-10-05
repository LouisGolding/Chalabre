// Configuration du mini algorithme de dépannage affiché dans "Guide de la
// maison" → "Urgences". Quatre mécanismes :
//
// - "diagnostic" (fuite d'eau) : on choisit une zone, l'appli indique quoi
//   vérifier (+ un plan si disponible), puis on confirme si le problème
//   est réglé ou si ça persiste (auquel cas la liste des artisans
//   concernés s'affiche).
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
// - "breaker" (panne électrique, refondu le 05/10/2026) : même principe
//   que "heater", mais avec TROIS côtés possibles (Canat/Lalande/Commun)
//   et des photos de plan carrées, en haute résolution, SANS zoom/plein
//   écran (contrairement à "heater"/"locator" qui utilisent
//   PlanThumbnail/FullscreenPlanViewer) -- demande explicite de Nicolas
//   le 05/10/2026. Voir SquarePlanImage dans EmergencyGuide.tsx.
//
// Pour "heater" et "breaker", les pastilles de sélection (côté/étage/
// option) restent masquées derrière un bouton "Signaler un problème" :
// il faut cliquer dessus pour les faire apparaître -- demande de Nicolas
// le 05/10/2026, pour harmoniser avec le comportement de "diagnostic".
//
// `planImage` n'est PAS encore renseigné partout : tant qu'il est absent,
// l'appli affiche un encadré "plan à venir" à la place. Chaque zone/
// niveau/option indique en commentaire le nom de fichier suggéré : il
// suffira de déposer l'image dans /public/images/plans/ et de renseigner
// `planImage: '/images/plans/<fichier>'` pour l'activer, sans toucher au
// reste du code.

export type DiagnosticZone = {
  id: string
  label: string
  // Ce qu'il faut vérifier concrètement (ex. "tableau électrique du hall").
  checkLabel: string
  planImage?: string
}

export type DiagnosticCategory = {
  kind: 'diagnostic'
  id: 'eau'
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

// "breaker" (panne électrique) : même mécanisme que "heater" (côté +
// étage -> option(s) -> plan), mais avec un 3e côté "Commun" (parties
// communes), et des photos affichées en carré haute résolution SANS
// zoom/plein écran (SquarePlanImage dans EmergencyGuide.tsx, pas
// PlanThumbnail/FullscreenPlanViewer). Demande de Nicolas le 05/10/2026.
export type BreakerSide = 'canat' | 'lalande' | 'commun'

export type BreakerOption = {
  id: string
  label: string
  planImage?: string
}

export type BreakerConfig = {
  side: BreakerSide
  floor: HeaterFloorId
  // Tableau vide = combinaison non mentionnée par Nicolas. Un seul
  // élément dont l'id est 'direct' = combinaison où le plan s'affiche
  // directement, sans pastille d'option (voir ElectricCard) -- Nicolas
  // n'a pas donné de nom pour ce "lieu", seulement le plan à afficher.
  options: BreakerOption[]
}

export type BreakerCategory = {
  kind: 'breaker'
  id: 'electrique'
  label: string
  floors: { id: HeaterFloorId; label: string }[]
  configs: BreakerConfig[]
}

export type EmergencyCategory = DiagnosticCategory | LocatorCategory | HeaterCategory | BreakerCategory

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
      { id: '1er', label: '1er' },
      { id: '2e', label: '2ème' },
      { id: '3e', label: '3ème' },
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
    // Refondue le 05/10/2026 a la demande de Nicolas, sur le meme modele
    // que "Plus d'eau chaude" ci-dessus : plus de zones provisoires ni de
    // suivi de panne (reglee/persistante, contacts) -- un pur outil de
    // reperage cote de la maison (Canat/Lalande/Commun, un 3e cote en
    // plus de "heater") + etage -> option(s) -> plan. Les photos sont
    // affichees en carre, haute resolution, SANS zoom/plein ecran (a la
    // difference de "heater"/"locator") -- voir SquarePlanImage dans
    // EmergencyGuide.tsx.
    //
    // ⚠️ Les 10 photos envoyees par Nicolas le 05/10/2026 (vues d'etage
    // avec pastille orange = tableau electrique) ne portent pas de nom de
    // piece/zone -- impossible de determiner avec certitude laquelle
    // correspond a quel plan nomme ci-dessous (ex. "ELEC RDC CANAT
    // CUISINE" vs "ELEC RDC CANAT GARAGE"). `planImage` reste donc vide
    // partout pour cette categorie : a renseigner avec Nicolas une fois
    // la correspondance photo <-> plan confirmee.
    kind: 'breaker',
    id: 'electrique',
    label: 'Panne électrique',
    floors: [
      { id: 'rdc', label: 'RDC' },
      { id: '1er', label: '1er' },
      { id: '2e', label: '2ème' },
      { id: '3e', label: '3ème' },
    ],
    configs: [
      {
        side: 'canat',
        floor: 'rdc',
        options: [
          { id: 'cuisine-salon-sam-billard', label: 'Cuisine - Salon - S.A.M - Billard' },
          // plan : ELEC RDC CANAT CUISINE
          { id: 'entree-atelier-garage', label: 'Entrée - Atelier - Garage' },
          // plan : ELEC RDC CANAT GARAGE
        ],
      },
      {
        side: 'canat',
        floor: '1er',
        options: [
          { id: 'aile-centrale', label: 'Aile centrale' },
          // plan : ELEC PREMIER CANAT COULOIR
          { id: 'aile-est', label: 'Aile Est' },
          // plan : ELEC PREMIER CANAT GARAGE
        ],
      },
      {
        side: 'canat',
        floor: '2e',
        options: [],
        // Combinaison pas mentionnée par Nicolas.
      },
      {
        side: 'canat',
        floor: '3e',
        options: [
          // Un seul "lieu", sans nom donné par Nicolas -> pas de pastille
          // affichée, le plan apparaît directement (voir ElectricCard,
          // option id 'direct').
          { id: 'direct', label: '3ème étage CANAT' },
          // plan : ELEC 3EME CANAT
        ],
      },
      {
        side: 'lalande',
        floor: 'rdc',
        options: [
          { id: 'atelier-couloir', label: 'Atelier Couloir' },
          // plan : ELEC ATELIER COULOIR
          { id: 'cuisine-buanderie-sam-bureau', label: 'Cuisine - Buanderie - S.A.M - Bureau' },
          // plan : ELEC LALANDE CUISINE
          { id: 'escalier-123', label: 'Escalier 1.2.3' },
          // plan : ELEC ANTICHAMBRE
        ],
      },
      {
        side: 'lalande',
        floor: '1er',
        options: [],
        // Combinaison pas mentionnée par Nicolas.
      },
      {
        side: 'lalande',
        floor: '2e',
        options: [
          { id: 'escalier-123', label: 'Escalier 1.2.3' },
          // plan : ELEC ANTICHAMBRE (même plan que Lalande+RDC/Escalier 1.2.3)
          { id: 'aile-ouest-escalier-central', label: 'Aile Ouest - Escalier central' },
          // plan : ELEC AILE OUEST 2EME
          { id: 'aile-est', label: 'Aile Est' },
          // plan : ELEC AILE EST 2EME
        ],
      },
      {
        side: 'lalande',
        floor: '3e',
        options: [
          { id: 'escalier-central', label: 'Escalier central' },
          // plan : ELEC AILE OUEST 2EME (même plan que Lalande+2e/Aile Ouest-Escalier central)
          { id: 'aile-est', label: 'Aile Est' },
          // plan : ELEC AILE EST 3EME
        ],
      },
      {
        side: 'commun',
        floor: 'rdc',
        options: [],
        // Combinaison pas mentionnée par Nicolas.
      },
      {
        side: 'commun',
        floor: '1er',
        options: [
          // Un seul "lieu", sans nom donné -> pas de pastille, plan direct.
          { id: 'direct', label: 'Antichambre (parties communes)' },
          // plan : ELEC ANTICHAMBRE (même plan que Lalande+RDC/Escalier 1.2.3)
        ],
      },
      {
        side: 'commun',
        floor: '2e',
        options: [],
        // Combinaison pas mentionnée par Nicolas.
      },
      {
        side: 'commun',
        floor: '3e',
        options: [],
        // Combinaison pas mentionnée par Nicolas.
      },
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
      { id: '1er', label: '1er', planImage: '/images/plans/extincteurs-1er.jpg' },
      { id: '2e', label: '2ème', planImage: '/images/plans/extincteurs-2e.jpg' },
      { id: '3e', label: '3ème', planImage: '/images/plans/extincteurs-3e.jpg' },
    ],
  },
]
