import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet, Info, PencilLine, Plus, Search, Trash2, Upload } from 'lucide-react';
import useSort from '../../hooks/useSort';
import api, { errMsg } from '../../api';
import { useDialog } from '../../context/DialogContext';
import { useAuth } from '../../context/AuthContext';
import { Badge, Drawer, Empty, PageHeader, Skeleton, Spin } from '../../components/ui';

/* ---------------- Official student list ---------------- */
// Minimal CSV parser (handles quotes and commas inside quotes)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i += 1; } else if (c === '"') quoted = false; else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

// Turns CSV rows into { regNo, email, name, faculty } using the header names
function toStudents(rows) {
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  const col = (...names) => head.findIndex((h) => names.includes(h));
  const iReg = col('regno', 'registrationnumber', 'registrationno', 'regnumber', 'indexno');
  const iEmail = col('email', 'universityemail', 'emailaddress');
  const iName = col('name', 'fullname', 'studentname');
  const iFac = col('faculty');
  if (iReg < 0 || iEmail < 0 || iName < 0) throw new Error('The CSV needs the columns: regNo, email, name (faculty is optional).');
  return rows.slice(1).map((r) => ({ regNo: r[iReg] || '', email: r[iEmail] || '', name: r[iName] || '', faculty: iFac >= 0 ? r[iFac] || '' : '' }));
}

const sampleCsv = (domain) => `regNo,name,email,faculty\nEG/2022/1001,Amal Silva,amal.silva@${domain},Engineering\nSC/2022/2001,Dilini Jayasinghe,dilini.j@${domain},Science\n`;

