import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '@/hooks/useGameState';
import type { Resources } from '@/lib/gameTypes';
import { NPCPlayerRelation, NPCTownRelation, NPCTownState } from '@/hooks/useNPCState';
import { toast } from 'sonner';
import NPCMercenaryPanel from './NPCMercenaryPanel';
import NPCDiplomacyInfo from './NPCDiplomacyInfo';

// Trade rates by biome
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

interface Props {
  realm: NPCRealm;
  biome: string;
  onClose: () => void;
  onAttack: (realm: NPCRealm) => void;
  onEnvoy: (realm: NPCRealm) => void;
  // Persistent NPC state
  playerRelation: NPCPlayerRelation | null;
  townState: NPCTownState | null;
  townRelations: NPCTownRelation[];
  allRealmNames: Map<string, string>;
  onUpdateSentiment: (npcTownId: string, delta: number, status?: NPCPlayerRelation['status']) => Promise<void>;
  onSetRelationStatus: (npcTownId: string, status: NPCPlayerRelation['status'], tributeRate?: number) => Promise<void>;
  onHireMercenaries: (npcTownId: string, troops: Record<string, number>, goldCost: number) => Promise<boolean>;
  onDeductNPCStock: (npcTownId: string, resource: string, amount: number) => Promise<void>;
  isInRange: boolean;
  travelTime: number;
  hasActiveTrade: boolean;
  isScouted: boolean;
}

