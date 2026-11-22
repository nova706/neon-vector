export const IS_TEST_MODE = import.meta.env.VITE_TEST_MODE === "true";

export interface DevDebugState {
    godMode: boolean;             // Take damage & hit-stun, but HP never drops below 1
    pauseSpawning: boolean;       // Stops RoomController wave queues and boss add timers
    disableEnemyAI: boolean;      // Enemies spawn and take damage, but don't move or attack
    damageMultiplier: number;     // Player outgoing damage multiplier (e.g., 1x, 5x, 50x)
    speedMultiplier: number;      // Player move speed multiplier
}

export const devState: DevDebugState = {
    godMode: false,
    pauseSpawning: false,
    disableEnemyAI: false,
    damageMultiplier: 1,
    speedMultiplier: 1,
};
