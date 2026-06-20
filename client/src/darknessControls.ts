import { useEffect } from "react";
import type { DarknessInputState } from "@jettis/shared";
import { useDarknessStore } from "./darknessStore.js";

const darknessKeys = new Set<string>();

export function useDarknessKeyboardControls(): void {
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || useDarknessStore.getState().status !== "connected") {
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        event.preventDefault();
      }
      darknessKeys.add(event.code);
      if (event.code === "KeyZ") {
        event.preventDefault();
        useDarknessStore.getState().send({ type: "darkness_zap", payload: {} });
      }
      if (event.code === "KeyX") {
        event.preventDefault();
        useDarknessStore.getState().send({ type: "darkness_activate_shield", payload: {} });
      }
      if (event.code === "KeyB") {
        event.preventDefault();
        useDarknessStore.getState().send({ type: "darkness_buy_house", payload: {} });
      }
    };

    const up = (event: KeyboardEvent) => {
      darknessKeys.delete(event.code);
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
      const state = useDarknessStore.getState();
      if (state.status !== "connected") {
        return;
      }
      const input: DarknessInputState = {
        moveX: axis("KeyD", "ArrowRight") - axis("KeyA", "ArrowLeft"),
        moveY: axis("KeyS", "ArrowDown") - axis("KeyW", "ArrowUp"),
        control: "keyboard"
      };
      state.send({ type: "darkness_input", payload: input });
    }, 80);
    return () => window.clearInterval(interval);
  }, []);
}

function axis(primary: string, alternate: string): number {
  return darknessKeys.has(primary) || darknessKeys.has(alternate) ? 1 : 0;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || target.isContentEditable;
}
