import Phaser from "phaser";
import type { EnemyType } from "../../types";
import type { NeonVectorScene } from "../../scene/NeonVectorScene";
import type { ObjectiveManager } from "../ObjectiveManager";
import type { RunRoomNode } from "../../interfaces/RoomInterfaces";
import { ENEMY_SPAWN_RULES, WAVE_DEFAULTS } from "../../data/WaveData";
import { devState, IS_TEST_MODE } from "../../data/DevData";
import { CHAOS_ENCOUNTERS } from "../../data/RoomEncounterData";

interface ActiveWavePlan {
    queue: EnemyType[];
    spawnInterval: number;
    isBossWave: boolean;
    addPool: EnemyType[];
    batchSize: number;
    batchInterval: number;
    maxActive: number;
}

export class RoomController {
    public readonly worldOrigin: { x: number; y: number };
    public currentWave = 0;
    public isCleared = false;

    private plan!: ActiveWavePlan;
    private spawnTimer = 0;
    private breakTimer = 0;
    private batchTimer = 0;
    private active = false;

    constructor(
        private readonly scene: NeonVectorScene,
        private readonly objectiveManager: ObjectiveManager,
        public readonly node: RunRoomNode
    ) {
        const { width, height } = scene.scale;
        this.worldOrigin = {
            x: node.gridX * width,
            y: node.gridY * height,
        };
    }

    public get totalWaves(): number {
        return WAVE_DEFAULTS.wavesPerRoom;
    }

    public startEncounter(): void {
        this.active = true;
        this.isCleared = false;
        this.currentWave = 0;
        this.startNextWave();
    }

    public update(delta: number): void {
        if (!this.active || this.isCleared) return;

        if (IS_TEST_MODE && devState.pauseSpawning) return;

        // 1. Drain current wave's spawn queue
        if (this.plan.queue.length > 0) {
            this.spawnTimer -= delta;
            if (this.spawnTimer <= 0) {
                this.scene.spawnEnemy(this.plan.queue.shift()!);
                this.spawnTimer = this.plan.spawnInterval;
            }
            return;
        }

        const enemies = this.scene.getEnemies();
        const bossAlive = enemies.some((e) => e.type === "boss");

        // 2. Boss Wave: spawn nuisance batches on a fixed interval while boss lives
        if (this.plan.isBossWave && bossAlive) {
            this.updateBossBatches(delta, enemies.length);
            return;
        }

        // 3. Wait until all enemies are destroyed... allow advancing waves while an object is going
        if (enemies.length > 0) return;

        if (this.currentWave < this.totalWaves) {
            this.breakTimer += delta;
            if (this.breakTimer >= WAVE_DEFAULTS.interWaveBreak) {
                this.breakTimer = 0;
                this.scene.onWaveCleared();
                this.startNextWave();
            }
        } else if (!this.objectiveManager.isActive) {

            // don't clear the room until the objective is done
            this.isCleared = true;
            this.scene.onWaveCleared();
            this.scene.onRoomCleared();
        }
    }

    private updateBossBatches(delta: number, currentEnemyCount: number): void {
        if (currentEnemyCount >= this.plan.maxActive) return;

        this.batchTimer -= delta;
        if (this.batchTimer <= 0) {
            this.batchTimer = this.plan.batchInterval;
            const roomLeft = this.plan.maxActive - currentEnemyCount;
            const toSpawn = Math.min(this.plan.batchSize, roomLeft);

            for (let i = 0; i < toSpawn; i++) {
                this.scene.spawnEnemy(Phaser.Utils.Array.GetRandom(this.plan.addPool));
            }
        }
    }

    private startNextWave(): void {
        this.currentWave += 1;
        this.breakTimer = 0;

        const globalWave = this.scene.waveNumber;
        this.plan = this.buildWavePlan(this.currentWave, globalWave);

        this.spawnTimer = 0;
        this.batchTimer = this.plan.batchInterval;

        this.scene.events.emit("wave-started", {
            roomWave: this.currentWave,
            totalRoomWaves: this.totalWaves,
            globalWave,
        });
    }

