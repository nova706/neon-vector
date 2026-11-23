import Phaser from "phaser";
import type { PlayerCommand, PlayerData, PlayerLoadout } from "../types";
import type { NeonVectorScene } from "../scene/NeonVectorScene";
import type { IAttacker } from "../interfaces/IAttacker";
import type { WeaponBase } from "./Weapons/WeaponBase";
import { WeaponFactory } from "./Weapons/WeaponFactory";
import type { AbilityBase } from "./Abilities/AbilityBase";
import { AbilityFactory } from "./Abilities/AbilityFactory";
import { StatComponent } from "../systems/stats/StatComponent";
import type { SuperBase } from "./Supers/SuperBase";
import { SuperFactory } from "./Supers/SuperFactory";
import { devState, IS_TEST_MODE } from "../data/DevData";
import { REVIVE_CONFIG } from "../data/PlayerData";
import { HitIFrame } from "../systems/stats/Buffs";

export class PlayerEntity extends Phaser.GameObjects.Container implements IAttacker {
    private static readonly MAX_SPEED = 300;

    readonly id: string = Phaser.Math.RND.uuid();

    declare body: Phaser.Physics.Arcade.Body;

    readonly graphic: Phaser.GameObjects.Graphics;
    readonly scene: NeonVectorScene;
    readonly stats: StatComponent;

    private reviveProgress = 0;

    // POOLS
    public currentHealth: number = 0;
    public currentOvershield: number = 0;
    public superCooldown: number = 0;
    public minorCooldown: number = 0;

    radius = 15;
    attackAngle = -Math.PI / 2;
    alive = true;
    color: number;
    readonly playerIndex: number;
    loadout: PlayerLoadout;
    command: PlayerCommand = { moveX: 0, moveY: 0, aimX: 0, aimY: -1, fire: false, useMinor: false, useSuper: false };

    private currentWeapon: WeaponBase;
    private currentAbility: AbilityBase;
    private currentSuper: SuperBase;
    private healthRegenDelay = 0;

    get abilityChargePercent(): number {
        return this.currentAbility.chargePercent;
    }

    get superChargePercent(): number {
        return this.currentSuper.chargePercent;
    }

    constructor(
        scene: NeonVectorScene,
        readonly playerData: PlayerData,
        x: number,
        y: number,
        loadout: PlayerLoadout,
    ) {
        super(scene, x, y);

        this.loadout = { ...loadout };
        this.color = playerData.color;
        this.playerIndex = playerData.index;

        this.currentWeapon = WeaponFactory.create(this.loadout.weapon, this);
        this.currentAbility = AbilityFactory.create(this.loadout.minor);
        this.currentSuper = SuperFactory.create(this.loadout.super);

        this.stats = new StatComponent({
            maxHealth: 220,
            healthRegen: 30,
            healthRegenDelay: 3,
            maxOvershield: 50,
            damageTakenMultiplier: 1,
            moveSpeed: 250,
            damageMultiplier: 1.0,
            attackRateMultiplier: 1.0,
            superCooldownMultiplier: 1.0,
            abilityCooldownMultiplier: 1.0
        });
        this.currentHealth = this.stats.getStat("maxHealth");

        this.scene = scene;
        this.graphic = scene.add.graphics();
        this.add(this.graphic);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.body.setCircle(14);
        this.body.setCollideWorldBounds(true);
        this.body.setBounce(0.25);
        this.body.setDamping(true);
        this.body.setDrag(240);
        this.body.setMaxVelocity(PlayerEntity.MAX_SPEED, PlayerEntity.MAX_SPEED);
    }

    setCommand(command: PlayerCommand): void {
        this.command = command;
        if (Math.hypot(command.aimX, command.aimY) > 0.18) {
            this.attackAngle = Math.atan2(command.aimY, command.aimX);
        } else if (Math.hypot(command.moveX, command.moveY) > 0.18) {
            this.attackAngle = Math.atan2(command.moveY, command.moveX);
        }
    }

