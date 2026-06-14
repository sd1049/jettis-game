import { Gamepad2 } from "lucide-react";
import { GameView } from "./components/GameView.js";
import { JoinScreen } from "./components/JoinScreen.js";
import { useKeyboardControls } from "./controls.js";
import { useGameStore } from "./store.js";

export function App() {
  const world = useGameStore((state) => state.world);
  const status = useGameStore((state) => state.status);
  useKeyboardControls();

  return (
    <main className="app-shell">
      <div className="brand-chip">
        <Gamepad2 size={18} aria-hidden />
        <span>Jettis Game</span>
      </div>
      {world && status === "connected" ? <GameView /> : <JoinScreen />}
    </main>
  );
}
