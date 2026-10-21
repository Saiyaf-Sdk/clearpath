import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

// Click a column header to sort a table by it; click again to reverse.
//   const { sorted, th } = useSort(rows, { key: 'createdAt', dir: 'desc' }, { student: (r) => r.student?.name });
//   <thead><tr>{th('student', 'Student')}{th('amount', 'Amount')}</tr></thead>  …  sorted.map(...)
const value = (v) => (v instanceof Date ? v.getTime() : v);

export default function useSort(rows, initial = { key: '', dir: 'asc' }, getters = {}) {
  const [sort, setSort] = useState(initial);
  const get = useRef(getters);
  get.current = getters;

  const sorted = useMemo(() => {
    const list = rows || [];
    if (!sort.key) return list;
    const pick = get.current[sort.key] || ((r) => r[sort.key]);
    const sign = sort.dir === 'desc' ? -1 : 1;
    return [...list].sort((a, b) => {
      const x = value(pick(a));
      const y = value(pick(b));
      if (x === y) return 0;
      if (x === undefined || x === null || x === '') return 1; // empty values always last
      if (y === undefined || y === null || y === '') return -1;
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sign;
      // ISO dates and text: natural order (EG/2021/9 before EG/2021/10)
      return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' }) * sign;
    });
  }, [rows, sort]);

  const toggle = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const th = (key, label, props = {}) => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th key={key} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} {...props}>
        <button type="button" className={`th-sort ${active ? 'active' : ''}`} onClick={() => toggle(key)} title={`Sort by ${label}`}>
          {label} <Icon size={12} />
        </button>
      </th>
    );
  };

  return { sorted, sort, setSort, th };
}
