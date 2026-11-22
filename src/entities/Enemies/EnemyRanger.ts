import Phaser from "phaser";
import { EnemyEntity } from "./EnemyEntity";
import { PlayerEntity } from "../PlayerEntity";

export class EnemyRanger extends EnemyEntity {
    
    protected override executeMovement(target: PlayerEntity, distance: number, angle: number): PlayerEntity | null {

        const speed = this.stats.getStat('moveSpeed');
        const attackRange = 300;
        const retreatRange = 200;

        this.moveTowardsPoint(target.x, target.y, speed, attackRange, retreatRange);

        if (this.aiState !== "CHASE" && this.attackCooldown <= 0) {
            this.attackCooldown = 0.95;
            this.scene.effectsManager.addProjectile(
                this.x,
                this.y,
                Math.cos(angle),
                Math.sin(angle),
                distance,
                this.color,
                0.12,
            );
            return target;
        }
        return null;
    }
}
