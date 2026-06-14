import { useEffect, useRef } from "react";
import type { PlayerInputState } from "@jettis/shared";
import { useGameStore } from "./store.js";

const keys = new Set<string>();

export function useKeyboardControls(): void {
  const spaceDownAt = useRef<number | undefined>(undefined);
  const descendUntil = useRef(0);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      if (useGameStore.getState().status !== "connected") {
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        event.preventDefault();
      }
      keys.add(event.code);
      if (event.code === "Space" && !spaceDownAt.current) {
        spaceDownAt.current = performance.now();
      }
      if (event.code === "KeyB") {
        useGameStore.getState().send({ type: "edit_block", payload: { action: "break", position: selectedTarget() } });
      }
      if (event.code === "KeyP") {
        const state = useGameStore.getState();
        useGameStore.getState().send({
          type: "edit_block",
          payload: { action: "place", position: placeTarget(), blockType: state.selectedBlockType }
        });
      }
      if (event.code === "KeyF") {
        useGameStore.getState().send({ type: "use_tool", payload: { tool: "water", target: selectedTarget() } });
      }
    };

    const up = (event: KeyboardEvent) => {
      keys.delete(event.code);
      if (isEditableTarget(event.target) || useGameStore.getState().status !== "connected") {
        return;
      }
      if (event.code === "Space") {
        const heldFor = performance.now() - (spaceDownAt.current ?? performance.now());
        if (heldFor < 180) {
          descendUntil.current = performance.now() + 220;
        }
        spaceDownAt.current = undefined;
      }
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const state = useGameStore.getState();
      if (state.status !== "connected" || state.commercialBreak) {
        return;
      }

      const input: PlayerInputState = {
        moveX: axis("KeyD", "ArrowRight") - axis("KeyA", "ArrowLeft"),
        moveZ: axis("KeyS", "ArrowDown") - axis("KeyW", "ArrowUp"),
        lookY: 0,
        jump: false,
        fly: keys.has("Space"),
        descend: performance.now() < descendUntil.current,
        sprint: keys.has("ShiftLeft") || keys.has("ShiftRight"),
        tapTarget: state.tapTarget
      };
      state.send({ type: "player_input", payload: input });
      if (state.tapTarget) {
        const player = state.world && state.playerId ? state.world.players[state.playerId] : undefined;
        if (player && Math.hypot(player.position.x - state.tapTarget.x, player.position.z - state.tapTarget.z) < 1.2) {
          state.setTapTarget(undefined);
        }
      }
    }, 80);
    return () => window.clearInterval(interval);
  }, []);
}

function axis(primary: string, alternate: string): number {
  return keys.has(primary) || keys.has(alternate) ? 1 : 0;
}

function selectedTarget() {
  const state = useGameStore.getState();
  const player = state.world && state.playerId ? state.world.players[state.playerId] : undefined;
  return state.selectedBlock?.position ?? player?.position ?? { x: 11, y: 8, z: 11 };
}

function placeTarget() {
  const target = selectedTarget();
  return { x: target.x, y: target.y + 1, z: target.z };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || target.isContentEditable;
}
