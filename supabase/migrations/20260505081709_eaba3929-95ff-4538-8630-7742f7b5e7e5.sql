-- Attach trigger and backfill trader profiles
DROP TRIGGER IF EXISTS on_auth_user_created_trader ON auth.users;
CREATE TRIGGER on_auth_user_created_trader
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_trader();

-- Backfill existing users
INSERT INTO public.trader_profiles (user_id, trader_name, home_realm_id, current_town_id, tier, gold)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1), 'Wanderer'),
  (SELECT id FROM public.realms WHERE is_central = true LIMIT 1),
  (SELECT t.id FROM public.realm_towns t JOIN public.realms r ON r.id = t.realm_id WHERE r.is_central = true AND t.town_type = 'capital' LIMIT 1),
  'caravaneer',
  250
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.trader_profiles p WHERE p.user_id = u.id);