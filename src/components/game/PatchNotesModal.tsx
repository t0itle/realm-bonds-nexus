import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CURRENT_VERSION, PATCH_NOTES } from '@/config/patchNotes';

const SEEN_VERSION_KEY = 'patch_notes_seen_version';

export default function PatchNotesModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(SEEN_VERSION_KEY);
    if (seen !== CURRENT_VERSION) {
      setOpen(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(SEEN_VERSION_KEY, CURRENT_VERSION);
    setOpen(false);
  };

  const latest = PATCH_NOTES[0];
  if (!latest) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4"
          onClick={dismiss}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            onClick={e => e.stopPropagation()}
            className="game-panel border border-primary/40 rounded-2xl p-5 max-w-sm w-full space-y-3 max-h-[80vh] overflow-y-auto"
          >
            <div className="text-center space-y-1">
              <span className="text-2xl">📜</span>
              <h3 className="font-display text-lg text-foreground">{latest.title}</h3>
              <p className="text-[10px] text-muted-foreground">v{latest.version} · {latest.date}</p>
            </div>

            <ul className="space-y-1.5">
              {latest.changes.map((change, i) => (
                <li key={i} className="text-xs text-foreground/90 leading-relaxed">
                  {change}
                </li>
              ))}
            </ul>

            <button
              onClick={dismiss}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-display text-sm"
            >
              Let's go!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
