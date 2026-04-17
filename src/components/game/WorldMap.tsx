import { useState, useCallback, useEffect, useMemo } from 'react';
import { MapContainer, ImageOverlay, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '@/hooks/useGameState';
import { calcMarchTime, getMaxRange, BUILDING_INFO, getSlowestTroopSpeed, WATCHTOWER_RANGE_BONUS } from '@/lib/gameConstants';
import type { TroopType, Resources, Building } from '@/lib/gameTypes';
import { useAuth } from '@/hooks/useAuth';
import { useNPCState } from '@/hooks/useNPCState';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import NPCInteractionPanel from './NPCInteractionPanel';
import { useTroopSkins } from '@/hooks/useTroopSkins';
import AttackConfigPanel from './AttackConfigPanel';
import TroopTransferPanel from './TroopTransferPanel';
import { useAzgaarMap, AZGAAR_SCALE } from '@/hooks/useAzgaarMap';
import { KINGDOM_SPRITES, getKingdomByStateId } from '@/config/kingdomLore';

// Leaflet coordinate system: we use CRS.Simple
// Azgaar map pixels map directly to Leaflet lat/lng (y inverted)
// lat = -azgaarY, lng = azgaarX (so north is up)

function azgaarToLatLng(ax: number, ay: number): L.LatLngExpression {
  return [-ay, ax];
}

function worldToLatLng(wx: number, wy: number): L.LatLngExpression {
  return [-wy, wx];
}

function latLngToWorld(latlng: L.LatLng): { x: number; y: number } {
  return { x: latlng.lng, y: -latlng.lat };
}

// Create emoji/text-based divIcon
function emojiIcon(emoji: string, size: number = 24, className?: string): L.DivIcon {
  return L.divIcon({
    html: `<span style="font-size:${size}px;line-height:1;display:block;text-align:center">${emoji}</span>`,
    className: className || 'leaflet-emoji-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function labelIcon(emoji: string, label: string, color?: string, size: number = 28): L.DivIcon {
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:1px">
      <span style="font-size:${size}px;line-height:1">${emoji}</span>
      <span style="font-size:9px;color:${color || '#ccc'};white-space:nowrap;text-shadow:0 1px 3px #000;font-family:var(--font-display,serif)">${label}</span>
    </div>`,
    className: 'leaflet-label-icon',
    iconSize: [size * 3, size + 16],
    iconAnchor: [size * 1.5, size / 2],
  });
}

// NPC burg icon — scales with zoom: small when zoomed out, larger when zoomed in
const _burgIconCache = new Map<string, L.DivIcon>();
function burgIcon(stateId: number, _population: number, isCapital: boolean, zoom: number = 5): L.DivIcon {
  // Base size at zoom 5; grow ~25% per zoom level in, shrink down to a readable floor when out
  const baseSize = isCapital ? 18 : 12;
  const scale = Math.pow(1.25, zoom - 5);
  const size = Math.round(Math.max(isCapital ? 12 : 9, Math.min(isCapital ? 56 : 42, baseSize * scale)));
  const key = `${stateId}-${isCapital ? 'cap' : 'reg'}-${size}`;
  const cached = _burgIconCache.get(key);
  if (cached) return cached;

  const spriteUrl = KINGDOM_SPRITES[stateId];
  let icon: L.DivIcon;
  if (spriteUrl) {
    icon = L.divIcon({
      html: `<img src="${spriteUrl}" style="width:${size}px;height:${size}px;object-fit:contain;background:transparent;display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.6))" />`,
      className: 'leaflet-burg-icon',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  } else {
    icon = L.divIcon({
      html: `<span style="font-size:${size}px;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,0.7)">${isCapital ? '👑' : '🏘️'}</span>`,
      className: 'leaflet-burg-icon',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }
  _burgIconCache.set(key, icon);
  return icon;
}

// Glowing pulse icon to mark the player's own settlement
function selfMarkerIcon(emoji: string, label: string, size: number = 40): L.DivIcon {
  return L.divIcon({
    html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:1px">
      <span class="leaflet-self-pulse" style="position:absolute;top:50%;left:50%;width:${size * 1.8}px;height:${size * 1.8}px;margin:-${size * 0.9}px 0 0 -${size * 0.9}px;border-radius:50%;border:2px solid rgba(255,215,0,0.9);box-shadow:0 0 16px 4px rgba(255,215,0,0.45);pointer-events:none"></span>
      <span style="font-size:${size}px;line-height:1;filter:drop-shadow(0 0 6px rgba(255,215,0,0.8))">${emoji}</span>
      <span style="font-size:10px;color:#ffd700;white-space:nowrap;text-shadow:0 1px 3px #000;font-family:var(--font-display,serif);font-weight:bold">⭐ ${label}</span>
    </div>`,
    className: 'leaflet-self-icon',
    iconSize: [size * 3, size + 20],
    iconAnchor: [size * 1.5, size / 2],
  });
}

// Component to handle map click on empty space
function MapClickHandler({ onEmptyClick }: { onEmptyClick: (worldX: number, worldY: number) => void }) {
  useMapEvents({
    click(e) {
      const world = latLngToWorld(e.latlng);
      onEmptyClick(world.x, world.y);
    },
  });
  return null;
}

// Component to fly to a position
function FlyTo({ position, zoom }: { position: L.LatLngExpression | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, zoom ?? map.getZoom(), { duration: 0.5 });
    }
  }, [position, zoom, map]);
  return null;
}

