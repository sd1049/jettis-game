import { FormEvent, useState } from "react";
import { Moon, Play, Users } from "lucide-react";
import { connectToDarknessWorld, createDarknessWorld } from "../darknessNetwork.js";
import { useDarknessStore } from "../darknessStore.js";
import { connectToWorld, createWorld } from "../network.js";
import { useGameStore } from "../store.js";

type HomeGameMode = "blocks" | "darkness";

export function JoinScreen() {
  const status = useGameStore((state) => state.status);
  const darknessStatus = useDarknessStore((state) => state.status);
  const messages = useGameStore((state) => state.messages);
  const darknessMessages = useDarknessStore((state) => state.messages);
  const [name, setName] = useState("Sister");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<HomeGameMode>("darkness");

  async function handlePlay(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const worldCode = code.trim().toUpperCase();
      const playerName = name.trim() || "Player";
      if (worldCode && !/^[A-Z0-9]{4,12}$/.test(worldCode)) {
        const message = "Enter a 4-12 character world code using letters or numbers.";
        if (mode === "darkness") {
          useDarknessStore.getState().pushMessage(message);
        } else {
          useGameStore.getState().pushMessage(message);
        }
        return;
      }

      if (mode === "darkness") {
        const targetCode = await createDarknessWorld(worldCode || undefined);
        connectToDarknessWorld({ worldCode: targetCode, playerName });
      } else {
        const targetCode = await createWorld(worldCode || undefined);
        connectToWorld({ worldCode: targetCode, playerName });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start world.";
      if (mode === "darkness") {
        useDarknessStore.getState().pushMessage(message);
      } else {
        useGameStore.getState().pushMessage(message);
      }
    } finally {
      setBusy(false);
    }
  }

  const connecting = status === "connecting" || darknessStatus === "connecting";
  const activeMessages = mode === "darkness" ? darknessMessages : messages;

  return (
    <section className="join-layout">
      <div className="join-hero">
        <h1>{mode === "darkness" ? "Survival in the Darkness" : "Build high. Stay safe. Spray the shadows."}</h1>
        <p>
          {mode === "darkness"
            ? "A top-down Lego cave chase with wristband zaps, shields, coins, morning, night, and one expensive house."
            : "A small co-op island with cube building, safe houses, jetpack towers, night creatures, fishing, villagers, and shared world codes."}
        </p>
      </div>

      <form className="join-panel" onSubmit={handlePlay}>
        <div className="mode-picker" aria-label="Game mode">
          <button
            type="button"
            className={mode === "darkness" ? "selected" : ""}
            onClick={() => setMode("darkness")}
            aria-pressed={mode === "darkness"}
          >
            <Moon size={18} aria-hidden />
            Survival in the Darkness
          </button>
          <button
            type="button"
            className={mode === "blocks" ? "selected" : ""}
            onClick={() => setMode("blocks")}
            aria-pressed={mode === "blocks"}
          >
            <Users size={18} aria-hidden />
            3D Block Survival
          </button>
        </div>
        <label>
          Player name
          <input value={name} maxLength={20} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          World code optional
          <input
            value={code}
            maxLength={12}
            placeholder="ABC123"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </label>
        <div className="join-actions">
          <button className="primary" type="submit" disabled={busy || connecting}>
            <Play size={18} aria-hidden />
            Play {mode === "darkness" ? "Darkness" : "3D World"}
          </button>
        </div>
        <div className="join-note">
          <Users size={18} aria-hidden />
          Two-player co-op, no account, no membership, no real ads.
        </div>
        {activeMessages.length > 0 && <p className="join-error">{activeMessages[0]}</p>}
      </form>
    </section>
  );
}
