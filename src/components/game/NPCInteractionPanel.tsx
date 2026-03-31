import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame, Resources } from '@/hooks/useGameState';
import { toast } from 'sonner';
import ResourceIcon from './ResourceIcon';

// Trade rates by biome — each biome has resources they WANT (buy high) and SELL cheap
const BIOME_TRADE_PROFILES: Record<string, { wants: (keyof Resources)[]; sells: (keyof Resources)[]; desc: string }> = {
  Plains:     { wants: ['stone', 'gold'], sells: ['food', 'wood'], desc: 'Fertile farmlands with abundant harvests' },
  Highlands:  { wants: ['food', 'wood'], sells: ['stone', 'gold'], desc: 'Rich in minerals and precious metals' },
  Marsh:      { wants: ['stone', 'gold'], sells: ['food', 'wood'], desc: 'Swampy but teeming with herbs and timber' },
  Desert:     { wants: ['food', 'wood'], sells: ['gold', 'stone'], desc: 'Scarce water but rich in gems and ore' },
  Tundra:     { wants: ['food', 'wood'], sells: ['stone', 'gold'], desc: 'Frozen wastes with deep mineral veins' },
  Forest:     { wants: ['stone', 'gold'], sells: ['wood', 'food'], desc: 'Endless timber and foraged provisions' },
  Steppe:     { wants: ['wood', 'stone'], sells: ['food', 'gold'], desc: 'Vast grasslands with herding wealth' },
  Badlands:   { wants: ['food', 'wood'], sells: ['stone', 'gold'], desc: 'Harsh terrain hiding rare resources' },
  Coast:      { wants: ['wood', 'stone'], sells: ['food', 'gold'], desc: 'Fishing ports and maritime trade' },
  Jungle:     { wants: ['stone', 'gold'], sells: ['wood', 'food'], desc: 'Dense canopy with exotic resources' },
};

const RESOURCE_ICONS: Record<keyof Resources, string> = { gold: '💰', wood: '🪵', stone: '🪨', food: '🌾' };

interface NPCRealm {
  id: string;
  name: string;
  ruler: string;
  power: number;
  x: number;
  y: number;
  emoji: string;
  type: 'hostile' | 'neutral' | 'friendly';
  desc: string;
  territory: number;
}

interface NPCRelation {
  realmId: string;
  status: 'neutral' | 'friendly' | 'vassal' | 'allied';
  tributeRate: number;
  friendshipLevel: number; // 0-100, affects trade rates
}

interface Props {
  realm: NPCRealm;
  biome: string;
  onClose: () => void;
  onAttack: (realm: NPCRealm) => void;
  onEnvoy: (realm: NPCRealm) => void;
  npcRelations: Map<string, NPCRelation>;
  setNpcRelations: React.Dispatch<React.SetStateAction<Map<string, NPCRelation>>>;
  isInRange: boolean;
  travelTime: number;
  hasActiveTrade: boolean;
}

