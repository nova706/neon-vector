import Phaser from "phaser";
import { WeaponBase } from "./WeaponBase";
import type { IAttacker } from "../../interfaces/IAttacker";
import { DirectionalBurstEntity } from "../Effects/DirectionalBurstEntity";

export class WeaponBurst extends WeaponBase {

    protected executeFire(attacker: IAttacker, multiplier: number): void {
        const dx = Math.cos(attacker.attackAngle);
        const dy = Math.sin(attacker.attackAngle);
        const finalDamage = this.stats.damage * multiplier;

        const coneSlope = 0.34;
        const edgeScale = Math.hypot(1, coneSlope); // ~1.0562 (accounts for perpendicular distance to angled edge)
        const range = this.stats.range;

        const hits = attacker.scene.getEnemies()
            .filter((enemy) => enemy.alive)
            .map((enemy) => {
                const rx = enemy.x - attacker.x;
                const ry = enemy.y - attacker.y;
                return {
                    enemy,
                    along: rx * dx + ry * dy,
                    across: Math.abs(rx * dy - ry * dx),
                };
            })
            .filter(({ enemy, along, across }) => {
                const r = enemy.radius;
                const maxDist = range + r;
                const distSq = along * along + across * across;

                // 1. Must be within the rounded sector arc (prevents flat cutoff at max range)
                if (distSq > maxDist * maxDist) {
                    return false;
                }

                // 2. Check against the angled cone sides (shifted perpendicular to the slope)
                if (along >= 0) {
                    return across <= along * coneSlope + r * edgeScale;
                }

                // 3. Optional: Catch enemies slightly behind attacker whose radius overlaps the origin point
                return distSq <= r * r;
            })
            .sort((a, b) => a.along - b.along)
            .map((v) => v.enemy);

        attacker.scene.effectsManager.addWeaponEffect(new DirectionalBurstEntity(
            attacker.scene,
            attacker.x,
            attacker.y,
            attacker.attackAngle,
            this.stats.range + 20,
            attacker.color,
            0.2,
        ));

        hits.forEach((enemy) => {
            enemy.takeDamage(finalDamage, attacker, this.stats.knockback);
        });
    }
}
