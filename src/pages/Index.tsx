import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { TraderProvider } from '@/hooks/useTrader';
import TraderLayout from '@/components/trader/TraderLayout';
import LandingPage from '@/pages/LandingPage';

function GameRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-3">
        <div className="text-4xl animate-float">✶</div>
        <p className="font-display text-sm text-muted-foreground">The Hollow Star awakens...</p>
      </div>
    );
  }

  if (!user) return <LandingPage />;

  return (
    <TraderProvider>
      <TraderLayout />
    </TraderProvider>
  );
}

const Index = () => (
  <AuthProvider>
    <GameRouter />
  </AuthProvider>
);

export default Index;
