import Phaser from "phaser";
import type { PortSlot, Rect } from "../interfaces/RoomInterfaces";
import { getRenderScale } from "../boot/phaserConfig";

export class AirlockTrigger extends Phaser.GameObjects.Container {
    public readonly slot: PortSlot;
    public readonly bounds: Phaser.Geom.Rectangle;
    public isLocked = true;

    private readonly frame: Phaser.GameObjects.Graphics;
    private readonly statusLabel: Phaser.GameObjects.Text;
    private readonly rect: Rect;

    constructor(scene: Phaser.Scene, slot: PortSlot, worldRect: Rect) {
        super(scene, worldRect.x, worldRect.y);
        this.slot = slot;
        this.rect = worldRect;
        this.bounds = new Phaser.Geom.Rectangle(worldRect.x, worldRect.y, worldRect.width, worldRect.height);

        this.frame = scene.add.graphics();
        this.add(this.frame);

        const renderScale = getRenderScale();

        this.statusLabel = scene.add
            .text(worldRect.width * 0.5, worldRect.height * 0.5, "LOCKED", {
                fontFamily: "monospace",
                fontSize: "13px",
                color: "#ff4f79",
                align: "center",
                resolution: renderScale
            })
            .setOrigin(0.5);
        this.add(this.statusLabel);

        this.redraw(0xff4f79, 0.18);
    }

    public setLocked(locked: boolean): void {
        this.isLocked = locked;
        if (locked) {
            this.statusLabel.setText("LOCKED").setColor("#ff4f79");
            this.redraw(0xff4f79, 0.18);
        } else {
            this.statusLabel.setText("READY").setColor("#55f6ff");
            this.redraw(0x55f6ff, 0.22);
        }
    }

    public setSingleStatus(insideCount: number, totalLiving: number): void {
        if (this.isLocked) return;
        const ready = insideCount === totalLiving && totalLiving > 0;
        const color = ready ? 0x4dff9e : 0x55f6ff;

        this.statusLabel
            .setText(ready ? "ENGAGING..." : `AIRLOCK ${insideCount}/${totalLiving}`)
            .setColor(ready ? "#4dff9e" : "#55f6ff");
        this.redraw(color, ready ? 0.35 : 0.2);
    }

    public setSplitStatus(insideThisSide: number, totalLiving: number, pairReady: boolean): void {
        if (this.isLocked) return;

        if (pairReady) {
            this.statusLabel.setText("LINKED").setColor("#4dff9e");
            this.redraw(0x4dff9e, 0.35);
            return;
        }

        const needsPlayer = totalLiving >= 2 && insideThisSide === 0;
        const color = needsPlayer ? 0xffbe3d : 0x55f6ff;
        const label = needsPlayer ? "NEED 1+" : `READY (${insideThisSide})`;

        this.statusLabel.setText(label).setColor(needsPlayer ? "#ffbe3d" : "#55f6ff");
        this.redraw(color, 0.22);
    }

    private redraw(color: number, fillAlpha: number): void {
        this.frame.clear();
        this.frame.fillStyle(color, fillAlpha);
        this.frame.fillRect(0, 0, this.rect.width, this.rect.height);

        this.frame.lineStyle(2, color, 0.9);
        this.frame.strokeRect(0, 0, this.rect.width, this.rect.height);
    }
}
