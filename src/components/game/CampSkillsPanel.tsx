import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ResourceIcon from './ResourceIcon';

interface CampSkill {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'survival' | 'crafting' | 'social';
  tier: number; // 1-3
  cost: { gold: number; wood: number; stone: number; food: number };
  requires?: string; // skill id prerequisite
  effect: string;
}

const CAMP_SKILLS: CampSkill[] = [
  // Survival branch (build tall - defense & sustainability)
  { id: 'foraging_mastery', name: 'Foraging Mastery', icon: '🌿', description: 'Improve food gathering efficiency', category: 'survival', tier: 1, cost: { gold: 20, wood: 0, stone: 0, food: 10 }, effect: '+10% food production' },
  { id: 'fire_keeping', name: 'Fire Keeping', icon: '🔥', description: 'Better campfire management', category: 'survival', tier: 1, cost: { gold: 15, wood: 20, stone: 0, food: 0 }, effect: '+5% happiness' },
  { id: 'shelter_craft', name: 'Shelter Craft', icon: '⛺', description: 'Build sturdier shelters', category: 'survival', tier: 1, cost: { gold: 10, wood: 30, stone: 10, food: 0 }, effect: '+2 housing per tent' },
  { id: 'tracking', name: 'Tracking', icon: '🐾', description: 'Track animals for better hunting', category: 'survival', tier: 2, cost: { gold: 40, wood: 10, stone: 0, food: 20 }, requires: 'foraging_mastery', effect: '+15% food, unlock scouts' },
  { id: 'herbalism', name: 'Herbalism', icon: '🌱', description: 'Identify healing herbs', category: 'survival', tier: 2, cost: { gold: 50, wood: 0, stone: 0, food: 30 }, requires: 'fire_keeping', effect: 'Heal troops 20% faster' },
  { id: 'fortification', name: 'Fortification', icon: '🪵', description: 'Build primitive defenses', category: 'survival', tier: 3, cost: { gold: 80, wood: 60, stone: 40, food: 0 }, requires: 'shelter_craft', effect: '+15 defense, unlock lookout Lv3+' },

  // Crafting branch (build wide - production & resources)
  { id: 'stone_working', name: 'Stone Working', icon: '🪨', description: 'Improve stone gathering', category: 'crafting', tier: 1, cost: { gold: 15, wood: 5, stone: 15, food: 0 }, effect: '+10% stone production' },
  { id: 'woodcraft', name: 'Woodcraft', icon: '🪓', description: 'Better wood processing', category: 'crafting', tier: 1, cost: { gold: 15, wood: 15, stone: 5, food: 0 }, effect: '+10% wood production' },
  { id: 'tool_making', name: 'Tool Making', icon: '🔨', description: 'Craft basic tools', category: 'crafting', tier: 1, cost: { gold: 25, wood: 20, stone: 15, food: 0 }, effect: '+5% all production' },
  { id: 'prospecting', name: 'Prospecting', icon: '💎', description: 'Find gold deposits', category: 'crafting', tier: 2, cost: { gold: 30, wood: 10, stone: 30, food: 0 }, requires: 'stone_working', effect: '+15% gold, find steel' },
  { id: 'carpentry', name: 'Carpentry', icon: '🪚', description: 'Advanced woodworking', category: 'crafting', tier: 2, cost: { gold: 40, wood: 30, stone: 0, food: 0 }, requires: 'woodcraft', effect: '-10% build costs' },
  { id: 'smelting', name: 'Smelting', icon: '⚒️', description: 'Process raw ores', category: 'crafting', tier: 3, cost: { gold: 100, wood: 40, stone: 50, food: 0 }, requires: 'tool_making', effect: 'Unlock smithy early' },

  // Social branch (diplomacy & trade)
  { id: 'campfire_tales', name: 'Campfire Tales', icon: '📖', description: 'Build morale through stories', category: 'social', tier: 1, cost: { gold: 10, wood: 5, stone: 0, food: 15 }, effect: '+8% happiness' },
  { id: 'barter', name: 'Barter', icon: '🤝', description: 'Trade with passing merchants', category: 'social', tier: 1, cost: { gold: 20, wood: 0, stone: 0, food: 10 }, effect: '+5% trade value' },
  { id: 'leadership', name: 'Leadership', icon: '👑', description: 'Organize your camp better', category: 'social', tier: 1, cost: { gold: 30, wood: 0, stone: 0, food: 20 }, effect: '+1 max workers' },
  { id: 'diplomacy', name: 'Diplomacy', icon: '🕊️', description: 'Open relations with NPC towns', category: 'social', tier: 2, cost: { gold: 60, wood: 0, stone: 0, food: 30 }, requires: 'campfire_tales', effect: 'NPC trade unlocked' },
  { id: 'trade_routes', name: 'Trade Routes', icon: '🐪', description: 'Establish regular trade', category: 'social', tier: 2, cost: { gold: 80, wood: 0, stone: 0, food: 20 }, requires: 'barter', effect: 'Auto-trade enabled' },
  { id: 'militia_training', name: 'Militia Training', icon: '⚔️', description: 'Train a small militia', category: 'social', tier: 3, cost: { gold: 100, wood: 30, stone: 20, food: 40 }, requires: 'leadership', effect: 'Unlock barracks early' },
];

