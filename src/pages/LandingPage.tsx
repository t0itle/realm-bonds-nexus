import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { lovable } from '@/integrations/lovable/index';
import ThemeToggle from '@/components/ThemeToggle';

function InlineAuth() {
  const { signIn, signUp } = useAuth();
  const [expanded, setExpanded] = useState<'login' | 'signup' | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmail, setShowEmail] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggle = (panel: 'login' | 'signup') => {
    setExpanded(expanded === panel ? null : panel);
    setError('');
    setUsername('');
    setEmail('');
    setPassword('');
    setShowEmail(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Ruler name is required'); return; }
    setLoading(true);
    const result = await signUp(username.trim(), password, showEmail ? email : undefined);
    if (result.error) setError(result.error.message);
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const identifier = username.trim();
    if (!identifier) { setError('Enter your username or email'); return; }
    setLoading(true);
    const result = await signIn(identifier, password);
    if (result.error) setError(result.error.message);
    setLoading(false);
  };

  const inputClass = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result?.error) setError(String(result.error));
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed');
    }
    setGoogleLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      {/* Google SSO */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-5 py-3.5 hover:bg-secondary/50 transition-colors disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span className="font-display text-sm text-foreground font-bold">
          {googleLoading ? 'Connecting...' : 'Sign in with Google'}
        </span>
      </motion.button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] text-muted-foreground">or use a username</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Sign Up Accordion */}
      <div className="rounded-xl overflow-hidden border-glow">
        <button
          onClick={() => toggle('signup')}
          className="w-full flex items-center justify-between px-5 py-4 bg-primary/10 hover:bg-primary/20 transition-colors"
        >
          <span className="font-display text-sm text-primary font-bold">⚔️ Forge Your Kingdom</span>
          <motion.span animate={{ rotate: expanded === 'signup' ? 180 : 0 }} className="text-primary text-xs">▼</motion.span>
        </button>
        <AnimatePresence>
          {expanded === 'signup' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <form onSubmit={handleSignUp} className="p-5 space-y-3 game-panel rounded-none border-t-0">
                <div>
                  <label className="text-xs font-display text-muted-foreground block mb-1">Ruler Name</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Lord Shadowmere" required className={inputClass} />
                </div>
                {showEmail ? (
                  <div>
                    <label className="text-xs font-display text-muted-foreground block mb-1">Email <span className="text-muted-foreground/60">(optional)</span></label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ruler@realm.com" className={inputClass} />
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowEmail(true)} className="text-[10px] text-primary hover:underline">
                    + Add email (optional, for password recovery)
                  </button>
                )}
                <div>
                  <label className="text-xs font-display text-muted-foreground block mb-1">Password</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={6} className={inputClass} />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <motion.button whileTap={{ scale: 0.95 }} type="submit" disabled={loading}
                  className="w-full bg-primary text-primary-foreground font-display font-bold py-3 rounded-lg glow-gold disabled:opacity-50">
                  {loading ? '...' : 'Begin Your Reign'}
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sign In Accordion */}
      <div className="rounded-xl overflow-hidden border-glow">
        <button
          onClick={() => toggle('login')}
          className="w-full flex items-center justify-between px-5 py-4 bg-secondary/50 hover:bg-secondary/80 transition-colors"
        >
          <span className="font-display text-sm text-foreground font-bold">🏰 Return to Your Kingdom</span>
          <motion.span animate={{ rotate: expanded === 'login' ? 180 : 0 }} className="text-muted-foreground text-xs">▼</motion.span>
        </button>
        <AnimatePresence>
          {expanded === 'login' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <form onSubmit={handleSignIn} className="p-5 space-y-3 game-panel rounded-none border-t-0">
                <div>
                  <label className="text-xs font-display text-muted-foreground block mb-1">Username or Email</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username or email" required className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-display text-muted-foreground block mb-1">Password</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={6} className={inputClass} />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <motion.button whileTap={{ scale: 0.95 }} type="submit" disabled={loading}
                  className="w-full bg-secondary text-foreground font-display font-bold py-3 rounded-lg border border-border disabled:opacity-50">
                  {loading ? '...' : 'Enter the Realm'}
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const LORE_SECTIONS = [
  {
    emoji: '🌍',
    title: 'A World Shattered',
    body: 'In the age before memory, the realm was whole — a single kingdom stretching from the Frostgate mountains to the Emerald Coast. Then came the Sundering. The great cataclysm fractured the land into a thousand warring territories, and the throne sits empty still. Ancient magic bleeds from the cracks in the earth, and the old gods whisper from forgotten temples.',
  },
  {
    emoji: '⚔️',
    title: 'Conquer or Perish',
    body: "Every ruler begins with nothing but a crumbling village and a dream of empire. Raise armies of spearmen, archers, and cavalry. Forge alliances with neighboring kingdoms or crush them beneath your heel. The Blighted Wastes crawl with undead legions, and the Dragon's Maw guards treasures that could buy a continent. Only the bold survive.",
  },
  {
    emoji: '🏗️',
    title: 'Build Your Legacy',
    body: 'Stone by stone, timber by timber — transform your village into an unassailable fortress. Construct farms to feed your growing population, lumber mills to fuel your war machine, and barracks to train elite soldiers. Upgrade your town hall to unlock devastating technologies that will make your enemies tremble.',
  },
  {
    emoji: '🤝',
    title: 'Forge Alliances',
    body: 'No ruler conquers alone. Form powerful alliances with other players — share resources, coordinate attacks, and dominate the world map together. Send envoys to NPC kingdoms for trade deals, or plunder their vaults if diplomacy fails. Trust is a weapon. Betrayal is an art.',
  },
  {
    emoji: '🗺️',
    title: 'Infinite Frontier',
    body: 'The world stretches endlessly in every direction — a procedurally generated frontier teeming with hostile kingdoms, mysterious ruins, wandering merchants, and dark portals to unknown dimensions. The further you explore from the heartlands, the greater the danger… and the greater the reward.',
  },
];

const FEATURES = [
  { icon: '🏰', label: 'Build & upgrade your village' },
  { icon: '⚔️', label: 'Train armies & wage war' },
  { icon: '🌍', label: 'Explore an infinite world map' },
  { icon: '🤝', label: 'Form alliances & share resources' },
  { icon: '👑', label: 'Conquer NPC kingdoms' },
  { icon: '🐉', label: 'Battle legendary creatures' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      {/* Top bar with theme toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-16 pb-12 text-center">
        {/* Ambient glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 w-[300px] h-[200px] rounded-full bg-destructive/5 blur-[80px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 space-y-4"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="text-7xl mb-2"
          >
            🏰
          </motion.div>

          <h1 className="font-display text-3xl sm:text-5xl font-black text-foreground text-shadow-gold leading-tight">
            Realm of Shadows
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Build your kingdom. Forge alliances. Conquer an <span className="text-primary font-semibold">infinite world</span> filled with ancient magic, warring empires, and untold riches.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {FEATURES.map(f => (
              <span key={f.label} className="inline-flex items-center gap-1.5 bg-secondary/60 border border-border rounded-full px-3 py-1.5 text-[11px] text-foreground">
                <span>{f.icon}</span>{f.label}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Auth Section */}
      <section className="px-6 pb-12">
        <InlineAuth />
      </section>

      {/* Divider */}
      <div className="flex items-center gap-4 px-8 pb-8">
        <div className="flex-1 h-px bg-border" />
        <span className="font-display text-xs text-muted-foreground tracking-widest">THE LORE</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Lore sections */}
      <section className="px-6 pb-16 space-y-8 max-w-2xl mx-auto">
        {LORE_SECTIONS.map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="game-panel border-glow rounded-xl p-5 space-y-2"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{section.emoji}</span>
              <h3 className="font-display text-base text-foreground font-bold">{section.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
          </motion.div>
        ))}
      </section>

      {/* Bottom CTA */}
      <section className="px-6 pb-20">
        <div className="text-center space-y-4 mb-6">
          <h2 className="font-display text-xl text-foreground text-shadow-gold font-bold">
            Your throne awaits, ruler.
          </h2>
          <p className="text-sm text-muted-foreground">No email required. Just pick a name and begin.</p>
        </div>
        <InlineAuth />
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 text-center">
        <p className="text-[10px] text-muted-foreground">© 2026 Realm of Shadows. All rights reserved.</p>
      </footer>
    </div>
  );
}
