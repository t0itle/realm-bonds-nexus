import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGame } from '@/hooks/useGameState';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
  sender_name?: string;
}

export default function MessagesPanel() {
  const { user } = useAuth();
  const { allVillages } = useGame();
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [newMsg, setNewMsg] = useState('');
  const [newRecipient, setNewRecipient] = useState('');
  const [composing, setComposing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const profileMap = new Map(allVillages.map(v => [v.village.user_id, v.profile.display_name]));

  useEffect(() => {
    if (!user) return;
    loadMessages();

    const channel = supabase
      .channel('player-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'player_messages' }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id === user.id || msg.receiver_id === user.id) {
          setMessages(prev => [...prev, { ...msg, sender_name: profileMap.get(msg.sender_id) || 'Unknown' }]);
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

  const sendMessage = async () => {
    if (!user || !newMsg.trim()) return;

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
      content: newMsg.trim(),
    });
    if (error) { toast.error('Failed to send'); return; }
    setNewMsg('');
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
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

  return (
    <div className="flex-1 flex flex-col p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-foreground text-shadow-gold">
          {activeConvo ? `💬 ${profileMap.get(activeConvo) || 'Unknown'}` : '📨 Messages'}
        </h2>
        <div className="flex gap-2">
          {activeConvo && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setActiveConvo(null); setComposing(false); }}
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
            <motion.button whileTap={{ scale: 0.95 }} onClick={sendMessage}
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
                <p className="text-[10px] text-muted-foreground truncate">{convo.lastMsg.content}</p>
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
            {activeMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-xl px-3 py-2 ${
                  msg.sender_id === user?.id
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-secondary text-foreground rounded-bl-sm'
                }`}>
                  <p className="text-xs">{msg.content}</p>
                  <p className={`text-[8px] mt-0.5 ${msg.sender_id === user?.id ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="Type a message..." value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
            <motion.button whileTap={{ scale: 0.95 }} onClick={sendMessage}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-display">Send</motion.button>
          </div>
        </>
      )}
    </div>
  );
}
