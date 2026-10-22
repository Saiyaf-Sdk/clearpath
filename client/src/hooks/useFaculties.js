import { useCallback, useEffect, useState } from 'react';
import api from '../api';

// The faculties of the signed-in admin's university (a faculty admin gets just their own).
// Shared by the admin pages for filters and drop-downs; kept for the visit so pages switch instantly.
let cache = null;
let pending = null;
const listeners = new Set();

const fetchFaculties = () => {
  if (!pending) {
    pending = api.get('/admin/faculties')
      .then((r) => { cache = r.data; listeners.forEach((fn) => fn(cache)); return cache; })
      .finally(() => { pending = null; });
  }
  return pending;
};

export const refreshFaculties = () => fetchFaculties();
export const clearFaculties = () => { cache = null; };

export default function useFaculties() {
  const [faculties, setFaculties] = useState(cache);
  useEffect(() => {
    listeners.add(setFaculties);
    if (!cache) fetchFaculties().catch(() => setFaculties([]));
    return () => listeners.delete(setFaculties);
  }, []);
  const reload = useCallback(() => fetchFaculties(), []);
  return { faculties, reload };
}
