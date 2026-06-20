import { useEffect, useRef, type PointerEvent } from "react";
import { Coins, Home, Moon, Save, Shield, Zap } from "lucide-react";
import {
  DARKNESS_HOUSE_PRICE,
  type DarknessPlayerState,
  type DarknessWorldState
} from "@jettis/shared";
import { getLocalDarknessPlayer, useDarknessStore } from "../darknessStore.js";

export function DarknessGameView() {
  const world = useDarknessStore((state) => state.world);
  const playerId = useDarknessStore((state) => state.playerId);
  const send = useDarknessStore((state) => state.send);
  const messages = useDarknessStore((state) => state.messages);
  const player = getLocalDarknessPlayer(world, playerId);
  const pointerMovement = useDarknessPointerMovement(world, player);

  if (!world || !player) {
    return null;
  }

  const now = Date.now();
  const winner = world.winnerPlayerId ? world.players[world.winnerPlayerId] : undefined;
  const zapReady = Math.max(0, player.zapCooldownUntil - now);
  const shieldReady = Math.max(0, player.shieldCooldownUntil - now);
  const shieldActive = Math.max(0, player.shieldActiveUntil - now);
  const stunned = Math.max(0, player.stunnedUntil - now);

  return (
    <section className={`darkness-view ${world.dayNight.phase === "night" ? "night" : "morning"}`}>
      <div className="darkness-map-wrap">
        <svg
          className="darkness-map"
          viewBox={`0 0 ${world.size.width} ${world.size.height}`}
          role="img"
          aria-label="Survival in the Darkness top-down map"
          {...pointerMovement}
        >
          <defs>
            <radialGradient id="coinGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff6a7" />
              <stop offset="100%" stopColor="#d89c25" />
            </radialGradient>
          </defs>
          <rect width={world.size.width} height={world.size.height} fill="#27323f" />
          <path d="M0 520 C160 470 260 580 420 530 C620 460 700 560 960 490 L960 640 L0 640 Z" fill="#1b2630" />
          <path d="M0 80 C180 130 310 40 500 88 C650 126 760 54 960 96 L960 0 L0 0 Z" fill="#344151" />
          {world.caves.map((cave) => (
            <g key={cave.id}>
              <ellipse cx={cave.position.x} cy={cave.position.y} rx={cave.radius} ry={cave.radius * 0.72} fill="#151c24" />
              <ellipse
                cx={cave.position.x}
                cy={cave.position.y + 9}
                rx={cave.radius * 0.58}
                ry={cave.radius * 0.42}
                fill="#090e13"
              />
            </g>
          ))}
          <g className="darkness-house">
            <rect
              x={world.house.position.x - 48}
              y={world.house.position.y - 42}
              width="96"
              height="82"
              rx="7"
              fill={world.house.ownerPlayerId ? "#e7c57a" : "#9c6743"}
              stroke="#fff0b8"
              strokeWidth="3"
            />
            <path
              d={`M${world.house.position.x - 58} ${world.house.position.y - 38} L${world.house.position.x} ${
                world.house.position.y - 86
              } L${world.house.position.x + 58} ${world.house.position.y - 38} Z`}
              fill="#693f33"
              stroke="#fff0b8"
              strokeWidth="3"
            />
            <rect x={world.house.position.x - 13} y={world.house.position.y + 1} width="26" height="39" rx="3" fill="#2d1f1a" />
            <text x={world.house.position.x} y={world.house.position.y + 64} textAnchor="middle" className="map-label">
              House {world.house.price} coins
            </text>
          </g>
          {world.coins.map((coin) => (
            <g key={coin.id}>
              <circle cx={coin.position.x} cy={coin.position.y} r={coin.value > 1 ? 9 : 7} fill="url(#coinGlow)" />
              <text x={coin.position.x} y={coin.position.y + 4} textAnchor="middle" className="coin-text">
                {coin.value}
              </text>
            </g>
          ))}
          {Object.values(world.players).map((worldPlayer) => (
            <DarknessPlayerSprite key={worldPlayer.id} player={worldPlayer} local={worldPlayer.id === player.id} now={now} />
          ))}
          {world.dayNight.phase === "night" && <rect width={world.size.width} height={world.size.height} fill="#020617" opacity="0.42" />}
        </svg>
      </div>

      <aside className="darkness-hud">
        <div className="darkness-status">
          <span className="world-code">Code {world.code}</span>
          <span>
            <Moon size={16} aria-hidden />
            {world.dayNight.phase}
          </span>
          <span>
            <Coins size={16} aria-hidden />
            {player.coins}/{world.house.price}
          </span>
          {stunned > 0 && <span>Stunned {seconds(stunned)}s</span>}
        </div>

        <div className="darkness-actions">
          <button type="button" onClick={() => send({ type: "darkness_zap", payload: {} })} disabled={zapReady > 0 || stunned > 0}>
            <Zap size={18} aria-hidden />
            {zapReady > 0 ? `Zap ${seconds(zapReady)}s` : "Zap"}
          </button>
          <button
            type="button"
            onClick={() => send({ type: "darkness_activate_shield", payload: {} })}
            disabled={shieldReady > 0}
          >
            <Shield size={18} aria-hidden />
            {shieldActive > 0 ? `Shield ${seconds(shieldActive)}s` : shieldReady > 0 ? `Shield ${seconds(shieldReady)}s` : "Shield"}
          </button>
          <button type="button" onClick={() => send({ type: "darkness_buy_house", payload: {} })}>
            <Home size={18} aria-hidden />
            Buy
          </button>
          <button type="button" onClick={() => send({ type: "darkness_request_save", payload: {} })}>
            <Save size={18} aria-hidden />
            Save
          </button>
        </div>

        <div className="darkness-meter">
          <span>House price</span>
          <div>
            <i style={{ width: `${Math.min(100, (player.coins / DARKNESS_HOUSE_PRICE) * 100)}%` }} />
          </div>
        </div>

        <div className="darkness-roster">
          {Object.values(world.players).map((worldPlayer) => (
            <span key={worldPlayer.id}>
              <i style={{ background: worldPlayer.color }} />
              {worldPlayer.name}: {worldPlayer.coins}
            </span>
          ))}
        </div>

        {winner && <div className="winner-banner">{winner.name} bought the house and won.</div>}

        <div className="messages darkness-messages">
          {messages.map((message, index) => (
            <p key={`${message}-${index}`}>{message}</p>
          ))}
        </div>
      </aside>

      <DarknessTouchControls />
    </section>
  );
}