    private buildWavePlan(roomWave: number, globalWave: number): ActiveWavePlan {
        const enc = this.node.encounter;
        const reinf = enc.bossReinforcements;

        const basePlan: ActiveWavePlan = {
            queue: [],
            spawnInterval: WAVE_DEFAULTS.spawnInterval,
            isBossWave: false,
            addPool: reinf?.addPool ?? WAVE_DEFAULTS.defaultAddPool,
            batchSize: reinf?.batchSize ?? WAVE_DEFAULTS.bossAddBatchSize,
            batchInterval: reinf?.batchInterval ?? WAVE_DEFAULTS.bossAddInterval,
            maxActive: reinf?.maxActiveEnemies ?? WAVE_DEFAULTS.bossMaxActiveEnemies,
        };

        // --- WAVE 10: BOSS ENCOUNTER ---
        if (roomWave === this.totalWaves) {
            const boss = enc.bossType ?? "boss";
            const guards = enc.bossGuards ?? WAVE_DEFAULTS.defaultBossGuards;
            return {
                ...basePlan,
                isBossWave: true,
                queue: [boss, ...guards],
                spawnInterval: WAVE_DEFAULTS.bossGuardSpawnInterval,
            };
        }

        // --- WAVES 3, 6, 9: CHAOS WAVE ---
        if (roomWave % WAVE_DEFAULTS.chaosWaveInterval === 0) {
            const presetType = enc.chaosPresets?.length
                ? Phaser.Utils.Array.GetRandom(enc.chaosPresets)
                : undefined;

            if (presetType) {
                const preset = CHAOS_ENCOUNTERS[presetType];
                return {
                    ...basePlan,
                    queue: [...preset.enemies],
                    spawnInterval: preset.spawnInterval ?? WAVE_DEFAULTS.chaosSpawnInterval,
                };
            }

            const swarmCount = Math.round(
                (WAVE_DEFAULTS.baseEnemyCount + globalWave * WAVE_DEFAULTS.countPerGlobalWave) *
                WAVE_DEFAULTS.chaosCountMultiplier
            );
            return {
                ...basePlan,
                queue: this.sampleEnemies(enc.enemyPool, swarmCount, this.scene.waveNumber),
                spawnInterval: WAVE_DEFAULTS.chaosSpawnInterval,
            };
        }

        // --- STANDARD WAVES: SCALING + RANDOM BONUS OBJECTIVE ---
        const count = WAVE_DEFAULTS.baseEnemyCount + Math.floor(globalWave * WAVE_DEFAULTS.countPerGlobalWave);
        this.maybeTriggerBonusObjective(globalWave);

        return {
            ...basePlan,
            queue: this.sampleEnemies(enc.enemyPool, count, this.scene.waveNumber),
        };
    }

    private maybeTriggerBonusObjective(globalWave: number): void {
        if (this.objectiveManager.isActive) return;

        const chance = Math.min(
            WAVE_DEFAULTS.maxObjectiveChance,
            WAVE_DEFAULTS.baseObjectiveChance + globalWave * WAVE_DEFAULTS.objectiveChancePerWave
        );

        if (Math.random() < chance) {
            const objective = Phaser.Utils.Array.GetRandom(WAVE_DEFAULTS.objectivePool);
            this.objectiveManager.beginObjective(objective);
        }
    }

    private sampleEnemies(pool: EnemyType[], count: number, globalWave: number): EnemyType[] {
        // 1. Filter to enemies unlocked by the current globalWave and compute their current weight
        const weightedPool = pool
            .map((type) => {
                const rule = ENEMY_SPAWN_RULES[type];
                if (!rule || globalWave < rule.minWave) return { type, weight: 0 };

                const wavesSinceUnlock = globalWave - rule.minWave;
                const rawWeight = rule.baseWeight + wavesSinceUnlock * rule.weightPerWave;
                const weight = Phaser.Math.Clamp(rawWeight, rule.minWeight, rule.maxWeight);
                return { type, weight };
            })
            .filter((entry) => entry.weight > 0);

        // Fallback: if all pool enemies had minWave > globalWave, use the lowest-minWave enemy in the pool
        if (weightedPool.length === 0) {
            const fallback = [...pool].sort(
                (a, b) => (ENEMY_SPAWN_RULES[a]?.minWave ?? 1) - (ENEMY_SPAWN_RULES[b]?.minWave ?? 1)
            )[0];
            return Array.from({ length: count }, () => fallback);
        }

        const totalWeight = weightedPool.reduce((sum, entry) => sum + entry.weight, 0);

        // 2. Roll each enemy using weighted random selection
        return Array.from({ length: count }, () => {
            let roll = Math.random() * totalWeight;
            for (const entry of weightedPool) {
                roll -= entry.weight;
                if (roll <= 0) return entry.type;
            }
            return weightedPool[weightedPool.length - 1].type;
        });
    }
}
