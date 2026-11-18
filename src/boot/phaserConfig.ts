import Phaser from "phaser";
import type { NeonVectorScene } from "../scene/NeonVectorScene";

export const ROOM_WIDTH = 1280;
export const ROOM_HEIGHT = 720;

export function createPhaserConfig(
    parent: HTMLElement,
    scene: NeonVectorScene,
): Phaser.Types.Core.GameConfig {
    return {
        type: Phaser.AUTO,
        parent,
        backgroundColor: "#070916",
        roundPixels: true,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: ROOM_WIDTH,
            height: ROOM_HEIGHT,
        },
        physics: {
            default: "arcade",
            arcade: {
                gravity: { x: 0, y: 0 },
                fixedStep: true,
                fps: 60,
                debug: false,
            },
        },
        scene: [scene],
        input: { gamepad: true },
        render: {
            antialias: true,
            pixelArt: false,
            roundPixels: true,
        },
    };
}