    applyLoadout(loadout: PlayerLoadout): void {
        if (loadout.weapon !== this.loadout.weapon) {
            this.currentWeapon = WeaponFactory.create(loadout.weapon, this);
        }
        if (loadout.minor !== this.loadout.minor) {
            this.currentAbility = AbilityFactory.create(loadout.minor);
            this.minorCooldown = this.currentAbility.resetCharge();
        }
        if (loadout.super !== this.loadout.super) {
            this.currentSuper = SuperFactory.create(loadout.super);
            this.superCooldown = this.currentSuper.resetCharge();
        }
        this.loadout = { ...loadout };
        this.playerData.loadout = this.loadout;
    }

    update(delta: number): void {

        this.stats.update(delta, this);

        this.minorCooldown = this.currentAbility.update(this, delta);
        this.superCooldown = this.currentSuper.update(this, delta);

        const maxHealth = this.stats.getStat("maxHealth");
        if (this.healthRegenDelay > 0) {
            this.healthRegenDelay = Math.max(0, this.healthRegenDelay - delta);
        } else if (this.currentHealth < maxHealth) {
            const regenRate = this.stats.getStat('healthRegen');
            this.currentHealth = Math.min(maxHealth, this.currentHealth + regenRate * delta);
        }

        if (this.command.useSuper) this.currentSuper.useSuper(this);
        if (this.command.useMinor) this.currentAbility.useAbility(this);

        // Decrease weapon timers safely
        if (this.currentWeapon.cooldownTimer > 0) {
            this.currentWeapon.cooldownTimer -= delta;
        }

        const canFire = !this.stats.hasTag('suppress_attack');
        if (this.command.fire) {
            if (canFire) {
                this.currentWeapon.tryFire(delta);
            }
        } else {
            this.currentWeapon.stopFire();
        }

        this.currentWeapon.update(delta);
        this.draw();
    }

    fixedUpdate(): void {
        if (!this.alive || !this.body) return;
        const length = Math.hypot(this.command.moveX, this.command.moveY);
        const scale = length > 1 ? 1 / length : 1;

        // Move speed now dynamically scales with slows, haste buffs, etc.
        const speed = this.stats.getStat('moveSpeed');
        this.body.setVelocity(this.command.moveX * scale * speed, this.command.moveY * scale * speed);
    }

    public updateDowned(delta: number, livingPlayers: PlayerEntity[]): void {
        if (this.alive) return;

        // Count how many living teammates are within revive range
        const helpers = livingPlayers.filter(
            (other) =>
                other !== this &&
                other.alive &&
                Phaser.Math.Distance.Between(this.x, this.y, other.x, other.y) <= REVIVE_CONFIG.radius
        ).length;

        if (helpers > 0) {
            // Each nearby teammate contributes to revive speed (1x for 1 player, 1.5x for 2, etc.)
            const speedMultiplier = 1 + (helpers - 1) * 0.5;
            this.reviveProgress += (delta / REVIVE_CONFIG.duration) * speedMultiplier;

            if (this.reviveProgress >= 1) {
                this.revive(REVIVE_CONFIG.reviveHealthRatio);
                return;
            }
        } else if (this.reviveProgress > 0) {
            // Slowly drain progress if teammates step away
            this.reviveProgress = Math.max(0, this.reviveProgress - delta * REVIVE_CONFIG.decayRate);
        }

        this.draw();
    }

    takeDamage(amount: number, source?: IAttacker): void {
        if (!this.alive) return;

        if (this.stats.hasTag('invulnerable')) {
            // Optional: spawn a floating "IMMUNE" or shield spark effect here
            return;
        }

        const finalDamage = amount * this.stats.getStat('damageTakenMultiplier');
        if (finalDamage <= 0) return;

        this.healthRegenDelay = this.stats.getStat('healthRegenDelay');

        const shieldDamage = Math.min(this.currentOvershield, finalDamage);
        this.currentOvershield -= shieldDamage;

        let minHealth = 0;
        if (IS_TEST_MODE && devState.godMode) {
            minHealth = 1;
        }

        this.currentHealth = Math.max(minHealth, this.currentHealth - (finalDamage - shieldDamage));

        this.scene.effectsManager.emitParticles(this.x, this.y, 0xff426b, 8);

        if (this.currentHealth <= 0) this.handleDeath();
    }

