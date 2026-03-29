-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Wanderer',
  avatar_emoji TEXT NOT NULL DEFAULT '🛡️',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by all authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Wanderer'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Villages table
CREATE TABLE public.villages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'New Village',
  gold BIGINT NOT NULL DEFAULT 500,
  wood BIGINT NOT NULL DEFAULT 300,
  stone BIGINT NOT NULL DEFAULT 200,
  food BIGINT NOT NULL DEFAULT 150,
  level INT NOT NULL DEFAULT 1,
  last_resource_tick TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Villages viewable by all authenticated" ON public.villages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own village" ON public.villages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own village" ON public.villages
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_villages_updated_at
  BEFORE UPDATE ON public.villages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Buildings table
CREATE TABLE public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  level INT NOT NULL DEFAULT 1,
  position INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(village_id, position)
);

ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buildings viewable by all authenticated" ON public.buildings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own buildings" ON public.buildings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own buildings" ON public.buildings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own buildings" ON public.buildings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_buildings_updated_at
  BEFORE UPDATE ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Alliances table
CREATE TABLE public.alliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  tag TEXT NOT NULL UNIQUE CHECK (length(tag) BETWEEN 2 AND 5),
  description TEXT,
  leader_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alliances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alliances viewable by all authenticated" ON public.alliances
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create alliances" ON public.alliances
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = leader_id);
CREATE POLICY "Leaders can update their alliance" ON public.alliances
  FOR UPDATE TO authenticated USING (auth.uid() = leader_id);

CREATE TRIGGER update_alliances_updated_at
  BEFORE UPDATE ON public.alliances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Alliance members
CREATE TABLE public.alliance_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id UUID NOT NULL REFERENCES public.alliances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'officer', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.alliance_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alliance members viewable by all authenticated" ON public.alliance_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join alliances" ON public.alliance_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave alliances" ON public.alliance_members
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Auto-create village on signup
CREATE OR REPLACE FUNCTION public.handle_new_village()
RETURNS TRIGGER AS $$
DECLARE
  village_id UUID;
BEGIN
  INSERT INTO public.villages (user_id, name)
  VALUES (NEW.id, 'Village of ' || COALESCE(NEW.raw_user_meta_data->>'display_name', 'Wanderer'))
  RETURNING id INTO village_id;
  
  INSERT INTO public.buildings (village_id, user_id, type, level, position) VALUES
    (village_id, NEW.id, 'townhall', 1, 4),
    (village_id, NEW.id, 'farm', 1, 7),
    (village_id, NEW.id, 'lumbermill', 1, 3);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_village
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_village();

-- Indexes
CREATE INDEX idx_villages_user_id ON public.villages(user_id);
CREATE INDEX idx_buildings_village_id ON public.buildings(village_id);
CREATE INDEX idx_alliance_members_alliance ON public.alliance_members(alliance_id);