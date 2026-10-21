// Remembers the university portal this browser used last, so returning users go straight to it.
const KEY = 'cp_portal';

export const rememberedPortal = () => {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
};

export const rememberPortal = (slug) => {
  try {
    if (slug) localStorage.setItem(KEY, slug);
  } catch {
    /* storage blocked */
  }
};

export const forgetPortal = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
};

// Where "Log in" / "Create account" should go
export const loginPath = () => (rememberedPortal() ? `/portal/${rememberedPortal()}` : '/portal');
export const registerPath = () => (rememberedPortal() ? `/portal/${rememberedPortal()}/register` : '/portal?next=register');

// Does this email belong to the university? (sub-domains count: stu.ruh.ac.lk → ruh.ac.lk)
export const emailMatches = (email, university) => {
  const domain = String(email || '').toLowerCase().trim().split('@')[1] || '';
  if (!domain || !university?.domains?.length) return null;
  return university.domains.some((d) => domain === d || domain.endsWith(`.${d}`));
};
