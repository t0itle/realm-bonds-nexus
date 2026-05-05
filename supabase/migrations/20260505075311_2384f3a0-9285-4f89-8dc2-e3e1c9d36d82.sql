
-- =========================================================================
-- PHASE 1: WIPE THE OLD WORLD
-- =========================================================================

-- Drop the auto-village trigger first
DROP TRIGGER IF EXISTS on_auth_user_created_village ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_village() CASCADE;

-- Drop obsolete tables (CASCADE handles dependent FKs/policies)
DROP TABLE IF EXISTS public.active_marches CASCADE;
DROP TABLE IF EXISTS public.active_reinforcements CASCADE;
DROP TABLE IF EXISTS public.active_spy_missions CASCADE;
DROP TABLE IF EXISTS public.battle_reports CASCADE;
DROP TABLE IF EXISTS public.build_queue CASCADE;
DROP TABLE IF EXISTS public.buildings CASCADE;
DROP TABLE IF EXISTS public.caravans CASCADE;
DROP TABLE IF EXISTS public.intel_reports CASCADE;
DROP TABLE IF EXISTS public.npc_mercenary_contracts CASCADE;
DROP TABLE IF EXISTS public.npc_player_relations CASCADE;
DROP TABLE IF EXISTS public.npc_settlement_lore CASCADE;
DROP TABLE IF EXISTS public.npc_town_relations CASCADE;
DROP TABLE IF EXISTS public.npc_town_state CASCADE;
DROP TABLE IF EXISTS public.outposts CASCADE;
DROP TABLE IF EXISTS public.player_skins CASCADE;
DROP TABLE IF EXISTS public.research_progress CASCADE;
DROP TABLE IF EXISTS public.roads CASCADE;
DROP TABLE IF EXISTS public.spy_training_queue CASCADE;
DROP TABLE IF EXISTS public.trade_routes CASCADE;
DROP TABLE IF EXISTS public.training_queue CASCADE;
DROP TABLE IF EXISTS public.vassalages CASCADE;
DROP TABLE IF EXISTS public.villages CASCADE;
DROP TABLE IF EXISTS public.wall_segments CASCADE;
DROP TABLE IF EXISTS public.world_boss_defeats CASCADE;
DROP TABLE IF EXISTS public.world_burgs CASCADE;
DROP TABLE IF EXISTS public.world_events CASCADE;
DROP TABLE IF EXISTS public.world_states CASCADE;

