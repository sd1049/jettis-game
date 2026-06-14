import { FormEvent, useState } from "react";
import { LogIn, Plus, Users } from "lucide-react";
import { connectToWorld, createWorld } from "../network.js";
import { useGameStore } from "../store.js";

export function JoinScreen() {
  const status = useGameStore((state) => state.status);
  const messages = useGameStore((state) => state.messages);
  const [name, setName] = useState("Sister");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setBusy(true);
    try {
      const newCode = await createWorld();
      connectToWorld({ worldCode: newCode, playerName: name.trim() || "Player" });
    } catch (error) {
      useGameStore.getState().pushMessage(error instanceof Error ? error.message : "Could not create world.");
    } finally {
      setBusy(false);
    }
  }

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    connectToWorld({ worldCode: code.trim(), playerName: name.trim() || "Player" });
  }

  return (
    <section className="join-layout">
      <div className="join-hero">
        <h1>Build high. Stay safe. Spray the shadows.</h1>
        <p>
          A small co-op island with cube building, safe houses, jetpack towers, night creatures, fishing, villagers,
          and shared world codes.
        </p>
      </div>

      <form className="join-panel" onSubmit={handleJoin}>
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
          <button className="primary" type="button" onClick={handleCreate} disabled={busy || status === "connecting"}>
            <Plus size={18} aria-hidden />
            New World
          </button>
          <button type="submit" disabled={!code.trim() || status === "connecting"}>
            <LogIn size={18} aria-hidden />
            Join
          </button>
        </div>
        <div className="join-note">
          <Users size={18} aria-hidden />
          Two-player co-op, no account, no membership, no real ads.
        </div>
        {messages.length > 0 && <p className="join-error">{messages[0]}</p>}
      </form>
    </section>
  );
}
