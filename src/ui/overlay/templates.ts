import { MINORS, SUPERS, WEAPONS, WEAPON_STATS } from "../../data/WeaponData";
import type { PlayerLoadout } from "../../types";

export interface SavedSetup {
    players: PlayerLoadout[];
}

const LABELS: Record<string, string> = {
    shockwave: "Shockwave",
    orbit: "Orbit blade",
    beam: "Prism beam",
    chain: "Chain shock",
    burst: "Short Burst",
    bubble: "Defense bubble",
    totem: "Damage totem",
    tether: "Void tether",
    nova: "Supernova",
    mine: "Pulse mine",
    teleport: "Blink",
    invisibility: "Ghost phase",
    barrier: "Repel barrier",
};

const PLAYER_COLOR_CSS = ["#55f6ff", "#ff58d4", "#c5ff57", "#ffc857"];

export function isLoadout(value: unknown): value is PlayerLoadout {
    if (typeof value !== "object" || value === null) return false;
    const loadout = value as Partial<PlayerLoadout>;
    return WEAPONS.includes(loadout.weapon as typeof WEAPONS[number])
        && SUPERS.includes(loadout.super as typeof SUPERS[number])
        && MINORS.includes(loadout.minor as typeof MINORS[number]);
}

export function weaponSummary(weapon: PlayerLoadout["weapon"]): string {
    const stats = WEAPON_STATS[weapon];
    const burst = stats.burstDamage
        ? ` · BURST ${stats.burstDamage} DMG / ${stats.burstKnockback} KB`
        : "";
    return `${stats.damage} DMG · ${stats.cooldown}s CD · ${stats.range} RANGE · ${stats.knockback} KB${burst}`;
}

export function loadoutMarkup(loadout: PlayerLoadout, index: number): string {
    return `
    <section class="nv4-loadout" style="--player-color:${PLAYER_COLOR_CSS[index]}">
      <h2>PLAYER ${index + 1}</h2>
      <label>WEAPON<select data-index="${index}" data-kind="weapon">${WEAPONS.map((value) => `<option value="${value}"${loadout.weapon === value ? " selected" : ""}>${LABELS[value]}</option>`).join("")}</select></label>
      <p class="nv4-weapon-stats" data-weapon-stats="${index}">${weaponSummary(loadout.weapon)}</p>
      <label>SUPER<select data-index="${index}" data-kind="super">${SUPERS.map((value) => `<option value="${value}"${loadout.super === value ? " selected" : ""}>${LABELS[value]}</option>`).join("")}</select></label>
      <label>MINOR<select data-index="${index}" data-kind="minor">${MINORS.map((value) => `<option value="${value}"${loadout.minor === value ? " selected" : ""}>${LABELS[value]}</option>`).join("")}</select></label>
    </section>`;
}

function playerCountSelect(count: number): string {
    return `<select data-players>${[1, 2, 3, 4].map((value) => `<option value="${value}"${count === value ? " selected" : ""}>${value} PLAYER${value === 1 ? "" : "S"}</option>`).join("")}</select>`;
}

export function setupOverlayHtml(setup: SavedSetup, message: string): string {
    return `
      <section class="nv4-card" aria-labelledby="nv4-title">
        <p class="nv4-kicker">LOCAL CO-OP · GEOMETRIC SWARM SURVIVAL</p>
        <h1 id="nv4-title">NEON <span>VECTOR</span></h1>
        <p class="nv4-intro">Choose your crew and build a loadout. Survive the swarm. Adapt every five waves.</p>
        <label class="nv4-player-count">TEAM SIZE
          ${playerCountSelect(setup.players.length)}
        </label>
        <div class="nv4-loadouts">${setup.players.map((loadout, index) => loadoutMarkup(loadout, index)).join("")}</div>
        <p class="nv4-message" role="status">${message}</p>
        <button type="button" class="nv4-primary" data-action="start">ENTER THE ARENA <span>→</span></button>
      </section>
    `;
}

export function pauseLoadoutOverlayHtml(setup: SavedSetup, message: string): string {
    return `
      <section class="nv4-card" aria-labelledby="nv4-pause-loadout-title">
      <p class="nv4-kicker">LOADOUT CHANGE · GAME PAUSED</p>
      <h2 id="nv4-pause-loadout-title">ADAPT YOUR CREW</h2>
      <label class="nv4-player-count">TEAM SIZE
        ${playerCountSelect(setup.players.length)}
      </label>
      <div class="nv4-loadouts">${setup.players.map((loadout, index) => loadoutMarkup(loadout, index)).join("")}</div>
      <p class="nv4-message" role="status">${message}</p>
      <button type="button" class="nv4-primary" data-action="return-to-pause">BACK TO PAUSE MENU</button>
      </section>
    `;
}

export function gameOverOverlayHtml(wave: number): string {
    return `
      <section class="nv4-card nv4-result" aria-labelledby="nv4-over-title">
        <p class="nv4-kicker">SIGNAL LOST</p>
        <h2 id="nv4-over-title">RUN ENDED</h2>
        <p class="nv4-intro">Your crew reached wave ${wave}.</p>
        <button type="button" class="nv4-primary" data-action="restart">RUN IT BACK <span>→</span></button>
        <button type="button" class="nv4-secondary" data-action="exit">RETURN TO ARCADE</button>
      </section>
    `;
}
