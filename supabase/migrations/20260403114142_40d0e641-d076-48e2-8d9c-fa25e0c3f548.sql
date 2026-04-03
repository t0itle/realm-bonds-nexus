
-- Roads between settlements
CREATE TABLE public.roads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  from_village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
  to_village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
  road_level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(from_village_id, to_village_id)
);

ALTER TABLE public.roads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roads" ON public.roads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own roads" ON public.roads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own roads" ON public.roads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own roads" ON public.roads FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_roads_updated_at BEFORE UPDATE ON public.roads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recurring trade routes
CREATE TABLE public.trade_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  from_village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
  to_village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
  gold INTEGER NOT NULL DEFAULT 0,
  wood INTEGER NOT NULL DEFAULT 0,
  stone INTEGER NOT NULL DEFAULT 0,
  food INTEGER NOT NULL DEFAULT 0,
  interval_seconds INTEGER NOT NULL DEFAULT 300,
  next_run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trade routes" ON public.trade_routes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own trade routes" ON public.trade_routes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trade routes" ON public.trade_routes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trade routes" ON public.trade_routes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_trade_routes_updated_at BEFORE UPDATE ON public.trade_routes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
