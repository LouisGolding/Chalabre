import { normalizeName } from '@/lib/utils'

// Demande d'Aurélie le 25/10/2026 : "l'onglet 'membres' ne sera accessible
// que du compte de 'guillaume canat / nicolas Lalande / aurélie fouré /
// margaux lalande'". Avant cette demande, "Membres" était visible (page +
// lien du bandeau du bas) pour TOUT compte admin (voir BottomNav.tsx et
// dashboard/admin/page.tsx) ; désormais réservé à ces 4 personnes précises,
// même si d'autres comptes admin existent (ex: Louis Golding, Guy LALANDE —
// vérifié en base le 25/10/2026 : Guy LALANDE a bien le rôle admin mais ne
// fait pas partie de la liste donnée par Aurélie).
//
// Fait sur le nom complet (prénom + nom, normalisé) plutôt que sur l'email :
// à ce jour (25/10/2026), Guillaume Canat n'a AUCUN compte sur le site
// (vérifié en base — seul un compte de test "Audit Canat" existe). Coder
// son email serait donc impossible aujourd'hui, et il aurait fallu revenir
// changer ce fichier le jour de la création de son vrai compte. En codant
// son nom complet ici, l'accès se débloquera de lui-même dès que son
// compte existera avec ce nom — à condition qu'il soit saisi tel quel
// ("Guillaume" / "Canat"). À adapter si un jour il utilise un nom affiché
// différent (surnom, orthographe différente...).
const ALLOWED_FULL_NAMES = new Set([
  'nicolas lalande',
  'aurélie fouré',
  'margaux lalande',
  'guillaume canat',
])

// normalizeName ne fait que trim+lowercase (voir lib/utils.ts) : il ne
// retire pas les espaces multiples internes. Nécessaire ici car au moins
// un profil existant (Margaux LALANDE) a un espace en trop dans first_name
// en base ("Margaux " avec espace final), qui laisserait sinon un double
// espace entre prénom et nom une fois concaténés.
function normalizedFullName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return normalizeName(`${firstName ?? ''} ${lastName ?? ''}`.replace(/\s+/g, ' '))
}

export function canAccessMembresTab(
  profile: { role: string; first_name?: string | null; last_name?: string | null } | null | undefined
): boolean {
  if (!profile || profile.role !== 'admin') return false
  return ALLOWED_FULL_NAMES.has(normalizedFullName(profile.first_name, profile.last_name))
}