function useDarknessPointerMovement(
  world: DarknessWorldState | undefined,
  player: DarknessPlayerState | undefined
) {
  const send = useDarknessStore((state) => state.send);
  const target = useRef({ x: 0, y: 0 });
  const pointerId = useRef<number | undefined>(undefined);
  const worldRef = useRef(world);
  const playerRef = useRef(player);

  useEffect(() => {
    worldRef.current = world;
    playerRef.current = player;
  }, [world, player]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (target.current.x !== 0 || target.current.y !== 0) {
        send({ type: "darkness_input", payload: { moveX: target.current.x, moveY: target.current.y } });
      }
    }, 80);
    return () => window.clearInterval(interval);
  }, [send]);

  function updateTarget(event: PointerEvent<SVGSVGElement>) {
    const currentWorld = worldRef.current;
    const currentPlayer = playerRef.current;
    if (!currentWorld || !currentPlayer || (pointerId.current !== undefined && event.pointerId !== pointerId.current)) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * currentWorld.size.width,
      y: ((event.clientY - rect.top) / rect.height) * currentWorld.size.height
    };
    const dx = point.x - currentPlayer.position.x;
    const dy = point.y - currentPlayer.position.y;
    const distance = Math.hypot(dx, dy);
    target.current = distance < 12 ? { x: 0, y: 0 } : { x: dx / distance, y: dy / distance };
    if (target.current.x !== 0 || target.current.y !== 0) {
      send({ type: "darkness_input", payload: { moveX: target.current.x, moveY: target.current.y } });
    }
  }

  function release(event?: PointerEvent<SVGSVGElement>) {
    if (event && pointerId.current !== undefined && event.pointerId !== pointerId.current) {
      return;
    }
    target.current = { x: 0, y: 0 };
    pointerId.current = undefined;
  }

  return {
    onPointerDown: (event: PointerEvent<SVGSVGElement>) => {
      event.preventDefault();
      pointerId.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      updateTarget(event);
    },
    onPointerMove: (event: PointerEvent<SVGSVGElement>) => {
      if (pointerId.current === undefined) {
        return;
      }
      event.preventDefault();
      updateTarget(event);
    },
    onPointerUp: release,
    onPointerCancel: release,
    onPointerLeave: release
  };
}

