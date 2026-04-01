import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import ResourceIcon from './ResourceIcon';

export default function VassalPanel() {
  const { vassalages, payRansom, attemptRebellion, setVassalTributeRate, releaseVassal, resources, army, allVillages } = useGame();
  const { user } = useAuth();
  const [rebelling, setRebelling] = useState<string | null>(null);

  if (vassalages.length === 0) return null;

  const myVassals = vassalages.filter(v => v.lord_id === user?.id);
  const myLords = vassalages.filter(v => v.vassal_id === user?.id);

  return (
    <div className="space-y-3">
      {/* I am a vassal */}
      {myLords.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-sm text-destructive">⛓️ Vassalage</h3>
          {myLords.map(v => {
            const lordVillage = allVillages.find(av => av.village.user_id === v.lord_id);
            const lordName = lordVillage?.profile.display_name || 'Unknown Lord';
            const canRebel = new Date(v.rebellion_available_at) <= new Date();
            const rebellionTime = new Date(v.rebellion_available_at);
            const canPayRansom = resources.gold >= v.ransom_gold;
            const hasTroops = Object.values(army).some(val => val > 0);

            return (
              <div key={v.id} className="game-panel border-glow rounded-xl p-3 space-y-2 border-destructive/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display text-sm text-foreground">Vassal of <span className="text-destructive">{lordName}</span></p>
                    <p className="text-sm text-muted-foreground">Tribute: {v.tribute_rate}% of production</p>
                  </div>
                  <span className="text-2xl">⛓️</span>
                </div>

                <div className="flex flex-col gap-2.5">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    disabled={!canPayRansom}
                    onClick={async () => {
                      const success = await payRansom(v.id);
                      if (success) toast.success('Freedom bought! You are no longer a vassal.');
                      else toast.error('Failed to pay ransom.');
                    }}
                    className={`w-full font-display text-sm py-3 rounded-lg flex items-center justify-center gap-2 ${
                      canPayRansom ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    💰 Pay Ransom (<ResourceIcon type="gold" size={10} />{v.ransom_gold})
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    disabled={!canRebel || !hasTroops || rebelling === v.id}
                    onClick={async () => {
                      if (!hasTroops) { toast.error('You need troops to rebel!'); return; }
                      setRebelling(v.id);
                      const success = await attemptRebellion(v.id);
                      setRebelling(null);
                      if (success) toast.success('⚔️ Rebellion successful! You are free!');
                      else toast.error('⚔️ Rebellion failed! Timer reset to 24h.');
                    }}
                    className={`w-full font-display text-sm py-3 rounded-lg ${
                      canRebel && hasTroops ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {rebelling === v.id ? '⚔️ Fighting...' : canRebel ? '⚔️ Rebel!' : `⚔️ Rebellion in ${Math.ceil((rebellionTime.getTime() - Date.now()) / 3600000)}h`}
                  </motion.button>

                  <p className="text-sm text-muted-foreground text-center">
                    Alliance members can also attack your lord to free you
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* I am a lord */}
      {myVassals.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-sm text-primary">👑 My Vassals</h3>
          {myVassals.map(v => {
            const vassalVillage = allVillages.find(av => av.village.user_id === v.vassal_id);
            const vassalName = vassalVillage?.profile.display_name || 'Unknown';

            return (
              <VassalLordCard
                key={v.id}
                vassalage={v}
                vassalName={vassalName}
                onSetRate={setVassalTributeRate}
                onRelease={releaseVassal}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function VassalLordCard({ vassalage, vassalName, onSetRate, onRelease }: {
  vassalage: { id: string; tribute_rate: number; ransom_gold: number };
  vassalName: string;
  onSetRate: (id: string, rate: number) => Promise<boolean>;
  onRelease: (id: string) => Promise<boolean>;
}) {
  const [editingRate, setEditingRate] = useState(false);
  const [rate, setRate] = useState(vassalage.tribute_rate);

  return (
    <div className="game-panel border-glow rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-sm text-foreground">{vassalName}</p>
          <p className="text-sm text-muted-foreground">Tribute: {vassalage.tribute_rate}% · Ransom: {vassalage.ransom_gold}💰</p>
        </div>
        <span className="text-sm text-primary font-bold">👑 Vassal</span>
      </div>

      {/* Tax rate control */}
      {editingRate ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0} max={50} step={1}
              value={rate}
              onChange={e => setRate(Number(e.target.value))}
              className="flex-1 accent-primary h-2"
            />
            <span className="text-sm font-bold text-foreground w-10 text-right">{rate}%</span>
          </div>
          <div className="flex gap-2.5">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                await onSetRate(vassalage.id, rate);
                setEditingRate(false);
                toast.success(`Tribute rate set to ${rate}%`);
              }}
              className="flex-1 font-display text-sm py-2.5 rounded-lg bg-primary/20 text-primary"
            >
              ✓ Save
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { setRate(vassalage.tribute_rate); setEditingRate(false); }}
              className="flex-1 font-display text-sm py-2.5 rounded-lg bg-muted text-muted-foreground"
            >
              ✕ Cancel
            </motion.button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2.5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setEditingRate(true)}
            className="flex-1 font-display text-sm py-2.5 rounded-lg bg-primary/20 text-primary"
          >
            📊 Change Tax
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              const success = await onRelease(vassalage.id);
              if (success) toast.success(`${vassalName} has been released!`);
              else toast.error('Failed to release vassal.');
            }}
            className="flex-1 font-display text-sm py-2.5 rounded-lg bg-destructive/20 text-destructive"
          >
            🕊️ Release
          </motion.button>
        </div>
      )}
    </div>
  );
}
