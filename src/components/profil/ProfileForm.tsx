'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { actionPillClass } from '@/lib/utils'
import { UNKNOWN_DATE_OF_BIRTH } from '@/lib/profile'
import type { FamilyGroup, Profile } from '@/types'

// Formulaire "Mon profil" (19/10/2026, demandé par Aurélie). Reprend les
// champs déjà saisis à la toute première connexion -- même logique de
// mise à jour directe de la ligne `profiles` côté client que
// CompleteProfileForm.tsx (policy "profiles_update_own", voir
// schema.sql) -- avec en plus un numéro de téléphone (nouvelle colonne,
// migration_profile_phone.sql, pas encore appliquée : tant que ce n'est
// pas fait, ce champ précis ne se sauvegarde pas, comme n'importe quelle
// colonne absente d'une table Supabase -- à garder en tête si Nicolas
// signale que le téléphone "ne s'enregistre jamais").
//
// Le groupe familial reste modifiable ici, comme à la première
// connexion : le rôle (admin/family/friend) n'est ni affiché ni
// modifiable depuis ce formulaire, il est entièrement dérivé par la
// base à partir du groupe (voir le commentaire de
// CompleteProfileForm.tsx et protect_profile_privileges() dans
// migration_tm_self_edit.sql).
//
// Email affiché en lecture seule : le modifier nécessiterait un flux de
// vérification dédié côté Supabase Auth (confirmation par lien), hors
// scope de cette page pour l'instant.
//
// "Se déconnecter" vivait jusqu'ici dans le bandeau du bas (voir
// BottomNav.tsx) -- déplacé en bas de cette page le 19/10/2026, le
// bandeau pointant désormais vers "Mon profil" à la place. Même route
// /auth/signout (POST uniquement, voir ce fichier).
//
// "Enregistrer" et "Se déconnecter" traités comme toutes les pastilles
// d'action du site (demande d'Aurélie, 19/10/2026) -- `actionPillClass`
// (src/lib/utils.ts), déjà utilisé pour "Valider"/"Modifier"/"Publier"/
// "+ Ajouter" ailleurs (NextStayCard.tsx, RealisationsBoard.tsx,
// TasksBoard.tsx...), appliqué ici sur des <button> natifs plutôt que
// le composant <Button> (dont le rounded-lg/bg-primary par défaut
// entre en conflit avec cette pastille, voir le commentaire d'origine
// d'actionPillClass).
export function ProfileForm({ profile }: { profile: Profile }) {
  const [firstName, setFirstName] = useState(profile.first_name ?? '')
  const [lastName, setLastName] = useState(profile.last_name ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(
    profile.date_of_birth === UNKNOWN_DATE_OF_BIRTH ? '' : profile.date_of_birth
  )
  const [familyGroup, setFamilyGroup] = useState<FamilyGroup>(profile.family_group)
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setLoading(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dateOfBirth,
        family_group: familyGroup,
        phone: phone.trim() === '' ? null : phone.trim(),
        // role est volontairement absent, comme dans CompleteProfileForm :
        // la base le dérive elle-même de family_group.
      })
      .eq('id', profile.id)

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSaved(true)
    router.refresh()
  }

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm md:text-base uppercase tracking-wide">Mes informations</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
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
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Groupe</Label>
              <Select value={familyGroup} onValueChange={(val) => setFamilyGroup(val as FamilyGroup)}>
                <SelectTrigger className="w-full">
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
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="06 12 34 56 78"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile.email} disabled readOnly />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && !error && (
              <p className="text-sm text-green-600">Modifications enregistrées.</p>
            )}

            <button type="submit" className={actionPillClass} disabled={loading}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </CardContent>
      </Card>

      <form action="/auth/signout" method="post" className="flex justify-center">
        <button type="submit" className={actionPillClass}>
          Se déconnecter
        </button>
      </form>
    </div>
  )
}
