import useFetch from '../../hooks/useFetch';

const OPEN = ['unpaid', 'receipt-submitted'];

// The student's requests and dues, plus the numbers every student page needs
export default function useStudentData() {
  const reqs = useFetch('/clearances/my');
  const dues = useFetch('/dues/my');
  const requests = reqs.data || [];
  const dueList = dues.data || [];
  // The most recent request that wasn't cancelled is "the" request
  const active = requests.find((r) => r.status !== 'cancelled') || null;
  const history = requests.filter((r) => r !== active);
  const unpaid = dueList.filter((d) => d.status === 'unpaid');
  const review = dueList.filter((d) => d.status === 'receipt-submitted');
  const owed = dueList.filter((d) => OPEN.includes(d.status)).reduce((s, d) => s + d.amount, 0);
  const cleared = active ? active.items.filter((i) => i.status === 'cleared').length : 0;
  const total = active ? active.items.length : 0;
  return {
    loading: reqs.loading || dues.loading,
    error: reqs.error || dues.error,
    reload: () => Promise.all([reqs.refresh(), dues.refresh()]),
    retry: () => { reqs.reload(); dues.reload(); },
    requests,
    dues: dueList,
    active,
    history,
    unpaid,
    review,
    owed,
    cleared,
    total,
    pct: total ? Math.round((cleared / total) * 100) : 0,
  };
}
