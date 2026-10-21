import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, Trash2 } from 'lucide-react';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { Avatar, Spin } from './ui';

const OUT = 320; // the stored picture is a 320 × 320 JPEG (about 20–40 KB)
const MAX_INPUT = 15 * 1024 * 1024;

// Crops the middle square of any photo and shrinks it, so uploads are small and always square
async function squareJpeg(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('unreadable'));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // transparent PNGs get a white background
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, OUT, OUT);
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.88));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Profile picture with change / remove buttons (Account settings)
export default function AvatarPicker() {
  const { user, updateUser } = useAuth();
  const { confirm } = useDialog();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  const choose = async (file) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return toast.error('Please choose a JPG, PNG or WebP picture');
    if (file.size > MAX_INPUT) return toast.error('That picture is too large (max 15 MB)');
    setBusy(true);
    try {
      const blob = await squareJpeg(file);
      const data = new FormData();
      data.append('avatar', blob, 'avatar.jpg');
      const { data: res } = await api.post('/auth/me/avatar', data);
      updateUser(res.user);
      toast.success('Profile picture updated');
    } catch (err) {
      toast.error(err.message === 'unreadable' ? 'This picture could not be opened. Try a JPG or PNG.' : errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: 'Remove your profile picture?', message: 'Your initials will be shown instead.', confirmText: 'Remove', tone: 'danger' });
    if (!ok) return;
    try {
      const { data: res } = await api.delete('/auth/me/avatar');
      updateUser(res.user);
      toast.success('Profile picture removed');
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="avatar-picker">
      <button type="button" className="avatar-edit" onClick={() => input.current?.click()} disabled={busy} aria-label="Change profile picture" title="Change profile picture">
        <Avatar name={user.name} src={user.avatarUrl} size={88} />
        <span className="avatar-edit-badge">{busy ? <Spin size={14} /> : <Camera size={15} />}</span>
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { choose(e.target.files[0]); e.target.value = ''; }} />
      <div className="avatar-actions">
        <button type="button" className="btn btn-soft btn-sm" onClick={() => input.current?.click()} disabled={busy}>
          <Camera size={14} /> {user.avatarUrl ? 'Change photo' : 'Upload photo'}
        </button>
        {user.avatarUrl && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={remove} disabled={busy} aria-label="Remove profile picture"><Trash2 size={14} /></button>
        )}
      </div>
    </div>
  );
}
