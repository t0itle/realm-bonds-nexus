import { useState, useRef } from 'react';
import { useGame, BUILDING_INFO, BuildingType, TROOP_INFO, TroopType } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { useTroopSkins, FACTION_SKINS } from '@/hooks/useTroopSkins';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { BUILDING_SPRITES } from './sprites';
import { FACTION_BUILDING_SPRITES } from './factionSprites';
import crownOverlay from '@/assets/sprites/crown-overlay.png';
import ResourceIcon from './ResourceIcon';

function CrownAvatar({ avatarUrl, emoji, size = 64 }: { avatarUrl?: string | null; emoji?: string; size?: number }) {
  const crownSize = size * 0.6;
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full bg-secondary flex items-center justify-center overflow-hidden glow-gold border-2 border-primary/30">
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <span style={{ fontSize: size * 0.5 }}>{emoji || '🛡️'}</span>
        )}
      </div>
      <img
        src={crownOverlay}
        alt=""
        className="absolute pointer-events-none"
        style={{ width: crownSize, height: crownSize, top: -crownSize * 0.55, left: '50%', transform: 'translateX(-50%)' }}
        loading="lazy"
      />
    </div>
  );
}

export default function ProfilePanel() {
  const { villageName, playerLevel, buildings, totalProduction, steelProduction, displayName, avatarUrl, army, totalArmyPower, setDisplayName, setVillageName, setAvatarUrl, resources } = useGame();
  const { signOut, user } = useAuth();
  const { activeSkin, ownedSkins, purchaseSkin, setActiveSkin, getTroopDisplay, getBuildingSprite } = useTroopSkins();
  const { isSupported, isSubscribed, subscribe, unsubscribe, permission } = usePushNotifications();
  const totalBuildingLevels = buildings.reduce((sum, b) => sum + b.level, 0);
  const power = totalArmyPower();
  const totalTroops = Object.values(army).reduce((s, v) => s + v, 0);

  const [editingName, setEditingName] = useState(false);
  const [editingVillage, setEditingVillage] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const [villageInput, setVillageInput] = useState(villageName);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasGoogle = user?.app_metadata?.providers?.includes('google') ||
    user?.identities?.some(i => i.provider === 'google');

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) return; // 2MB limit

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      // Add cache-buster
      const url = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const saveName = async () => {
    if (nameInput.trim() && nameInput.trim() !== displayName) {
      await setDisplayName(nameInput.trim());
    }
    setEditingName(false);
  };

  const saveVillage = async () => {
    if (villageInput.trim() && villageInput.trim() !== villageName) {
      await setVillageName(villageInput.trim());
    }
    setEditingVillage(false);
  };

  return (
    <div className="flex-1 flex flex-col p-4 space-y-4 pb-20 overflow-y-auto">
      <h2 className="font-display text-lg text-foreground text-shadow-gold">Profile</h2>

      <div className="game-panel border-glow rounded-xl p-4 text-center space-y-3">
        {/* Avatar with crown */}
        <div className="flex flex-col items-center gap-1 pt-4">
          <div className="cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <CrownAvatar avatarUrl={avatarUrl} size={72} />
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="text-[9px] text-primary hover:underline mt-1"
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Change Avatar'}
          </button>
        </div>

        {/* Display name */}
        <AnimatePresence mode="wait">
          {editingName ? (
            <motion.div key="edit-name" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 justify-center">
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                maxLength={20}
                autoFocus
                className="bg-muted text-foreground font-display text-center text-sm rounded-lg px-2 py-1 border border-border w-36 focus:outline-none focus:border-primary"
                onKeyDown={e => e.key === 'Enter' && saveName()}
              />
              <button onClick={saveName} className="text-primary text-xs">✓</button>
              <button onClick={() => setEditingName(false)} className="text-muted-foreground text-xs">✕</button>
            </motion.div>
          ) : (
            <motion.div key="show-name" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h3 className="font-display text-foreground cursor-pointer hover:text-primary transition-colors inline-flex items-center gap-1"
                onClick={() => { setNameInput(displayName); setEditingName(true); }}>
                {displayName} <span className="text-[9px] text-muted-foreground">✏️</span>
              </h3>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Village name */}
        <AnimatePresence mode="wait">
          {editingVillage ? (
            <motion.div key="edit-village" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 justify-center">
              <input
                value={villageInput}
                onChange={e => setVillageInput(e.target.value)}
                maxLength={30}
                autoFocus
                className="bg-muted text-muted-foreground text-center text-xs rounded-lg px-2 py-1 border border-border w-40 focus:outline-none focus:border-primary"
                onKeyDown={e => e.key === 'Enter' && saveVillage()}
              />
              <button onClick={saveVillage} className="text-primary text-xs">✓</button>
              <button onClick={() => setEditingVillage(false)} className="text-muted-foreground text-xs">✕</button>
            </motion.div>
          ) : (
            <motion.div key="show-village" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors inline-flex items-center gap-1"
                onClick={() => { setVillageInput(villageName); setEditingVillage(true); }}>
                {villageName} <span className="text-[9px]">✏️</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-xs text-primary font-bold">Level {playerLevel}</p>
        <p className="text-xs text-muted-foreground">Power: {(totalBuildingLevels * 100 + power.attack + power.defense).toLocaleString()}</p>
      </div>

      <div className="game-panel border-glow rounded-xl p-4 space-y-2">
        <h3 className="font-display text-sm text-foreground">Production Rates</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2"><ResourceIcon type="gold" size={14} /><span className="text-foreground">{totalProduction.gold} gold/min</span></div>
          <div className="flex items-center gap-2"><ResourceIcon type="wood" size={14} /><span className="text-foreground">{totalProduction.wood} wood/min</span></div>
          <div className="flex items-center gap-2"><ResourceIcon type="stone" size={14} /><span className="text-foreground">{totalProduction.stone} stone/min</span></div>
          <div className="flex items-center gap-2"><ResourceIcon type="food" size={14} /><span className="text-foreground">{totalProduction.food} food/min</span></div>
          {steelProduction > 0 && (
            <div className="flex items-center gap-2"><ResourceIcon type="steel" size={14} /><span className="text-foreground">{steelProduction} steel/min</span></div>
          )}
        </div>
      </div>

      {totalTroops > 0 && (
        <div className="game-panel border-glow rounded-xl p-4 space-y-2">
          <h3 className="font-display text-sm text-foreground">Army ({totalTroops} troops)</h3>
          <div className="flex items-center gap-3 mb-1 text-xs">
            <span className="text-primary font-bold">⚔️ {power.attack} ATK</span>
            <span className="text-foreground font-bold">🛡️ {power.defense} DEF</span>
          </div>
          <div className="space-y-1">
            {Object.entries(army).filter(([, v]) => v > 0).map(([type, count]) => {
              const skinDisplay = getTroopDisplay(type as TroopType);
              return (
                <div key={type} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{skinDisplay.emoji} {skinDisplay.name}</span>
                  <span className="text-primary font-bold">x{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="game-panel border-glow rounded-xl p-4 space-y-2">
        <h3 className="font-display text-sm text-foreground">Buildings ({buildings.length})</h3>
        <div className="space-y-1">
          {buildings.map(b => {
            const type = b.type as Exclude<BuildingType, 'empty'>;
            const info = BUILDING_INFO[type];
            return (
              <div key={b.id} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{info.icon} {info.name}</span>
                <span className="text-primary font-bold">Lv.{b.level}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== FACTION SKINS SHOP ===== */}
      <div className="game-panel border-glow rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm text-foreground">🎨 Faction Skins</h3>
          <span className="text-[9px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
            Active: {activeSkin.icon} {activeSkin.name}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Change the look of your buildings, troops, and map sprites. Each faction reskins everything.
        </p>

        {/* Sprite preview of active skin */}
        <div className="flex items-center justify-center gap-2 py-2">
          {(['townhall', 'barracks', 'farm'] as const).map(bType => (
            <div key={bType} className="flex flex-col items-center">
              <img src={BUILDING_SPRITES[bType]} alt={bType} className="w-10 h-10 object-contain" style={{ filter: spriteFilter }} />
              <span className="text-[7px] text-muted-foreground mt-0.5">{BUILDING_INFO[bType].name}</span>
            </div>
          ))}
          <div className="flex flex-col items-center">
            <span className="text-2xl">{getTroopDisplay('knight').emoji}</span>
            <span className="text-[7px] text-muted-foreground mt-0.5">{getTroopDisplay('knight').name}</span>
          </div>
        </div>

        {/* Skin cards */}
        <div className="space-y-2">
          {FACTION_SKINS.map(skin => {
            const owned = ownedSkins.includes(skin.id);
            const isActive = activeSkin.id === skin.id;
            const canAffordSkin = resources.gold >= skin.cost;

            return (
              <div key={skin.id} className={`rounded-xl p-3 border transition-all ${isActive ? 'border-primary/60 bg-primary/5' : 'border-border/40 bg-muted/20'}`}>
                <div className="flex items-center gap-3">
                  {/* Sprite preview with this skin's filter */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-background/50 flex items-center justify-center overflow-hidden">
                    <img src={skin.id !== 'default' && FACTION_BUILDING_SPRITES[skin.id] ? FACTION_BUILDING_SPRITES[skin.id].townhall : BUILDING_SPRITES.townhall} alt={skin.name} className="w-10 h-10 object-contain" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{skin.icon}</span>
                      <span className="font-display text-xs text-foreground">{skin.name}</span>
                      {isActive && <span className="text-[7px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">ACTIVE</span>}
                      {owned && !isActive && <span className="text-[7px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">OWNED</span>}
                    </div>
                    <p className="text-[9px] text-muted-foreground truncate">{skin.description}</p>
                    {/* Troop preview */}
                    <div className="flex gap-1.5 mt-1">
                      {(['militia', 'archer', 'knight', 'cavalry'] as TroopType[]).map(t => (
                        <span key={t} className="text-[8px] text-muted-foreground">{skin.troops[t].emoji}</span>
                      ))}
                    </div>
                  </div>

                  {/* Action */}
                  <div className="flex-shrink-0">
                    {!owned && skin.cost > 0 && (
                      <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => purchaseSkin(skin.id)}
                        disabled={!canAffordSkin}
                        className={`font-display text-[9px] py-1.5 px-3 rounded-lg whitespace-nowrap ${canAffordSkin ? 'bg-primary text-primary-foreground glow-gold-sm' : 'bg-muted text-muted-foreground'}`}>
                        🪙 {skin.cost.toLocaleString()}
                      </motion.button>
                    )}
                    {owned && !isActive && (
                      <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveSkin(skin.id)}
                        className="font-display text-[9px] py-1.5 px-3 rounded-lg bg-secondary text-foreground whitespace-nowrap">
                        Equip
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>


      {isSupported && (
        <div className="game-panel border-glow rounded-xl p-4 space-y-2">
          <h3 className="font-display text-sm text-foreground">🔔 Push Notifications</h3>
          <p className="text-[10px] text-muted-foreground">
            Get notified about attacks, completed buildings, and vassal events.
          </p>
          {permission === 'denied' ? (
            <p className="text-[10px] text-destructive">Notifications blocked. Enable in browser settings.</p>
          ) : (
            <motion.button whileTap={{ scale: 0.95 }}
              onClick={() => isSubscribed ? unsubscribe() : subscribe()}
              className={`w-full font-display text-xs py-2 rounded-lg transition-colors ${
                isSubscribed 
                  ? 'bg-destructive/20 text-destructive' 
                  : 'bg-primary text-primary-foreground glow-gold-sm'
              }`}>
              {isSubscribed ? '🔕 Disable Notifications' : '🔔 Enable Notifications'}
            </motion.button>
          )}
        </div>
      )}

      {/* Google account status */}
      {hasGoogle && (
        <div className="game-panel border-glow rounded-xl p-4 flex items-center gap-2">
          <span className="text-xs text-primary">✓</span>
          <span className="text-xs text-muted-foreground">Signed in with Google</span>
        </div>
      )}

      <motion.button whileTap={{ scale: 0.95 }} onClick={signOut}
        className="bg-destructive/20 text-destructive font-display text-sm py-2.5 rounded-lg w-full">
        Leave Realm
      </motion.button>
    </div>
  );
}

export { CrownAvatar };
