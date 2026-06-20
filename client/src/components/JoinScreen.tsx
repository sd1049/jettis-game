import { FormEvent, useState } from "react";
import { LogIn, Moon, Plus, Users } from "lucide-react";
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
  const [mode, setMode] = useState<HomeGameMode>("blocks");

  async function handleCreate() {
    setBusy(true);
    try {
      if (mode === "darkness") {
        const newCode = await createDarknessWorld();
        connectToDarknessWorld({ worldCode: newCode, playerName: name.trim() || "Player" });
      } else {
        const newCode = await createWorld();
        connectToWorld({ worldCode: newCode, playerName: name.trim() || "Player" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create world.";
      if (mode === "darkness") {
        useDarknessStore.getState().pushMessage(message);
      } else {
        useGameStore.getState().pushMessage(message);
      }
    } finally {
      setBusy(false);
    }
  }

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    const worldCode = code.trim().toUpperCase();
    if (worldCode.length < 4 || worldCode.length > 12) {
      const message = "Enter a 4-12 character world code.";
      if (mode === "darkness") {
        useDarknessStore.getState().pushMessage(message);
      } else {
        useGameStore.getState().pushMessage(message);
      }
      return;
    }

    if (mode === "darkness") {
      connectToDarknessWorld({ worldCode, playerName: name.trim() || "Player" });
    } else {
      connectToWorld({ worldCode, playerName: name.trim() || "Player" });
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

      <form className="join-panel" onSubmit={handleJoin}>
        <div className="mode-picker" aria-label="Game mode">
          <button
            type="button"
            className={mode === "blocks" ? "selected" : ""}
            onClick={() => setMode("blocks")}
          >
            <Users size={18} aria-hidden />
            3D Block Survival
          </button>
          <button
            type="button"
            className={mode === "darkness" ? "selected" : ""}
            onClick={() => setMode("darkness")}
          >
            <Moon size={18} aria-hidden />
            Survival in the Darkness
          </button>
        </div>
        <label>
          Player name
          <input value={name} maxLength={20} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          World code
          <input
            value={code}
            maxLength={12}
            placeholder="ABC123"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </label>
        <div className="join-actions">
          <button className="primary" type="button" onClick={handleCreate} disabled={busy || connecting}>
            <Plus size={18} aria-hidden />
            New {mode === "darkness" ? "Darkness Room" : "World"}
          </button>
          <button type="submit" disabled={!code.trim() || connecting}>
            <LogIn size={18} aria-hidden />
            Join
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
