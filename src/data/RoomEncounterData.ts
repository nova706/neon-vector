import type { ChaosWavePreset, RoomEncounterConfig } from "../interfaces/RoomInterfaces";

export const ROOM_ENCOUNTERS: RoomEncounterConfig[] = [
    {
        id: "enc_kinetic_vanguard",
        label: "Kinetic",
        enemyPool: ["chaser", "flanker", "exploder", "splitter", "tank"],
        chaosPresets: ["detonator_rush", "mitosis_swarm"],
        bossType: "boss",
        bossGuards: ["shielder", "ranger", "flanker"],
        bossReinforcements: {
            addPool: ["chaser", "exploder", "flanker"],
            batchSize: 3,
            batchInterval: 6.0,
        },
    },
    {
        id: "enc_armored_bastion",
        label: "Armored Bastion",
        enemyPool: ["chaser", "flanker", "ranger", "shielder", "tank"],
        chaosPresets: ["shielded_rangers"],
        bossType: "boss",
        bossGuards: ["tank", "shielder", "shielder"],
        bossReinforcements: {
            addPool: ["chaser", "ranger"],
            batchSize: 3,
            batchInterval: 6.5,
        },
    },
];

export type ChaosWaveType = "shielded_rangers" | "detonator_rush" | "mitosis_swarm";

export const CHAOS_ENCOUNTERS: Record<ChaosWaveType, ChaosWavePreset> = {
    shielded_rangers: {
        label: "AEGIS PHALANX",
        enemies: ["tank", "shielder", "ranger", "tank", "shielder", "ranger"],
        spawnInterval: 0.65,
    },
    detonator_rush: {
        label: "DETONATOR SURGE",
        enemies: ["exploder", "exploder", "flanker", "exploder", "exploder", "flanker", "exploder"],
        spawnInterval: 0.28,
    },
    mitosis_swarm: {
        label: "MITOSIS FLOOD",
        enemies: ["splitter", "splitter", "chaser", "splitter", "splitter", "chaser"],
        spawnInterval: 0.4,
    },
};
