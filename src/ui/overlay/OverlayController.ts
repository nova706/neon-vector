import { DEFAULT_LOADOUTS, MINORS, SUPERS, WEAPONS } from "../../data/WeaponData";
import type { NamespacedSettingsStore } from "../../systems/SettingsStore";
import type { PlayerLoadout } from "../../types";
import {
    type SavedSetup,
    gameOverOverlayHtml,
    isLoadout,
    loadoutMarkup,
    pauseLoadoutOverlayHtml,
    setupOverlayHtml,
    weaponSummary,
} from "./templates";

export interface OverlayActions {
    beginRun(players: PlayerLoadout[]): void;
    exit(): void;
    applyRunningLoadouts(players: PlayerLoadout[]): void;
    getRunningLoadouts(): PlayerLoadout[];
    openPauseMenu(): void;
}

export class OverlayController {
    editingRunLoadout = false;
    setup: SavedSetup = { players: [{ ...DEFAULT_LOADOUTS[0] }] };
    message = "";

    constructor(
        private readonly overlay: HTMLElement,
        private readonly settings: NamespacedSettingsStore,
        private readonly actions: OverlayActions,
    ) {}

    loadSavedSetup(): void {
        try {
            const saved = this.settings.load<unknown>("loadouts");
            if (typeof saved === "object" && saved !== null && Array.isArray((saved as Partial<SavedSetup>).players)) {
                const loadouts = (saved as SavedSetup).players;
                if (loadouts.length >= 1 && loadouts.length <= 4 && loadouts.every(isLoadout)) {
                    this.setup = { players: loadouts.map((loadout) => ({ ...loadout })) };
                }
            }
        } catch (error) {
            console.error("Could not load Neon Vector Phaser loadouts.", error);
            this.message = "Could not load saved loadouts.";
        }
    }

    persist(): void {
        try {
            this.settings.save("loadouts", this.setup);
            this.message = "";
        } catch (error) {
            console.error("Could not save Neon Vector Phaser loadouts.", error);
            this.message = "Loadouts could not be saved in this browser.";
        }
    }

    showSetup(): void {
        this.editingRunLoadout = false;
        this.overlay.innerHTML = setupOverlayHtml(this.setup, this.message);
    }

    showPausedLoadoutScreen(): void {
        this.editingRunLoadout = true;
        this.setup.players = this.actions.getRunningLoadouts();
        this.overlay.innerHTML = pauseLoadoutOverlayHtml(this.setup, this.message);
    }

    showGameOver(wave: number): void {
        this.overlay.innerHTML = gameOverOverlayHtml(wave);
    }

    clear(): void {
        this.editingRunLoadout = false;
        this.overlay.replaceChildren();
    }

    bind(signal: AbortSignal): void {
        this.overlay.addEventListener("change", (event) => this.onChange(event), { signal });
        this.overlay.addEventListener("click", (event) => this.onClick(event), { signal });
    }

    private refreshLoadoutCards(): void {
        const cards = this.overlay.querySelector<HTMLElement>(".nv4-loadouts");
        if (cards) cards.innerHTML = this.setup.players.map((loadout, index) => loadoutMarkup(loadout, index)).join("");
    }

    private onChange(event: Event): void {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) return;
        if (target.hasAttribute("data-players")) {
            const count = Number(target.value);
            if (!Number.isInteger(count) || count < 1 || count > 4) return;
            this.setup.players = Array.from({ length: count }, (_, index) =>
                this.setup.players[index] ?? { ...DEFAULT_LOADOUTS[index] });
            if (this.editingRunLoadout) {
                this.actions.applyRunningLoadouts(this.copyPlayers());
                this.refreshLoadoutCards();
            }
            this.persist();
            if (!this.editingRunLoadout) this.showSetup();
            return;
        }
        const index = Number(target.dataset.index);
        const kind = target.dataset.kind;
        const value = target.value;
        const loadout = this.setup.players[index];
        if (!loadout) return;
        if (kind === "weapon" && WEAPONS.includes(value as typeof WEAPONS[number])) loadout.weapon = value as PlayerLoadout["weapon"];
        else if (kind === "super" && SUPERS.includes(value as typeof SUPERS[number])) loadout.super = value as PlayerLoadout["super"];
        else if (kind === "minor" && MINORS.includes(value as typeof MINORS[number])) loadout.minor = value as PlayerLoadout["minor"];
        else return;
        if (kind === "weapon") {
            const summary = this.overlay.querySelector<HTMLElement>(`[data-weapon-stats="${index}"]`);
            if (summary) summary.textContent = weaponSummary(loadout.weapon);
        }
        if (this.editingRunLoadout) this.actions.applyRunningLoadouts(this.copyPlayers());
        this.persist();
    }

    private onClick(event: Event): void {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
        if (action === "start" || action === "restart") {
            this.editingRunLoadout = false;
            this.overlay.replaceChildren();
            this.actions.beginRun(this.copyPlayers());
            this.persist();
        } else if (action === "exit") {
            this.actions.exit();
        } else if (action === "return-to-pause") {
            this.clear();
            this.actions.openPauseMenu();
        }
    }

    private copyPlayers(): PlayerLoadout[] {
        return this.setup.players.map((loadout) => ({ ...loadout }));
    }
}
