import { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MessagesPanel = lazy(() => import('./MessagesPanel'));
const AlliancePanel = lazy(() => import('./AlliancePanel'));

function TabFallback() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-2xl animate-float">⏳</div>
    </div>
  );
}

type SubTab = 'mail' | 'guild';

export default function SocialPanel({ initialDm, onDmHandled }: {
  initialDm?: { userId: string; name: string } | null;
  onDmHandled?: () => void;
}) {
  const [subTab, setSubTab] = useState<SubTab>(initialDm ? 'mail' : 'mail');

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab switcher */}
      <div className="flex gap-1 px-3 pt-2 pb-1">
        {([
          { id: 'mail' as SubTab, icon: '💬', label: 'Mail' },
          { id: 'guild' as SubTab, icon: '🤝', label: 'Guild' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-display transition-colors ${
              subTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <Suspense fallback={<TabFallback />}>
          {subTab === 'mail' && <MessagesPanel initialDm={initialDm} onDmHandled={onDmHandled} />}
          {subTab === 'guild' && <AlliancePanel />}
        </Suspense>
      </div>
    </div>
  );
}