DROP FUNCTION IF EXISTS public.deliver_caravan(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.raze_outpost(uuid) CASCADE;

-- =========================================================================
-- PHASE 2: NEW WORLD SCHEMA
-- =========================================================================

-- THE REALMS (8 kingdoms + Khar-Anum the free city)
CREATE TABLE public.realms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  epithet TEXT NOT NULL,
  aether TEXT NOT NULL,                -- 'Frost','Ember','Verdant','Tide','Storm','Dust','Hollow','None','Concord'
  culture TEXT NOT NULL,
  ruler_title TEXT NOT NULL,
  ruler_name TEXT NOT NULL,
  capital_x DOUBLE PRECISION NOT NULL,
  capital_y DOUBLE PRECISION NOT NULL,
  color TEXT NOT NULL DEFAULT '#888',
  sigil TEXT NOT NULL DEFAULT '✦',
  lore TEXT NOT NULL,
  arc_index INTEGER NOT NULL,           -- 0=Khar-Anum center; 1..8 along the crescent
  is_central BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.realms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Realms viewable by all authenticated" ON public.realms FOR SELECT TO authenticated USING (true);

-- TOWNS within realms
CREATE TABLE public.realm_towns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id UUID NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  town_type TEXT NOT NULL DEFAULT 'town',  -- 'capital','city','town','village','outpost'
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  population INTEGER NOT NULL DEFAULT 500,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.realm_towns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Towns viewable by all authenticated" ON public.realm_towns FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_realm_towns_realm ON public.realm_towns(realm_id);

-- GOODS catalog
CREATE TABLE public.goods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,               -- 'staple','luxury','exotic','contraband','ritual'
  rarity INTEGER NOT NULL DEFAULT 1,    -- 1..5
  base_price INTEGER NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  origin_realm_id UUID REFERENCES public.realms(id),
  icon TEXT NOT NULL DEFAULT '📦',
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.goods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Goods viewable by all authenticated" ON public.goods FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_goods_origin ON public.goods(origin_realm_id);

-- TOWN MARKETS — what each town buys/sells
CREATE TABLE public.town_market (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  town_id UUID NOT NULL REFERENCES public.realm_towns(id) ON DELETE CASCADE,
  good_id UUID NOT NULL REFERENCES public.goods(id) ON DELETE CASCADE,
  buy_price INTEGER NOT NULL,           -- price the town will pay (sell to town)
  sell_price INTEGER NOT NULL,          -- price the town charges (buy from town)
  stock INTEGER NOT NULL DEFAULT 0,
  demand INTEGER NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(town_id, good_id)
);
ALTER TABLE public.town_market ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Markets viewable by all authenticated" ON public.town_market FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_market_town ON public.town_market(town_id);

-- TRADER PROFILE — the player
CREATE TABLE public.trader_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  trader_name TEXT NOT NULL,
  home_realm_id UUID REFERENCES public.realms(id),
  current_town_id UUID REFERENCES public.realm_towns(id),
  tier TEXT NOT NULL DEFAULT 'caravaneer',  -- 'caravaneer','merchant','tradehouse','magnate'
  gold BIGINT NOT NULL DEFAULT 250,
  cart_capacity INTEGER NOT NULL DEFAULT 20,
  caravan_slots INTEGER NOT NULL DEFAULT 1,
  guild_standing INTEGER NOT NULL DEFAULT 0,
  total_profit BIGINT NOT NULL DEFAULT 0,
  trades_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trader_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trader profiles viewable by all authenticated" ON public.trader_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own trader profile" ON public.trader_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own trader profile" ON public.trader_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- INVENTORY — goods the trader carries
CREATE TABLE public.trader_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  good_id UUID NOT NULL REFERENCES public.goods(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  avg_cost INTEGER NOT NULL DEFAULT 0,  -- weighted-avg purchase price
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, good_id)
);
ALTER TABLE public.trader_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own inventory" ON public.trader_inventory FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_inventory_user ON public.trader_inventory(user_id);

-- WAREHOUSES — Trade House tier storage per realm
CREATE TABLE public.trader_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  town_id UUID NOT NULL REFERENCES public.realm_towns(id) ON DELETE CASCADE,
  capacity INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, town_id)
);
ALTER TABLE public.trader_warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own warehouses" ON public.trader_warehouses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- CARAVANS — in-transit cargo
CREATE TABLE public.trader_caravans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  origin_town_id UUID NOT NULL REFERENCES public.realm_towns(id),
  destination_town_id UUID NOT NULL REFERENCES public.realm_towns(id),
  cargo JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{good_id, qty, cost}]
  guards INTEGER NOT NULL DEFAULT 0,
  risk INTEGER NOT NULL DEFAULT 10,           -- 0..100
  departed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  arrives_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_transit', -- 'in_transit','arrived','raided','lost'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trader_caravans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own caravans" ON public.trader_caravans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_caravans_user ON public.trader_caravans(user_id);

