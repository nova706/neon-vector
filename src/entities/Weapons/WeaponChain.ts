import Phaser from "phaser";
import { WeaponBase } from "./WeaponBase";
import type { IAttacker } from "../../interfaces/IAttacker";
import { BeamEntity } from "../Effects/BeamEntity";

export class WeaponChain extends WeaponBase {

    protected executeFire(attacker: IAttacker, multiplier: number): void {
        const dx = Math.cos(attacker.attackAngle);
        const dy = Math.sin(attacker.attackAngle);
        const range = this.stats.range;
        const finalDamage = this.stats.damage * multiplier;

        const possibleTargets = attacker.scene.getEnemies().filter((enemy) => enemy.alive && !enemy.stats.hasTag("invulnerable"));

        const beamHalfWidth = 28;

        const hit = attacker.scene.getEnemies()
            .filter((enemy) => enemy.alive)
            .map((enemy) => {
                // Adjust property to match your entity/body setup (e.g., enemy.radius or enemy.body.radius)
                const enemyRadius = enemy.radius ?? 0;
                const rx = enemy.x - attacker.x;
                const ry = enemy.y - attacker.y;

                return {
                    enemy,
                    enemyRadius,
                    along: rx * dx + ry * dy,
                    across: Math.abs(rx * dy - ry * dx),
                };
            })
            .filter(({ along, across, enemyRadius }) => {
                const hitWidth = beamHalfWidth + enemyRadius;

                // Quick rejection for width and overall length
                if (across > hitWidth || along < -enemyRadius || along > range + enemyRadius) {
                    return false;
                }

                // Exact rounded-cap check if the enemy is slightly behind the origin or past the max range
                if (along < 0) {
                    return (along * along + across * across) <= (hitWidth * hitWidth);
                }
                if (along > range) {
                    const pastEnd = along - range;
                    return (pastEnd * pastEnd + across * across) <= (hitWidth * hitWidth);
                }

                return true;
            })
            .sort((a, b) => a.along - b.along)
            .map(({ enemy }) => enemy)[0];


        const end = hit ? { x: hit.x, y: hit.y } : { x: attacker.x + dx * this.stats.range, y: attacker.y + dy * this.stats.range };

        let beam = new BeamEntity(attacker.scene, attacker.x, attacker.y, end.x, end.y, 1, 0, attacker.color, 0.5);
        attacker.scene.effectsManager.addWeaponEffect(beam);

        if (!hit) return;

        let chained = [hit.id];
        let previous = hit;
        let chainRange = this.stats.chainRange || 100;
        let falloff = this.stats.chainFalloff || 0.5;
        const chainCount = this.stats.chainCount || 2;

        hit.takeDamage(finalDamage, attacker, this.stats.knockback);

        for (let count = 0; count < chainCount; count += 1) {

            const next = possibleTargets.find((enemy) => !chained.includes(enemy.id)
                && Phaser.Math.Distance.Between(previous.x, previous.y, enemy.x, enemy.y) < chainRange);

            if (!next) break;

            beam = new BeamEntity(attacker.scene, previous.x, previous.y, next.x, next.y, 1, 0, attacker.color, 0.5);
            attacker.scene.effectsManager.addWeaponEffect(beam);

            let multiplier = Math.pow(falloff, count + 1);
            next.takeDamage(finalDamage * multiplier, attacker, this.stats.knockback * multiplier);

            chained.push(next.id);
            previous = next;
        }
    }

    public draw(attacker: IAttacker, graphics: Phaser.GameObjects.Graphics) {
        if (this.stats.chargeTime && this.chargeTimer > 0 && this.chargeTimer < this.stats.chargeTime) {
            const dx = Math.cos(attacker.attackAngle);
            const dy = Math.sin(attacker.attackAngle);
            const end = { x: dx * this.stats.range, y: dy * this.stats.range };

            const t = Phaser.Math.Clamp(this.chargeTimer / this.stats.chargeTime, 0, 1);

            // Lerp alpha between start and end
            let alpha = Phaser.Math.Linear(0, 0.7, t);

            graphics.lineStyle(1, attacker.color, alpha);
            graphics.lineBetween(0, 0, end.x, end.y);
        }
    }
}
