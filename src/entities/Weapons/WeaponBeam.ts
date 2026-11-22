import Phaser from "phaser";
import { WeaponBase } from "./WeaponBase";
import type { IAttacker } from "../../interfaces/IAttacker";

export class WeaponBeam extends WeaponBase {
    
    protected executeFire(attacker: IAttacker, multiplier: number): void {
        const dx = Math.cos(attacker.attackAngle);
        const dy = Math.sin(attacker.attackAngle);
        const range = this.stats.range;
        const finalDamage = this.stats.damage * multiplier;

        const beamHalfWidth = 18;

        const hits = attacker.scene.getEnemies()
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
            .map(({ enemy }) => enemy);

        hits.forEach((enemy) => {
            enemy.takeDamage(finalDamage, attacker, this.stats.knockback);
        });

        attacker.scene.effectsManager.addProjectile(attacker.x, attacker.y, dx, dy, range, attacker.color, 0.12);
    }
}