export default function AdminStudents() {
  const { confirm } = useDialog();
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({ regNo: '', name: '', email: '', faculty: '' });
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const { sorted, th } = useSort(data?.rows, { key: '', dir: 'asc' });

  const saveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/admin/roster/${edit._id}`, { regNo: edit.regNo, name: edit.name, email: edit.email, faculty: edit.faculty });
      toast.success('Student record updated');
      setEdit(null);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };
  const { user } = useAuth();
  const domains = user.university?.domains || [];

  const load = () => api.get('/admin/roster', { params: { search: search || undefined, status: status || undefined } })
    .then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = async (file) => {
    if (!file) return;
    setResult(null);
    try {
      const students = toStudents(parseCSV(await file.text()));
      if (!students.length) throw new Error('No students found in this file.');
      setPreview({ name: file.name, students });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const doImport = async () => {
    setImporting(true);
    try {
      const { data: r } = await api.post('/admin/roster/import', { rows: preview.students });
      setResult(r);
      setPreview(null);
      toast.success(`${r.added} added, ${r.updated} updated`);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setImporting(false);
    }
  };

  const addOne = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/roster', form);
      toast.success(`${form.name} added to the student list`);
      setForm({ regNo: '', name: '', email: '', faculty: '' });
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const remove = async (r) => {
    const ok = await confirm({ title: `Remove ${r.name}?`, message: 'They will no longer be able to create an account.', confirmText: 'Remove', tone: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/admin/roster/${r._id}`);
      toast.success('Removed from the student list');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob([sampleCsv(domains[0] || 'university.ac.lk')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student-list-sample.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="page">
      <PageHeader title="Official student list" subtitle="The registrar's list of enrolled students. Only students on it can create a ClearPath account." />
      <div className="policy-note" style={{ marginBottom: 18 }}>
        <Info size={16} />
        <span>
          Only students on this list can create an account, using their own university email
          {domains.length ? ` (${domains.map((d) => `@${d}`).join(' or ')})` : ''}. Import the list from the registrar's records each intake.
        </span>
      </div>

      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 20 }}>
        <section className="card" style={{ margin: 0 }}>
          <h2><Upload size={17} className="text-brand" style={{ verticalAlign: -3, marginRight: 6 }} />Import from CSV</h2>
          <p className="muted small" style={{ margin: '4px 0 14px' }}>Columns: regNo, name, email, faculty. Existing students are updated, students who already have an account are skipped.</p>
          <label className="dropzone">
            <FileSpreadsheet size={20} />
            <span>{preview ? preview.name : 'Choose a CSV file'}</span>
            <small className="muted">{preview ? `${preview.students.length} students ready to import` : 'Exported from the registrar system or Excel'}</small>
            <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { onFile(e.target.files[0]); e.target.value = ''; }} />
          </label>
          <div className="row-gap" style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" disabled={!preview || importing} onClick={doImport}>
              {importing ? 'Importing…' : `Import${preview ? ` ${preview.students.length} students` : ''}`}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={downloadSample}><Download size={14} /> Sample CSV</button>
          </div>
          {result && (
            <div className="small" style={{ marginTop: 12 }}>
              <strong>{result.added}</strong> added · <strong>{result.updated}</strong> updated · <strong>{result.skipped}</strong> skipped (already registered)
              {result.errors.length > 0 && (
                <ul className="muted" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  {result.errors.slice(0, 6).map((er) => <li key={`${er.row}-${er.regNo}`}>Row {er.row}{er.regNo ? ` (${er.regNo})` : ''}: {er.reason}</li>)}
                  {result.errors.length > 6 && <li>…and {result.errors.length - 6} more</li>}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="card" style={{ margin: 0 }}>
          <h2><Plus size={17} className="text-brand" style={{ verticalAlign: -3, marginRight: 6 }} />Add one student</h2>
          <form className="grid-2" style={{ marginTop: 14 }} onSubmit={addOne}>
            <label className="label">Registration no.<input className="input" required value={form.regNo} onChange={(e) => setForm({ ...form, regNo: e.target.value })} /></label>
            <label className="label">Full name<input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="label">University email<input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="label">Faculty<input className="input" value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })} /></label>
            <div><button className="btn btn-primary btn-sm">Add to list</button></div>
          </form>
        </section>
      </div>

      <section className="card">
        <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <div className="search-box">
            <Search size={16} />
            <input className="input" placeholder="Search reg no., name or email and press Enter" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Everyone</option>
            <option value="pending">Not registered yet</option>
            <option value="activated">Account created</option>
          </select>
          {data && <span className="muted small" style={{ marginLeft: 'auto' }}>{data.activated} of {data.total} students have created an account</span>}
        </form>
        {!data ? <Skeleton h={220} r={14} /> : data.rows.length === 0 ? <Empty icon={FileSpreadsheet} title="No students on the list yet">Import a CSV from the registrar to get started.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr>{th('regNo', 'Reg. no.')}{th('name', 'Name')}{th('email', 'University email')}{th('faculty', 'Faculty')}{th('status', 'Status')}<th /></tr></thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r._id}>
                    <td><strong>{r.regNo}</strong></td>
                    <td>{r.name}</td>
                    <td className="small">{r.email}</td>
                    <td className="small">{r.faculty || '—'}</td>
                    <td><Badge status={r.status === 'activated' ? 'activated' : 'invited'} /></td>
                    <td><div className="actions end">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...r })} aria-label={`Edit ${r.name}`} title="Edit"><PencilLine size={14} /></button>
                      {r.status !== 'activated' && <button className="btn btn-ghost btn-sm" onClick={() => remove(r)} aria-label="Remove from list" title="Remove"><Trash2 size={14} /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Drawer open={!!edit} onClose={() => setEdit(null)} title="Edit student record" subtitle={edit && `${edit.regNo} · ${edit.status === 'activated' ? 'account created' : 'not registered yet'}`}>
        {edit && (
          <form className="form-stack" onSubmit={saveEdit}>
            {edit.status === 'activated' && <p className="policy-note small">This student already has an account, so the registration number and email are locked. Name and faculty changes also update their account.</p>}
            <label className="label">Registration no.<input className="input" required disabled={edit.status === 'activated'} value={edit.regNo} onChange={(e) => setEdit({ ...edit, regNo: e.target.value })} /></label>
            <label className="label">Full name<input className="input" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label className="label">University email<input className="input" type="email" required disabled={edit.status === 'activated'} value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></label>
            <label className="label">Faculty<input className="input" value={edit.faculty || ''} onChange={(e) => setEdit({ ...edit, faculty: e.target.value })} /></label>
            <div className="row-gap">
              <button className="btn btn-primary" disabled={saving}>{saving ? <Spin /> : <PencilLine size={16} />} Save changes</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
}
