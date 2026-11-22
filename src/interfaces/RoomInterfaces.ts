import type { ChaosWaveType } from "../data/RoomEncounterData";
import type { EnemyType, ObjectiveType } from "../types";

export type PortSlot = "N1" | "N2" | "S1" | "S2" | "W" | "E";

export interface PortConnection {
    targetRoomIndex: number;
    targetPort: PortSlot;
    /** When set, living players must split across both ports (e.g., N1 & N2) to transition */
    pairedExitPort?: PortSlot;
    pairedTargetPort?: PortSlot;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface RoomLayout {
    id: string;
    ports: PortSlot[];
    walkable: Rect[];
    isSplit?: boolean;
    minPlayers?: number;
}

export interface ChaosWavePreset {
    label: string;                // e.g. "SCRAPPER SWARM" or "ARMORED VANGUARD"
    enemies: EnemyType[];         // Exact composition or weighted batch
    spawnInterval?: number;
}

export interface BossReinforcementConfig {
    addPool?: EnemyType[];
    batchSize?: number;
    batchInterval?: number;
    maxActiveEnemies?: number;
}

export interface RoomEncounterConfig {
    id: string;
    label: string;
    enemyPool: EnemyType[];
    isSplitCoop?: boolean;
    /** Optional themed chaos waves (triggered on waves 3, 6, 9) */
    chaosPresets?: ChaosWaveType[];
    /** Optional wave 10 boss override */
    bossType?: EnemyType;
    bossGuards?: EnemyType[];
    bossReinforcements?: BossReinforcementConfig;
}

export interface RunRoomNode {
    id: string;
    gridX: number; // World grid position (e.g., 0, 1, 2...)
    gridY: number;
    layout: RoomLayout;
    encounter: RoomEncounterConfig;
    connections: Partial<Record<PortSlot, PortConnection>>;
}
