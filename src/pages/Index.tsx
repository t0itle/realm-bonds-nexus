import { GameProvider } from '@/hooks/useGameState';
import GameLayout from '@/components/game/GameLayout';

const Index = () => {
  return (
    <GameProvider>
      <GameLayout />
    </GameProvider>
  );
};

export default Index;
