import { ABILITY_REGISTRY, type AbilityData, type AbilityType } from "../../data/AbilityData";
import type { IAttacker } from "../../interfaces/IAttacker";

export abstract class AbilityBase {
    public cooldown = 0;
    public activeRemaining = 0;

    constructor(protected readonly abilityType: AbilityType) { }

    public update(attacker: IAttacker, delta: number): number {
        // 1. Drain phase: tick down active duration before cooldown begins
        if (this.activeRemaining > 0) {
            this.activeRemaining = Math.max(0, this.activeRemaining - delta);
            if (this.activeRemaining === 0) {
                this.onAbilityEnded(attacker);
            }
            return this.cooldown;
        }

        // 2. Recharge phase: tick down cooldown once super has finished draining
        if (this.cooldown > 0) {
            const cooldownMultiplier = attacker.stats.getStat("abilityCooldownMultiplier");
            this.cooldown = Math.max(0, this.cooldown - delta * cooldownMultiplier);
        }

        return this.cooldown;
    }

    public get chargePercent(): number {
        const stats = ABILITY_REGISTRY[this.abilityType];

        // Draining from 100% -> 0% while active
        if (this.activeRemaining > 0 && stats.duration && stats.duration > 0) {
            return Math.round((this.activeRemaining / stats.duration) * 100);
        }

        // Charging from 0% -> 100% while on cooldown
        return stats.cooldown === 0 ? 100 : Math.round((1 - this.cooldown / stats.cooldown) * 100);
    }

    public resetCharge(): number {
        this.activeRemaining = 0;
        this.cooldown = ABILITY_REGISTRY[this.abilityType].cooldown;
        return this.cooldown;
    }

    public useAbility(attacker: IAttacker): void {
        if (this.cooldown > 0) return;

        console.log("player use ability");

        const stats = ABILITY_REGISTRY[this.abilityType];
        this.activeRemaining = stats.duration ?? 0;
        this.cooldown = stats.cooldown;

        this.executeAbility(attacker, stats);

        attacker.scene.events.emit("minor-used", { player: attacker.playerIndex, ability: this.abilityType });
    }

    /** Optional hook for subclasses to clean up active buffs/visuals when duration ends */
    protected onAbilityEnded(_attacker: IAttacker): void { }

    protected abstract executeAbility(attacker: IAttacker, stats: AbilityData): void;
}