-- REPUTATION per realm
CREATE TABLE public.realm_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  realm_id UUID NOT NULL REFERENCES public.realms(id) ON DELETE CASCADE,
  reputation INTEGER NOT NULL DEFAULT 0,    -- -100..+100
  trades_in_realm INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, realm_id)
);
ALTER TABLE public.realm_reputation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reputation" ON public.realm_reputation FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- CONTRACTS — quests from rulers / the Concord
CREATE TABLE public.trader_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  issuer_realm_id UUID REFERENCES public.realms(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  required_good_id UUID REFERENCES public.goods(id),
  required_quantity INTEGER NOT NULL DEFAULT 0,
  deliver_to_town_id UUID REFERENCES public.realm_towns(id),
  reward_gold INTEGER NOT NULL DEFAULT 0,
  reward_reputation INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'available',  -- 'available','accepted','completed','failed','expired'
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trader_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contracts" ON public.trader_contracts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER trg_trader_profiles_updated BEFORE UPDATE ON public.trader_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_trader_inventory_updated BEFORE UPDATE ON public.trader_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_realm_reputation_updated BEFORE UPDATE ON public.realm_reputation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_trader_contracts_updated BEFORE UPDATE ON public.trader_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_town_market_updated BEFORE UPDATE ON public.town_market FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- PHASE 3: NEW SIGNUP TRIGGER — make every new user a Caravaneer
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_trader()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_central_realm_id UUID;
  v_central_town_id UUID;
BEGIN
  SELECT id INTO v_central_realm_id FROM public.realms WHERE is_central = true LIMIT 1;
  SELECT id INTO v_central_town_id FROM public.realm_towns WHERE realm_id = v_central_realm_id AND town_type = 'capital' LIMIT 1;

  INSERT INTO public.trader_profiles (user_id, trader_name, home_realm_id, current_town_id, tier, gold)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Wanderer'),
    v_central_realm_id,
    v_central_town_id,
    'caravaneer',
    250
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_trader ON auth.users;
CREATE TRIGGER on_auth_user_created_trader
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_trader();

-- =========================================================================
-- PHASE 4: SEED THE WORLD
-- =========================================================================

-- Khar-Anum: the central free city (arc 0)
INSERT INTO public.realms (slug, name, epithet, aether, culture, ruler_title, ruler_name, capital_x, capital_y, color, sigil, lore, arc_index, is_central) VALUES
('khar-anum',   'Khar-Anum',   'The Hollow Star',     'Concord', 'Cosmopolitan free-city',         'High Concordant', 'Vey Talune',         500, 500, '#E8D7A8', '✶', 'A free city built where no kingdom dares claim ground. Every banner is welcome; none flies above the others. The Hollow Concord taxes only access — to the roads, to the markets, to the wells. Coin is its only god.', 0, true),
('ysmir-vale',  'Ysmir Vale',  'Where Winter Lingers','Frost',   'Pale highlanders of longhouses', 'Jarl-Queen',      'Halgrim Vyr',         220, 200, '#BFD9E6', '❆', 'Glacier-fed valleys ringed by white pine. The Vale folk speak in clipped vowels and trade in things that do not melt. Their salt cures any meat for a year and a day.', 1, false),
('halqaran',    'Halqaran',    'The Sun Below',       'Ember',   'Sun-bronzed tent-cities',        'Sun-Caliph',      'Mehir al-Saadan',     320, 180, '#E8B66A', '☀', 'A confederation of brass-tented nomads who follow the heat from oasis to oasis. They claim fire as inheritance; their ember-silk is woven by hand and warm even in Ysmir snow.', 2, false),
('vehruun',     'Vehruun',     'The Vine Throne',     'Verdant', 'Jungle city-state of vine spires','Bloomspeaker',   'Iskaye Mun',          440, 160, '#7CB46A', '❦', 'A spiral city grown from living wood. Every spire is older than the realm itself. Vehruun does not cut its trees; it asks them.', 3, false),
('olethros',    'Olethros',    'The Coral Crown',     'Tide',    'Coral citadels and lagoon traders','Sea-Magnate',    'Daron Vesh',          560, 160, '#5BA0B8', '❉', 'Built on the bones of a leviathan in shallow water. Olethrans speak in tides and never trust anything that does not float.', 4, false),
('drakkanmar',  'Drakkanmar',  'The Sky Crag',        'Storm',   'Cliff fortresses and sky-wardens','Storm-Marshal',  'Vael Drakkenmoor',    680, 180, '#7B7BC4', '⚡', 'Eyrie-cities clinging to vertical stone. Their stormsteel is forged in lightning struck anvils. They send messages by raptor and reply only at dawn.', 5, false),
('sephar-tul',  'Sephar-Tul',  'The Reading Tomb',    'Dust',    'Tomb-cities of scribe-priests',  'Vizier-Pontiff', 'Hep-Anira',           780, 220, '#C8A56B', '☥', 'A buried civilization that never quite died. Sephar-Tul exports its dead in painted linen and scripture-gold leaf. Their libraries are larger than their cities.', 6, false),
('ainwyrd',     'Ainwyrd',     'The Whispering Moor', 'Hollow',  'Misty moors of oracle covens',   'Veiled Matriarch','Mereth of the Veil',  680, 800, '#9C8FB8', '◐', 'Mist-drowned moorland where the dead are still consulted on tax policy. Their whisperglass shows the recent past; their oracles know exactly which side a coin will land.', 7, false),
('karzul',      'Karzûl',      'The Refusal',         'None',    'Iron oligarchy without priests', 'The Iron Council','First Hand Yorvek',   320, 820, '#4A4A52', '⚒', 'The eighth realm rejected the Aethers and pays the price in iron. Karzûl trades in black steel, slave-iron, and any contraband the other seven forbid. They keep no rulers, only a council of nine fists.', 8, false);

-- TOWNS (capitals + lesser settlements). Coordinates form a crescent around Khar-Anum.
WITH r AS (SELECT id, slug FROM public.realms)
INSERT INTO public.realm_towns (realm_id, name, town_type, x, y, population, description) VALUES
-- Khar-Anum
((SELECT id FROM r WHERE slug='khar-anum'), 'Khar-Anum',         'capital', 500, 500, 12000, 'The free city at the heart of the crescent. Every road begins here.'),
((SELECT id FROM r WHERE slug='khar-anum'), 'Wellgate',          'town',    470, 530,  1800, 'Outer market quarter, where caravans water their beasts.'),
((SELECT id FROM r WHERE slug='khar-anum'), 'Saltspur',          'village', 540, 480,   600, 'A waystation half-buried in dune.'),
-- Ysmir Vale
((SELECT id FROM r WHERE slug='ysmir-vale'), 'Halgrim-Hold',     'capital', 220, 200,  6000, 'Black timber and white snow. Seat of the Jarl-Queen.'),
((SELECT id FROM r WHERE slug='ysmir-vale'), 'Vorn',             'town',    180, 230,  1200, 'A salt-mining settlement on a frozen lake.'),
((SELECT id FROM r WHERE slug='ysmir-vale'), 'Iceweir',          'village', 250, 170,   400, 'Pelt-hunters and ice-fishers.'),
-- Halqaran
((SELECT id FROM r WHERE slug='halqaran'), 'Saadan',             'capital', 320, 180,  5500, 'Brass tent-city that follows the sun.'),
((SELECT id FROM r WHERE slug='halqaran'), 'Khel-Ouran',         'town',    290, 220,  1400, 'Spice-ash kilns at a deep oasis.'),
((SELECT id FROM r WHERE slug='halqaran'), 'Ras-Akhim',          'village', 360, 150,   500, 'Firegold prospectors.'),
-- Vehruun
((SELECT id FROM r WHERE slug='vehruun'), 'Vehruun-Zha',         'capital', 440, 160,  7000, 'A spiral grown from living wood.'),
((SELECT id FROM r WHERE slug='vehruun'), 'Mun-Lirae',           'town',    410, 200,  1600, 'A vine-canopied river port.'),
((SELECT id FROM r WHERE slug='vehruun'), 'Lethbough',           'village', 470, 130,   550, 'Dreamleaf farmers.'),
-- Olethros
((SELECT id FROM r WHERE slug='olethros'), 'Olethros-Sind',      'capital', 560, 160,  6500, 'Coral citadel on a sunken whale.'),
((SELECT id FROM r WHERE slug='olethros'), 'Vesh-Anar',          'town',    600, 200,  1300, 'Pearl-divers and kraken-renderers.'),
((SELECT id FROM r WHERE slug='olethros'), 'Tideholm',           'village', 530, 130,   480, 'Lagoon-village on stilts.'),
-- Drakkanmar
((SELECT id FROM r WHERE slug='drakkanmar'), 'Drakkenspire',     'capital', 680, 180,  6200, 'Eyrie-fortress carved into a black peak.'),
((SELECT id FROM r WHERE slug='drakkanmar'), 'Veylcrag',         'town',    720, 220,  1500, 'Stormsteel forges struck by lightning.'),
((SELECT id FROM r WHERE slug='drakkanmar'), 'Raptor''s Perch',  'village', 650, 150,   420, 'Falconers and sky-scouts.'),
-- Sephar-Tul
((SELECT id FROM r WHERE slug='sephar-tul'), 'Hep-Anira',        'capital', 780, 220,  5800, 'A library buried in sand. The capital reads itself daily.'),
((SELECT id FROM r WHERE slug='sephar-tul'), 'Sefti',            'town',    810, 270,  1100, 'Scribe-priests embalm and export.'),
((SELECT id FROM r WHERE slug='sephar-tul'), 'Tul-Khera',        'village', 760, 180,   500, 'Ivory-carvers in tomb hills.'),
-- Ainwyrd
((SELECT id FROM r WHERE slug='ainwyrd'), 'Ainwyrd-on-the-Veil', 'capital', 680, 800,  4900, 'A moor city forever in low fog.'),
((SELECT id FROM r WHERE slug='ainwyrd'), 'Hexrun',              'town',    720, 760,  1000, 'Hexroot harvesters and oracle covens.'),
((SELECT id FROM r WHERE slug='ainwyrd'), 'Mereth''s Hollow',    'village', 640, 830,   430, 'Whisperglass quarry.'),
-- Karzûl
((SELECT id FROM r WHERE slug='karzul'), 'Karzûl-Vor',           'capital', 320, 820,  5400, 'Iron-walled fortress-city. The Council sits here.'),
((SELECT id FROM r WHERE slug='karzul'), 'Slagmouth',            'town',    280, 780,  1300, 'Black-steel foundries belch night and day.'),
((SELECT id FROM r WHERE slug='karzul'), 'The Cinder Pits',      'village', 360, 850,   600, 'Smuggler camps the Council pretends not to know about.');

-- GOODS catalog (~60 items, each with origin)
WITH r AS (SELECT id, slug FROM public.realms)
INSERT INTO public.goods (slug, name, category, rarity, base_price, weight, origin_realm_id, icon, description) VALUES
-- Khar-Anum (services & finished goods)
('concord-script',   'Concord Script',     'luxury',     3, 80,  1, (SELECT id FROM r WHERE slug='khar-anum'), '📜', 'Letters of credit honored across every realm.'),
('caravan-charter',  'Caravan Charter',    'luxury',     3, 120, 1, (SELECT id FROM r WHERE slug='khar-anum'), '🪪', 'Right of safe passage stamped by the Concord.'),
('hollow-coin',      'Hollow Coin',        'staple',     2, 35,  1, (SELECT id FROM r WHERE slug='khar-anum'), '🪙', 'Coined where no king mints. Trusted because no one can forge it.'),
-- Ysmir Vale
('glacier-glass',    'Glacier-Glass',      'luxury',     3, 95,  3, (SELECT id FROM r WHERE slug='ysmir-vale'), '🧊', 'Translucent ice-amber chipped from blue glaciers.'),
('white-pelt',       'White Pelt',         'staple',     2, 40,  4, (SELECT id FROM r WHERE slug='ysmir-vale'), '🦊', 'Snow-fox furs from the highest valleys.'),
('frostsalt',        'Frostsalt',          'staple',     1, 20,  2, (SELECT id FROM r WHERE slug='ysmir-vale'), '❄', 'A pinch cures meat for a year and a day.'),
('ymar-mead',        'Ymar Mead',          'luxury',     3, 70,  3, (SELECT id FROM r WHERE slug='ysmir-vale'), '🍯', 'Honey-wine fermented in glacial caves.'),
('ironbark',         'Ironbark Plank',     'staple',     2, 30,  6, (SELECT id FROM r WHERE slug='ysmir-vale'), '🪵', 'Cold-hardened pine, harder than soft iron.'),
-- Halqaran
('firegold',         'Firegold',           'exotic',     4, 180, 1, (SELECT id FROM r WHERE slug='halqaran'),  '🔥', 'Veined gold with embers still trapped inside.'),
('spice-ash',        'Spice-Ash',          'luxury',     3, 65,  1, (SELECT id FROM r WHERE slug='halqaran'),  '🌶', 'Charred peppers ground to a crimson dust.'),
('ember-silk',       'Ember-Silk',         'luxury',     3, 110, 2, (SELECT id FROM r WHERE slug='halqaran'),  '🧣', 'Silk warm to the touch even in deepest cold.'),
('brass-bell',       'Brass Caravan-Bell', 'staple',     2, 28,  2, (SELECT id FROM r WHERE slug='halqaran'),  '🔔', 'Halqaran caravans are heard before they are seen.'),
('saadi-coffee',     'Saadi Coffee',       'luxury',     3, 55,  2, (SELECT id FROM r WHERE slug='halqaran'),  '☕', 'Roasted on hot brass for nine breaths exactly.'),
-- Vehruun
('living-wood',      'Living Wood',        'exotic',     4, 160, 5, (SELECT id FROM r WHERE slug='vehruun'),   '🌳', 'Cut wood that still puts out leaves.'),
('dreamleaf',        'Dreamleaf',          'exotic',     4, 140, 1, (SELECT id FROM r WHERE slug='vehruun'),   '🍃', 'Smoked, it shows you a road you have not yet walked.'),
('jade-resin',       'Jade-Resin',         'luxury',     3, 85,  2, (SELECT id FROM r WHERE slug='vehruun'),   '💎', 'Tree sap that hardens into translucent green.'),
('vine-rope',        'Vine-Rope',          'staple',     1, 18,  3, (SELECT id FROM r WHERE slug='vehruun'),   '🪢', 'Stronger than hemp, never rots.'),
('mun-honey',        'Mun-Honey',          'luxury',     2, 45,  2, (SELECT id FROM r WHERE slug='vehruun'),   '🍯', 'Vine-flower honey with a faint taste of rain.'),
-- Olethros
('pearl-iron',       'Pearl-Iron',         'exotic',     4, 175, 4, (SELECT id FROM r WHERE slug='olethros'),  '⚪', 'Iron grown like a pearl inside giant clams.'),
('deepsalt',         'Deepsalt',           'staple',     1, 15,  2, (SELECT id FROM r WHERE slug='olethros'),  '🧂', 'Black salt from the bottom of the lagoon.'),
('kraken-oil',       'Kraken Oil',         'exotic',     5, 220, 3, (SELECT id FROM r WHERE slug='olethros'),  '🦑', 'Burns blue. One drop lights a room for a week.'),
('coral-tile',       'Coral Tile',         'luxury',     3, 90,  4, (SELECT id FROM r WHERE slug='olethros'),  '🧱', 'Pink-veined building tiles harvested at low tide.'),
('lagoon-pearl',     'Lagoon Pearl',       'luxury',     3, 130, 1, (SELECT id FROM r WHERE slug='olethros'),  '🦪', 'Cultivated for three generations before harvest.'),
-- Drakkanmar
('stormsteel',       'Stormsteel Ingot',   'exotic',     4, 200, 5, (SELECT id FROM r WHERE slug='drakkanmar'),'⚙', 'Steel quenched in lightning-struck water.'),
('lightning-pitch',  'Lightning-Pitch',    'exotic',     4, 150, 2, (SELECT id FROM r WHERE slug='drakkanmar'),'⚡', 'A jar of trapped storm. Cracks if dropped.'),
('raptor-feather',   'Raptor Feather',     'luxury',     2, 50,  1, (SELECT id FROM r WHERE slug='drakkanmar'),'🪶', 'Plumes from the high eyries.'),
('crag-cheese',      'Crag-Cheese',        'staple',     2, 32,  2, (SELECT id FROM r WHERE slug='drakkanmar'),'🧀', 'Aged in cliffside caves where the wind never stops.'),
('skywarden-arrow',  'Skywarden Arrow',    'luxury',     3, 75,  1, (SELECT id FROM r WHERE slug='drakkanmar'),'🏹', 'Fletched for a falling shot from a great height.'),
-- Sephar-Tul
('bone-ivory',       'Bone-Ivory',         'luxury',     3, 105, 3, (SELECT id FROM r WHERE slug='sephar-tul'),'🦴', 'Carved from beasts older than memory.'),
('scripture-gold',   'Scripture-Gold Leaf','luxury',     4, 165, 1, (SELECT id FROM r WHERE slug='sephar-tul'),'📖', 'Gold beaten thin enough to read through.'),
('mummia',           'Mummia',             'ritual',     4, 190, 2, (SELECT id FROM r WHERE slug='sephar-tul'),'🏺', 'Tomb-resin used in healing — and in things less spoken.'),
('tul-papyrus',      'Tul Papyrus',        'staple',     2, 25,  1, (SELECT id FROM r WHERE slug='sephar-tul'),'📄', 'Reed-paper that lasts a thousand years.'),
('reading-stone',    'Reading-Stone',      'luxury',     3, 95,  2, (SELECT id FROM r WHERE slug='sephar-tul'),'🔍', 'Polished crystal that magnifies small script.'),
-- Ainwyrd
('whisperglass',     'Whisperglass',       'exotic',     4, 170, 2, (SELECT id FROM r WHERE slug='ainwyrd'),   '🪞', 'A mirror that briefly shows the recent past.'),
('soul-thread',      'Soul-Thread',        'ritual',     5, 240, 1, (SELECT id FROM r WHERE slug='ainwyrd'),   '🧵', 'Spun from mist on the right kind of moor at the right kind of dawn.'),
('hexroot',          'Hexroot',            'exotic',     4, 130, 1, (SELECT id FROM r WHERE slug='ainwyrd'),   '🌿', 'A bitter root that breaks small curses.'),
('moor-tea',         'Moor Tea',           'staple',     2, 38,  1, (SELECT id FROM r WHERE slug='ainwyrd'),   '🍵', 'Tea steeped over peat smoke.'),
('veil-candle',      'Veil-Candle',        'luxury',     3, 70,  2, (SELECT id FROM r WHERE slug='ainwyrd'),   '🕯', 'Lit at funerals and contract signings.'),
-- Karzûl
('black-steel',      'Black Steel Ingot',  'contraband', 4, 195, 5, (SELECT id FROM r WHERE slug='karzul'),    '🗡', 'Steel forged in coal-and-blood quench. Banned in three realms.'),
('slave-iron',       'Slave-Iron',         'contraband', 5, 260, 6, (SELECT id FROM r WHERE slug='karzul'),    '⛓', 'Iron made by hands that did not choose. Worth a fortune. Worth a noose.'),
('cinder-wine',      'Cinder Wine',        'exotic',     4, 145, 3, (SELECT id FROM r WHERE slug='karzul'),    '🍷', 'Black wine fermented in iron barrels.'),
('pit-coal',         'Pit-Coal',           'staple',     1, 12,  4, (SELECT id FROM r WHERE slug='karzul'),    '⬛', 'Burns hotter than any other in the crescent.'),
('forbidden-script', 'Forbidden Script',   'contraband', 5, 280, 1, (SELECT id FROM r WHERE slug='karzul'),    '📕', 'Books the seven realms ordered burned. Karzûl prints them.'),
('iron-mask',        'Iron Mask',          'luxury',     3, 90,  2, (SELECT id FROM r WHERE slug='karzul'),    '🎭', 'Worn by Council emissaries. Sold to those who wish they were.');

-- TOWN MARKETS — every town buys/sells a sensible mix.
-- Origin towns sell their realm's goods cheap and stock plenty.
-- Other realms buy them dear (especially distant ones).
INSERT INTO public.town_market (town_id, good_id, buy_price, sell_price, stock, demand)
SELECT
  t.id,
  g.id,
  CASE
    WHEN g.origin_realm_id = t.realm_id THEN GREATEST(1, ROUND(g.base_price * 0.55))   -- town pays poorly for local goods
    ELSE ROUND(g.base_price * (1.15 + random() * 0.6))                                 -- pays well for foreign goods
  END,
  CASE
    WHEN g.origin_realm_id = t.realm_id THEN ROUND(g.base_price * 0.85)                 -- sells local goods cheap
    ELSE ROUND(g.base_price * (1.30 + random() * 0.5))                                  -- charges premium for imports
  END,
  CASE
    WHEN g.origin_realm_id = t.realm_id THEN 80 + floor(random() * 120)::int           -- lots of local stock
    WHEN t.town_type IN ('capital','city') THEN 20 + floor(random() * 40)::int
    ELSE 5 + floor(random() * 20)::int
  END,
  CASE
    WHEN g.origin_realm_id = t.realm_id THEN 20 + floor(random() * 30)::int             -- low demand for own goods
    ELSE 50 + floor(random() * 50)::int
  END
FROM public.realm_towns t
CROSS JOIN public.goods g
WHERE
  -- Khar-Anum trades everything; other towns trade their own goods + a curated import slate
  (
    EXISTS (SELECT 1 FROM public.realms r WHERE r.id = t.realm_id AND r.is_central = true)
    OR g.origin_realm_id = t.realm_id
    OR (t.town_type IN ('capital','city') AND g.rarity <= 4 AND random() < 0.55)
    OR (t.town_type = 'town' AND g.rarity <= 3 AND random() < 0.35)
    OR (t.town_type = 'village' AND g.rarity <= 2 AND random() < 0.25)
  )
  -- Karzûl contraband only stocks naturally outside Karzûl in shady ports
  AND NOT (g.category = 'contraband' AND t.realm_id <> g.origin_realm_id AND random() < 0.85);
