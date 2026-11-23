import { PRECISION_CONFIG, WEAPON_STATS, type WeaponStats } from "../../data/WeaponData";
import type { IAttacker } from "../../interfaces/IAttacker";
import type { PlayerLoadout, WeaponHitResult } from "../../types";

export abstract class WeaponBase {
    public cooldownTimer = 0;
    public chargeTimer = 0;
    public readonly stats: WeaponStats;
    public precisionStreak = 0;

    constructor(
        protected readonly weaponKey: PlayerLoadout["weapon"],
        protected readonly attacker: IAttacker) {
        this.stats = WEAPON_STATS[this.weaponKey];
    }

    // Some weapons (like 'orbit') need a continuous frame update tick
    public update(delta: number): void { }

    // Some weapons (like 'orbit') need a continuous frame draw tick
    public draw(graphics: Phaser.GameObjects.Graphics): void { }

    public tryFire(delta: number): void {
        if (this.cooldownTimer > 0) return;

        // If charging, do not fire
        if (this.stats.chargeTime && this.chargeTimer < this.stats.chargeTime) {
            this.chargeTimer += delta;
            return;
        }

        this.cooldownTimer = this.stats.cooldown;
        this.chargeTimer = 0;
        
        // Break stealth automatically on trigger pull
        this.attacker.stats.removeEffect("invisibility");

        // Calculate damage amplification factor
        const damageMultiplier = this.attacker.stats.getStat("damageMultiplier") || 1;

        // Execute the unique firing code written in the subclass
        this.executeFire(damageMultiplier);
    }

    public stopFire(): void {
        this.chargeTimer = 0;
    }

    protected abstract executeFire(damageMultiplier: number): void;

    /** Call once per attack/trigger with whether ANY target took a precision hit */
    protected recordHits(hits: WeaponHitResult[]): void {
        if (hits.some(hit => hit.isPrecision)) {
            this.precisionStreak = Math.min(PRECISION_CONFIG.maxStreakStacks, this.precisionStreak + 1);
            this.showPrecisionMultiplierPopup();
        } else {
            this.precisionStreak = 0;
        }
    }

    protected recordHit(hit?: WeaponHitResult): void {
        if (hit?.isPrecision) {
            this.precisionStreak = Math.min(PRECISION_CONFIG.maxStreakStacks, this.precisionStreak + 1);
            this.showPrecisionMultiplierPopup();
        } else {
            this.precisionStreak = 0;
        }
    }

    protected getCurrentPrecisionMultiplier(isPrecision: boolean): number {
        if (!isPrecision) return 1;
        return PRECISION_CONFIG.baseCritMultiplier + this.precisionStreak * PRECISION_CONFIG.streakStep;
    }

    protected resetPrecisionStreak(): void {
        this.precisionStreak = 0;
    }

    private showPrecisionMultiplierPopup() {
        this.attacker.scene.effectsManager.addPrecisionStreak(
            this.attacker.x,
            this.attacker.y,
            PRECISION_CONFIG.baseCritMultiplier,
            this.precisionStreak
        );
    }

    protected getBeamHits(dx: number, dy: number, range: number): WeaponHitResult[] {

        const beamHalfWidth = 18;

        const hits: WeaponHitResult[] = this.attacker.scene.getEnemies()
            .filter((enemy) => enemy.alive)
            .map((enemy) => {
                const enemyRadius = enemy.radius ?? 0;
                const rx = enemy.x - this.attacker.x;
                const ry = enemy.y - this.attacker.y;

                return {
                    enemy,
                    enemyRadius,
                    along: rx * dx + ry * dy,
                    across: Math.abs(rx * dy - ry * dx),
                };
            })
            .filter(({ along, across, enemyRadius }) => {
                const hitWidth = beamHalfWidth + enemyRadius;
                if (across > hitWidth || along < -enemyRadius || along > range + enemyRadius) {
                    return false;
                }
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
            .map(({ enemy, across, enemyRadius }) => ({
                enemy,
                // Dead-center alignment check (scales slightly for large bosses/tanks)
                isPrecision: across <= Math.max(PRECISION_CONFIG.radiusBuffer, enemyRadius * 0.3),
            }));

        return hits;
    }
}
