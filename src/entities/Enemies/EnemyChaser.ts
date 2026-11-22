import Phaser from "phaser";
import { EnemyEntity } from "./EnemyEntity";
import { PlayerEntity } from "../PlayerEntity";

export class EnemyChaser extends EnemyEntity {

    override executeMovement(target: PlayerEntity, distance: number, angle: number): PlayerEntity | null {
        const speed = this.stats.getStat('moveSpeed');
        const attackRange = this.radius + 15;

        this.moveTowardsPoint(target.x, target.y, speed, attackRange);

        if (this.aiState !== "CHASE" && this.attackCooldown <= 0) {
            this.attackCooldown = this.type === "boss" ? 1.4 : 0.95;
            return target;
        }
        return null;
    }
}
