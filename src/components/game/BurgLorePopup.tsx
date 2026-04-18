import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SettlementLore {
  id: string;
  burg_id: number;
  burg_name: string;
  state_name: string;
  ruler_name: string;
  ruler_title: string;
  dynasty_name: string;
  lineage: { name: string; title: string; note: string }[];
  kingdom_hierarchy: {
    sovereign?: string;
    sovereign_seat?: string;
    liege?: string;
    liege_title?: string;
    this_ruler_rank?: string;
  };
  settlement_history: string;
  ruler_personality: string;
  notable_facts: string[];
}

interface BurgPayload {
  burg_id: number;
  burg_name: string;
  state_id: number;
  state_name: string;
  culture_name: string;
  burg_type: string;
  population: number;
  has_walls: boolean;
  has_port: boolean;
  has_temple: boolean;
  has_citadel: boolean;
  is_capital: boolean;
}

export default function BurgLorePopup({ burg }: { burg: BurgPayload }) {
  const [lore, setLore] = useState<SettlementLore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Try cache first (cheap read)
    supabase
      .from('npc_settlement_lore')
      .select('*')
      .eq('burg_id', burg.burg_id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) setLore(data as unknown as SettlementLore);
      });
    return () => { cancelled = true; };
  }, [burg.burg_id]);

  async function fetchLore() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('generate-settlement-lore', {
        body: burg,
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setLore(data.lore);
      setHasFetched(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to summon ruler';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!lore && !loading && !hasFetched) {
    return (
      <div className="text-center space-y-2 min-w-[220px]">
        <strong className="text-sm block">{burg.burg_name}</strong>
        <p className="text-[10px] opacity-70">
          {burg.state_name} · Pop {burg.population.toLocaleString()}
          {burg.is_capital && ' · 👑 Capital'}
        </p>
        <button
          onClick={fetchLore}
          className="w-full bg-primary/20 hover:bg-primary/30 text-primary text-[11px] font-display py-1.5 rounded-md transition-colors"
        >
          🗣️ Speak with the Ruler
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center space-y-1 min-w-[220px] py-3">
        <div className="text-xl animate-pulse">📜</div>
        <p className="text-[10px] opacity-70">A herald rides forth…</p>
      </div>
    );
  }

  if (error && !lore) {
    return (
      <div className="text-center space-y-2 min-w-[220px]">
        <p className="text-[11px] text-destructive">{error}</p>
        <button onClick={fetchLore} className="text-[10px] underline opacity-70">Try again</button>
      </div>
    );
  }

  if (!lore) return null;

  const h = lore.kingdom_hierarchy || {};
  return (
    <div className="space-y-2 min-w-[260px] max-w-[280px] max-h-[60vh] overflow-y-auto pr-1">
      <div className="border-b border-border/40 pb-1.5">
        <strong className="text-sm block">{lore.burg_name}</strong>
        <p className="text-[10px] opacity-70">
          {lore.state_name} · Pop {burg.population.toLocaleString()}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-display text-primary">
          {lore.ruler_title} {lore.ruler_name}
        </p>
        <p className="text-[10px] opacity-80">of {lore.dynasty_name}</p>
        <p className="text-[10px] italic opacity-70 mt-1 leading-snug">{lore.ruler_personality}</p>
      </div>

      <div className="bg-muted/30 rounded p-1.5 space-y-0.5">
        <p className="text-[9px] font-display uppercase tracking-wide opacity-60">Hierarchy</p>
        {h.sovereign && (
          <p className="text-[10px]">
            👑 <span className="opacity-70">Sovereign:</span> {h.sovereign}
            {h.sovereign_seat && <span className="opacity-50"> ({h.sovereign_seat})</span>}
          </p>
        )}
        {h.liege && h.liege !== h.sovereign && (
          <p className="text-[10px]">
            ⚔️ <span className="opacity-70">{h.liege_title || 'Liege'}:</span> {h.liege}
          </p>
        )}
        {h.this_ruler_rank && (
          <p className="text-[10px]">
            🏛️ <span className="opacity-70">Standing:</span> {h.this_ruler_rank}
          </p>
        )}
      </div>

      <div>
        <p className="text-[9px] font-display uppercase tracking-wide opacity-60 mb-0.5">History</p>
        <p className="text-[10px] leading-snug opacity-85">{lore.settlement_history}</p>
      </div>

      {lore.lineage?.length > 0 && (
        <div>
          <p className="text-[9px] font-display uppercase tracking-wide opacity-60 mb-0.5">Lineage</p>
          <ul className="space-y-0.5">
            {lore.lineage.map((a, i) => (
              <li key={i} className="text-[10px] leading-snug">
                <span className="opacity-90">{a.title} {a.name}</span>
                <span className="opacity-60"> — {a.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lore.notable_facts?.length > 0 && (
        <div>
          <p className="text-[9px] font-display uppercase tracking-wide opacity-60 mb-0.5">Whispers</p>
          <ul className="list-disc list-inside space-y-0.5">
            {lore.notable_facts.map((f, i) => (
              <li key={i} className="text-[10px] leading-snug opacity-80">{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
