import { SUPER_REGISTRY, type SuperData, type SuperType } from "../../data/SuperData";
import type { IAttacker } from "../../interfaces/IAttacker";

export abstract class SuperBase {
    public cooldown = 0;
    public activeRemaining = 0;

    constructor(protected readonly superType: SuperType) { }

    public get isActive(): boolean {
        return this.activeRemaining > 0;
    }

    public get isReady(): boolean {
        return !this.isActive && this.cooldown <= 0;
    }

    public update(attacker: IAttacker, delta: number): number {
        // 1. Drain phase: tick down active duration before cooldown begins
        if (this.activeRemaining > 0) {
            this.activeRemaining = Math.max(0, this.activeRemaining - delta);
            if (this.activeRemaining === 0) {
                this.onSuperEnded(attacker);
            }
            return this.cooldown;
        }

        // 2. Recharge phase: tick down cooldown once super has finished draining
        if (this.cooldown > 0) {
            const cooldownMultiplier = attacker.stats.getStat("superCooldownMultiplier");
            this.cooldown = Math.max(0, this.cooldown - delta * cooldownMultiplier);
        }

        return this.cooldown;
    }

    public get chargePercent(): number {
        const stats = SUPER_REGISTRY[this.superType];

        // Draining from 100% -> 0% while active
        if (this.activeRemaining > 0 && stats.duration && stats.duration > 0) {
            return Math.round((this.activeRemaining / stats.duration) * 100);
        }

        // Charging from 0% -> 100% while on cooldown
        return stats.cooldown === 0 ? 100 : Math.round((1 - this.cooldown / stats.cooldown) * 100);
    }

    public resetCharge(): number {
        this.activeRemaining = 0;
        this.cooldown = SUPER_REGISTRY[this.superType].cooldown;
        return this.cooldown;
    }

    public useSuper(attacker: IAttacker): void {
        if (!this.isReady) return;

        const stats = SUPER_REGISTRY[this.superType];
        this.activeRemaining = stats.duration ?? 0;
        this.cooldown = stats.cooldown;

        this.executeSuper(attacker, stats);

        attacker.scene.events.emit("super-used", {
            player: attacker.playerIndex,
            super: this.superType,
        });
    }

    /** Optional hook for subclasses to clean up active buffs/visuals when duration ends */
    protected onSuperEnded(_attacker: IAttacker): void { }

    protected abstract executeSuper(attacker: IAttacker, stats: SuperData): void;
}
