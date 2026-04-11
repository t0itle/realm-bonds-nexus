import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AzgaarState } from '@/hooks/useAzgaarMap';

interface Props {
  states: AzgaarState[];
  hiddenStates: Set<number>;
  onToggleState: (stateId: number) => void;
  showRoads: boolean;
  onToggleRoads: () => void;
  showBurgs: boolean;
  onToggleBurgs: () => void;
}

export default function MapFilterPanel({ states, hiddenStates, onToggleState, showRoads, onToggleRoads, showBurgs, onToggleBurgs }: Props) {
  const [open, setOpen] = useState(false);

  const realStates = states.filter(s => s.id !== 0);

  return (
    <>
      <button
        type="button"
        aria-label="Filter map"
        onClick={() => setOpen(!open)}
        className="w-9 h-9 bg-background/80 backdrop-blur-sm border border-border/40 rounded-lg flex items-center justify-center text-foreground/80 text-sm active:scale-90 transition-all hover:bg-background/95 shadow-sm"
      >
        🗺️
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-12 top-0 z-[1001] w-44 game-panel border-glow rounded-lg p-2 max-h-64 overflow-y-auto"
          >
            <p className="font-display text-[10px] text-primary mb-1.5">Map Filters</p>

            <label className="flex items-center gap-1.5 text-[10px] text-foreground/80 mb-1 cursor-pointer">
              <input type="checkbox" checked={showRoads} onChange={onToggleRoads} className="w-3 h-3 accent-primary" />
              🛤️ Roads
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-foreground/80 mb-2 cursor-pointer">
              <input type="checkbox" checked={showBurgs} onChange={onToggleBurgs} className="w-3 h-3 accent-primary" />
              🏘️ Settlements
            </label>

            <div className="border-t border-border/30 pt-1.5">
              <p className="text-[9px] text-muted-foreground mb-1">States</p>
              {realStates.map(s => (
                <label key={s.id} className="flex items-center gap-1.5 text-[10px] text-foreground/80 py-0.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!hiddenStates.has(s.id)}
                    onChange={() => onToggleState(s.id)}
                    className="w-3 h-3"
                    style={{ accentColor: s.color }}
                  />
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: s.color }} />
                  {s.name}
                </label>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
