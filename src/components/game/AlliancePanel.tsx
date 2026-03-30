import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AllianceResourceSharing from './AllianceResourceSharing';
import GuildChat from './GuildChat';
import GuildTaxPanel from './GuildTaxPanel';
import GuildContracts from './GuildContracts';
import GuildVoting from './GuildVoting';

interface Alliance {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  leader_id: string;
  memberCount: number;
}

export default function AlliancePanel() {
  const { user } = useAuth();
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [myAlliance, setMyAlliance] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadAlliances();
  }, [user]);

  const loadAlliances = async () => {
    if (!user) return;

    // Check my membership
    const { data: membership } = await supabase
      .from('alliance_members')
      .select('alliance_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (membership) setMyAlliance(membership.alliance_id);

    // Load alliances with member counts
    const { data: als } = await supabase.from('alliances').select('*');
    if (!als) return;

    const withCounts: Alliance[] = [];
    for (const a of als) {
      const { count } = await supabase
        .from('alliance_members')
        .select('*', { count: 'exact', head: true })
        .eq('alliance_id', a.id);
      withCounts.push({ ...a, memberCount: count || 0 });
    }
    setAlliances(withCounts.sort((a, b) => b.memberCount - a.memberCount));
  };

  const createAlliance = async () => {
    if (!user || !name || !tag) return;
    setError('');

    const { data, error: err } = await supabase.from('alliances').insert({
      name,
      tag: tag.toUpperCase(),
      leader_id: user.id,
    }).select().single();

    if (err) {
      setError(err.message);
      return;
    }

    // Add self as leader
    await supabase.from('alliance_members').insert({
      alliance_id: data.id,
      user_id: user.id,
      role: 'leader',
    });

    setMyAlliance(data.id);
    setCreating(false);
    setName('');
    setTag('');
    loadAlliances();
  };

  const joinAlliance = async (allianceId: string) => {
    if (!user || myAlliance) return;
    await supabase.from('alliance_members').insert({
      alliance_id: allianceId,
      user_id: user.id,
      role: 'member',
    });
    setMyAlliance(allianceId);
    loadAlliances();
  };

  const leaveAlliance = async () => {
    if (!user || !myAlliance) return;
    await supabase.from('alliance_members').delete().eq('user_id', user.id);
    setMyAlliance(null);
    loadAlliances();
  };

  return (
    <div className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
      <h2 className="font-display text-lg text-foreground text-shadow-gold">Guild</h2>

      {/* Your alliance status */}
      <div className="game-panel border-glow rounded-xl p-4 text-center space-y-2">
        {myAlliance ? (
          <>
            <p className="text-sm text-foreground font-display">
              {alliances.find(a => a.id === myAlliance)?.name || 'Your Alliance'}
            </p>
            <p className="text-xs text-muted-foreground">
              [{alliances.find(a => a.id === myAlliance)?.tag}]
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={leaveAlliance}
              className="bg-destructive/20 text-destructive font-display text-xs py-1.5 px-4 rounded-lg"
            >
              Leave Alliance
            </motion.button>
          </>
        ) : creating ? (
          <div className="space-y-2 text-left">
            <input
              type="text"
              placeholder="Alliance Name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            />
            <input
              type="text"
              placeholder="Tag (2-5 chars)"
              value={tag}
              maxLength={5}
              onChange={e => setTag(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.95 }} onClick={createAlliance}
                className="flex-1 bg-primary text-primary-foreground font-display text-sm py-2 rounded-lg glow-gold">
                Create
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setCreating(false)}
                className="flex-1 bg-muted text-muted-foreground font-display text-sm py-2 rounded-lg">
                Cancel
              </motion.button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">You are not in an alliance</p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setCreating(true)}
              className="bg-primary text-primary-foreground font-display text-sm py-2 px-6 rounded-lg glow-gold"
            >
              Create Alliance
            </motion.button>
          </>
        )}
      </div>

      {/* Guild features for members */}
      {myAlliance && (
        <>
          <GuildChat allianceId={myAlliance} />
          <GuildTaxPanel allianceId={myAlliance} isLeader={alliances.find(a => a.id === myAlliance)?.leader_id === user?.id} />
          <GuildVoting allianceId={myAlliance} isLeader={alliances.find(a => a.id === myAlliance)?.leader_id === user?.id} />
          <GuildContracts allianceId={myAlliance} isLeader={alliances.find(a => a.id === myAlliance)?.leader_id === user?.id} />
          <AllianceResourceSharing allianceId={myAlliance} />
        </>
      )}

      {/* Alliance rankings */}
      <div>
        <h3 className="font-display text-sm text-foreground mb-2">
          {alliances.length > 0 ? 'Active Alliances' : 'No alliances yet — be the first!'}
        </h3>
        <div className="space-y-2">
          {alliances.map((alliance, i) => (
            <motion.div
              key={alliance.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="game-panel border-glow rounded-xl p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-primary font-display text-sm font-bold w-5">#{i + 1}</span>
                <div>
                  <p className="font-display text-xs text-foreground">{alliance.name}</p>
                  <p className="text-[10px] text-muted-foreground">[{alliance.tag}] • {alliance.memberCount} members</p>
                </div>
              </div>
              {!myAlliance && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => joinAlliance(alliance.id)}
                  className="bg-primary/20 text-primary font-display text-[10px] py-1 px-3 rounded-lg"
                >
                  Join
                </motion.button>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
