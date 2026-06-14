import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { memo, useMemo } from "react";
import * as THREE from "three";
import {
  adjacentPositions,
  blockKey,
  getBlock,
  isSolidBlock,
  parseBlockKey,
  type BlockKey,
  type BlockType,
  type CreatureState,
  type FoodNodeState,
  type HazardState,
  type PlayerState,
  type SupplyCrateState,
  type Vec3,
  type VillagerState,
  type WorldState
} from "@jettis/shared";
import { getLocalPlayer, useGameStore } from "../store.js";

const blockColors: Record<BlockType, string> = {
  grass: "#4f9b45",
  dirt: "#7a5233",
  stone: "#7d858c",
  wood: "#a86f37",
  leaves: "#2f7d4a",
  glass: "#94d7e8",
  door: "#8b5a2b",
  ladder: "#c8975b",
  water: "#2f92d0",
  lava: "#ff5a2e",
  light: "#ffe28a"
};

export function GameCanvas() {
  const world = useGameStore((state) => state.world);
  const playerId = useGameStore((state) => state.playerId);
  const player = getLocalPlayer(world, playerId);

  if (!world || !player) {
    return null;
  }

  return (
    <Canvas shadows camera={{ position: [12, 14, 16], fov: 52 }} className="game-canvas">
      <color attach="background" args={[world.dayNight.phase === "night" ? "#111827" : "#9bd3ee"]} />
      <fog attach="fog" args={[world.dayNight.phase === "night" ? "#111827" : "#9bd3ee", 42, 96]} />
      <ambientLight intensity={world.dayNight.phase === "night" ? 0.45 : 0.85} />
      <directionalLight position={[20, 32, 18]} intensity={world.dayNight.phase === "night" ? 0.7 : 1.4} castShadow />
      <CameraRig world={world} player={player} />
      <VoxelWorld world={world} />
      {Object.values(world.players).map((worldPlayer) => (
        <PlayerAvatar key={worldPlayer.id} player={worldPlayer} local={worldPlayer.id === player.id} world={world} />
      ))}
      {world.creatures.map((creature) => (
        <Creature key={creature.id} creature={creature} world={world} />
      ))}
      {world.hazards.map((hazard) => (
        <Hazard key={hazard.id} hazard={hazard} world={world} />
      ))}
      {world.villagers.map((villager) => (
        <Villager key={villager.id} villager={villager} world={world} />
      ))}
      {world.crates.map((crate) => (
        <Crate key={crate.id} crate={crate} world={world} />
      ))}
      {world.foodNodes.map((food) => (
        <FoodNode key={food.id} food={food} world={world} />
      ))}
      {world.victory.wonAt && (
        <Text position={[0, 30, 0]} fontSize={3} color="#ffe28a" anchorX="center">
          Victory!
        </Text>
      )}
    </Canvas>
  );
}

function CameraRig({ world, player }: { world: WorldState; player: PlayerState }) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const position = toScene(player.position, world);
    target.set(position[0], position[1] + 1.6, position[2]);
    desired.set(position[0] + 12, position[1] + 9, position[2] + 14);
    camera.position.lerp(desired, 0.08);
    camera.lookAt(target);
  });

  return null;
}

const VoxelWorld = memo(function VoxelWorld({ world }: { world: WorldState }) {
  const setSelectedBlock = useGameStore((state) => state.setSelectedBlock);
  const setTapTarget = useGameStore((state) => state.setTapTarget);
  const visibleBlocks = useMemo(() => getVisibleBlocks(world), [world]);

  function selectBlock(event: ThreeEvent<MouseEvent>, position: Vec3, type: BlockType) {
    event.stopPropagation();
    setSelectedBlock({ position, type });
    if (navigator.maxTouchPoints > 0) {
      setTapTarget({ x: position.x + 0.5, y: position.y + 1, z: position.z + 0.5 });
    }
  }

  return (
    <group>
      {visibleBlocks.map(([key, type, position]) => {
        const scene = toScene(position, world);
        const fluid = type === "water" || type === "lava";
        return (
          <mesh
            key={key}
            position={scene}
            castShadow={!fluid}
            receiveShadow
            onClick={(event) => selectBlock(event, position, type)}
          >
            <boxGeometry args={[1, fluid ? 0.72 : 1, 1]} />
            <meshStandardMaterial
              color={blockColors[type]}
              roughness={type === "glass" ? 0.25 : 0.8}
              metalness={0}
              emissive={type === "light" || type === "lava" ? blockColors[type] : "#000000"}
              emissiveIntensity={type === "light" ? 0.75 : type === "lava" ? 0.45 : 0}
              transparent={type === "glass" || type === "water"}
              opacity={type === "glass" ? 0.5 : type === "water" ? 0.72 : 1}
            />
          </mesh>
        );
      })}
    </group>
  );
});

