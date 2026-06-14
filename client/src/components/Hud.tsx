import {
  Backpack,
  Blocks,
  Droplets,
  Fish,
  Flag,
  Hand,
  Hammer,
  Save,
  SprayCan,
  SunMoon,
  Wheat
} from "lucide-react";
import { BLOCK_TYPES, type BlockType, type ItemId } from "@jettis/shared";
import { getLocalPlayer, useGameStore } from "../store.js";

const blockOptions = BLOCK_TYPES.filter((block) => !["water", "lava"].includes(block));

export function Hud() {
  const world = useGameStore((state) => state.world);
  const playerId = useGameStore((state) => state.playerId);
  const selectedBlock = useGameStore((state) => state.selectedBlock);
  const selectedBlockType = useGameStore((state) => state.selectedBlockType);
  const setSelectedBlockType = useGameStore((state) => state.setSelectedBlockType);
  const send = useGameStore((state) => state.send);
  const messages = useGameStore((state) => state.messages);
  const player = getLocalPlayer(world, playerId);

  if (!world || !player) {
    return null;
  }

  const target = selectedBlock?.position ?? player.position;
  const placeTarget = selectedBlock ? { ...selectedBlock.position, y: selectedBlock.position.y + 1 } : player.position;
  const otherPlayer = Object.values(world.players).find((candidate) => candidate.id !== player.id);

  return (
    <aside className="hud">
      <div className="status-row">
        <span className="world-code">Code {world.code}</span>
        <span>
          <SunMoon size={16} aria-hidden />
          {world.dayNight.phase} {world.dayNight.nightCount > 0 ? world.dayNight.nightCount : ""}
        </span>
        <span>{player.isSafe ? "Safe base" : "Outside"}</span>
      </div>

      <div className="meters">
        <Meter label="Health" value={player.health} color="#4fb477" />
        <Meter label="Food" value={player.hunger} color="#f2b84b" />
        <Meter label="Jetpack" value={(player.jetpackCharge / player.gear.jetpackChargeMax) * 100} color="#3ea7ff" />
      </div>

      <div className="tool-row">
        <button type="button" onClick={() => send({ type: "edit_block", payload: { action: "break", position: target } })}>
          <Hammer size={18} aria-hidden />
          Break
        </button>
        <button
          type="button"
          onClick={() =>
            send({ type: "edit_block", payload: { action: "place", position: placeTarget, blockType: selectedBlockType } })
          }
        >
          <Blocks size={18} aria-hidden />
          Place
        </button>
        <button type="button" onClick={() => send({ type: "use_tool", payload: { tool: "water", target } })}>
          <SprayCan size={18} aria-hidden />
          Spray
        </button>
        <button type="button" onClick={() => send({ type: "use_tool", payload: { tool: "gather", target } })}>
          <Wheat size={18} aria-hidden />
          Gather
        </button>
        <button type="button" onClick={() => send({ type: "use_tool", payload: { tool: "fish", target } })}>
          <Fish size={18} aria-hidden />
          Fish
        </button>
        <button type="button" onClick={() => send({ type: "use_tool", payload: { tool: "victory_flag", target } })}>
          <Flag size={18} aria-hidden />
          Flag
        </button>
        <button type="button" onClick={() => send({ type: "request_save", payload: {} })}>
          <Save size={18} aria-hidden />
          Save
        </button>
        <button
          type="button"
          disabled={!otherPlayer}
          onClick={() => otherPlayer && send({ type: "start_trade", payload: { otherPlayerId: otherPlayer.id } })}
        >
          <Hand size={18} aria-hidden />
          Trade
        </button>
      </div>

      <div className="block-picker" aria-label="Block picker">
        {blockOptions.map((block) => (
          <button
            key={block}
            type="button"
            className={block === selectedBlockType ? "selected" : ""}
            onClick={() => setSelectedBlockType(block as BlockType)}
          >
            <span className={`block-swatch block-${block}`} />
            {block}
          </button>
        ))}
      </div>

      <div className="inventory">
        <Backpack size={18} aria-hidden />
        {Object.entries(player.inventory)
          .filter(([, count]) => (count ?? 0) > 0)
          .slice(0, 10)
          .map(([item, count]) => (
            <span key={item}>
              {formatItem(item as ItemId)} {count}
            </span>
          ))}
      </div>

      <div className="target-line">
        <Droplets size={16} aria-hidden />
        Target: {selectedBlock ? `${selectedBlock.type ?? "space"} ${selectedBlock.position.x},${selectedBlock.position.y},${selectedBlock.position.z}` : "tap or click a block"}
      </div>

      <div className="messages">
        {messages.map((message, index) => (
          <p key={`${message}-${index}`}>{message}</p>
        ))}
      </div>
    </aside>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="meter">
      <span>{label}</span>
      <div>
        <i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      </div>
    </div>
  );
}

function formatItem(item: ItemId) {
  return item.replaceAll("_", " ");
}
