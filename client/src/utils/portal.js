// Remembers the portal this browser used last (university, and the faculty when known),
// e.g. "ruhuna/engineering" or "ruhuna/central", so returning users go straight to it.
const KEY = 'cp_portal';

export const rememberedPortal = () => {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
};

export const rememberPortal = (university, faculty) => {
  try {
    if (university) localStorage.setItem(KEY, faculty ? `${university}/${faculty}` : university);
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

const parts = () => rememberedPortal().split('/').filter(Boolean);
export const rememberedUniversity = () => parts()[0] || '';
export const rememberedFaculty = () => parts()[1] || '';

// Where "Log in" / "Create account" should go
export const loginPath = () => (rememberedPortal() ? `/portal/${rememberedPortal()}` : '/portal');
export const registerPath = () => {
  const [uni, fac] = parts();
  if (uni && fac && fac !== 'central') return `/portal/${uni}/${fac}/register`;
  return uni ? `/portal/${uni}?next=register` : '/portal?next=register';
};
// Address of a faculty portal (faculty slug "central" = Central administration)
export const facultyPath = (uni, fac, register = false) => `/portal/${uni}/${fac}${register ? '/register' : ''}`;

// Does this email belong to the university? (sub-domains count: stu.ruh.ac.lk → ruh.ac.lk)
export const emailMatches = (email, university) => {
  const domain = String(email || '').toLowerCase().trim().split('@')[1] || '';
  if (!domain || !university?.domains?.length) return null;
  return university.domains.some((d) => domain === d || domain.endsWith(`.${d}`));
};
