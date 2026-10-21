import { useState } from 'react';
import toast from 'react-hot-toast';
import { ImageUp, RotateCcw } from 'lucide-react';
import api, { errMsg } from '../api';
import { useDialog } from '../context/DialogContext';
import { Spin, UniLogo } from './ui';

const MAX = 1024 * 1024;
const uploaded = (url) => typeof url === 'string' && url.startsWith('/api/files/');

// Upload or remove a university's logo.
// endpoint: '/platform/universities/<id>/logo' (platform admin) or '/admin/logo' (the university's own admin)
export default function LogoPanel({ university, endpoint, onChanged }) {
  const { confirm } = useDialog();
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    if (file.size > MAX) return toast.error('Logo must be smaller than 1 MB');
    const data = new FormData();
    data.append('logo', file);
    setBusy(true);
    try {
      const { data: uni } = await api.post(endpoint, data);
      toast.success('Logo updated');
      onChanged?.(uni);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: 'Remove the uploaded logo?', message: 'The official logo that comes with ClearPath (or the initials badge) will be shown instead.', confirmText: 'Remove', tone: 'danger' });
    if (!ok) return;
    try {
      const { data: uni } = await api.delete(endpoint);
      toast.success('Uploaded logo removed');
      onChanged?.(uni);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="logo-panel">
      <div className="logo-preview"><UniLogo university={university} size={76} /></div>
      <div className="logo-side">
        <div className="row-gap">
          <label className="btn btn-soft btn-sm" style={{ cursor: 'pointer' }}>
            {busy ? <Spin /> : <ImageUp size={15} />} {university.logoUrl ? 'Replace logo' : 'Upload logo'}
            <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg" hidden onChange={(e) => { upload(e.target.files[0]); e.target.value = ''; }} />
          </label>
          {uploaded(university.logoUrl) && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={remove}><RotateCcw size={14} /> Remove upload</button>
          )}
        </div>
        <p className="muted small">
          {university.logoUrl
            ? uploaded(university.logoUrl) ? 'Showing an uploaded logo.' : 'Showing the official logo that comes with ClearPath.'
            : 'No logo yet – the initials badge is shown.'}{' '}
          Use the university&rsquo;s official file: PNG, JPG, WebP or SVG, square, up to 1 MB. PNG or JPG also appears on PDF certificates.
        </p>
      </div>
    </div>
  );
}