    handleDeath(): void {
        if (!this.alive) return;
        this.alive = false;

        this.reviveProgress = 0;
        this.minorCooldown = this.currentAbility.resetCharge();
        this.superCooldown = this.currentSuper.resetCharge();
        this.command = { ...this.command, moveX: 0, moveY: 0, fire: false };
        this.body.setVelocity(0, 0);
        this.draw();

        this.scene.events.emit("player-died", this);
    }

    revive(healthPercent: number) {

        this.alive = true;
        this.reviveProgress = 0;
        this.currentHealth = Math.max(1, Math.round(this.stats.getStat('maxHealth') * healthPercent));

        // Re-enable physics body
        const body = this.body as Phaser.Physics.Arcade.Body | undefined;
        if (body) {
            body.enable = true;
            body.setVelocity(0, 0);
        }

        this.stats.applyEffect(HitIFrame);

        // Spawn a burst effect to signal the revive
        this.scene.effectsManager.addExpandingRing(this.x, this.y, REVIVE_CONFIG.radius, this.color, 0.42);
    }

    override destroy(fromScene?: boolean): void {
        this.graphic.destroy();
        super.destroy(fromScene);
    }

    private draw(): void {
        const graphics = this.graphic;
        const alpha = this.stats.hasTag("invisible") ? 0.1 : 1;

        graphics.clear();
        graphics.setAlpha(alpha);

        graphics.fillStyle(this.playerData.color, 0.85);
        graphics.fillCircle(0, 0, 5);
        graphics.lineStyle(2, this.playerData.color, 0.75);

        if (this.minorCooldown <= 0) {
            graphics.lineBetween(-10, -5, -17, -12);
            graphics.lineBetween(10, -5, 17, -12);
            graphics.lineBetween(-10, 7, -15, 15);
            graphics.lineBetween(10, 7, 15, 15);
        }

        if (this.superCooldown <= 0) {
            graphics.fillStyle(this.playerData.color, 0.5);
            graphics.fillCircle(0, 0, 18);
        }

        // aiming
        if (this.alive) {

            // Draw health bar
            const maxHealth = this.stats.getStat("maxHealth");
            const healthColor = this.currentHealth < maxHealth * 0.25 ? 0xff1744 : this.playerData.color;
            this.graphic.lineStyle(4, healthColor, 0.95);
            this.graphic.beginPath();
            this.graphic.arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.currentHealth / maxHealth);
            this.graphic.strokePath();

            // aiming
            const aimX = Math.cos(this.attackAngle);
            const aimY = Math.sin(this.attackAngle);
            graphics.lineStyle(3, 0xe7fbff, 0.9);
            graphics.lineBetween(aimX * 9, aimY * 9, aimX * 25, aimY * 25);

            this.currentWeapon.draw(graphics);
        } else {

            // Outer proximity circle
            graphics.lineStyle(1.5, this.color, 0.35);
            graphics.strokeCircle(0, 0, REVIVE_CONFIG.radius);

            // Inner downed core
            graphics.fillStyle(this.color, 0.25);
            graphics.fillCircle(0, 0, 12);

            // Progress arc (starts at top -90 deg and fills clockwise)
            if (this.reviveProgress > 0) {
                const startAngle = -Math.PI / 2;
                const endAngle = startAngle + Math.PI * 2 * Math.min(1, this.reviveProgress);

                graphics.lineStyle(4, 0x4dff9e, 0.95);
                graphics.beginPath();
                graphics.arc(0, 0, 22, startAngle, endAngle, false);
                graphics.strokePath();
            }
        }

    }
}
