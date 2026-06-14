import { ArrowDown, Blocks, Droplets, Hammer, Navigation, Rocket } from "lucide-react";
import { useGameStore } from "../store.js";

export function TouchControls() {
  const send = useGameStore((state) => state.send);
  const selectedBlock = useGameStore((state) => state.selectedBlock);
  const selectedBlockType = useGameStore((state) => state.selectedBlockType);
  const player = useGameStore((state) =>
    state.world && state.playerId ? state.world.players[state.playerId] : undefined
  );
  const target = selectedBlock?.position ?? player?.position ?? { x: 11, y: 8, z: 11 };

  return (
    <div className="touch-controls">
      <button
        type="button"
        onPointerDown={() =>
          send({
            type: "player_input",
            payload: { moveX: 0, moveZ: 0, lookY: 0, jump: false, fly: true, descend: false, sprint: false }
          })
        }
      >
        <Rocket size={18} aria-hidden />
        Fly
      </button>
      <button
        type="button"
        onClick={() =>
          send({
            type: "player_input",
            payload: { moveX: 0, moveZ: 0, lookY: 0, jump: false, fly: false, descend: true, sprint: false }
          })
        }
      >
        <ArrowDown size={18} aria-hidden />
        Down
      </button>
      <button type="button" onClick={() => selectedBlock && useGameStore.getState().setTapTarget(selectedBlock.position)}>
        <Navigation size={18} aria-hidden />
        Move
      </button>
      <button type="button" onClick={() => send({ type: "use_tool", payload: { tool: "water", target } })}>
        <Droplets size={18} aria-hidden />
        Spray
      </button>
      <button type="button" onClick={() => send({ type: "edit_block", payload: { action: "break", position: target } })}>
        <Hammer size={18} aria-hidden />
        Break
      </button>
      <button
        type="button"
        onClick={() =>
          send({
            type: "edit_block",
            payload: { action: "place", position: { ...target, y: target.y + 1 }, blockType: selectedBlockType }
          })
        }
      >
        <Blocks size={18} aria-hidden />
        Place
      </button>
    </div>
  );
}