export default function NPCInteractionPanel({ realm, biome, onClose, onAttack, onEnvoy, npcRelations, setNpcRelations, isInRange, travelTime, hasActiveTrade }: Props) {
  const { resources, addResources } = useGame();
  const [tab, setTab] = useState<'info' | 'trade' | 'talk'>('info');
  const [tradeResource, setTradeResource] = useState<keyof Resources | null>(null);
  const [tradeAmount, setTradeAmount] = useState(50);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const relation = npcRelations.get(realm.id) || { realmId: realm.id, status: realm.type === 'friendly' ? 'friendly' : 'neutral', tributeRate: 0, friendshipLevel: realm.type === 'friendly' ? 40 : 10 };
  const profile = BIOME_TRADE_PROFILES[biome] || BIOME_TRADE_PROFILES['Plains'];

  // Trade rates: base 1:1 ratio, biome adjusts prices
  // Selling what they WANT: you get more for it. Buying what they SELL: cheaper.
  const getTradeRate = (fromResource: keyof Resources, toResource: keyof Resources): number => {
    let rate = 1.0;
    // If the realm wants what you're selling, better rate
    if (profile.wants.includes(fromResource)) rate *= 1.4;
    // If they sell what you want, better rate
    if (profile.sells.includes(toResource)) rate *= 1.3;
    // Friendship bonus
    rate *= 1 + (relation.friendshipLevel / 200);
    // Hostile penalty
    if (realm.type === 'hostile') rate *= 0.5;
    // Vassal bonus
    if (relation.status === 'vassal') rate *= 1.5;
    return Math.round(rate * 100) / 100;
  };

  const availableTrades = (() => {
    const trades: { give: keyof Resources; receive: keyof Resources; rate: number }[] = [];
    const allRes: (keyof Resources)[] = ['gold', 'wood', 'stone', 'food'];
    for (const give of allRes) {
      for (const receive of allRes) {
        if (give === receive) continue;
        const rate = getTradeRate(give, receive);
        if (rate > 0.3) trades.push({ give, receive, rate });
      }
    }
    // Sort by best rates first
    return trades.sort((a, b) => b.rate - a.rate).slice(0, 6);
  })();

  const executeTrade = (give: keyof Resources, receive: keyof Resources, amount: number) => {
    if (resources[give] < amount) { toast.error(`Not enough ${give}!`); return; }
    if (!isInRange) { toast.error('Out of range!'); return; }
    const rate = getTradeRate(give, receive);
    const received = Math.floor(amount * rate);
    addResources({ [give]: -amount, [receive]: received });
    // Increase friendship
    setNpcRelations(prev => {
      const next = new Map(prev);
      const r = next.get(realm.id) || { ...relation };
      r.friendshipLevel = Math.min(100, r.friendshipLevel + Math.floor(amount / 50));
      if (r.friendshipLevel >= 60 && r.status === 'neutral') r.status = 'friendly';
      next.set(realm.id, r);
      return next;
    });
    toast.success(`Traded ${amount} ${RESOURCE_ICONS[give]} for ${received} ${RESOURCE_ICONS[receive]}`);
  };

  // AI chat with NPC ruler
  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    const newMessages = [...chatMessages, { role: 'user' as const, content: userMsg }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const systemContext = `You are ${realm.ruler}, ruler of ${realm.name}, a ${realm.type} NPC kingdom in the ${biome} biome. Your realm has power level ${realm.power}. You speak in character as a medieval ruler. Keep responses SHORT (2-3 sentences). The player's friendship level with you is ${relation.friendshipLevel}/100. ${relation.status === 'vassal' ? 'They have conquered your realm and you are their vassal — be submissive but resentful.' : relation.status === 'friendly' ? 'You are on friendly terms — be warm and helpful.' : realm.type === 'hostile' ? 'You are hostile — be threatening and dismissive.' : 'You are cautious but open to diplomacy.'}`;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/game-dm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          type: 'event',
          messages: [{ role: 'system', content: systemContext }, ...newMessages],
          gameState: null,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to get response');
      }

      // Stream the response
      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No reader');
      const decoder = new TextDecoder();
      let assistantText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setChatMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
                }
                return [...prev, { role: 'assistant', content: assistantText }];
              });
            }
          } catch { /* partial */ }
        }
      }

      if (!assistantText) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: '*The ruler stares at you silently.*' }]);
      }

      // Talking increases friendship slightly
      setNpcRelations(prev => {
        const next = new Map(prev);
        const r = next.get(realm.id) || { ...relation };
        r.friendshipLevel = Math.min(100, r.friendshipLevel + 2);
        next.set(realm.id, r);
        return next;
      });
    } catch (e) {
      console.error('NPC chat error:', e);
      setChatMessages(prev => [...prev, { role: 'assistant', content: '*The ruler is unavailable.*' }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatMessages, chatLoading, realm, biome, relation]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Vassalize NPC (after winning a battle, or through high friendship)
  const vassalizeNPC = () => {
    if (relation.friendshipLevel < 80 && realm.type !== 'friendly') {
      toast.error('Friendship too low! Trade or talk more first (need 80+).');
      return;
    }
    setNpcRelations(prev => {
      const next = new Map(prev);
      next.set(realm.id, { ...relation, status: 'vassal', tributeRate: 10, friendshipLevel: Math.max(relation.friendshipLevel, 60) });
      return next;
    });
    toast.success(`${realm.name} has pledged allegiance! They are now your vassal.`);
  };

  const friendshipColor = relation.friendshipLevel >= 80 ? 'text-food' : relation.friendshipLevel >= 40 ? 'text-primary' : 'text-muted-foreground';
  const statusLabel = relation.status === 'vassal' ? '👑 Vassal' : relation.status === 'friendly' ? '🤝 Friendly' : relation.status === 'allied' ? '⭐ Allied' : '😐 Neutral';

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-3xl">{realm.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-sm text-foreground truncate">{realm.name}</h3>
          <p className="text-[10px] text-muted-foreground">Ruled by {realm.ruler}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
            relation.status === 'vassal' ? 'bg-primary/20 text-primary' :
            realm.type === 'hostile' ? 'bg-destructive/20 text-destructive' :
            realm.type === 'friendly' ? 'bg-food/20 text-food' : 'bg-muted text-muted-foreground'
          }`}>{statusLabel}</span>
          <span className={`text-[8px] ${friendshipColor}`}>❤️ {relation.friendshipLevel}/100</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
        {(['info', 'trade', 'talk'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 font-display text-[10px] py-1.5 rounded-md transition-colors ${
              tab === t ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {t === 'info' ? '📋 Info' : t === 'trade' ? '💱 Trade' : '💬 Talk'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* INFO TAB */}
        {tab === 'info' && (
          <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            <p className="text-[10px] text-muted-foreground">{realm.desc}</p>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-foreground font-bold">⚔️ Power: {realm.power}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">🌍 {biome}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">📍 {isInRange ? `${travelTime}s away` : 'Out of range'}</span>
            </div>
            <p className="text-[9px] text-muted-foreground italic">{profile.desc}</p>

            {hasActiveTrade && <span className="text-[9px] text-food font-bold block">📜 Active Trade Contract</span>}

            <div className="flex gap-1.5 mt-1.5">
              {relation.status !== 'vassal' && realm.type !== 'hostile' && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => onEnvoy(realm)}
                  className="flex-1 bg-primary/20 text-primary font-display text-[10px] py-2 rounded-lg">
                  📜 Envoy 💰{Math.floor(realm.power * 0.3)}
                </motion.button>
              )}
              {relation.status !== 'vassal' && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => onAttack(realm)}
                  className="flex-1 bg-destructive/20 text-destructive font-display text-[10px] py-2 rounded-lg">
                  ⚔️ Attack
                </motion.button>
              )}
              {relation.status !== 'vassal' && (relation.friendshipLevel >= 80 || realm.type === 'friendly') && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={vassalizeNPC}
                  className="flex-1 bg-food/20 text-food font-display text-[10px] py-2 rounded-lg">
                  👑 Vassalize
                </motion.button>
              )}
              {relation.status === 'vassal' && (
                <div className="flex-1 bg-primary/10 text-primary font-display text-[10px] py-2 rounded-lg text-center">
                  👑 Tribute: {relation.tributeRate}% • +{Math.floor(realm.power * 0.02)}/min
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TRADE TAB */}
        {tab === 'trade' && (
          <motion.div key="trade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            <div className="text-[9px] text-muted-foreground flex items-center gap-1">
              <span>🌍 {biome} market</span>
              <span>·</span>
              <span className="text-food">Sells: {profile.sells.map(r => RESOURCE_ICONS[r]).join(' ')}</span>
              <span>·</span>
              <span className="text-primary">Wants: {profile.wants.map(r => RESOURCE_ICONS[r]).join(' ')}</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {availableTrades.map((trade, i) => {
                const receiveAmt = Math.floor(tradeAmount * trade.rate);
                const canDo = resources[trade.give] >= tradeAmount && isInRange;
                return (
                  <motion.button key={i} whileTap={{ scale: 0.95 }}
                    disabled={!canDo}
                    onClick={() => executeTrade(trade.give, trade.receive, tradeAmount)}
                    className={`p-2 rounded-lg text-left space-y-0.5 transition-colors ${
                      canDo ? 'bg-muted/50 hover:bg-muted/80 border border-border/50' : 'bg-muted/20 opacity-50'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]">{RESOURCE_ICONS[trade.give]} → {RESOURCE_ICONS[trade.receive]}</span>
                      <span className={`text-[8px] font-bold ${trade.rate >= 1.5 ? 'text-food' : trade.rate >= 1 ? 'text-primary' : 'text-destructive'}`}>
                        ×{trade.rate}
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground">
                      {tradeAmount} → {receiveAmt}
                    </p>
                  </motion.button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] text-muted-foreground">Amount:</span>
              <input type="range" min={10} max={500} step={10} value={tradeAmount}
                onChange={e => setTradeAmount(Number(e.target.value))}
                className="flex-1 accent-primary h-1.5" />
              <span className="text-[10px] font-bold text-foreground w-10 text-right">{tradeAmount}</span>
            </div>

            {!isInRange && <p className="text-[9px] text-destructive text-center">Out of range — train scouts to extend reach</p>}
          </motion.div>
        )}

        {/* TALK TAB */}
        {tab === 'talk' && (
          <motion.div key="talk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            <div className="bg-muted/30 rounded-lg p-2 max-h-[140px] overflow-y-auto space-y-1.5">
              {chatMessages.length === 0 && (
                <p className="text-[9px] text-muted-foreground italic text-center py-3">
                  Speak with {realm.ruler} of {realm.name}...
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`text-[10px] rounded-lg px-2 py-1.5 ${
                  msg.role === 'user' ? 'bg-primary/20 text-foreground ml-6' : 'bg-muted/60 text-foreground mr-6'
                }`}>
                  <span className="font-bold text-[8px] text-muted-foreground block mb-0.5">
                    {msg.role === 'user' ? 'You' : realm.ruler}
                  </span>
                  {msg.content}
                </div>
              ))}
              {chatLoading && (
                <div className="text-[9px] text-muted-foreground italic animate-pulse">
                  {realm.ruler} is thinking...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-1.5">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder={`Speak to ${realm.ruler}...`}
                className="flex-1 bg-muted/40 rounded-lg px-2.5 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground outline-none border border-border/50 focus:border-primary/50"
              />
              <motion.button whileTap={{ scale: 0.95 }} onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                className="bg-primary/20 text-primary font-display text-[10px] px-3 py-1.5 rounded-lg disabled:opacity-50">
                Send
              </motion.button>
            </div>

            <div className="flex gap-1 flex-wrap">
              {[
                'Greetings, what do you trade?',
                'I seek an alliance.',
                'Surrender or face my army!',
                'Tell me about your lands.',
              ].map((q, i) => (
                <button key={i} onClick={() => { setChatInput(q); }}
                  className="text-[8px] text-muted-foreground bg-muted/30 rounded px-1.5 py-0.5 hover:bg-muted/50 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
