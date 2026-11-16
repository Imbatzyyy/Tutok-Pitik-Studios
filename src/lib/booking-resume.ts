// When a guest leaves the booking form to sign in, remember it so the form can
// pick up at the payment step afterwards. sessionStorage is per tab, so this
// also survives the Google sign-in redirect.

const RESUME_KEY = 'tps:resume-booking';
const RESUME_TTL_MS = 30 * 60 * 1000;

export const markBookingResume = () => {
  try {
    sessionStorage.setItem(RESUME_KEY, String(Date.now()));
  } catch {
    /* storage blocked: the form simply won't auto-scroll */
  }
};

export const clearBookingResume = () => {
  try {
    sessionStorage.removeItem(RESUME_KEY);
  } catch {
    /* ignore */
  }
};

/** Reads and clears the flag. True only if it was set in the last 30 minutes. */
export const takeBookingResume = () => {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    sessionStorage.removeItem(RESUME_KEY);
    return raw !== null && Date.now() - Number(raw) < RESUME_TTL_MS;
  } catch {
    return false;
  }
};