function DarknessPlayerSprite({ player, local, now }: { player: DarknessPlayerState; local: boolean; now: number }) {
  const stunned = player.stunnedUntil > now;
  const shielded = player.shieldActiveUntil > now;
  return (
    <g transform={`translate(${player.position.x} ${player.position.y})`} className={stunned ? "stunned-player" : ""}>
      {shielded && <circle r="32" fill="none" stroke="#8ff0ff" strokeWidth="5" opacity="0.8" />}
      <rect x="-17" y="-19" width="34" height="38" rx="4" fill={player.color} stroke={local ? "#fff6a7" : "#1a2028"} strokeWidth="4" />
      <circle cx="-8" cy="-24" r="8" fill="#f1b88d" />
      <circle cx="8" cy="-24" r="8" fill="#f1b88d" />
      <rect x="-20" y="-1" width="8" height="16" rx="2" fill={player.wristbandColor} />
      <rect x="12" y="-1" width="8" height="16" rx="2" fill={player.wristbandColor} />
      <text y="36" textAnchor="middle" className="map-label">
        {player.name}
      </text>
    </g>
  );
}

function DarknessTouchControls() {
  const send = useDarknessStore((state) => state.send);
  const held = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (held.current.x !== 0 || held.current.y !== 0) {
        send({ type: "darkness_input", payload: { moveX: held.current.x, moveY: held.current.y } });
      }
    }, 80);
    return () => window.clearInterval(interval);
  }, [send]);

  function hold(x: number, y: number) {
    held.current = { x, y };
  }

  function release() {
    held.current = { x: 0, y: 0 };
  }

  return (
    <div className="darkness-touch">
      <div className="darkness-pad">
        <button type="button" onPointerDown={() => hold(0, -1)} onPointerUp={release} onPointerLeave={release}>
          Up
        </button>
        <button type="button" onPointerDown={() => hold(-1, 0)} onPointerUp={release} onPointerLeave={release}>
          Left
        </button>
        <button type="button" onPointerDown={() => hold(1, 0)} onPointerUp={release} onPointerLeave={release}>
          Right
        </button>
        <button type="button" onPointerDown={() => hold(0, 1)} onPointerUp={release} onPointerLeave={release}>
          Down
        </button>
      </div>
      <div className="darkness-touch-actions">
        <button type="button" onClick={() => send({ type: "darkness_zap", payload: {} })}>
          <Zap size={18} aria-hidden />
          Zap
        </button>
        <button type="button" onClick={() => send({ type: "darkness_activate_shield", payload: {} })}>
          <Shield size={18} aria-hidden />
          Shield
        </button>
        <button type="button" onClick={() => send({ type: "darkness_buy_house", payload: {} })}>
          <Home size={18} aria-hidden />
          Buy
        </button>
      </div>
    </div>
  );
}

function seconds(ms: number): number {
  return Math.ceil(ms / 1000);
}
