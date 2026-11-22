import type { NeonVectorScene } from "../scene/NeonVectorScene";
import type { StatComponent } from "../systems/stats/StatComponent";

export interface IAttacker {
    id: string;
    alive: boolean;
    body: Phaser.Physics.Arcade.Body;
    x: number;
    y: number;
    radius: number;
    attackAngle: number;
    color: number;          // Visual effect tracking
    scene: NeonVectorScene; // Central game state access
    playerIndex?: number;      // Optional player index for team-based logic
    setPosition: (x: number, y: number) => void
    stats: StatComponent
}
