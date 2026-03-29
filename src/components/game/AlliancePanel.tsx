import { motion } from 'framer-motion';

const MOCK_ALLIANCES = [
  { name: 'Order of the Phoenix', members: 12, power: 45200, tag: 'OoP' },
  { name: 'DragonClan', members: 8, power: 32100, tag: 'DRC' },
  { name: 'Alliance of Light', members: 15, power: 58300, tag: 'AoL' },
  { name: 'Shadow Wolves', members: 6, power: 18700, tag: 'SHW' },
];

export default function AlliancePanel() {
  return (
    <div className="flex-1 flex flex-col p-4 space-y-4">
      <h2 className="font-display text-lg text-foreground text-shadow-gold">Alliances</h2>

      {/* Your alliance status */}
      <div className="game-panel border-glow rounded-xl p-4 text-center space-y-2">
        <p className="text-sm text-muted-foreground">You are not in an alliance</p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="bg-primary text-primary-foreground font-display text-sm py-2 px-6 rounded-lg glow-gold"
        >
          Create Alliance
        </motion.button>
      </div>

      {/* Alliance rankings */}
      <div>
        <h3 className="font-display text-sm text-foreground mb-2">Top Alliances</h3>
        <div className="space-y-2">
          {MOCK_ALLIANCES.sort((a, b) => b.power - a.power).map((alliance, i) => (
            <motion.div
              key={alliance.tag}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="game-panel border-glow rounded-xl p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-primary font-display text-sm font-bold w-5">#{i + 1}</span>
                <div>
                  <p className="font-display text-xs text-foreground">{alliance.name}</p>
                  <p className="text-[10px] text-muted-foreground">[{alliance.tag}] • {alliance.members} members</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-primary">{alliance.power.toLocaleString()}</p>
                <p className="text-[9px] text-muted-foreground">Power</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