function PlayerAvatar({ player, local, world }: { player: PlayerState; local: boolean; world: WorldState }) {
  const position = toScene(player.position, world);
  return (
    <group position={[position[0], position[1] + 0.2, position[2]]}>
      <mesh castShadow position={[0, 0.9, 0]}>
        <boxGeometry args={[0.8, 1.2, 0.45]} />
        <meshStandardMaterial color={player.appearance.shirtColor} />
      </mesh>
      <mesh castShadow position={[0, 1.8, 0]}>
        <boxGeometry args={[0.62, 0.62, 0.62]} />
        <meshStandardMaterial color={player.appearance.bodyColor} />
      </mesh>
      <mesh castShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[0.7, 0.3, 0.42]} />
        <meshStandardMaterial color={player.appearance.pantsColor} />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0.42]}>
        <boxGeometry args={[0.5, 0.65, 0.18]} />
        <meshStandardMaterial color={player.gear.packColor} emissive={local ? "#0a4a80" : "#000000"} emissiveIntensity={0.15} />
      </mesh>
      <mesh castShadow position={[0, 2.22, 0]}>
        <boxGeometry args={[0.74, 0.2, 0.74]} />
        <meshStandardMaterial color={player.appearance.accentColor} />
      </mesh>
      <Text position={[0, 2.75, 0]} fontSize={0.36} color={local ? "#fff2a8" : "#ffffff"} anchorX="center">
        {player.name}
      </Text>
    </group>
  );
}

function Creature({ creature, world }: { creature: CreatureState; world: WorldState }) {
  const position = toScene(creature.position, world);
  const boss = creature.kind === "storm_boss";
  return (
    <group position={[position[0], position[1] + (boss ? 1.2 : 0.6), position[2]]}>
      <mesh castShadow>
        <sphereGeometry args={[boss ? 1.4 : 0.7, 18, 12]} />
        <meshStandardMaterial color={boss ? "#5c3b8f" : "#24243a"} emissive={boss ? "#7b45d9" : "#3b2f70"} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, boss ? 1.15 : 0.62, 0]}>
        <sphereGeometry args={[boss ? 0.42 : 0.18, 12, 8]} />
        <meshStandardMaterial color="#8fd6ff" emissive="#8fd6ff" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function Hazard({ hazard, world }: { hazard: HazardState; world: WorldState }) {
  const position = toScene(hazard.position, world);
  const color = hazard.kind === "quicksand" ? "#d8b55f" : hazard.kind === "lava_spark" ? "#ff5a2e" : "#7bb7ff";
  return (
    <mesh position={[position[0], position[1] + 0.04, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[hazard.radius, 32]} />
      <meshStandardMaterial color={color} transparent opacity={0.72} emissive={color} emissiveIntensity={0.2} />
    </mesh>
  );
}

function Villager({ villager, world }: { villager: VillagerState; world: WorldState }) {
  const send = useGameStore((state) => state.send);
  const position = toScene(villager.position, world);
  return (
    <group position={[position[0], position[1] + 0.65, position[2]]} onClick={() => send({ type: "interact", payload: { targetKind: "villager", targetId: villager.id } })}>
      <mesh castShadow>
        <boxGeometry args={[0.7, 1.25, 0.5]} />
        <meshStandardMaterial color="#7a9f9b" />
      </mesh>
      <mesh position={[0, 0.86, 0]}>
        <boxGeometry args={[0.52, 0.42, 0.52]} />
        <meshStandardMaterial color="#d3a176" />
      </mesh>
      <Text position={[0, 1.55, 0]} fontSize={0.3} color="#ffffff" anchorX="center">
        {villager.name}
      </Text>
    </group>
  );
}

function Crate({ crate, world }: { crate: SupplyCrateState; world: WorldState }) {
  const send = useGameStore((state) => state.send);
  const playerId = useGameStore((state) => state.playerId);
  const position = toScene(crate.position, world);
  const opened = playerId ? crate.openedBy.includes(playerId) : false;
  return (
    <mesh
      position={[position[0], position[1] + 0.42, position[2]]}
      castShadow
      onClick={(event) => {
        event.stopPropagation();
        send({ type: "interact", payload: { targetKind: "crate", targetId: crate.id } });
      }}
    >
      <boxGeometry args={[0.9, 0.75, 0.9]} />
      <meshStandardMaterial color={opened ? "#7c6f5a" : "#b8874f"} emissive={opened ? "#000000" : "#51300f"} emissiveIntensity={0.12} />
    </mesh>
  );
}

function FoodNode({ food, world }: { food: FoodNodeState; world: WorldState }) {
  const send = useGameStore((state) => state.send);
  const position = toScene(food.position, world);
  const color = food.kind === "fishing_spot" ? "#47a7d8" : food.kind === "garden_plot" ? "#7a5233" : "#ba3b62";
  return (
    <group
      position={[position[0], position[1] + 0.3, position[2]]}
      onClick={(event) => {
        event.stopPropagation();
        send({ type: "interact", payload: { targetKind: "food", targetId: food.id } });
      }}
    >
      <mesh castShadow>
        <sphereGeometry args={[0.35, 14, 10]} />
        <meshStandardMaterial color={color} emissive={food.kind === "fishing_spot" ? "#0d6fa6" : "#000000"} emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

function getVisibleBlocks(world: WorldState): [BlockKey, BlockType, Vec3][] {
  const entries: [BlockKey, BlockType, Vec3][] = [];
  for (const [rawKey, cell] of Object.entries(world.blocks)) {
    const key = rawKey as BlockKey;
    const position = parseBlockKey(key);
    const visible = adjacentPositions(position).some((adjacent) => {
      if (adjacent.y < 0 || adjacent.y >= world.size.height) {
        return true;
      }
      const neighbor = getBlock(world, adjacent);
      return neighbor === undefined || !isSolidBlock(neighbor) || cell.type === "water" || cell.type === "lava";
    });
    if (visible) {
      entries.push([key, cell.type, position]);
    }
  }
  return entries;
}

function toScene(position: Vec3, world: WorldState): [number, number, number] {
  return [position.x - world.size.width / 2, position.y, position.z - world.size.depth / 2];
}