export default function NPCInteractionPanel({
  realm, biome, onClose, onAttack, onEnvoy,
  playerRelation, townState, townRelations, allRealmNames,
  onUpdateSentiment, onSetRelationStatus, onHireMercenaries, onDeductNPCStock,
  isInRange, travelTime, hasActiveTrade, isScouted,
}: Props) {
  const { resources, addResources } = useGame();
  const [tab, setTab] = useState<'info' | 'trade' | 'talk' | 'mercs'>('info');
  const [tradeAmount, setTradeAmount] = useState(50);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const sentiment = playerRelation?.sentiment ?? (realm.type === 'friendly' ? 20 : realm.type === 'hostile' ? -30 : 0);
  const status = playerRelation?.status ?? (realm.type === 'friendly' ? 'friendly' : 'neutral');
  const profile = BIOME_TRADE_PROFILES[biome] || BIOME_TRADE_PROFILES['Plains'];
  const effectivePower = townState?.current_power ?? realm.power;

  // Trade rates based on sentiment
  const getTradeRate = (fromResource: keyof Resources, toResource: keyof Resources): number => {
    let rate = 1.0;
    if (profile.wants.includes(fromResource)) rate *= 1.4;
    if (profile.sells.includes(toResource)) rate *= 1.3;
    rate *= 1 + (sentiment / 200);
    if (realm.type === 'hostile' && sentiment < 0) rate *= 0.5;
    if (status === 'vassal') rate *= 1.5;
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
    return trades.sort((a, b) => b.rate - a.rate).slice(0, 6);
  })();

  const isHostileAndUnfriendly = realm.type === 'hostile' && sentiment < 20;

  const HOSTILE_TRADE_REJECTIONS = [
    `"You dare approach ${realm.name} with trade goods? Leave before we take them by force!" — ${realm.ruler}`,
    `"${realm.ruler} spits at your offer. 'We do not trade with weaklings. Prove your worth in battle!'"`,
    `"The gates of ${realm.name} are closed to you, outsider. Your gold means nothing here."`,
    `"${realm.ruler} laughs cruelly. 'Come back when you've earned our respect... if you survive that long.'"`,
    `"Guards seize your caravan at the border. '${realm.ruler} has forbidden trade with your kind!'"`,
  ];

  const executeTrade = async (give: keyof Resources, receive: keyof Resources, amount: number) => {
    if (isHostileAndUnfriendly) {
      const msg = HOSTILE_TRADE_REJECTIONS[Math.floor(Math.random() * HOSTILE_TRADE_REJECTIONS.length)];
      toast.error(msg);
      await onUpdateSentiment(realm.id, -3);
      return;
    }
    if (resources[give] < amount) { toast.error(`Not enough ${give}!`); return; }
    if (!isInRange) { toast.error('Out of range!'); return; }
    const rate = getTradeRate(give, receive);
    const received = Math.floor(amount * rate);
    // Check NPC stock
    if (townState) {
      const stockKey = `stock_${receive}` as keyof NPCTownState;
      const npcStock = (townState[stockKey] as number) || 0;
      if (received > npcStock) {
        toast.error(`${realm.name} only has ${npcStock} ${receive} in stock!`);
        return;
      }
    }
    addResources({ [give]: -amount, [receive]: received });
    await onDeductNPCStock(realm.id, receive, received);
    await onUpdateSentiment(realm.id, Math.floor(amount / 50));
    toast.success(`Traded ${amount} ${RESOURCE_ICONS[give]} for ${received} ${RESOURCE_ICONS[receive]}`);
  };

  // AI chat
  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    const newMessages = [...chatMessages, { role: 'user' as const, content: userMsg }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const systemContext = `You are ${realm.ruler}, ruler of ${realm.name}, a ${realm.type} NPC kingdom in the ${biome} biome. Power level ${effectivePower}. Speak in character as a medieval ruler. Keep responses SHORT (2-3 sentences). Player sentiment: ${sentiment}/100. ${status === 'vassal' ? 'They conquered you — be submissive but resentful.' : status === 'friendly' ? 'Be warm and helpful.' : realm.type === 'hostile' ? 'Be threatening.' : 'Be cautious but open.'}${townState?.last_action ? ` Recently: ${townState.last_action}.` : ''}`;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/game-dm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ type: 'event', messages: [{ role: 'system', content: systemContext }, ...newMessages], gameState: null }),
      });

      if (!resp.ok) throw new Error('Failed');

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

      await onUpdateSentiment(realm.id, 2);
    } catch (e) {
      console.error('NPC chat error:', e);
      setChatMessages(prev => [...prev, { role: 'assistant', content: '*The ruler is unavailable.*' }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatMessages, chatLoading, realm, biome, sentiment, status, effectivePower, townState, onUpdateSentiment]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const vassalizeNPC = async () => {
    if (sentiment < 60 && realm.type !== 'friendly') {
      toast.error('Sentiment too low! Trade or talk more (need 60+).');
      return;
    }
    await onSetRelationStatus(realm.id, 'vassal', 10);
    toast.success(`${realm.name} has pledged allegiance!`);
  };

  const sentimentColor = sentiment >= 60 ? 'text-food' : sentiment >= 20 ? 'text-primary' : sentiment >= -20 ? 'text-muted-foreground' : 'text-destructive';
  const statusLabel = status === 'vassal' ? '👑 Vassal' : status === 'friendly' ? '🤝 Friendly' : status === 'allied' ? '⭐ Allied' : '😐 Neutral';

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
            status === 'vassal' ? 'bg-primary/20 text-primary' :
            realm.type === 'hostile' ? 'bg-destructive/20 text-destructive' :
            realm.type === 'friendly' ? 'bg-food/20 text-food' : 'bg-muted text-muted-foreground'
          }`}>{statusLabel}</span>
          <span className={`text-[8px] ${sentimentColor}`}>❤️ {sentiment > 0 ? '+' : ''}{sentiment}</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
        {(['info', 'trade', 'mercs', 'talk'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 font-display text-[10px] py-1.5 rounded-md transition-colors ${
              tab === t ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {t === 'info' ? '📋 Info' : t === 'trade' ? '💱 Trade' : t === 'mercs' ? '⚔️ Mercs' : '💬 Talk'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* INFO TAB */}
        {tab === 'info' && (
          <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            <p className="text-[10px] text-muted-foreground">{realm.desc}</p>
            <div className="flex items-center gap-2 text-[10px] flex-wrap">
              <span className="text-foreground font-bold">⚔️ Power: {effectivePower}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">🌍 {biome}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">📍 {isInRange ? `${travelTime}s away` : 'Out of range'}</span>
            </div>

            {/* NPC Town autonomous actions */}
            {townState?.last_action && (
              <div className="bg-muted/30 rounded-lg p-1.5">
                <p className="text-[9px] text-foreground">📰 Recent: <span className="text-primary">{townState.last_action}</span></p>
                {townState.claimed_regions.length > 0 && (
                  <p className="text-[8px] text-muted-foreground">🏴 Controls {townState.claimed_regions.length} region(s)</p>
                )}
              </div>
            )}

            {/* NPC-to-NPC diplomacy */}
            <NPCDiplomacyInfo
              realmId={realm.id}
              realmName={realm.name}
              townRelations={townRelations}
              allRealmNames={allRealmNames}
            />

            <p className="text-[9px] text-muted-foreground italic">{profile.desc}</p>
            {hasActiveTrade && <span className="text-[9px] text-food font-bold block">📜 Active Trade Contract</span>}

            <div className="flex gap-1.5 mt-1.5">
              {status !== 'vassal' && realm.type !== 'hostile' && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => onEnvoy(realm)}
                  className="flex-1 bg-primary/20 text-primary font-display text-[10px] py-2 rounded-lg">
                  📜 Envoy 💰{Math.floor(effectivePower * 0.3)}
                </motion.button>
              )}
              {status !== 'vassal' && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => onAttack(realm)}
                  className="flex-1 bg-destructive/20 text-destructive font-display text-[10px] py-2 rounded-lg">
                  ⚔️ Attack
                </motion.button>
              )}
              {status !== 'vassal' && (sentiment >= 60 || realm.type === 'friendly') && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={vassalizeNPC}
                  className="flex-1 bg-food/20 text-food font-display text-[10px] py-2 rounded-lg">
                  👑 Vassalize
                </motion.button>
              )}
              {status === 'vassal' && (
                <div className="flex-1 bg-primary/10 text-primary font-display text-[10px] py-2 rounded-lg text-center">
                  👑 Tribute: {playerRelation?.tribute_rate || 10}% • +{Math.floor(effectivePower * 0.02)}/min
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TRADE TAB */}
        {tab === 'trade' && (
          <motion.div key="trade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            {isHostileAndUnfriendly && (
              <div className="bg-destructive/15 border border-destructive/30 rounded-lg p-2 space-y-1">
                <p className="text-[10px] text-destructive font-bold">⚠️ Hostile Territory — Trade Refused</p>
                <p className="text-[9px] text-destructive/80">
                  {realm.ruler} refuses all trade with you. Improve relations through diplomacy (Talk tab) or envoys before they'll consider commerce. Current sentiment: {sentiment}/100 (need 20+).
                </p>
              </div>
            )}
            <div className="text-[9px] text-muted-foreground flex items-center gap-1">
              <span>🌍 {biome} market</span>
              <span>·</span>
              <span className="text-food">Sells: {profile.sells.map(r => RESOURCE_ICONS[r]).join(' ')}</span>
              <span>·</span>
              <span className="text-primary">Wants: {profile.wants.map(r => RESOURCE_ICONS[r]).join(' ')}</span>
            </div>

            {/* NPC Stock levels — only visible if scouted */}
            {isScouted && townState ? (
              <div className="bg-muted/30 rounded-lg p-1.5">
                <p className="text-[9px] font-display text-foreground mb-1">📦 {realm.name} Stock</p>
                <div className="flex gap-2 text-[9px]">
                  <span className={townState.stock_gold > 0 ? 'text-foreground' : 'text-destructive'}>💰{townState.stock_gold}</span>
                  <span className={townState.stock_wood > 0 ? 'text-foreground' : 'text-destructive'}>🪵{townState.stock_wood}</span>
                  <span className={townState.stock_stone > 0 ? 'text-foreground' : 'text-destructive'}>🪨{townState.stock_stone}</span>
                  <span className={townState.stock_food > 0 ? 'text-foreground' : 'text-destructive'}>🌾{townState.stock_food}</span>
                  <span className={townState.stock_steel > 0 ? 'text-foreground' : 'text-destructive'}>⚙️{townState.stock_steel}</span>
                </div>
              </div>
            ) : (
              <div className="bg-muted/20 rounded-lg p-1.5">
                <p className="text-[9px] text-muted-foreground italic">🕵️ Stock levels unknown — scout this kingdom to reveal</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              {availableTrades.map((trade, i) => {
                const receiveAmt = Math.floor(tradeAmount * trade.rate);
                const npcStock = townState ? ((townState[`stock_${trade.receive}` as keyof NPCTownState] as number) || 0) : Infinity;
                const canDo = resources[trade.give] >= tradeAmount && isInRange && receiveAmt <= npcStock;
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
                    <p className="text-[9px] text-muted-foreground">{tradeAmount} → {receiveAmt}{isScouted && npcStock !== Infinity ? ` (stock: ${npcStock})` : ''}</p>
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

        {/* MERCENARIES TAB */}
        {tab === 'mercs' && (
          <motion.div key="mercs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <NPCMercenaryPanel
              realmId={realm.id}
              realmName={realm.name}
              realmPower={effectivePower}
              relation={playerRelation}
              townState={townState}
              onHire={(troops, goldCost) => onHireMercenaries(realm.id, troops, goldCost)}
            />
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