function MapInstanceBridge({ onMapReady }: { onMapReady: (map: L.Map) => void }) {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  return null;
}

type SelectedItem =
  | { kind: 'player'; data: any }
  | { kind: 'outpost'; data: any }
  | { kind: 'empty'; data: { x: number; y: number } }
  | null;

export default function WorldMap() {
  const { allVillages, addResources, army, totalArmyPower, attackTarget, attackPlayer, vassalages, buildings, displayName, spies, sendSpyMission, activeSpyMissions, resources, getWatchtowerLevel, getSpyGuildLevel, refreshVillages, refreshMineOutposts, myVillages, settlementType, deployTroops, returnTroops, switchVillage, villageId } = useGame();
  const { user } = useAuth();
  const npcState = useNPCState();
  const { activeSkin } = useTroopSkins();
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [outposts, setOutposts] = useState<any[]>([]);
  const [wallSegments, setWallSegments] = useState<any[]>([]);
  const [marches, setMarches] = useState<any[]>([]);
  const [otherMarches, setOtherMarches] = useState<any[]>([]);
  const [, forceRender] = useState(0);
  const [attackConfig, setAttackConfig] = useState<any>(null);
  const [flyTarget, setFlyTarget] = useState<L.LatLngExpression | null>(null);
  const [leafletMap, setLeafletMap] = useState<L.Map | null>(null);

  const azgaarMap = useAzgaarMap();

  // ── Subscribe to other players' marches ──
  useEffect(() => {
    if (!user) return;
    const loadMarches = async () => {
      const { data } = await supabase.from('active_marches').select('*');
      if (data) setOtherMarches(data.filter((m: any) => m.user_id !== user.id && new Date(m.arrives_at).getTime() > Date.now()));
    };
    loadMarches();
    const channel = supabase
      .channel('active-marches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_marches' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const m = payload.new as any;
          if (m.user_id !== user.id) setOtherMarches(prev => [...prev, m]);
        } else if (payload.eventType === 'DELETE') {
          setOtherMarches(prev => prev.filter(m => m.id !== (payload.old as any).id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Restore own active marches ──
  useEffect(() => {
    if (!user) return;
    const restoreOwnMarches = async () => {
      const { data } = await supabase.from('active_marches')
        .select('*')
        .eq('user_id', user.id)
        .gt('arrives_at', new Date().toISOString());
      if (!data || data.length === 0) return;
      setMarches(prev => {
        const existingIds = new Set(prev.map((m: any) => m.id));
        const restored = data
          .filter((m: any) => !existingIds.has(m.id))
          .map((m: any) => ({
            id: m.id,
            targetName: m.target_name || 'Unknown',
            arrivalTime: new Date(m.arrives_at).getTime(),
            startTime: new Date(m.started_at).getTime(),
            startX: m.start_x,
            startY: m.start_y,
            targetX: m.target_x,
            targetY: m.target_y,
            action: () => {},
          }));
        return [...prev, ...restored];
      });
    };
    restoreOwnMarches();
  }, [user]);

  // Clean up expired marches
  useEffect(() => {
    if (otherMarches.length === 0) return;
    const interval = setInterval(() => {
      setOtherMarches(prev => prev.filter(m => new Date(m.arrives_at).getTime() > Date.now()));
    }, 3000);
    return () => clearInterval(interval);
  }, [otherMarches.length]);

  // Animate marches
  useEffect(() => {
    if (marches.length === 0) return;
    const interval = setInterval(() => forceRender(v => v + 1), 1000);
    return () => clearInterval(interval);
  }, [marches.length]);

  // Process marches
  useEffect(() => {
    if (marches.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const arrived = marches.filter((m: any) => m.arrivalTime <= now);
      if (arrived.length === 0) return;
      const remaining = marches.filter((m: any) => m.arrivalTime > now);
      setMarches(remaining);
      arrived.forEach((m: any) => {
        toast.success(`Troops arrived at ${m.targetName}!`);
        try { m.action(); } catch (err) {
          console.error('March action failed:', err);
          toast.error(`⚠️ Battle at ${m.targetName} failed`);
        }
      });
      if (user) {
        supabase.from('active_marches').delete().eq('user_id', user.id).lte('arrives_at', new Date().toISOString()).then(() => {});
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [marches, user, returnTroops]);

  // NPC vassal tribute
  useEffect(() => {
    const vassalNPCs = Array.from(npcState.playerRelations.values()).filter((r: any) => r.status === 'vassal');
    if (vassalNPCs.length === 0) return;
    const interval = setInterval(() => {
      let totalGold = 0, totalFood = 0;
      for (const v of vassalNPCs) {
        totalGold += Math.floor(v.tribute_rate * 0.5);
        totalFood += Math.floor(v.tribute_rate * 0.3);
      }
      if (totalGold > 0 || totalFood > 0) addResources({ gold: totalGold, food: totalFood });
    }, 15000);
    return () => clearInterval(interval);
  }, [npcState.playerRelations, addResources]);

  // Load outposts
  useEffect(() => {
    if (!user) return;
    supabase.from('outposts').select('*').then(({ data }) => {
      if (data) setOutposts(data.map((o: any) => ({ ...o, garrison_troops: o.garrison_troops || {} })));
    });
    supabase.from('wall_segments').select('*').then(({ data }) => {
      if (data) setWallSegments(data);
    });
  }, [user]);

  const getPlayerPos = (id: string) => {
    const village = allVillages.find(v => v.village.id === id);
    if (village && (village.village.map_x !== 0 || village.village.map_y !== 0)) {
      return { x: village.village.map_x, y: village.village.map_y };
    }
    let h = 5381;
    for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
    const h2 = ((h * 2654435761) >>> 0);
    const angle = (h % 10000) / 10000 * Math.PI * 2;
    const radius = 25000 + (h2 % 120000);
    return { x: 175000 + Math.cos(angle) * radius, y: 330000 + Math.sin(angle) * radius };
  };

  const getMyPos = useCallback(() => {
    if (!user) return { x: 175000, y: 330000 };
    const myVillage = allVillages.find(v => v.village.id === villageId) || allVillages.find(v => v.village.user_id === user.id);
    return getPlayerPos(myVillage?.village.id || 'me');
  }, [user, allVillages, villageId]);

  const goHome = useCallback(() => {
    const pos = getMyPos();
    setFlyTarget(worldToLatLng(pos.x, pos.y));
  }, [getMyPos]);

  const getDistance = useCallback((targetX: number, targetY: number) => {
    const myPos = getMyPos();
    return Math.sqrt(Math.pow(targetX - myPos.x, 2) + Math.pow(targetY - myPos.y, 2));
  }, [getMyPos]);

  const calcTravelTime = useCallback((targetX: number, targetY: number) => {
    const dist = getDistance(targetX, targetY);
    return calcMarchTime(dist, army);
  }, [getDistance, army]);

  const isInRange = useCallback((targetX: number, targetY: number) => {
    const wtLevel = getWatchtowerLevel();
    const maxRange = getMaxRange(army, wtLevel);
    const dist = getDistance(targetX, targetY);
    if (dist <= maxRange) return true;
    const myOutposts = outposts.filter((o: any) => o.user_id === user?.id);
    for (const op of myOutposts) {
      const opDist = Math.hypot(targetX - op.x, targetY - op.y);
      if (opDist <= maxRange) return true;
    }
    return false;
  }, [getDistance, army, outposts, user?.id, getWatchtowerLevel]);

  const createMarch = useCallback((id: string, targetName: string, targetX: number, targetY: number, _travelSec: number, action: () => void, sentArmy?: Partial<Record<string, number>>) => {
    const myPos = getMyPos();
    const now = Date.now();
    const dist = Math.hypot(targetX - myPos.x, targetY - myPos.y);
    const scoutBonus = Math.min(0.30, (army.scout || 0) * 0.03);
    const actualTravelSec = Math.max(5, Math.floor(dist / (getSlowestTroopSpeed(army) * 200) * (1 - scoutBonus)));
    const arrivalTime = now + actualTravelSec * 1000;
    setMarches(prev => [...prev, {
      id, targetName, arrivalTime,
      startTime: now, startX: myPos.x, startY: myPos.y,
      targetX, targetY, action, sentArmy,
    }]);
    if (user) {
      const marchType = id.startsWith('atk') || id.startsWith('pvp') ? 'attack' : id.startsWith('envoy') ? 'envoy' : 'march';
      const marchInsert: any = {
        user_id: user.id, player_name: displayName,
        start_x: myPos.x, start_y: myPos.y,
        target_x: targetX, target_y: targetY,
        target_name: targetName,
        arrives_at: new Date(arrivalTime).toISOString(),
        march_type: marchType, sent_army: sentArmy || {},
      };
      supabase.from('active_marches').insert(marchInsert).then(() => {});
    }
  }, [getMyPos, army, user, displayName]);

  const handleAttackPlayer = useCallback((pv: any) => {
    const hasTroops = Object.values(army).some(v => (v as number) > 0);
    if (!hasTroops) { toast.error('You need troops to attack!'); return; }
    const pos = getPlayerPos(pv.village.id);
    if (!isInRange(pos.x, pos.y)) { toast.error('Out of range!'); return; }
    const travelSec = calcTravelTime(pos.x, pos.y);
    setAttackConfig({
      targetName: pv.profile.display_name, targetPower: undefined,
      targetX: pos.x, targetY: pos.y, travelTime: travelSec,
      showEspionage: getSpyGuildLevel() >= 1, targetId: pv.village.user_id,
      onAttack: (sentArmy: any) => {
        toast(`⚔️ Troops marching to ${pv.profile.display_name}... ETA ${travelSec}s`);
        deployTroops(sentArmy);
        (window as any).__pendingMarchTargetUserId = pv.village.user_id;
        createMarch(`pvp-${Date.now()}`, pv.profile.display_name, pos.x, pos.y, travelSec, () => {
          attackPlayer(pv.village.user_id, pv.profile.display_name, sentArmy);
        }, sentArmy);
        setAttackConfig(null);
        setSelected(null);
      },
    });
  }, [army, calcTravelTime, isInRange, createMarch, attackPlayer, deployTroops, getSpyGuildLevel]);

  const handleEmptyClick = useCallback((worldX: number, worldY: number) => {
    setSelected({ kind: 'empty', data: { x: worldX, y: worldY } });
  }, []);

  const power = totalArmyPower();

  // Map bounds based on Azgaar map dimensions
  const mapBounds = useMemo((): L.LatLngBoundsExpression => {
    return [
      [-azgaarMap.mapHeight, 0],  // south-west
      [0, azgaarMap.mapWidth],     // north-east
    ];
  }, [azgaarMap.mapWidth, azgaarMap.mapHeight]);

  // Initial center on player's village
  const initialCenter = useMemo((): L.LatLngExpression => {
    const pos = getMyPos();
    return worldToLatLng(pos.x, pos.y);
  }, [getMyPos]);

  const mapControlButtonClassName = 'w-9 h-9 bg-background/80 backdrop-blur-sm border border-border/40 rounded-lg flex items-center justify-center text-foreground/80 text-sm active:scale-90 transition-all hover:bg-background/95 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed';

  if (azgaarMap.loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="text-2xl animate-spin">🌍</div>
          <p className="text-sm text-muted-foreground font-display">Loading world map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-3 pt-2 pb-1.5 flex items-center justify-between border-b border-border/30">
        <h2 className="font-display text-sm text-foreground/90 tracking-wide">World Map</h2>
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground/70">
          {marches.length > 0 && <span className="text-primary/80 animate-pulse">🚶 {marches.length}</span>}
          <span className="font-mono">⚔️{power.attack} 🛡️{power.defense}</span>
        </div>
      </div>

      <div className="flex-1 relative">
        <MapContainer
          className="world-leaflet-map"
          center={initialCenter}
          zoom={5}
          minZoom={-1}
          maxZoom={10}
          crs={L.CRS.Simple}
          maxBounds={mapBounds}
          maxBoundsViscosity={0.9}
          scrollWheelZoom
          touchZoom
          doubleClickZoom
          zoomSnap={0.25}
          zoomDelta={0.5}
          style={{ width: '100%', height: '100%', background: 'hsl(var(--map-bg-1))' }}
          attributionControl={false}
          zoomControl={false}
        >
          <MapInstanceBridge onMapReady={setLeafletMap} />

          {/* Map background image from Azgaar cells */}
          {azgaarMap.mapImageUrl && (
            <ImageOverlay
              url={azgaarMap.mapImageUrl}
              bounds={mapBounds}
              opacity={1}
            />
          )}

          <MapClickHandler onEmptyClick={handleEmptyClick} />
          {flyTarget && <FlyTo position={flyTarget} />}

          {/* NPC Burgs from Azgaar data */}
          {azgaarMap.burgs.map(burg => {
            const kingdom = getKingdomByStateId(burg.state);
            const state = azgaarMap.states.find(s => s.id === burg.state);
            return (
              <Marker
                key={`burg-${burg.id}`}
                position={azgaarToLatLng(burg.x, burg.y)}
                icon={burgIcon(burg.state, burg.population, burg.capital)}
              >
                <Popup className="leaflet-burg-popup" maxWidth={240}>
                  <div className="text-center space-y-1">
                    <strong className="text-sm">{burg.name}</strong>
                    <div className="text-[10px] opacity-70">
                      {kingdom?.name || state?.name || 'Unknown'} · Pop: {burg.population}
                      {burg.capital && ' · 👑 Capital'}
                      {burg.port && ' · ⚓ Port'}
                    </div>
                    {kingdom && (
                      <p className="text-[9px] italic opacity-60 leading-tight mt-1">{kingdom.lore}</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Player settlements */}
          {allVillages.map(pv => {
            const pos = getPlayerPos(pv.village.id);
            const isMe = pv.village.user_id === user?.id;
            const tier = pv.village.settlement_type || 'camp';
            const emoji = tier === 'city' ? '🏰' : tier === 'town' ? '🏘️' : tier === 'village' ? '🏠' : '🏕️';
            return (
              <Marker
                key={`player-${pv.village.id}`}
                position={worldToLatLng(pos.x, pos.y)}
                icon={isMe
                  ? selfMarkerIcon(emoji, pv.profile.display_name, 38)
                  : labelIcon(emoji, pv.profile.display_name, '#aaa', 24)}
                zIndexOffset={isMe ? 1000 : 0}
                eventHandlers={{
                  click: () => {
                    if (isMe) {
                      if (pv.village.id !== villageId) switchVillage(pv.village.id);
                      window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'village' }));
                    } else {
                      setSelected({ kind: 'player', data: pv });
                    }
                  },
                }}
              />
            );
          })}

          {/* Outposts */}
          {outposts.map((op: any) => {
            const isOwn = op.user_id === user?.id;
            const emoji = op.outpost_type === 'bridge' ? '🌉' : op.outpost_type === 'fort' ? '🏰' : op.outpost_type === 'mine' ? '⛏️' : '🏕️';
            return (
              <Marker
                key={`outpost-${op.id}`}
                position={worldToLatLng(op.x, op.y)}
                icon={labelIcon(emoji, op.name, isOwn ? '#4ade80' : '#ef4444', 22)}
                eventHandlers={{
                  click: () => setSelected({ kind: 'outpost', data: op }),
                }}
              />
            );
          })}

          {/* Active marches (own) */}
          {marches.map((m: any) => {
            const now = Date.now();
            const progress = Math.min(1, Math.max(0, (now - m.startTime) / (m.arrivalTime - m.startTime)));
            const curX = m.startX + (m.targetX - m.startX) * progress;
            const curY = m.startY + (m.targetY - m.startY) * progress;
            const remainingSec = Math.max(0, Math.ceil((m.arrivalTime - now) / 1000));
            return (
              <Marker
                key={`march-${m.id}`}
                position={worldToLatLng(curX, curY)}
                icon={labelIcon('⚔️', `→ ${m.targetName} (${remainingSec}s)`, '#fbbf24', 20)}
              />
            );
          })}

          {/* Other players' marches */}
          {otherMarches.map((m: any) => {
            const now = Date.now();
            const start = new Date(m.started_at).getTime();
            const end = new Date(m.arrives_at).getTime();
            const progress = Math.min(1, Math.max(0, (now - start) / (end - start)));
            const curX = m.start_x + (m.target_x - m.start_x) * progress;
            const curY = m.start_y + (m.target_y - m.start_y) * progress;
            return (
              <Marker
                key={`other-march-${m.id}`}
                position={worldToLatLng(curX, curY)}
                icon={emojiIcon('🚶', 16)}
              />
            );
          })}
        </MapContainer>

        {/* Zoom controls */}
        <div className="absolute bottom-20 sm:bottom-16 right-3 flex flex-col gap-1 z-[1000]">
          <button type="button" aria-label="Zoom in" onClick={() => leafletMap?.zoomIn()}
            disabled={!leafletMap}
            className={mapControlButtonClassName}>+</button>
          <button type="button" aria-label="Zoom out" onClick={() => leafletMap?.zoomOut()}
            disabled={!leafletMap}
            className={mapControlButtonClassName}>−</button>
          <button type="button" aria-label="Center on home" onClick={goHome}
            disabled={!leafletMap}
            className={mapControlButtonClassName}>⌂</button>
        </div>

        {/* Selected item panel */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-16 sm:bottom-14 inset-x-0 z-[1000] mx-2 sm:mx-3 game-panel border-glow rounded-xl p-3 max-h-[50vh] overflow-y-auto safe-bottom">
              <button onClick={() => setSelected(null)} className="absolute top-2 right-2 text-muted-foreground/60 hover:text-foreground text-lg z-10">✕</button>

              {selected.kind === 'player' && (() => {
                const pv = selected.data;
                const pos = getPlayerPos(pv.village.id);
                const travelSec = calcTravelTime(pos.x, pos.y);
                const inRange = isInRange(pos.x, pos.y);
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">{pv.profile.avatar_emoji}</span>
                      <div>
                        <h3 className="font-display text-sm text-foreground">{pv.profile.display_name}</h3>
                        <p className="text-[9px] text-muted-foreground">{pv.village.settlement_type || 'camp'} · Tier {pv.village.settlement_tier || 1}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => handleAttackPlayer(pv)}
                        disabled={!inRange}
                        className="flex-1 bg-destructive text-destructive-foreground font-display text-[11px] py-2 rounded-lg disabled:opacity-40">
                        ⚔️ Attack ({travelSec}s)
                      </motion.button>
                    </div>
                  </div>
                );
              })()}

              {selected.kind === 'outpost' && (() => {
                const op = selected.data;
                const isOwn = op.user_id === user?.id;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">{op.outpost_type === 'fort' ? '🏰' : op.outpost_type === 'bridge' ? '🌉' : '🏕️'}</span>
                      <div>
                        <h3 className="font-display text-sm text-foreground">{op.name}</h3>
                        <p className="text-[9px] text-muted-foreground">
                          Lv.{op.level || 1} · ⚔️{op.garrison_power || 0} defense
                          {isOwn ? ' · Yours' : ''}
                        </p>
                      </div>
                    </div>
                    {isOwn && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground">
                          {op.outpost_type === 'fort' ? 'Your fort. Garrison armies here.' : 'Your outpost. Upgrade to Lv.5 for a fort.'}
                        </p>
                        <motion.button whileTap={{ scale: 0.95 }}
                          onClick={async () => {
                            if (!window.confirm(`Demolish ${op.name}?`)) return;
                            await supabase.from('outposts').delete().eq('id', op.id);
                            setOutposts(prev => prev.filter((o: any) => o.id !== op.id));
                            toast.success(`🗑️ ${op.name} demolished.`);
                            setSelected(null);
                          }}
                          className="w-full bg-destructive text-destructive-foreground font-display text-[11px] py-2 rounded-lg">
                          🗑️ Demolish
                        </motion.button>
                      </div>
                    )}
                    {!isOwn && (
                      <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          const hasTroops = Object.values(army).some(v => (v as number) > 0);
                          if (!hasTroops) { toast.error('Need troops!'); return; }
                          if (!isInRange(op.x, op.y)) { toast.error('Out of range!'); return; }
                          const travelSec = calcTravelTime(op.x, op.y);
                          setAttackConfig({
                            targetName: op.name, targetPower: op.garrison_power,
                            targetX: op.x, targetY: op.y, travelTime: travelSec,
                            showEspionage: false,
                            onAttack: (sentArmy: any) => {
                              deployTroops(sentArmy);
                              createMarch(`atk-op-${Date.now()}`, op.name, op.x, op.y, travelSec, async () => {
                                const log = attackTarget(op.name, op.garrison_power, sentArmy);
                                if (log.result === 'victory') {
                                  await supabase.rpc('raze_outpost', { p_outpost_id: op.id });
                                  setOutposts(prev => prev.filter((o: any) => o.id !== op.id));
                                  toast.success(`🔥 ${op.name} razed!`);
                                } else {
                                  toast.error('Defeated!');
                                }
                              }, sentArmy);
                              setAttackConfig(null);
                              setSelected(null);
                            },
                          });
                        }}
                        className="w-full bg-destructive text-destructive-foreground font-display text-[11px] py-2.5 rounded-lg">
                        ⚔️ Attack ({op.garrison_power} power)
                      </motion.button>
                    )}
                  </div>
                );
              })()}

              {selected.kind === 'empty' && (() => {
                const thLevel = buildings.find((b: Building) => b.type === 'townhall')?.level || 1;
                const outpostCost = { gold: 300, wood: 200, stone: 150, food: 100 };
                const canAffordOp = resources.gold >= outpostCost.gold && resources.wood >= outpostCost.wood && resources.stone >= outpostCost.stone && resources.food >= outpostCost.food;
                const canBuildOutpost = thLevel >= 3;
                const inRange = isInRange(selected.data.x, selected.data.y);
                const coordLabel = `${(selected.data.x / 1000).toFixed(1)}k, ${(selected.data.y / 1000).toFixed(1)}k`;
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📍</span>
                      <div>
                        <h3 className="font-display text-sm text-foreground">Territory</h3>
                        <p className="text-[9px] text-muted-foreground font-mono">{coordLabel}</p>
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2.5 space-y-1.5">
                      <p className="font-display text-[11px] text-foreground">🏕️ Found Outpost</p>
                      <p className="text-[9px] text-muted-foreground">Expand your borders here.</p>
                      <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                        <span className={resources.gold >= outpostCost.gold ? '' : 'text-destructive'}>🪙{outpostCost.gold}</span>
                        <span className={resources.wood >= outpostCost.wood ? '' : 'text-destructive'}>🪵{outpostCost.wood}</span>
                        <span className={resources.stone >= outpostCost.stone ? '' : 'text-destructive'}>🪨{outpostCost.stone}</span>
                        <span className={resources.food >= outpostCost.food ? '' : 'text-destructive'}>🌾{outpostCost.food}</span>
                      </div>
                      <motion.button whileTap={{ scale: 0.95 }}
                        disabled={!canBuildOutpost || !canAffordOp || !inRange}
                        onClick={() => {
                          if (!canBuildOutpost) { toast.error('Town Hall level 3 required!'); return; }
                          if (!canAffordOp) { toast.error('Not enough resources!'); return; }
                          if (!inRange) { toast.error('Out of range!'); return; }
                          const travelSec = calcTravelTime(selected.data.x, selected.data.y);
                          const targetData = selected.data;
                          toast(`🏗️ Settlers heading out... ETA ${travelSec}s`);
                          addResources({ gold: -outpostCost.gold, wood: -outpostCost.wood, stone: -outpostCost.stone, food: -outpostCost.food });
                          createMarch(`outpost-${Date.now()}`, 'New Outpost', targetData.x, targetData.y, travelSec, async () => {
                            const opName = `Outpost ${outposts.length + 1}`;
                            const { data, error } = await supabase.from('outposts').insert({
                              user_id: user!.id, x: targetData.x, y: targetData.y, name: opName, outpost_type: 'outpost',
                            }).select().single();
                            if (error) { toast.error('Failed to build outpost'); return; }
                            setOutposts(prev => [...prev, { ...data, garrison_troops: {} }]);
                            toast.success(`🏕️ ${opName} established!`);
                          });
                          setSelected(null);
                        }}
                        className="w-full bg-primary text-primary-foreground font-display text-[11px] py-2 rounded-lg glow-gold-sm disabled:opacity-40">
                        {!inRange ? '⚠️ Out of Range' : '🏕️ Found Outpost'}
                      </motion.button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attack Configuration Panel */}
        <AnimatePresence>
          {attackConfig && (
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-16 sm:bottom-14 inset-x-0 z-[1100] mx-2 sm:mx-3 game-panel border-glow rounded-xl p-3 max-h-[55vh] overflow-y-auto safe-bottom">
              <AttackConfigPanel
                targetName={attackConfig.targetName}
                targetPower={attackConfig.targetPower}
                targetId={attackConfig.targetId}
                targetX={attackConfig.targetX}
                targetY={attackConfig.targetY}
                travelTime={attackConfig.travelTime}
                showEspionage={attackConfig.showEspionage}
                espionageOnly={attackConfig.espionageOnly}
                onConfirmAttack={attackConfig.onAttack}
                onConfirmEspionage={(mission, count) => {
                  if (attackConfig.targetId) {
                    sendSpyMission(mission, attackConfig.targetName, attackConfig.targetId, attackConfig.targetX, attackConfig.targetY, count);
                    toast(`🕵️ Spies dispatched to ${attackConfig.targetName}`);
                  }
                  setAttackConfig(null);
                  setSelected(null);
                }}
                onCancel={() => setAttackConfig(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
