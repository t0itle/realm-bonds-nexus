import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '@/hooks/useGameState';
import { Send, Scroll, Sparkles } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };

const DM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/game-dm`;

function buildGameState(game: ReturnType<typeof useGame>) {
  return {
    villageName: game.villageName,
    playerLevel: game.playerLevel,
    gold: game.resources.gold,
    wood: game.resources.wood,
    stone: game.resources.stone,
    food: game.resources.food,
    steel: game.steel,
    population: game.population.current,
    maxPopulation: game.population.max,
    happiness: game.population.happiness,
    taxRate: game.popTaxRate,
    rations: game.rations,
    militia: game.army.militia,
    archers: game.army.archer,
    knights: game.army.knight,
    cavalry: game.army.cavalry,
    siege: game.army.siege,
    scouts: game.army.scout,
    totalTroops: Object.values(game.army).reduce((s, v) => s + v, 0),
    buildings: game.buildings.filter(b => b.type !== 'empty').map(b => `${b.type} Lv${b.level}`).join(', '),
  };
}

async function streamDM(
  messages: Msg[],
  gameState: any,
  type: 'chat' | 'event',
  onDelta: (text: string) => void,
  onDone: () => void,
  signal?: AbortSignal,
) {
  const resp = await fetch(DM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, gameState, type }),
    signal,
  });

  if (!resp.ok || !resp.body) {
    const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to reach the oracle');
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch { /* partial */ }
    }
  }
  onDone();
}

// Thresholds for automatic events
function detectEvents(game: ReturnType<typeof useGame>): string | null {
  if (game.resources.food <= 10 && game.population.current > 5) return 'The granaries are nearly empty! The people cry out for food. What counsel do you offer?';
  if (game.resources.gold <= 10) return 'The treasury coffers echo with emptiness. Gold reserves are critically low.';
  if (game.population.happiness <= 20) return 'Discontent festers among the populace. Happiness has fallen dangerously low. The people whisper of rebellion.';
  if (game.population.current >= game.population.max * 0.95 && game.population.max > 10) return 'The village bursts at the seams — housing is at maximum capacity!';
  return null;
}

export default function DungeonMasterPanel() {
  const game = useGame();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [eventBanner, setEventBanner] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastEventRef = useRef<string | null>(null);
  const initRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
  }, []);

  // Auto-detect events every 30s
  useEffect(() => {
    const check = () => {
      const event = detectEvents(game);
      if (event && event !== lastEventRef.current) {
        lastEventRef.current = event;
        setEventBanner(event);
        // Auto-dismiss after 10s
        setTimeout(() => setEventBanner(null), 10000);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [game.resources, game.population]);

  // Welcome message on first mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const welcome: Msg = {
      role: 'assistant',
      content: `⚜️ *Greetings, my liege.* I am the Oracle of the Realm — your counsel in times of war and peace alike. Ask me anything about your kingdom, or I shall watch over it and warn you of dangers ahead.`,
    };
    setMessages([welcome]);
  }, []);

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content || isLoading) return;
    setInput('');

    const userMsg: Msg = { role: 'user', content };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setIsLoading(true);
    scrollToBottom();

    let assistantSoFar = '';
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && prev.length > newMsgs.length) {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
      scrollToBottom();
    };

    try {
      await streamDM(
        newMsgs.slice(-10), // last 10 messages for context
        buildGameState(game),
        'chat',
        upsert,
        () => setIsLoading(false),
      );
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `🔮 *The oracle falters...* ${e.message}` }]);
      setIsLoading(false);
    }
  };

  const handleEventClick = () => {
    if (eventBanner) {
      sendMessage(eventBanner);
      setEventBanner(null);
    }
  };

  return (
    <div className="flex flex-col h-full p-2 gap-3 parchment-panel rounded-xl">
      {/* Event Banner */}
      <AnimatePresence>
        {eventBanner && (
          <motion.button
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onClick={handleEventClick}
            className="game-panel p-3 text-left border border-primary/30 bg-primary/5 rounded-lg flex items-start gap-3"
          >
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-display text-primary font-bold">⚡ Kingdom Event</p>
              <p className="text-sm text-muted-foreground mt-1">{eventBanner}</p>
              <p className="text-sm text-primary/60 mt-1">Tap to consult the Oracle</p>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'game-panel border border-border/50'
            }`}>
              {msg.role === 'assistant' && <Scroll className="w-3 h-3 text-primary inline mr-1 mb-0.5" />}
              <span className="whitespace-pre-wrap">{msg.content}</span>
            </div>
          </motion.div>
        ))}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="game-panel border border-border/50 rounded-xl px-4 py-3 text-sm">
              <span className="animate-pulse">🔮 The oracle gazes into the beyond...</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        {['How is my kingdom?', 'Military advice', 'What should I build?'].map(q => (
          <button
            key={q}
            onClick={() => sendMessage(q)}
            disabled={isLoading}
            className="text-sm px-3 py-2 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-3 items-center">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Speak to the Oracle..."
          disabled={isLoading}
          className="flex-1 bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage()}
          disabled={isLoading || !input.trim()}
          className="p-2 rounded-lg wood-btn-primary disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
