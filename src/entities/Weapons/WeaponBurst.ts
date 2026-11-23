import Phaser from "phaser";
import { WeaponBase } from "./WeaponBase";
import { DirectionalBurstEntity } from "../Effects/DirectionalBurstEntity";
import { PRECISION_CONFIG } from "../../data/WeaponData";
import type { WeaponHitResult } from "../../types";

export class WeaponBurst extends WeaponBase {

    protected executeFire(multiplier: number): void {
        const dx = Math.cos(this.attacker.attackAngle);
        const dy = Math.sin(this.attacker.attackAngle);

        const coneSlope = 0.34;
        const edgeScale = Math.hypot(1, coneSlope); // ~1.0562 (accounts for perpendicular distance to angled edge)
        const range = this.stats.range;

        const hits: WeaponHitResult[] = this.attacker.scene.getEnemies()
            .filter((enemy) => enemy.alive)
            .map((enemy) => {
                const rx = enemy.x - this.attacker.x;
                const ry = enemy.y - this.attacker.y;
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

                if (distSq > maxDist * maxDist) return false;
                if (along >= 0) return across <= along * coneSlope + r * edgeScale;
                return distSq <= r * r;
            })
            .sort((a, b) => a.along - b.along)
            .map(({ enemy, along, across }) => {
                const distSq = along * along + across * across;
                const sweetRange = range * PRECISION_CONFIG.coneRangeRatio;

                const inCenterCone = along > 0 && across <= along * (coneSlope * PRECISION_CONFIG.coneAngleRatio);
                const insideSweetRange = distSq <= sweetRange * sweetRange;

                return {
                    enemy,
                    isPrecision: inCenterCone && insideSweetRange,
                };
            });


        this.attacker.scene.effectsManager.addWeaponEffect(new DirectionalBurstEntity(
            this.attacker.scene,
            this.attacker.x,
            this.attacker.y,
            this.attacker.attackAngle,
            this.stats.range + 20,
            this.attacker.color,
            0.2,
        ));

        if (hits.length === 0) {
            this.resetPrecisionStreak();
            return;
        }

        // Only one precision hit per burst counts towards multiplier but each enemy precision hit gets the increased damage.
        hits.forEach((hit) => {
            let precisionMultiplier = this.getCurrentPrecisionMultiplier(hit.isPrecision);
            let finalDamage = this.stats.damage * multiplier * precisionMultiplier;
            let finalKnockback = this.stats.knockback * precisionMultiplier;

            hit.enemy.takeDamage(finalDamage, this.attacker, finalKnockback, hit.isPrecision);
        });

        // If any hits were precision, increase the count
        this.recordHits(hits);
    }
}
