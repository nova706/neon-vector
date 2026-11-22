import type { EnemyType, ObjectiveType } from "../types";

export const WAVE_DEFAULTS = {
    wavesPerRoom: 10,
    chaosWaveInterval: 3,         // Waves 3, 6, 9 are chaos waves
    spawnInterval: 0.55,
    chaosSpawnInterval: 0.3,
    bossGuardSpawnInterval: 0.75,
    interWaveBreak: 2.2,

    baseEnemyCount: 4,
    countPerGlobalWave: 1.05,
    chaosCountMultiplier: 1.02,

    // Escalating objective chance on standard waves
    baseObjectiveChance: 0.15,
    objectiveChancePerWave: 0.003,
    maxObjectiveChance: 0.65,
    objectivePool: ["capture", "checkpoints", "tank"] as ObjectiveType[],

    // Boss wave defaults
    defaultBossGuards: ["shielder", "ranger", "ranger"] as EnemyType[],
    defaultAddPool: ["chaser", "flanker"] as EnemyType[],
    bossAddInterval: 6.0,
    bossAddBatchSize: 5,
    bossMaxActiveEnemies: 9,
} as const;

export interface EnemySpawnRule {
    minWave: number;       // Earliest global wave this enemy can appear
    baseWeight: number;    // Starting spawn weight when unlocked
    weightPerWave: number; // How weight changes per wave (negative = tapers off, positive = ramps up)
    minWeight: number;     // Floor so early enemies never completely vanish
    maxWeight: number;     // Cap so heavy units don't become 100% of spawns
}

export const ENEMY_SPAWN_RULES: Record<EnemyType, EnemySpawnRule> = {
    // Tier 1: Red-bar fodder (common early, tapers off slightly as elites enter)
    chaser:   { minWave: 1,  baseWeight: 50, weightPerWave: -1.5, minWeight: 15, maxWeight: 50 },
    flanker:  { minWave: 1,  baseWeight: 40, weightPerWave: -0.8, minWeight: 15, maxWeight: 40 },
    exploder: { minWave: 2,  baseWeight: 20, weightPerWave:  0.5, minWeight: 10, maxWeight: 30 },

    // Tier 2: Mid-tier specialists (ramps up through mid-waves)
    ranger:   { minWave: 3,  baseWeight: 15, weightPerWave:  1.5, minWeight: 10, maxWeight: 40 },
    splitter: { minWave: 4,  baseWeight: 12, weightPerWave:  1.2, minWeight: 10, maxWeight: 35 },

    // Tier 3: Yellow-bar / heavy units (rare early, increasingly common in deeper rooms)
    shielder: { minWave: 5,  baseWeight: 8,  weightPerWave:  1.8, minWeight: 5,  maxWeight: 35 },
    tank:     { minWave: 6,  baseWeight: 6,  weightPerWave:  1.5, minWeight: 5,  maxWeight: 30 },

    // Bosses are spawned explicitly on Wave 10, never rolled as standard mobs
    boss:     { minWave: 999, baseWeight: 0, weightPerWave:  0,   minWeight: 0,  maxWeight: 0 },
};
