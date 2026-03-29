import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
            Realm of Shadows
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? 'Create your kingdom' : 'Return to your kingdom'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-display text-muted-foreground block mb-1">
              {isSignUp ? 'Ruler Name' : 'Username or Email'}
            </label>
            <input
              type="text"
              value={isSignUp ? username : (email || username)}
              onChange={e => isSignUp ? setUsername(e.target.value) : (e.target.value.includes('@') ? setEmail(e.target.value) : setUsername(e.target.value))}
              placeholder={isSignUp ? 'Lord Shadowmere' : 'Username or email'}
              required
              className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {isSignUp && (
            <>
              {showEmail ? (
                <div>
                  <label className="text-xs font-display text-muted-foreground block mb-1">
                    Email <span className="text-muted-foreground/60">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ruler@realm.com"
                    className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowEmail(true)}
                  className="text-[10px] text-primary hover:underline"
                >
                  + Add email (optional, for password recovery)
                </button>
              )}
            </>
          )}

          <div>
            <label className="text-xs font-display text-muted-foreground block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
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

        <button
          onClick={() => { setIsSignUp(!isSignUp); setError(''); setShowEmail(false); setEmail(''); setUsername(''); }}
          className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          {isSignUp ? 'Already have a kingdom? Sign in' : "New ruler? Create your kingdom"}
        </button>
      </motion.div>
    </div>
  );
}
