import Phaser from "phaser";
import type { EnemyEntity } from "../entities/Enemies/EnemyEntity";
import type { NeonVectorScene } from "../scene/NeonVectorScene";
import type { ObjectiveType } from "../types";
import { getWalkablePoint, type ChamberSide } from "./rooms/RoomGeometry";

export class ObjectiveManager {
    private scene: NeonVectorScene;
    objective: string | null = null;
    objectiveTimer: number = 0;
    objectiveMaxTime: number = 30;
    checkpointIndex: number = 0;

    private objectiveEnemyId: string | null = null;

    get isActive(): boolean { return this.objective !== null; }

    constructor(scene: NeonVectorScene) {
        this.scene = scene;
        this.scene.events.on("enemy-died", this.onEnemyDied, this);
    }

    public getProgressRatio(): number {
        if (!this.objective || this.objectiveMaxTime <= 0) return 0;
        return Phaser.Math.Clamp(this.objectiveTimer / this.objectiveMaxTime, 0, 1);
    }

    public update(delta: number) {
        if (this.objective) {
            this.objectiveTimer = Math.max(0, this.objectiveTimer - delta);

            if (this.objectiveTimer <= 0) {
                this.failObjective();
            }
        }
    }

    public beginObjective(objectiveType: ObjectiveType): void {
        this.objective = objectiveType;
        this.objectiveTimer = this.objectiveMaxTime;
        this.checkpointIndex = 0;
        this.scene.events.emit("objective-started", { objective: this.objective });

        if (this.objective === "capture") {
            this.placeCapture();
        } else if (this.objective === "checkpoints") {
            this.placeCheckpoint();
        } else {
            this.objectiveEnemyId = this.scene.spawnEnemy("tank").id;
        }
    }

    public onEnemyDied(enemy: EnemyEntity): void {
        if (enemy.id === this.objectiveEnemyId) this.completeObjective();
    }

    public placeCapture(): void {
        const { width } = this.scene.scale;
        const origin = this.scene.activeRoomOrigin;
        const layout = this.scene.activeLayout;

        // If split, place the capture zone on one side while enemies pressure both sides
        const side: ChamberSide = layout.isSplit ? Phaser.Utils.Array.GetRandom(["left", "right"]) : "all";
        const pos = getWalkablePoint(layout.walkable, origin, width, 95, side);

        this.scene.spawnAreaAt("capture", -1, pos.x, pos.y);
    }

    public placeCheckpoint(): void {
        const { width } = this.scene.scale;
        const origin = this.scene.activeRoomOrigin;
        const layout = this.scene.activeLayout;

        const side: ChamberSide = layout.isSplit
            ? (this.checkpointIndex % 2 === 0 ? "left" : "right")
            : "all";

        const pos = getWalkablePoint(layout.walkable, origin, width, 70, side);

        // TODO: Unsure about this offset
        this.scene.spawnAreaAt("checkpoint", -1, pos.x, pos.y);
    }

    public completeObjective(): void {
        if (!this.isActive) return;

        this.clearObjective();
        this.scene.events.emit("objective-completed", {});
    }

    private failObjective() {
        this.clearObjective();
        this.scene.events.emit("objective-failed", {});
        this.scene.spawnAreaAt("blackhole", -1, this.scene.scale.width / 2, this.scene.scale.height / 2, true);
    }

    private clearObjective() {
        this.objective = null;
        this.objectiveTimer = 0;
        this.checkpointIndex = 0;
        this.objectiveEnemyId = null;
        this.scene.getAreas().filter((area) => area.kind === "capture" || area.kind === "checkpoint")
            .forEach((area) => area.destroy());
    }

    public destroy(): void {
        this.clearObjective();
        this.scene.events.off("enemy-died", this.onEnemyDied, this);
    }
}
