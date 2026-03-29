import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { GameProvider } from '@/hooks/useGameState';
import GameLayout from '@/components/game/GameLayout';
import AuthPage from '@/pages/AuthPage';

function GameRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-3">
        <div className="text-4xl animate-float">🏰</div>
        <p className="font-display text-sm text-muted-foreground">Loading realm...</p>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <GameProvider>
      <GameLayout />
    </GameProvider>
  );
}

const Index = () => (
  <AuthProvider>
    <GameRouter />
  </AuthProvider>
);

export default Index;
