import Phaser from "phaser";
import { DAMAGE_POPUP_CONFIG } from "../../data/DamagePopupData";
import { getRenderScale } from "../../boot/phaserConfig";

export class PrecisionStreakEntity extends Phaser.GameObjects.Text {
    private elapsed = 0;
    private readonly lifetime = 0.8;
    private readonly startY: number;

    constructor(scene: Phaser.Scene, x: number, y: number, multiplier: number, streak: number) {
        const startY = y - 32;
        //const label = `${multiplier.toFixed(2)}x PRECISION (${streak})`;
        const label = `${streak}x`;

        super(scene, x, startY, label, {
            fontFamily: "monospace",
            fontSize: DAMAGE_POPUP_CONFIG.streakFontSize,
            fontStyle: "bold",
            color: DAMAGE_POPUP_CONFIG.streakColor,
            stroke: DAMAGE_POPUP_CONFIG.strokeColor,
            strokeThickness: 3,
            resolution: getRenderScale(),
        });

        this.startY = startY;
        this.setOrigin(0.5);
        this.setDepth(91);

        scene.add.existing(this);
    }

    public override update(delta: number): boolean {
        this.elapsed += delta;
        const t = Math.min(1, this.elapsed / this.lifetime);

        // Quad ease-out drift & fade
        const easeOut = 1 - (1 - t) * (1 - t);
        this.y = this.startY - 24 * easeOut;
        this.setAlpha(1 - t);

        return this.elapsed >= this.lifetime;
    }
}
