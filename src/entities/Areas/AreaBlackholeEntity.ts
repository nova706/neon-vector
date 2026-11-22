import Phaser from "phaser";
import type { NeonVectorScene } from "../../scene/NeonVectorScene";
import { AreaEntity } from "./AreaEntity";
import { AREA_REGISTRY } from "../../data/AreaData";
import { Slowed } from "../../systems/stats/Debuffs";
import type { IAttacker } from "../../interfaces/IAttacker";

export class AreaBlackholeEntity extends AreaEntity {

    private pullStrength: number = 300;
    private pullStrengthFalloff: number = 50;
    private damage: number = 400;

    constructor(
        scene: NeonVectorScene,
        x: number,
        y: number,
        readonly owner: number,
    ) {
        super(scene, x, y, "blackhole", owner, AREA_REGISTRY.blackhole);
    }

    override onUpdateEffect(delta: number): void {

        const players = this.scene.getPlayers().map(p => p as IAttacker);
        const enemies = this.scene.getEnemies().map(e => e as IAttacker);

        players.concat(enemies).forEach((attacker: IAttacker) => {
            if (!attacker.alive) return;
            const distance = Phaser.Math.Distance.Between(attacker.x, attacker.y, this.x, this.y);

            if (distance > 5) {
                const currentPull = this.pullStrength / (1 + (distance / this.pullStrengthFalloff));

                // Pull players in
                const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, this.x, this.y);
                attacker.body.setVelocity(attacker.body.velocity.x + Math.cos(angle) * currentPull, attacker.body.velocity.y + Math.sin(angle) * currentPull);
            }

            if (distance < this.areaData.radius) {
                attacker.stats.applyEffect(Slowed);
            }
        });
    }

    override destroy() {
        this.scene.explodeAt(this.x, this.y, this.areaData.radius, this.damage, this.areaData.color);
        super.destroy();
    }
}
