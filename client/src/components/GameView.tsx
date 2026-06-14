import { Pause } from "lucide-react";
import { GameCanvas } from "./GameCanvas.js";
import { Hud } from "./Hud.js";
import { TouchControls } from "./TouchControls.js";
import { TradePanel } from "./TradePanel.js";
import { useGameStore } from "../store.js";

export function GameView() {
  const commercialBreak = useGameStore((state) => state.commercialBreak);
  const setCommercialBreak = useGameStore((state) => state.setCommercialBreak);

  return (
    <section className="game-view">
      <button className="commercial-button" type="button" onClick={() => setCommercialBreak(true)} title="Take a funny break">
        <Pause size={18} aria-hidden />
        Break
      </button>
      <GameCanvas />
      <Hud />
      <TouchControls />
      <TradePanel />
      {commercialBreak && (
        <div className="break-overlay" role="dialog" aria-modal="true">
          <div className="break-copy">
            <h2>Jettis Safety Break</h2>
            <p>Hydrate the jetpack. Wiggle your fingers. The shadows can wait.</p>
            <button type="button" onClick={() => setCommercialBreak(false)}>
              Back to the island
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
