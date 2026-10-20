import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TriangleAlert, CircleHelp, PencilLine } from 'lucide-react';

// Replaces window.confirm / window.prompt with nice animated modals.
// Usage:  const { confirm, prompt } = useDialog();
//         if (await confirm({ title: 'Delete?', tone: 'danger' })) ...
//         const text = await prompt({ title: 'Remark', defaultValue: '' }); // null if cancelled

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [value, setValue] = useState('');
  const resolver = useRef(null);
  const inputRef = useRef(null);

  const open = useCallback((type, opts) => {
    setValue(opts.defaultValue || '');
    setDialog({ type, ...opts });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  };

  const confirm = useCallback((opts) => open('confirm', opts), [open]);
  const prompt = useCallback((opts) => open('prompt', opts), [open]);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation(); // don't also close a drawer underneath
        close(dialog.type === 'prompt' ? null : false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      clearTimeout(t);
    };
  }, [dialog]); // eslint-disable-line react-hooks/exhaustive-deps

  const danger = dialog?.tone === 'danger';
  const Icon = dialog?.type === 'prompt' ? PencilLine : danger ? TriangleAlert : CircleHelp;

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      <AnimatePresence>
        {dialog && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => close(dialog.type === 'prompt' ? null : false)}
          >
            <motion.form
              className="modal glass"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              onMouseDown={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                close(dialog.type === 'prompt' ? value : true);
              }}
            >
              <div className={`modal-icon ${danger ? 'danger' : ''}`}><Icon size={22} /></div>
              <h3>{dialog.title}</h3>
              {dialog.message && <p className="muted">{dialog.message}</p>}
              {dialog.type === 'prompt' && (
                <input
                  ref={inputRef}
                  className="input"
                  value={value}
                  placeholder={dialog.placeholder || ''}
                  onChange={(e) => setValue(e.target.value)}
                  required={dialog.required}
                />
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => close(dialog.type === 'prompt' ? null : false)}>
                  Cancel
                </button>
                <button type="submit" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}>
                  {dialog.confirmText || 'Confirm'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  );
}

export const useDialog = () => useContext(DialogContext);
