import Phaser from "phaser";
import type { PlayerEntity } from "../entities/PlayerEntity";
import { CONTROLLER_INPUTS, GAMEPAD_BUTTONS, KEYBOARD_INPUTS } from "../input";
import type { NeonVectorScene } from "../scene/NeonVectorScene";
import type { PlayerCommand } from "../types";

interface PlayerKeyBindings {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    fire: Phaser.Input.Keyboard.Key;
    minor: Phaser.Input.Keyboard.Key;
    super: Phaser.Input.Keyboard.Key;
}

export class InputSystem {
    private playerKeys: Array<PlayerKeyBindings | null> = [];
    private assignedPads: Array<Phaser.Input.Gamepad.Gamepad | null> = [null, null, null, null];
    private padJustPressed: Array<Set<number>> = Array.from({ length: 4 }, () => new Set());
    private mouseMinorPressed = false;

    constructor(private readonly scene: NeonVectorScene) { }

    public start(): void {
        const kb = this.scene.input.keyboard;
        if (kb) {
            kb.addCapture([
                Phaser.Input.Keyboard.KeyCodes.SPACE,
                Phaser.Input.Keyboard.KeyCodes.UP,
                Phaser.Input.Keyboard.KeyCodes.DOWN,
                Phaser.Input.Keyboard.KeyCodes.LEFT,
                Phaser.Input.Keyboard.KeyCodes.RIGHT,
            ]);

            // Pass numeric KeyCodes directly into kb.addKey()
            this.playerKeys = KEYBOARD_INPUTS.map((cfg) => {
                if (!cfg) return null;
                return {
                    up: kb.addKey(cfg.up),
                    down: kb.addKey(cfg.down),
                    left: kb.addKey(cfg.left),
                    right: kb.addKey(cfg.right),
                    fire: kb.addKey(cfg.fire),
                    minor: kb.addKey(cfg.minor),
                    super: kb.addKey(cfg.super),
                };
            });
        }

        // Mouse setup
        this.scene.input.mouse?.disableContextMenu();
        this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) {
                this.mouseMinorPressed = true;
            }
        });

        // Gamepad setup
        const gamepadPlugin = this.scene.input.gamepad;
        if (gamepadPlugin) {
            gamepadPlugin.on("connected", (pad: Phaser.Input.Gamepad.Gamepad) => {
                pad.setAxisThreshold(0.2);
            });

            gamepadPlugin.on("disconnected", (pad: Phaser.Input.Gamepad.Gamepad) => {
                const slot = this.assignedPads.indexOf(pad);
                if (slot !== -1) {
                    this.assignedPads[slot] = null;
                    this.padJustPressed[slot].clear();
                }
            });

            gamepadPlugin.on(
                "down",
                (pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
                    let slot = this.assignedPads.indexOf(pad);

                    if (slot === -1 && button.index === GAMEPAD_BUTTONS.A) {
                        slot = this.assignedPads.findIndex((p) => p === null);
                        if (slot !== -1) {
                            pad.setAxisThreshold(0.2);
                            this.assignedPads[slot] = pad;
                        }
                    }

                    if (slot !== -1) {
                        this.padJustPressed[slot].add(button.index);
                    }
                }
            );
        }
    }

    public readCommand(index: number, player: PlayerEntity): PlayerCommand {
        const keys = this.playerKeys[index];
        const pad = this.assignedPads[index];
        if (!keys && !pad) return this.emptyCommand();

        const kbX = keys ? Number(keys.right.isDown) - Number(keys.left.isDown) : 0;
        const kbY = keys ? Number(keys.down.isDown) - Number(keys.up.isDown) : 0;
        const moveX = Phaser.Math.Clamp(kbX + (pad?.leftStick.x ?? 0), -1, 1);
        const moveY = Phaser.Math.Clamp(kbY + (pad?.leftStick.y ?? 0), -1, 1);

        const pointer = this.scene.input.activePointer;
        const pointerAim = index === 0 && pointer.leftButtonDown();

        const rightX = pad?.rightStick.x ?? 0;
        const rightY = pad?.rightStick.y ?? 0;
        const stickAim = Math.hypot(rightX, rightY) > 0.2;

        const fire =
            Boolean(keys?.fire.isDown) ||
            this.isButtonDown(pad, CONTROLLER_INPUTS.fire) ||
            pointerAim;

        const useMinor =
            Boolean(keys && Phaser.Input.Keyboard.JustDown(keys.minor)) ||
            this.consumeButtonPress(index, CONTROLLER_INPUTS.minor) ||
            (index === 0 && this.consumeMouseMinorPress());

        const useSuper =
            Boolean(keys && Phaser.Input.Keyboard.JustDown(keys.super)) ||
            this.consumeButtonPress(index, CONTROLLER_INPUTS.super);

        return {
            moveX,
            moveY,
            aimX: pointerAim ? pointer.worldX - player.x : stickAim ? rightX : moveX,
            aimY: pointerAim ? pointer.worldY - player.y : stickAim ? rightY : moveY,
            fire,
            useMinor,
            useSuper,
        };
    }

    public getAssignedPads(): ReadonlyArray<Phaser.Input.Gamepad.Gamepad | null> {
        return this.assignedPads;
    }

    private isButtonDown(pad: Phaser.Input.Gamepad.Gamepad | null, buttonIndex: number): boolean {
        if (!pad) return false;
        const button = pad.buttons[buttonIndex];
        return button ? button.value >= 0.5 : false;
    }

    private consumeButtonPress(playerIndex: number, buttonIndex: number): boolean {
        const pressedSet = this.padJustPressed[playerIndex];
        if (!pressedSet.has(buttonIndex)) return false;
        pressedSet.delete(buttonIndex);
        return true;
    }

    private consumeMouseMinorPress(): boolean {
        if (!this.mouseMinorPressed) return false;
        this.mouseMinorPressed = false;
        return true;
    }

    private emptyCommand(): PlayerCommand {
        return { moveX: 0, moveY: 0, aimX: 0, aimY: -1, fire: false, useMinor: false, useSuper: false };
    }
}
