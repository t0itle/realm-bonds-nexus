import { NPCTownRelation } from '@/hooks/useNPCState';

interface Props {
  realmId: string;
  realmName: string;
  townRelations: NPCTownRelation[];
  allRealmNames: Map<string, string>; // id -> name for display
}

const RELATION_STYLES: Record<string, { label: string; emoji: string; color: string }> = {
  allied: { label: 'Allied', emoji: '🤝', color: 'text-food' },
  hostile: { label: 'Hostile', emoji: '⚔️', color: 'text-destructive' },
  war: { label: 'At War', emoji: '🔥', color: 'text-destructive' },
  vassal: { label: 'Vassal of', emoji: '👑', color: 'text-primary' },
  neutral: { label: 'Neutral', emoji: '😐', color: 'text-muted-foreground' },
};

export default function NPCDiplomacyInfo({ realmId, realmName, townRelations, allRealmNames }: Props) {
  // Get all relations involving this realm
  const relations = townRelations.filter(r => r.town_a_id === realmId || r.town_b_id === realmId);

  if (relations.length === 0) {
    return (
      <div className="text-[9px] text-muted-foreground italic py-1">
        No known diplomatic ties with other realms.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[9px] text-muted-foreground font-bold">🏛️ Diplomatic Relations</p>
      {relations.slice(0, 5).map((rel, i) => {
        const otherId = rel.town_a_id === realmId ? rel.town_b_id : rel.town_a_id;
        const otherName = allRealmNames.get(otherId) || 'Unknown Realm';
        const style = RELATION_STYLES[rel.relation_type] || RELATION_STYLES.neutral;
        return (
          <div key={i} className="flex items-center gap-1.5 text-[9px]">
            <span>{style.emoji}</span>
            <span className={style.color}>{style.label}</span>
            <span className="text-foreground truncate">{otherName}</span>
            {rel.last_event && (
              <span className="text-muted-foreground ml-auto truncate max-w-[80px]" title={rel.last_event}>
                ({rel.last_event})
              </span>
            )}
          </div>
        );
      })}
      {relations.length > 5 && (
        <p className="text-[8px] text-muted-foreground">+{relations.length - 5} more relations</p>
      )}
    </div>
  );
}
