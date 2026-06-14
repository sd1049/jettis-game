import type { ItemId } from "@jettis/shared";
import { useGameStore } from "../store.js";

const quickItems: ItemId[] = ["wood", "glass", "berries", "fish", "booster", "light"];

export function TradePanel() {
  const trade = useGameStore((state) => state.activeTrade);
  const playerId = useGameStore((state) => state.playerId);
  const world = useGameStore((state) => state.world);
  const send = useGameStore((state) => state.send);

  if (!trade || trade.status !== "pending" || !playerId || !world) {
    return null;
  }

  const player = world.players[playerId];
  const otherId = trade.playerAId === playerId ? trade.playerBId : trade.playerAId;
  const other = world.players[otherId];
  const mine = trade.offers[playerId];
  const theirs = trade.offers[otherId];

  return (
    <div className="trade-panel">
      <h2>Direct Trade</h2>
      <p>{other ? `Trading with ${other.name}` : "Waiting for player"}</p>
      <div className="trade-offers">
        <div>
          <strong>Your offer</strong>
          <span>{formatOffer(mine?.items ?? {})}</span>
        </div>
        <div>
          <strong>Their offer</strong>
          <span>{formatOffer(theirs?.items ?? {})}</span>
        </div>
      </div>
      <div className="trade-items">
        {quickItems.map((item) => (
          <button
            key={item}
            type="button"
            disabled={(player?.inventory[item] ?? 0) <= 0}
            onClick={() => send({ type: "update_trade", payload: { tradeId: trade.id, items: { [item]: 1 } } })}
          >
            {item.replaceAll("_", " ")}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => send({ type: "accept_trade", payload: { tradeId: trade.id } })}>
        {mine?.accepted ? "Accepted" : "Accept trade"}
      </button>
    </div>
  );
}

function formatOffer(items: Partial<Record<ItemId, number>>) {
  const entries = Object.entries(items).filter(([, count]) => (count ?? 0) > 0);
  return entries.length ? entries.map(([item, count]) => `${item} x${count}`).join(", ") : "Nothing yet";
}
