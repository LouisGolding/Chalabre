import type { Profile } from '@/types'

// handle_new_user writes this when the identity provider gives no birth date,
// which is always the case for Google. It reads as an adult, so the booking
// rate defaults to the full price rather than the child price.
export const UNKNOWN_DATE_OF_BIRTH = '1900-01-01'

/**
 * True for a profile the signup form never filled in — in practice, one created
 * by Google sign-in, which supplies no birth date and no family group.
 */
export function isProfileIncomplete(profile: Profile) {
  return (
    !profile.first_name?.trim() ||
    !profile.last_name?.trim() ||
    profile.date_of_birth === UNKNOWN_DATE_OF_BIRTH
  )
}
