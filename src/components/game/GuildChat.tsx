import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGame } from '@/hooks/useGameState';

interface GuildMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export default function GuildChat({ allianceId }: { allianceId: string }) {
  const { user } = useAuth();
  const { allVillages } = useGame();
  const [messages, setMessages] = useState<GuildMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const profileMap = new Map(allVillages.map(v => [v.village.user_id, v.profile.display_name]));

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`guild-chat-${allianceId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'alliance_messages',
        filter: `alliance_id=eq.${allianceId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as GuildMessage]);
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [allianceId]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('alliance_messages')
      .select('*')
      .eq('alliance_id', allianceId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (data) setMessages(data);
  };

  const send = async () => {
    if (!user || !newMsg.trim()) return;
    await supabase.from('alliance_messages').insert({
      alliance_id: allianceId,
      sender_id: user.id,
      content: newMsg.trim(),
    });
    setNewMsg('');
  };

  return (
    <div className="game-panel border-glow rounded-xl p-3 space-y-2">
      <h3 className="font-display text-sm text-foreground">💬 Guild Chat</h3>
      <div ref={scrollRef} className="h-40 overflow-y-auto space-y-1.5 bg-secondary/30 rounded-lg p-2">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No messages yet</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.sender_id === user?.id ? 'items-end' : 'items-start'}`}>
            <span className="text-sm text-muted-foreground font-display">
              {profileMap.get(msg.sender_id) || 'Unknown'}
            </span>
            <div className={`rounded-lg px-3 py-2 max-w-[80%] ${
              msg.sender_id === user?.id ? 'bg-primary/20 text-foreground' : 'bg-muted text-foreground'
            }`}>
              <p className="text-[11px]">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <input type="text" placeholder="Chat..." value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground" />
        <motion.button whileTap={{ scale: 0.95 }} onClick={send}
          className="wood-btn-primary px-4 py-2.5 rounded-lg text-sm font-display">Send</motion.button>
      </div>
    </div>
  );
}