const CATEGORY_INFO = {
  survival: { name: 'Survival', icon: '🏕️', color: 'text-green-400', bg: 'bg-green-400/10' },
  crafting: { name: 'Crafting', icon: '🔨', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  social: { name: 'Social', icon: '👥', color: 'text-blue-400', bg: 'bg-blue-400/10' },
};

export default function CampSkillsPanel() {
  const { resources, canAfford, villageId } = useGame();
  const { user } = useAuth();
  const [unlockedSkills, setUnlockedSkills] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'survival' | 'crafting' | 'social'>('survival');
  const [selectedSkill, setSelectedSkill] = useState<CampSkill | null>(null);

  // Load unlocked skills from research_progress
  useEffect(() => {
    if (!villageId || !user) return;
    supabase.from('research_progress').select('unlocked_nodes').eq('village_id', villageId).single()
      .then(({ data }) => {
        if (data?.unlocked_nodes) {
          setUnlockedSkills(Array.isArray(data.unlocked_nodes) ? data.unlocked_nodes as string[] : []);
        }
      });
  }, [villageId, user]);

  const unlockSkill = async (skill: CampSkill) => {
    if (!villageId || !user) return;
    if (unlockedSkills.includes(skill.id)) return;
    if (skill.requires && !unlockedSkills.includes(skill.requires)) {
      toast.error(`Requires ${CAMP_SKILLS.find(s => s.id === skill.requires)?.name} first!`);
      return;
    }
    if (!canAfford(skill.cost)) { toast.error('Not enough resources!'); return; }

    const newUnlocked = [...unlockedSkills, skill.id];

    // Deduct resources
    const newResources = {
      gold: resources.gold - skill.cost.gold,
      wood: resources.wood - skill.cost.wood,
      stone: resources.stone - skill.cost.stone,
      food: resources.food - skill.cost.food,
    };

    await supabase.from('villages').update(newResources as any).eq('id', villageId);

    // Upsert research progress
    const { data: existing } = await supabase.from('research_progress').select('id').eq('village_id', villageId).single();
    if (existing) {
      await supabase.from('research_progress').update({ unlocked_nodes: newUnlocked as any }).eq('village_id', villageId);
    } else {
      await supabase.from('research_progress').insert({
        user_id: user.id, village_id: villageId,
        unlocked_nodes: newUnlocked as any,
      } as any);
    }

    setUnlockedSkills(newUnlocked);
    toast.success(`🎓 Learned ${skill.name}! ${skill.effect}`);
    setSelectedSkill(null);
  };

  const categorySkills = CAMP_SKILLS.filter(s => s.category === selectedCategory);

  return (
    <div className="space-y-3">
      {/* Category tabs */}
      <div className="flex gap-1">
        {(Object.keys(CATEGORY_INFO) as Array<keyof typeof CATEGORY_INFO>).map(cat => {
          const info = CATEGORY_INFO[cat];
          const count = CAMP_SKILLS.filter(s => s.category === cat && unlockedSkills.includes(s.id)).length;
          const total = CAMP_SKILLS.filter(s => s.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-1 flex flex-col items-center gap-0.5 rounded-lg py-2 px-1 transition-all ${
                selectedCategory === cat ? `${info.bg} border border-current ${info.color}` : 'bg-muted/30 text-muted-foreground'
              }`}
            >
              <span className="text-sm">{info.icon}</span>
              <span className="text-[9px] font-display">{info.name}</span>
              <span className="text-[8px]">{count}/{total}</span>
            </button>
          );
        })}
      </div>

      {/* Skill tree */}
      <div className="space-y-1">
        {[1, 2, 3].map(tier => {
          const tierSkills = categorySkills.filter(s => s.tier === tier);
          if (tierSkills.length === 0) return null;
          return (
            <div key={tier} className="space-y-1">
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider px-1">Tier {tier}</p>
              <div className="flex gap-1">
                {tierSkills.map(skill => {
                  const unlocked = unlockedSkills.includes(skill.id);
                  const prereqMet = !skill.requires || unlockedSkills.includes(skill.requires);
                  const affordable = canAfford(skill.cost);
                  const available = !unlocked && prereqMet;

                  return (
                    <motion.button
                      key={skill.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedSkill(skill)}
                      className={`flex-1 flex flex-col items-center gap-0.5 rounded-lg py-2 px-1 border transition-all ${
                        unlocked
                          ? 'border-primary/50 bg-primary/10'
                          : available && affordable
                          ? 'border-primary/30 bg-muted/50 hover:border-primary/60'
                          : 'border-border/30 bg-muted/20 opacity-50'
                      }`}
                    >
                      <span className="text-base">{skill.icon}</span>
                      <span className="text-[8px] font-display text-foreground leading-tight text-center">{skill.name}</span>
                      {unlocked && <span className="text-[7px] text-primary">✓</span>}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Skill detail popup */}
      <AnimatePresence>
        {selectedSkill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-6"
            onClick={() => setSelectedSkill(null)}
          >
            <motion.div
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.85 }}
              onClick={e => e.stopPropagation()}
              className="game-panel border border-primary/30 rounded-2xl p-4 max-w-xs w-full space-y-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedSkill.icon}</span>
                <div>
                  <h4 className="font-display text-sm text-foreground">{selectedSkill.name}</h4>
                  <p className="text-[9px] text-muted-foreground">{CATEGORY_INFO[selectedSkill.category].name} • Tier {selectedSkill.tier}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">{selectedSkill.description}</p>
              <div className="bg-primary/5 rounded-lg px-2 py-1.5">
                <p className="text-[10px] text-primary font-display">{selectedSkill.effect}</p>
              </div>

              {selectedSkill.requires && (
                <p className="text-[9px] text-muted-foreground">
                  Requires: {CAMP_SKILLS.find(s => s.id === selectedSkill.requires)?.name}
                  {unlockedSkills.includes(selectedSkill.requires) ? ' ✓' : ' ✗'}
                </p>
              )}

              <div className="flex flex-wrap gap-1.5 text-[9px]">
                {Object.entries(selectedSkill.cost).filter(([, v]) => v > 0).map(([key, val]) => {
                  const enough = (resources as any)[key] >= val;
                  return (
                    <span key={key} className={`flex items-center gap-0.5 ${enough ? 'text-foreground' : 'text-destructive'}`}>
                      {key === 'gold' ? '🪙' : key === 'wood' ? '🪵' : key === 'stone' ? '🪨' : '🌾'}{val}
                    </span>
                  );
                })}
              </div>

              {unlockedSkills.includes(selectedSkill.id) ? (
                <div className="text-center py-2 text-primary font-display text-xs">✦ Already Learned ✦</div>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => unlockSkill(selectedSkill)}
                  disabled={!canAfford(selectedSkill.cost) || (selectedSkill.requires && !unlockedSkills.includes(selectedSkill.requires)) as boolean}
                  className={`w-full py-2.5 rounded-lg font-display text-xs font-bold transition-all ${
                    canAfford(selectedSkill.cost) && (!selectedSkill.requires || unlockedSkills.includes(selectedSkill.requires))
                      ? 'bg-primary text-primary-foreground glow-gold-sm'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  Learn Skill
                </motion.button>
              )}

              <button onClick={() => setSelectedSkill(null)} className="w-full text-center text-[10px] text-muted-foreground">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
