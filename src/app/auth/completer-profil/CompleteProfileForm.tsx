'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UNKNOWN_DATE_OF_BIRTH } from '@/lib/profile'
import { properCase, parseFrenchDate, formatFrenchDateInput } from '@/lib/utils'
import type { FamilyGroup, Profile } from '@/types'

export function CompleteProfileForm({ profile }: { profile: Profile }) {
  const [firstName, setFirstName] = useState(profile.first_name ?? '')
  const [lastName, setLastName] = useState(profile.last_name ?? '')
  // Texte libre "JJ/MM/AAAA" plutôt qu'un calendrier (27/10/2026, voir
  // parseFrenchDate/formatFrenchDateInput dans src/lib/utils.ts) --
  // pré-rempli à partir de l'ISO déjà connu, le cas échéant.
  const [dateOfBirth, setDateOfBirth] = useState(
    profile.date_of_birth === UNKNOWN_DATE_OF_BIRTH ? '' : formatFrenchDateInput(profile.date_of_birth)
  )
  const [familyGroup, setFamilyGroup] = useState<FamilyGroup>(profile.family_group)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const isoDateOfBirth = parseFrenchDate(dateOfBirth)
    if (!isoDateOfBirth) {
      setError('Date de naissance invalide. Format attendu : JJ/MM/AAAA.')
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        // Casse normalisee a l'enregistrement (demande par Aurelie le
        // 26/10/2026 : "Eva" s'affichait "eVA") -- voir properCase dans
        // src/lib/utils.ts.
        first_name: properCase(firstName.trim()),
        last_name: properCase(lastName.trim()),
        date_of_birth: isoDateOfBirth,
        family_group: familyGroup,
        // role is deliberately absent: the database derives it from
        // family_group. Sending it here would demote an admin who completes
        // their own profile, and would be the obvious escalation target.
      })
      .eq('id', profile.id)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-stone-800 mb-2">La Bâtisse</h1>
          <p className="text-stone-500">Encore une étape</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Compléter mon profil</CardTitle>
            <CardDescription>
              Il manque votre date de naissance ou votre groupe sur votre profil.
              Ces informations servent à calculer votre taxe de séjour.
            </CardDescription>
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
                {/* Champ texte libre plutôt qu'un calendrier (27/10/2026,
                    demande d'Aurélie) -- converti en ISO à la soumission
                    (voir parseFrenchDate, handleSubmit plus haut). */}
                <Input
                  id="dateOfBirth"
                  type="text"
                  inputMode="numeric"
                  placeholder="JJ/MM/AAAA"
                  autoComplete="bday"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Groupe</Label>
                <Select
                  value={familyGroup}
                  onValueChange={(val) => setFamilyGroup(val as FamilyGroup)}
                >
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

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enregistrement...' : 'Continuer'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
