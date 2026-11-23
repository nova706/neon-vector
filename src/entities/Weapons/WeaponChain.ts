import Phaser from "phaser";
import { WeaponBase } from "./WeaponBase";
import { BeamEntity } from "../Effects/BeamEntity";

export class WeaponChain extends WeaponBase {

    protected executeFire(multiplier: number): void {
        const dx = Math.cos(this.attacker.attackAngle);
        const dy = Math.sin(this.attacker.attackAngle);
        const range = this.stats.range;

        const possibleTargets = this.attacker.scene.getEnemies().filter((enemy) => enemy.alive && !enemy.stats.hasTag("invulnerable"));

        const hit = this.getBeamHits(dx, dy, range)[0];

        const end = hit ? { x: hit.enemy.x, y: hit.enemy.y } : { x: this.attacker.x + dx * this.stats.range, y: this.attacker.y + dy * this.stats.range };

        let beam = new BeamEntity(this.attacker.scene, this.attacker.x, this.attacker.y, end.x, end.y, 1, 0, this.attacker.color, 0.5);
        this.attacker.scene.effectsManager.addWeaponEffect(beam);

        if (!hit) {
            this.resetPrecisionStreak();
            return;
        }

        let previous = hit.enemy;
        let chained = [previous.id];
        let chainRange = this.stats.chainRange || 100;
        let falloff = this.stats.chainFalloff || 0.5;
        const chainCount = this.stats.chainCount || 2;

        const precisionMultiplier = this.getCurrentPrecisionMultiplier(hit.isPrecision);
        const finalDamage = this.stats.damage * multiplier * precisionMultiplier;
        const finalKnockback = this.stats.knockback * precisionMultiplier;
        hit.enemy.takeDamage(finalDamage, this.attacker, finalKnockback, hit.isPrecision);

        for (let count = 0; count < chainCount; count += 1) {

            const next = possibleTargets.find((enemy) => !chained.includes(enemy.id)
                && Phaser.Math.Distance.Between(previous.x, previous.y, enemy.x, enemy.y) < chainRange);

            if (!next) break;

            beam = new BeamEntity(this.attacker.scene, previous.x, previous.y, next.x, next.y, 1, 0, this.attacker.color, 0.5);
            this.attacker.scene.effectsManager.addWeaponEffect(beam);

            let falloffMultiplier = Math.pow(falloff, count + 1);
            next.takeDamage(finalDamage * falloffMultiplier, this.attacker, finalKnockback * falloffMultiplier);

            chained.push(next.id);
            previous = next;
        }

        // Only the first enemy hit counts towards precision but the chain shares the precision damage
        this.recordHit(hit);
    }

    public draw(graphics: Phaser.GameObjects.Graphics) {
        if (this.stats.chargeTime && this.chargeTimer > 0 && this.chargeTimer < this.stats.chargeTime) {
            const dx = Math.cos(this.attacker.attackAngle);
            const dy = Math.sin(this.attacker.attackAngle);
            const end = { x: dx * this.stats.range, y: dy * this.stats.range };

            const t = Phaser.Math.Clamp(this.chargeTimer / this.stats.chargeTime, 0, 1);

            // Lerp alpha between start and end
            let alpha = Phaser.Math.Linear(0, 0.7, t);

            graphics.lineStyle(1, this.attacker.color, alpha);
            graphics.lineBetween(0, 0, end.x, end.y);
        }
    }
}
