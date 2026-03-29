import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGame, Resources } from '@/hooks/useGameState';
import { toast } from 'sonner';

// Special message types encoded as JSON in content field
interface TradeOffer {
  type: 'trade_offer';
  offer: Partial<Resources & { steel: number }>;
  request: Partial<Resources & { steel: number }>;
  status: 'pending' | 'accepted' | 'declined';
  id: string; // unique trade id
}

interface GuildInvite {
  type: 'guild_invite';
  allianceId: string;
  allianceName: string;
  allianceTag: string;
  status: 'pending' | 'accepted' | 'declined';
  id: string;
}

type SpecialContent = TradeOffer | GuildInvite;

function parseSpecialContent(content: string): SpecialContent | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.type === 'trade_offer' || parsed.type === 'guild_invite') return parsed;
  } catch { /* not special */ }
  return null;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
  sender_name?: string;
}

interface MessagesPanelProps {
  initialDm?: { userId: string; name: string } | null;
  onDmHandled?: () => void;
}

const RES_ICONS: Record<string, string> = { gold: '💰', wood: '🪵', stone: '🪨', food: '🌾', steel: '⚙️' };

export default function MessagesPanel({ initialDm, onDmHandled }: MessagesPanelProps) {
  const { user } = useAuth();
  const { allVillages, resources, steel, addResources, addSteel } = useGame();
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [newMsg, setNewMsg] = useState('');
  const [newRecipient, setNewRecipient] = useState('');
  const [composing, setComposing] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [showGuildInvite, setShowGuildInvite] = useState(false);
  const [tradeOffer, setTradeOffer] = useState<Partial<Resources & { steel: number }>>({});
  const [tradeRequest, setTradeRequest] = useState<Partial<Resources & { steel: number }>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const profileMap = new Map(allVillages.map(v => [v.village.user_id, v.profile.display_name]));

  useEffect(() => {
    if (initialDm) {
      setActiveConvo(initialDm.userId);
      setComposing(false);
      onDmHandled?.();
    }
  }, [initialDm]);

  useEffect(() => {
    if (!user) return;
    loadMessages();
    const channel = supabase
      .channel('player-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const msg = payload.new as any;
          if (msg.sender_id === user.id || msg.receiver_id === user.id) {
            setMessages(prev => [...prev, { ...msg, sender_name: profileMap.get(msg.sender_id) || 'Unknown' }]);
          }
        } else if (payload.eventType === 'UPDATE') {
          const msg = payload.new as any;
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: msg.content, read: msg.read } : m));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadMessages = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('player_messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: true })
      .limit(200);
    if (data) {
      setMessages(data.map(m => ({ ...m, sender_name: profileMap.get(m.sender_id) || 'Unknown' })));
    }
  };

  const sendMessage = async (content?: string) => {
    if (!user) return;
    const msgContent = content || newMsg.trim();
    if (!msgContent) return;

    let receiverId = activeConvo;
    if (composing) {
      const target = allVillages.find(v => v.profile.display_name.toLowerCase() === newRecipient.toLowerCase());
      if (!target) { toast.error('Player not found'); return; }
      receiverId = target.village.user_id;
      setActiveConvo(receiverId);
      setComposing(false);
    }
    if (!receiverId) return;

    const { error } = await supabase.from('player_messages').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      content: msgContent,
    });
    if (error) { toast.error('Failed to send'); return; }
    if (!content) setNewMsg('');
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
  };

  const sendTradeOffer = async () => {
    if (!activeConvo || !user) return;
    const hasOffer = Object.values(tradeOffer).some(v => v && v > 0);
    const hasRequest = Object.values(tradeRequest).some(v => v && v > 0);
    if (!hasOffer && !hasRequest) { toast.error('Set at least one resource'); return; }

    const trade: TradeOffer = {
      type: 'trade_offer',
      offer: tradeOffer,
      request: tradeRequest,
      status: 'pending',
      id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    await sendMessage(JSON.stringify(trade));
    setShowTradeForm(false);
    setTradeOffer({});
    setTradeRequest({});
    toast.success('Trade offer sent!');
  };

  const sendGuildInvite = async () => {
    if (!activeConvo || !user) return;
    // Find user's alliance
    const { data: membership } = await supabase.from('alliance_members')
      .select('alliance_id, role')
      .eq('user_id', user.id)
      .single();
    if (!membership) { toast.error('You must be in a guild first'); return; }
    if (membership.role !== 'leader' && membership.role !== 'officer') {
      toast.error('Only leaders and officers can invite'); return;
    }
    const { data: alliance } = await supabase.from('alliances')
      .select('id, name, tag')
      .eq('id', membership.alliance_id)
      .single();
    if (!alliance) { toast.error('Guild not found'); return; }

    const invite: GuildInvite = {
      type: 'guild_invite',
      allianceId: alliance.id,
      allianceName: alliance.name,
      allianceTag: alliance.tag,
      status: 'pending',
      id: `invite-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    await sendMessage(JSON.stringify(invite));
    setShowGuildInvite(false);
    toast.success('Guild invite sent!');
  };

  const respondToTrade = async (msgId: string, trade: TradeOffer, accept: boolean) => {
    if (!user) return;
    if (accept) {
      // Check if the responder (receiver) can afford what was requested
      const req = trade.request;
      if ((req.gold || 0) > resources.gold || (req.wood || 0) > resources.wood ||
          (req.stone || 0) > resources.stone || (req.food || 0) > resources.food ||
          (req.steel || 0) > steel) {
        toast.error("You can't afford this trade"); return;
      }
      // Deduct requested resources from receiver, add offered
      addResources({
        gold: (trade.offer.gold || 0) - (req.gold || 0),
        wood: (trade.offer.wood || 0) - (req.wood || 0),
        stone: (trade.offer.stone || 0) - (req.stone || 0),
        food: (trade.offer.food || 0) - (req.food || 0),
      });
      if ((trade.offer.steel || 0) > 0) addSteel(trade.offer.steel || 0);
      if ((req.steel || 0) > 0) addSteel(-(req.steel || 0));
      toast.success('Trade accepted! Resources exchanged.');
    }
    // Update the message content with new status
    const updated = { ...trade, status: accept ? 'accepted' : 'declined' } as TradeOffer;
    await supabase.from('player_messages').update({ content: JSON.stringify(updated) }).eq('id', msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: JSON.stringify(updated) } : m));
  };

  const respondToGuildInvite = async (msgId: string, invite: GuildInvite, accept: boolean) => {
    if (!user) return;
    if (accept) {
      // Check if already in a guild
      const { data: existing } = await supabase.from('alliance_members')
        .select('id').eq('user_id', user.id).maybeSingle();
      if (existing) { toast.error('You are already in a guild'); return; }
      const { error } = await supabase.from('alliance_members').insert({
        alliance_id: invite.allianceId,
        user_id: user.id,
      });
      if (error) { toast.error('Failed to join guild'); return; }
      toast.success(`Joined [${invite.allianceTag}] ${invite.allianceName}!`);
    }
    const updated = { ...invite, status: accept ? 'accepted' : 'declined' } as GuildInvite;
    await supabase.from('player_messages').update({ content: JSON.stringify(updated) }).eq('id', msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: JSON.stringify(updated) } : m));
  };

  // Group conversations
  const conversations = new Map<string, Message[]>();
  messages.forEach(m => {
    const otherId = m.sender_id === user?.id ? m.receiver_id : m.sender_id;
    if (!conversations.has(otherId)) conversations.set(otherId, []);
    conversations.get(otherId)!.push(m);
  });

  const convoList = Array.from(conversations.entries()).map(([id, msgs]) => ({
    id,
    name: profileMap.get(id) || 'Unknown',
    lastMsg: msgs[msgs.length - 1],
    unread: msgs.filter(m => m.receiver_id === user?.id && !m.read).length,
  })).sort((a, b) => new Date(b.lastMsg.created_at).getTime() - new Date(a.lastMsg.created_at).getTime());

  const activeMessages = activeConvo ? (conversations.get(activeConvo) || []) : [];

  // Mark as read
  useEffect(() => {
    if (!user || !activeConvo) return;
    const unread = activeMessages.filter(m => m.receiver_id === user.id && !m.read);
    if (unread.length > 0) {
      unread.forEach(m => {
        supabase.from('player_messages').update({ read: true }).eq('id', m.id).then();
      });
      setMessages(prev => prev.map(m =>
        m.receiver_id === user.id && m.sender_id === activeConvo && !m.read
          ? { ...m, read: true } : m
      ));
    }
  }, [activeConvo, activeMessages.length]);

  const getConvoPreview = (msg: Message) => {
    const special = parseSpecialContent(msg.content);
    if (special?.type === 'trade_offer') return '📦 Trade Offer';
    if (special?.type === 'guild_invite') return `🤝 Guild Invite: [${special.allianceTag}]`;
    return msg.content;
  };

  const renderMessage = (msg: Message) => {
    const special = parseSpecialContent(msg.content);
    const isMine = msg.sender_id === user?.id;
    const isReceiver = msg.receiver_id === user?.id;

    if (special?.type === 'trade_offer') {
      const trade = special;
      return (
        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] rounded-xl p-3 border ${
            trade.status === 'accepted' ? 'border-primary/40 bg-primary/10' :
            trade.status === 'declined' ? 'border-destructive/40 bg-destructive/10' :
            'border-border bg-secondary'
          }`}>
            <p className="font-display text-xs text-foreground mb-1.5">📦 Trade Offer</p>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <p className="text-muted-foreground mb-0.5">{isMine ? 'You offer' : 'They offer'}:</p>
                {Object.entries(trade.offer).filter(([, v]) => v && v > 0).map(([k, v]) => (
                  <span key={k} className="text-primary mr-1.5">{RES_ICONS[k] || k}{v}</span>
                ))}
                {!Object.values(trade.offer).some(v => v && v > 0) && <span className="text-muted-foreground">Nothing</span>}
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">{isMine ? 'You want' : 'They want'}:</p>
                {Object.entries(trade.request).filter(([, v]) => v && v > 0).map(([k, v]) => (
                  <span key={k} className="text-destructive mr-1.5">{RES_ICONS[k] || k}{v}</span>
                ))}
                {!Object.values(trade.request).some(v => v && v > 0) && <span className="text-muted-foreground">Nothing</span>}
              </div>
            </div>
            {trade.status === 'pending' && isReceiver && (
              <div className="flex gap-2 mt-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => respondToTrade(msg.id, trade, true)}
                  className="flex-1 bg-primary text-primary-foreground text-[10px] py-1.5 rounded-lg font-display">✅ Accept</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => respondToTrade(msg.id, trade, false)}
                  className="flex-1 bg-destructive/20 text-destructive text-[10px] py-1.5 rounded-lg font-display">❌ Decline</motion.button>
              </div>
            )}
            {trade.status !== 'pending' && (
              <p className={`text-[9px] mt-1.5 font-bold ${trade.status === 'accepted' ? 'text-primary' : 'text-destructive'}`}>
                {trade.status === 'accepted' ? '✅ Accepted' : '❌ Declined'}
              </p>
            )}
            <p className={`text-[8px] mt-1 ${isMine ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      );
    }

    if (special?.type === 'guild_invite') {
      const invite = special;
      return (
        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] rounded-xl p-3 border ${
            invite.status === 'accepted' ? 'border-primary/40 bg-primary/10' :
            invite.status === 'declined' ? 'border-destructive/40 bg-destructive/10' :
            'border-border bg-secondary'
          }`}>
            <p className="font-display text-xs text-foreground mb-1">🤝 Guild Invite</p>
            <p className="text-[10px] text-foreground">
              {isMine ? 'You invited them' : 'You are invited'} to join <strong>[{invite.allianceTag}] {invite.allianceName}</strong>
            </p>
            {invite.status === 'pending' && isReceiver && (
              <div className="flex gap-2 mt-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => respondToGuildInvite(msg.id, invite, true)}
                  className="flex-1 bg-primary text-primary-foreground text-[10px] py-1.5 rounded-lg font-display">✅ Join</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => respondToGuildInvite(msg.id, invite, false)}
                  className="flex-1 bg-destructive/20 text-destructive text-[10px] py-1.5 rounded-lg font-display">❌ Decline</motion.button>
              </div>
            )}
            {invite.status !== 'pending' && (
              <p className={`text-[9px] mt-1.5 font-bold ${invite.status === 'accepted' ? 'text-primary' : 'text-destructive'}`}>
                {invite.status === 'accepted' ? '✅ Joined!' : '❌ Declined'}
              </p>
            )}
            <p className="text-[8px] mt-1 text-muted-foreground">
              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      );
    }

    // Regular text message
    return (
      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[75%] rounded-xl px-3 py-2 ${
          isMine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-secondary text-foreground rounded-bl-sm'
        }`}>
          <p className="text-xs">{msg.content}</p>
          <p className={`text-[8px] mt-0.5 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  };

  const ResourceInput = ({ label, values, onChange }: { label: string; values: Partial<Resources & { steel: number }>; onChange: (v: Partial<Resources & { steel: number }>) => void }) => (
    <div>
      <p className="text-[9px] text-muted-foreground mb-1">{label}</p>
      <div className="grid grid-cols-5 gap-1">
        {(['gold', 'wood', 'stone', 'food', 'steel'] as const).map(key => (
          <div key={key} className="flex flex-col items-center">
            <span className="text-[10px]">{RES_ICONS[key]}</span>
            <input type="number" min={0} value={values[key] || ''} placeholder="0"
              onChange={e => onChange({ ...values, [key]: parseInt(e.target.value) || 0 })}
              className="w-full bg-muted border border-border rounded text-[10px] text-foreground text-center py-0.5 px-0.5" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-foreground text-shadow-gold">
          {activeConvo ? `💬 ${profileMap.get(activeConvo) || 'Unknown'}` : '📨 Messages'}
        </h2>
        <div className="flex gap-2">
          {activeConvo && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setActiveConvo(null); setComposing(false); setShowTradeForm(false); setShowGuildInvite(false); }}
              className="text-xs text-primary bg-primary/10 px-3 py-1 rounded-lg">← Back</motion.button>
          )}
          {!activeConvo && !composing && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setComposing(true)}
              className="text-xs text-primary-foreground bg-primary px-3 py-1 rounded-lg">✏️ New</motion.button>
          )}
        </div>
      </div>

      {composing && !activeConvo && (
        <div className="game-panel border-glow rounded-xl p-3 space-y-2">
          <input type="text" placeholder="Recipient username..." value={newRecipient}
            onChange={e => setNewRecipient(e.target.value)}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
          <div className="flex gap-2">
            <input type="text" placeholder="Message..." value={newMsg} onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => sendMessage()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-display">Send</motion.button>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setComposing(false)}
            className="text-xs text-muted-foreground">Cancel</motion.button>
        </div>
      )}

      {!activeConvo && !composing && (
        <div className="space-y-2">
          {convoList.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Send one from the Map!</p>
          )}
          {convoList.map(convo => (
            <motion.button key={convo.id} whileTap={{ scale: 0.98 }}
              onClick={() => setActiveConvo(convo.id)}
              className="w-full game-panel border-glow rounded-xl p-3 flex items-center justify-between text-left">
              <div className="flex-1 min-w-0">
                <p className="font-display text-sm text-foreground">{convo.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{getConvoPreview(convo.lastMsg)}</p>
              </div>
              <div className="flex flex-col items-end gap-1 ml-2">
                <span className="text-[9px] text-muted-foreground">
                  {new Date(convo.lastMsg.created_at).toLocaleDateString()}
                </span>
                {convo.unread > 0 && (
                  <span className="bg-primary text-primary-foreground text-[9px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {convo.unread}
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {activeConvo && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {activeMessages.map(renderMessage)}
          </div>

          {/* Trade form */}
          <AnimatePresence>
            {showTradeForm && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="game-panel border-glow rounded-xl p-3 space-y-2 overflow-hidden">
                <h4 className="font-display text-xs text-foreground">📦 New Trade Offer</h4>
                <ResourceInput label="You offer:" values={tradeOffer} onChange={setTradeOffer} />
                <ResourceInput label="You want:" values={tradeRequest} onChange={setTradeRequest} />
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={sendTradeOffer}
                    className="flex-1 bg-primary text-primary-foreground text-[10px] py-1.5 rounded-lg font-display">Send Offer</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowTradeForm(false)}
                    className="text-[10px] text-muted-foreground px-3 py-1.5">Cancel</motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action bar */}
          <div className="flex gap-1.5 mb-1">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setShowTradeForm(!showTradeForm); setShowGuildInvite(false); }}
              className={`text-[9px] px-2 py-1 rounded-lg font-display ${showTradeForm ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground border border-border'}`}>
              📦 Trade
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setShowGuildInvite(false); sendGuildInvite(); }}
              className="text-[9px] px-2 py-1 rounded-lg font-display bg-secondary text-foreground border border-border">
              🤝 Guild Invite
            </motion.button>
          </div>

          <div className="flex gap-2">
            <input type="text" placeholder="Type a message..." value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => sendMessage()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-display">Send</motion.button>
          </div>
        </>
      )}
    </div>
  );
}
