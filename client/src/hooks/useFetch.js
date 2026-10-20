import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errMsg } from '../api';

// Loads data from the API with loading / error states.
//   const { data, error, loading, reload } = useFetch('/stats/officer', { params });
// Changing `url` or `params` reloads; responses that arrive late for an old request are ignored.
export default function useFetch(url, { params, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: !!enabled });
  const seq = useRef(0);
  const key = JSON.stringify(params || {});

  const load = useCallback(
    (quiet = false) => {
      if (!enabled || !url) return Promise.resolve();
      const id = ++seq.current;
      if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
      return api
        .get(url, { params: JSON.parse(key) })
        .then((r) => {
          if (id === seq.current) setState({ data: r.data, error: null, loading: false });
          return r.data;
        })
        .catch((err) => {
          if (id === seq.current) setState((s) => ({ ...s, error: errMsg(err), loading: false }));
        });
    },
    [url, key, enabled]
  );

  useEffect(() => {
    load();
  }, [load]);

  // reload() shows the skeleton again; refresh() updates quietly in the background
  return {
    ...state,
    reload: () => load(false),
    refresh: () => load(true),
    setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })),
  };
}
