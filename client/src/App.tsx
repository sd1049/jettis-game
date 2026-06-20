import { Gamepad2 } from "lucide-react";
import { DarknessGameView } from "./components/DarknessGameView.js";
import { GameView } from "./components/GameView.js";
import { JoinScreen } from "./components/JoinScreen.js";
import { useKeyboardControls } from "./controls.js";
import { useDarknessKeyboardControls } from "./darknessControls.js";
import { useDarknessStore } from "./darknessStore.js";
import { useGameStore } from "./store.js";

export function App() {
  const world = useGameStore((state) => state.world);
  const status = useGameStore((state) => state.status);
  const darknessWorld = useDarknessStore((state) => state.world);
  const darknessStatus = useDarknessStore((state) => state.status);
  useKeyboardControls();
  useDarknessKeyboardControls();

  return (
    <main className="app-shell">
      <div className="brand-chip">
        <Gamepad2 size={18} aria-hidden />
        <span>Jettis Game</span>
      </div>
      {darknessWorld && darknessStatus === "connected" ? (
        <DarknessGameView />
      ) : world && status === "connected" ? (
        <GameView />
      ) : (
        <JoinScreen />
      )}
    </main>
  );
}
