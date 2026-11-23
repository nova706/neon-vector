import Phaser from "phaser";
import { WeaponBase } from "./WeaponBase";
import type { WeaponHitResult } from "../../types";

export class WeaponOrbit extends WeaponBase {

    private elapsedTime = 0;
    private x = 0;
    private y = 0;
    private radius = 18;

    public override update(delta: number): void {
        this.elapsedTime += delta;

        // Orbit math using dynamic index offset or default layout properties
        const angle = this.elapsedTime * 6 + (this.attacker.playerIndex || 0);
        this.x = this.attacker.x + Math.cos(angle) * this.stats.range;
        this.y = this.attacker.y + Math.sin(angle) * this.stats.range;

        const enemy = this.attacker.scene.getEnemies().find((candidate) => candidate.alive
            && Phaser.Math.Distance.Between(candidate.x, candidate.y, this.x, this.y) < candidate.radius + this.radius);

        if (enemy) {
            this.attacker.stats.removeEffect("invisibility");
            const damageMultiplier = this.attacker.stats.getStat("damageMultiplier") || 1;
            enemy.takeDamage(this.stats.damage * delta * 60 * damageMultiplier, this.attacker, this.stats.knockback);
        }
    }

    public override draw(graphics: Phaser.GameObjects.Graphics): void {
        // Graphics are drawn relative to the attacker, so we offset the orbit position accordingly
        const x = this.x - this.attacker.x;
        const y = this.y - this.attacker.y;

        graphics.lineStyle(4, this.attacker.color, 0.95);
        graphics.lineBetween(x - 7, y - 7, x + 7, y + 7);
        graphics.lineBetween(x - 7, y + 7, x + 7, y - 7);
    }

    // Active trigger pull performs the custom secondary explosion burst expansion
    protected executeFire(multiplier: number): void {
        const range = this.stats.burstRange ?? 110;
        const orbRadius = this.radius ?? 10;
        const baseDamage = (this.stats.burstDamage ?? this.stats.damage) * multiplier;
        const baseKnockback = this.stats.burstKnockback ?? this.stats.knockback;

        const hits: WeaponHitResult[] = this.attacker.scene.getEnemies()
            .filter((enemy) => enemy.alive)
            .map((enemy) => {
                const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
                return { enemy, dist };
            })
            .filter(({ enemy, dist }) => dist <= range + (enemy.radius ?? 0))
            .map(({ enemy, dist }) => ({
                enemy,
                // Precision if the spinning blade itself is overlapping the enemy's radius
                isPrecision: dist <= (enemy.radius ?? 0) + orbRadius,
            }));

        const hadPrecision = hits.some((h) => h.isPrecision);

        hits.forEach((hit) => {
            let precisionMultiplier = this.getCurrentPrecisionMultiplier(hit.isPrecision);
            let damage = baseDamage * precisionMultiplier;
            let knockback = baseKnockback * precisionMultiplier;
            hit.enemy.takeDamage(damage, this.attacker, knockback, hit.isPrecision);
        });

        // Only one precision hit per burst counts towards multiplier but each enemy precision hit gets the increased damage.
        this.recordHits(hits);

        this.attacker.scene.effectsManager.addExpandingRing(this.x, this.y, range, this.attacker.color, 0.28);
        this.attacker.scene.effectsManager.emitParticles(this.x, this.y, this.attacker.color, hadPrecision ? 28 : 18);
    }
}
