import Phaser from "phaser";

const KeyCodes = Phaser.Input.Keyboard.KeyCodes;

// Standard W3C Gamepad Button Indices (used by pad.buttons[index])
export const GAMEPAD_BUTTONS = {
    A: 0,
    B: 1,
    X: 2,
    Y: 3,
    LB: 4,
    RB: 5,
    LT: 6,
    RT: 7,
    BACK: 8,
    START: 9,
    L3: 10,
    R3: 11,
    UP: 12,
    DOWN: 13,
    LEFT: 14,
    RIGHT: 15,
} as const;

export interface KeyboardBindingConfig {
    up: number;
    down: number;
    left: number;
    right: number;
    fire: number;
    minor: number;
    super: number;
}

export const CONTROLLER_INPUTS = {
    fire: GAMEPAD_BUTTONS.RT,
    minor: GAMEPAD_BUTTONS.LT,
    super: GAMEPAD_BUTTONS.RB,
} as const;

export const KEYBOARD_INPUTS: Array<KeyboardBindingConfig | null> = [
    // Player 1 (WASD + Space/E/Q)
    {
        up: KeyCodes.W,
        down: KeyCodes.S,
        left: KeyCodes.A,
        right: KeyCodes.D,
        fire: KeyCodes.SPACE,
        minor: KeyCodes.E,
        super: KeyCodes.Q,
    },
    // Player 2 (Arrows + Numpad)
    {
        up: KeyCodes.UP,
        down: KeyCodes.DOWN,
        left: KeyCodes.LEFT,
        right: KeyCodes.RIGHT,
        fire: KeyCodes.NUMPAD_ZERO,
        minor: KeyCodes.NUMPAD_ONE,
        super: KeyCodes.NUMPAD_TWO,
    },
    null, // Player 3 (Gamepad only)
    null, // Player 4 (Gamepad only)
];
