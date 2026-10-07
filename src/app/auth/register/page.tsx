'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Eye, EyeOff } from 'lucide-react'

type FamilyGroup = 'lalande' | 'canat' | 'friend'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    familyGroup: '' as FamilyGroup | '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Connexion Google — remise en place le 07/10/2026 à la demande de
  // Nicolas (retirée le 19/09/2026, voir points-a-regler-avec-louis.md,
  // point 11 : à l'époque elle n'existait QUE sur cette page, pas sur la
  // connexion, ce qui laissait un compte créé par Google sans aucun
  // moyen de se reconnecter — Louis l'avait signalé). Cette fois, remise
  // sur les deux pages (voir aussi login/page.tsx) pour ne pas recréer
  // cette incohérence. Le fournisseur Google n'a en réalité jamais été
  // désactivé côté Supabase (l'ancien retrait n'avait touché que
  // l'interface) : aucune configuration Supabase à refaire pour que ce
  // bouton fonctionne.
  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError('La connexion Google est indisponible pour le moment.')
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.familyGroup) {
      setError('Veuillez sélectionner votre groupe.')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          date_of_birth: formData.dateOfBirth,
          family_group: formData.familyGroup,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // With confirmations on, an address that already exists comes back as a
    // decoy user with no identities rather than an error.
    if (data.user && data.user.identities?.length === 0) {
      setError('Un compte existe déjà avec cet email. Connectez-vous.')
      setLoading(false)
      return
    }

    // Confirmations disabled in Supabase: signUp already returned a session,
    // so the "vérifiez votre email" page would be a dead end.
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    router.push('/auth/verify-email')
  }

  return (
    // Refonte visuelle du 29/09/2026, demandée par Nicolas : cette page
    // était restée sur le gabarit shadcn par défaut (fond bg-stone-50,
    // titres en gris stone-800/500), seule page du site à ne pas avoir
    // suivi la refonte de fin septembre (texture papier, palette sépia,
    // typographie EB Garamond des titres, pastilles noires). Le fond
    // bg-stone-50 ci-dessous a simplement été retiré : la texture papier
    // du <body> (voir globals.css, appliquée globalement) apparaît donc
    // ici aussi, sans rien dupliquer. Tout le reste (Card, Input, Select,
    // Button) utilisait déjà les bonnes variables de couleur du thème
    // (bg-card, border-input, bg-primary...) — seul l'habillage de cette
    // page elle-même (fond, titres, bouton) était resté générique.
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo + wordmark : remplace le simple texte "La Bâtisse" par le
            même bloc dessin + wordmark que sur la page de connexion (voir
            src/app/auth/login/page.tsx), réduit aux 3/4 (demandé par
            Nicolas : "réduit sa taille de 1/4") puisque cette page n'a
            pas de photo en fond pour lui donner de l'ampleur comme sur
            login. "Rejoindre la maison familiale" est gardé en dessous
            (rôle propre à cette page) plutôt que remplacé par "Chalabre
            - 11230" (la légende utilisée sur login) : les deux pages ont
            besoin d'un sous-titre différent. */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/images/logo-batisse-drawing.png"
            alt="La Bâtisse"
            width={1897}
            height={652}
            priority
            className="h-auto w-[45%] max-w-[183px]"
          />
          <h1 className="mt-2 font-serif text-4xl uppercase tracking-[0.1em] text-foreground md:text-5xl">
            La Bâtisse
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Rejoindre la maison familiale</p>
        </div>

        {/* Card légèrement plus arrondie (rounded-2xl) + une ombre douce,
            pour un rendu plus "dessiné" que le rounded-xl par défaut du
            composant Card — cohérent avec la carte email/mot de passe de
            la page de connexion (elle aussi rounded-2xl + shadow-lg). */}
        <Card className="rounded-2xl shadow-lg">
          <CardHeader>
            {/* Même traitement que les titres de page du reste du site
                (Planning, Entretien... voir dashboard/layout.tsx et le
                point 18 de points-a-regler-avec-louis.md) : MAJUSCULES,
                espacement de lettres, graisse normale — plutôt que le
                CardTitle par défaut (petit, graisse medium, casse
                normale). */}
            <CardTitle className="text-lg font-normal uppercase tracking-wide text-foreground">
              Créer un compte
            </CardTitle>
            <CardDescription>Renseignez vos informations pour rejoindre La Bâtisse</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google */}
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center gap-3"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {googleLoading ? 'Redirection...' : 'Continuer avec Google'}
            </Button>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-stone-400">ou</span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date de naissance</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Groupe</Label>
                <Select onValueChange={(val) => setFormData({ ...formData, familyGroup: val as FamilyGroup })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lalande">Famille Lalande</SelectItem>
                    <SelectItem value="canat">Famille Canat</SelectItem>
                    <SelectItem value="friend">Ami(e) de la famille</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="votre@email.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    autoComplete="new-password"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              {/* Vert olive foncé (#393F2F) + texte crème (#F5F1EF) :
                  couleurs de la pastille "SE CONNECTER" de la page de
                  connexion (voir login/page.tsx), reprises telles quelles
                  ici à la demande de Nicolas le 29/09/2026 — remplace le
                  premier essai en pastille noire uniforme (bg-foreground),
                  lui-même déjà un remplacement du bouton bg-primary
                  orange par défaut de shadcn. Couleurs propres à ce
                  couple de pages (login/register), pas des variables du
                  thème général — même logique que sur login (voir son
                  commentaire de tête : "couleur dédiée à cette page pour
                  coller précisément au montage").  */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#393F2F] text-[#F5F1EF] uppercase tracking-[0.12em] hover:bg-[#393F2F]/90"
              >
                {loading ? 'Création du compte...' : 'Créer mon compte'}
              </Button>
            </form>

            {/* "Se connecter" demandé en gris foncé, comme les libellés
                de la grille d'onglets (Planning, Réalisations... voir
                TileNav.tsx) — déjà le cas ici (text-foreground, même
                variable que ces libellés) depuis le premier passage de
                cette page en text-foreground : rien à changer, gardé tel
                quel plutôt que remis en noir/vert comme le bouton
                au-dessus. */}
            <p className="text-center text-sm text-muted-foreground">
              Déjà un compte ?{' '}
              <Link href="/auth/login" className="font-medium text-foreground hover:underline">
                Se connecter
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
