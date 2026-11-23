import Phaser from "phaser";
import { DAMAGE_POPUP_CONFIG } from "../../data/DamagePopupData";
import { getRenderScale } from "../../boot/phaserConfig";

export class DamageNumberEntity extends Phaser.GameObjects.Text {
    private elapsed = 0;
    private readonly lifetime = DAMAGE_POPUP_CONFIG.durationMs / 1000;
    private readonly startY: number;
    private readonly initialScale: number;

    constructor(scene: Phaser.Scene, x: number, y: number, amount: number, isCrit = false) {
        const rounded = Math.max(1, Math.round(amount));
        const label = isCrit ? `${rounded}!` : `${rounded}`;
        const jitterX = Phaser.Math.Between(-10, 10);
        const startY = y - 14;

        super(scene, x + jitterX, startY, label, {
            fontFamily: "monospace",
            fontSize: isCrit ? DAMAGE_POPUP_CONFIG.critFontSize : DAMAGE_POPUP_CONFIG.normalFontSize,
            fontStyle: isCrit ? "bold" : "normal",
            color: isCrit ? DAMAGE_POPUP_CONFIG.critColor : DAMAGE_POPUP_CONFIG.normalColor,
            stroke: DAMAGE_POPUP_CONFIG.strokeColor,
            strokeThickness: isCrit ? 4 : 3,
            resolution: getRenderScale(),
        });

        this.startY = startY;
        this.initialScale = isCrit ? DAMAGE_POPUP_CONFIG.critPopScale : 1;

        this.setOrigin(0.5);
        this.setDepth(90);
        this.setScale(this.initialScale);

        scene.add.existing(this);
    }

    public override update(delta: number): boolean {
        this.elapsed += delta;
        const t = Math.min(1, this.elapsed / this.lifetime);

        // Cubic ease-out upward float & scale settle
        const easeOut = 1 - Math.pow(1 - t, 3);
        this.y = this.startY - DAMAGE_POPUP_CONFIG.floatDistance * easeOut;
        this.setScale(Phaser.Math.Linear(this.initialScale, 1, easeOut));
        this.setAlpha(1 - t);

        return this.elapsed >= this.lifetime;
    }
}
