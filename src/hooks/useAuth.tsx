import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (displayName: string, password: string, email?: string) => Promise<{ error: any }>;
  signIn: (identifier: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function usernameToEmail(username: string): string {
  const sanitized = username.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return `${sanitized}@realm.local`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let initialStateResolved = false;

    const applySession = (nextSession: Session | null) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    };

    const resolveInitialState = (nextSession: Session | null) => {
      if (initialStateResolved) return;
      initialStateResolved = true;
      applySession(nextSession);
    };

    const initTimeout = window.setTimeout(() => {
      console.error('Auth bootstrap timed out; falling back to signed-out state.');
      resolveInitialState(null);
    }, 4000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.clearTimeout(initTimeout);
      if (!initialStateResolved) {
        initialStateResolved = true;
      }
      applySession(session);
    });

    void supabase.auth.getSession()
      .then(({ data: { session } }) => {
        window.clearTimeout(initTimeout);
        resolveInitialState(session);
      })
      .catch((error) => {
        console.error('Failed to initialize auth session.', error);
        window.clearTimeout(initTimeout);
        resolveInitialState(null);
      });

    return () => {
      isMounted = false;
      window.clearTimeout(initTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (displayName: string, password: string, email?: string) => {
    const finalEmail = email && email.trim() ? email.trim() : usernameToEmail(displayName);
    const { error } = await supabase.auth.signUp({
      email: finalEmail,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signIn = async (identifier: string, password: string) => {
    // If identifier looks like an email, use it directly; otherwise convert username to email
    const email = identifier.includes('@') ? identifier : usernameToEmail(identifier);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
