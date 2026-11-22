export const REVIVE_CONFIG = {
    radius: 56,           // Distance in pixels a teammate must stand within
    duration: 2.5,        // Seconds to complete a revive (faster with multiple teammates)
    decayRate: 0.4,       // How fast progress drains if teammates step out of range
    reviveHealthRatio: 0.5, // Restores 50% max HP on revive
} as const;
