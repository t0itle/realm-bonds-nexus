import { motion } from 'framer-motion';
import { useTheme } from '@/hooks/useTheme';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={toggleTheme}
      className={`w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-card text-foreground text-sm transition-colors hover:bg-secondary ${className}`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </motion.button>
  );
}
