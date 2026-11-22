import Phaser from "phaser";
import { EnemyEntity } from "./EnemyEntity";
import { PlayerEntity } from "../PlayerEntity";
import { Shielded } from "../../systems/stats/Buffs";

const SHIELD_RADIUS = 190;
const MAX_SHIELDED_ENEMIES = 3;

export class EnemyShielder extends EnemyEntity {

    private shieldedEnemies: EnemyEntity[] = [];
    private moveTargetAlly: EnemyEntity | null = null;

    protected override executeMovement(target: PlayerEntity, distance: number, angle: number): PlayerEntity | null {

        const speed = this.stats.getStat('moveSpeed');
        const leashRadius = SHIELD_RADIUS * 1.15;

        // 1. Keep all currently shielded allies (up to MAX_SHIELDED_ENEMIES) that are still alive & in leash range
        this.shieldedEnemies = this.shieldedEnemies.filter(
            (ally) => ally.alive && Phaser.Math.Distance.Between(this.x, this.y, ally.x, ally.y) <= leashRadius
        );

        // 2. Fill any open shield slots up to MAX_SHIELDED_ENEMIES
        if (this.shieldedEnemies.length < MAX_SHIELDED_ENEMIES) {
            const candidatesInRange = this.scene.getEnemies()
                .filter((candidate) =>
                    candidate !== this &&
                    candidate.type !== 'shielder' &&
                    candidate.alive &&
                    !this.shieldedEnemies.includes(candidate) &&
                    Phaser.Math.Distance.Between(this.x, this.y, candidate.x, candidate.y) <= SHIELD_RADIUS
                )
                .sort((a, b) => {
                    // Prefer enemies not already shielded by another Shielder, then closest
                    const aShielded = a.stats.hasEffect('shielded') ? 1 : 0;
                    const bShielded = b.stats.hasEffect('shielded') ? 1 : 0;
                    if (aShielded !== bShielded) return aShielded - bShielded;

                    return Phaser.Math.Distance.Between(this.x, this.y, a.x, a.y) -
                        Phaser.Math.Distance.Between(this.x, this.y, b.x, b.y);
                });

            const openSlots = MAX_SHIELDED_ENEMIES - this.shieldedEnemies.length;
            this.shieldedEnemies.push(...candidatesInRange.slice(0, openSlots));
        }

        // 3. Apply shield effect to the entire shielded group
        for (const enemy of this.shieldedEnemies) {
            enemy.stats.applyEffect(Shielded(this));
        }

        // 4. Case A: Actively shielding 1+ enemies -> move to the center of the group
        // (As we approach the center, nearby pack members naturally enter SHIELD_RADIUS and fill remaining slots)
        if (this.shieldedEnemies.length > 0) {
            this.moveTargetAlly = null;
            const centerX = this.shieldedEnemies.reduce((sum, e) => sum + e.x, 0) / this.shieldedEnemies.length;
            const centerY = this.shieldedEnemies.reduce((sum, e) => sum + e.y, 0) / this.shieldedEnemies.length;

            this.moveTowardsPoint(centerX, centerY, speed, SHIELD_RADIUS / 2, 20);
            return null;
        }

        // 5. Case B: Currently shielding 0 enemies -> find the best cluster of unshielded enemies to run into
        if (!this.moveTargetAlly || !this.moveTargetAlly.alive || this.moveTargetAlly.stats.hasEffect('shielded')) {
            const unshieldedAllies = this.scene.getEnemies().filter(
                (candidate) =>
                    candidate !== this &&
                    candidate.type !== 'shielder' &&
                    candidate.alive &&
                    !candidate.stats.hasEffect('shielded')
            );

            let bestAnchor: EnemyEntity | null = null;
            let bestScore = -Infinity;

            for (const candidate of unshieldedAllies) {
                // Count how many other unshielded allies are clustered within SHIELD_RADIUS of this candidate
                const neighbors = unshieldedAllies.filter(
                    (other) => other !== candidate &&
                        Phaser.Math.Distance.Between(candidate.x, candidate.y, other.x, other.y) <= SHIELD_RADIUS
                ).length;

                const distToMe = Phaser.Math.Distance.Between(this.x, this.y, candidate.x, candidate.y);
                // Weight each nearby neighbor heavily (e.g., worth 150px of travel distance)
                const score = (neighbors * 150) - distToMe;

                if (score > bestScore) {
                    bestScore = score;
                    bestAnchor = candidate;
                }
            }

            this.moveTargetAlly = bestAnchor;
        }

        if (this.moveTargetAlly) {
            // Walk all the way to the cluster anchor (stop radius 25) so surrounding pack members enter SHIELD_RADIUS
            this.moveTowardsPoint(this.moveTargetAlly.x, this.moveTargetAlly.y, speed, SHIELD_RADIUS / 2, 20);
            return null;
        }

        // 6. Case C: No allies left -> melee rush the player
        const meleeAttackRange = this.radius + 15;
        this.moveTowardsPoint(target.x, target.y, speed, meleeAttackRange);

        if (distance <= meleeAttackRange && this.attackCooldown <= 0) {
            this.attackCooldown = 1.5;
            return target;
        }

        return null;
    }

    protected override draw(): void {
        super.draw();

        for (const target of this.shieldedEnemies) {
            if (!target.alive) continue;

            const targetX = target.x - this.x;
            const targetY = target.y - this.y;
            this.graphic.lineStyle(7, this.color, 0.12);
            this.graphic.lineBetween(0, 0, targetX, targetY);
            this.graphic.lineStyle(2, this.color, 0.85);
            this.graphic.lineBetween(0, 0, targetX, targetY);
            this.graphic.lineStyle(2, this.color, 0.95);
            this.graphic.strokeCircle(targetX, targetY, target.radius + 8);
            this.graphic.fillStyle(this.color, 0.75);
            this.graphic.fillCircle(targetX, targetY, 3);
        }
    }

    override destroy(): void {
        this.shieldedEnemies = [];
        super.destroy();
    }
}
