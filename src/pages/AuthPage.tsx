import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { lovable } from '@/integrations/lovable/index';
import { motion } from 'framer-motion';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmail, setShowEmail] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isSignUp) {
      if (!username.trim()) {
        setError('Ruler name is required');
        setLoading(false);
        return;
      }
      const result = await signUp(username.trim(), password, showEmail ? email : undefined);
      if (result.error) setError(result.error.message);
    } else {
      // Sign in: accept username or email
      const identifier = email.trim() || username.trim();
      if (!identifier) {
        setError('Enter your username or email');
        setLoading(false);
        return;
      }
      const result = await signIn(identifier, password);
      if (result.error) setError(result.error.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        {/* Logo */}
        <div className="text-center space-y-2">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="text-5xl"
          >
            🏰
          </motion.div>
          <h1 className="font-display text-2xl font-bold text-foreground text-shadow-gold">
            Everbloom Kingdoms
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? 'Create your kingdom' : 'Return to your kingdom'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-display text-muted-foreground block mb-1">
              {isSignUp ? 'Ruler Name' : 'Username or Email'}
            </label>
            <input
              type="text"
              value={isSignUp ? username : (email || username)}
              onChange={e => isSignUp ? setUsername(e.target.value) : (e.target.value.includes('@') ? setEmail(e.target.value) : setUsername(e.target.value))}
              placeholder={isSignUp ? 'Lord Shadowmere' : 'Username or email'}
              required
              className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {isSignUp && (
            <>
              {showEmail ? (
                <div>
                  <label className="text-sm font-display text-muted-foreground block mb-1">
                    Email <span className="text-muted-foreground/60">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ruler@realm.com"
                    className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowEmail(true)}
                  className="text-sm text-primary hover:underline"
                >
                  + Add email (optional, for password recovery)
                </button>
              )}
            </>
          )}

          <div>
            <label className="text-sm font-display text-muted-foreground block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <motion.button
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-display font-bold py-3 rounded-lg glow-gold disabled:opacity-50"
          >
            {loading ? '...' : isSignUp ? 'Forge Kingdom' : 'Enter Realm'}
          </motion.button>
        </form>

        {/* Google SSO */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-card border border-border rounded-lg px-4 py-2.5 hover:bg-secondary/50 transition-colors disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-sm font-display font-bold text-foreground">
              {googleLoading ? '...' : 'Sign in with Google'}
            </span>
          </motion.button>
        </div>

        <button
          onClick={() => { setIsSignUp(!isSignUp); setError(''); setShowEmail(false); setEmail(''); setUsername(''); }}
          className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          {isSignUp ? 'Already have a kingdom? Sign in' : "New ruler? Create your kingdom"}
        </button>
      </motion.div>
    </div>
  );
}
