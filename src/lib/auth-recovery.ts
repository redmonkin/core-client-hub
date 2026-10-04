// Captures, before the Supabase client loads and strips them from the URL,
// whether this page load came from a password-recovery email link. The reset
// form must only unlock for a real recovery link, not for any signed-in
// session, or anyone at an unlocked computer could change the password
// without knowing the current one. Imported first in main.tsx.
const { pathname, hash, search } = window.location;
const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
const searchParams = new URLSearchParams(search);

export const openedFromRecoveryLink =
  pathname === '/reset-password' &&
  (hashParams.get('type') === 'recovery' || searchParams.has('code') || searchParams.get('type') === 'recovery');
