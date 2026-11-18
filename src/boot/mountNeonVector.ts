import Phaser from "phaser";
import { type GameMenuContext, type PauseMenuControls } from "../systems/GameMenu";
import type { NamespacedSettingsStore } from "../systems/SettingsStore";
import { NeonVectorScene } from "../scene/NeonVectorScene";
import { OverlayController } from "../ui/overlay/OverlayController";
import { createPhaserConfig } from "./phaserConfig";

export async function mountNeonVectorPhaser(
    host: HTMLElement,
    onExit: () => void,
    settings: NamespacedSettingsStore,
    gameMenu?: GameMenuContext,
): Promise<void> {
    host.innerHTML = `
    <main class="nv4">
      <div class="nv4-stage"></div>
      <section class="nv4-overlay" aria-live="polite"></section>
    </main>
  `;
    const root = host.querySelector<HTMLElement>(".nv4");
    const stage = host.querySelector<HTMLElement>(".nv4-stage");
    const overlay = host.querySelector<HTMLElement>(".nv4-overlay");
    if (!root || !stage || !overlay) throw new Error("Neon Vector Phaser is missing required UI elements.");

    const scene = new NeonVectorScene();
    let unregisterPauseAction: (() => void) | undefined;
    let pauseMenuControls: PauseMenuControls | undefined;
    const phaser = new Phaser.Game(createPhaserConfig(stage, scene));
    const lifecycle = new AbortController();
    let closed = false;

    const overlays = new OverlayController(overlay, settings, {
        beginRun: (players) => {
            scene.startRun(players);
        },
        exit: () => exit(),
        applyRunningLoadouts: (players) => scene.setPlayerLoadouts(players),
        getRunningLoadouts: () => scene.getPlayers().map((player) => ({ ...player.loadout })),
        openPauseMenu: () => pauseMenuControls?.openPauseMenu(),
    });

    function exit(): void {
        if (closed) return;
        closed = true;
        lifecycle.abort();
        unregisterPauseAction?.();
        phaser.destroy(true);
        onExit();
    }

    overlays.bind(lifecycle.signal);
    overlays.loadSavedSetup();

    window.addEventListener("arcade:pause", (event) => {
        if (!(event instanceof CustomEvent) || typeof event.detail !== "boolean" || closed) return;
        if (event.detail) phaser.scene.pause("NeonVectorPhaserScene");
        else phaser.scene.resume("NeonVectorPhaserScene");
    }, { signal: lifecycle.signal });
    window.addEventListener("arcade:pause-menu", (event) => {
        if (!(event instanceof CustomEvent) || event.detail !== true || !overlays.editingRunLoadout) return;
        overlays.clear();
    }, { signal: lifecycle.signal });
    unregisterPauseAction = gameMenu?.registerPauseMenuAction("CHANGE LOADOUT", (controls) => {
        if (!scene.isRunActive) return;
        pauseMenuControls = controls;
        overlays.showPausedLoadoutScreen();
        controls.closePauseMenu();
    });

    overlays.showSetup();
    await new Promise<void>((resolve) => {
        phaser.events.once(Phaser.Core.Events.READY, () => {
            scene.events.on("game-over", ({ wave }: { wave: number }) => overlays.showGameOver(wave));
            resolve();
        });
    });
    root.dataset.engine = "Phaser 4";
}
