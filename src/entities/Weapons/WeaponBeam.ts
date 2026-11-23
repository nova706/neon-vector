import Phaser from "phaser";
import { WeaponBase } from "./WeaponBase";

export class WeaponBeam extends WeaponBase {
    
    protected executeFire(multiplier: number): void {
        const dx = Math.cos(this.attacker.attackAngle);
        const dy = Math.sin(this.attacker.attackAngle);
        const range = this.stats.range;

        this.attacker.scene.effectsManager.addProjectile(this.attacker.x, this.attacker.y, dx, dy, range, this.attacker.color, 0.12);

        const hits = this.getBeamHits(dx, dy, range);

        if (hits.length === 0) {
            this.resetPrecisionStreak();
            return;
        }

        const baseDamage = this.stats.damage * multiplier;
        const precisionMultiplier = this.getCurrentPrecisionMultiplier(hits[0].isPrecision);
        const firstHitDamage = baseDamage * precisionMultiplier;
        const firstHitKnockback = this.stats.knockback * precisionMultiplier;

        let isFirstHit = true;
        hits.forEach((hit) => {
            let damage = isFirstHit ? firstHitDamage : baseDamage;
            let knockback = isFirstHit ? firstHitKnockback : this.stats.knockback;
            hit.enemy.takeDamage(damage, this.attacker, knockback, isFirstHit && hit.isPrecision);
            isFirstHit = false;
        });

        // Only the first enemy hit counts for precision (over penetration does not count)
        this.recordHit(hits[0]);
    }
}
