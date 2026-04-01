import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseProfileParams {
  villageId: string | null;
  user: { id: string } | null;
  setVillageNameLocal: (name: string) => void;
  setDisplayNameLocal: (name: string) => void;
  setAvatarUrlLocal: (url: string | null) => void;
}

export function useProfile({
  villageId,
  user,
  setVillageNameLocal,
  setDisplayNameLocal,
  setAvatarUrlLocal,
}: UseProfileParams) {
  const setVillageName = useCallback(async (name: string) => {
    if (!villageId || !name.trim()) return false;
    const trimmed = name.trim().slice(0, 30);
    setVillageNameLocal(trimmed);
    await supabase.from('villages').update({ name: trimmed }).eq('id', villageId);
    return true;
  }, [villageId, setVillageNameLocal]);

  const setDisplayName = useCallback(async (name: string) => {
    if (!user || !name.trim()) return false;
    const trimmed = name.trim().slice(0, 20);
    setDisplayNameLocal(trimmed);
    await supabase.from('profiles').update({ display_name: trimmed }).eq('user_id', user.id);
    return true;
  }, [user, setDisplayNameLocal]);

  const setAvatarUrl = useCallback((url: string | null) => {
    setAvatarUrlLocal(url);
    if (user) {
      supabase.from('profiles').update({ avatar_url: url } as any).eq('user_id', user.id).then();
    }
  }, [user, setAvatarUrlLocal]);

  return { setVillageName, setDisplayName, setAvatarUrl };
}
