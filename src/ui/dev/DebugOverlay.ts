import { IS_TEST_MODE, devState } from "../../data/DevData";
import { ROOM_ENCOUNTERS } from "../../data/RoomEncounterData";
import type { NeonVectorScene } from "../../scene/NeonVectorScene";
import { ENEMY_TYPES, objectiveTypes, type EnemyType } from "../../types";

export function mountDevOverlay(scene: NeonVectorScene): () => void {
    if (!IS_TEST_MODE) return () => {};

    const panel = document.createElement("div");
    Object.assign(panel.style, {
        position: "fixed",
        top: "12px",
        right: "12px",
        width: "250px",
        padding: "10px",
        background: "rgba(10, 12, 26, 0.92)",
        border: "1px solid #55f6ff",
        color: "#eaf2ff",
        fontFamily: "monospace",
        fontSize: "12px",
        zIndex: "9999",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    });

    panel.innerHTML = `
        <div style="font-weight:bold; color:#55f6ff; display:flex; justify-content:space-between;">
            <span>DEV SANDBOX</span>
            <button id="dev-collapse" style="cursor:pointer;">_</button>
        </div>
        <div id="dev-body" style="display:flex; flex-direction:column; gap:6px;">
            <label><input type="checkbox" id="dev-god"> God Mode (Min 1 HP)</label>
            <label><input type="checkbox" id="dev-pause-spawn"> Pause Spawning</label>
            <label><input type="checkbox" id="dev-no-ai"> Disable Enemy Tracking</label>

            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span>DMG Mult:</span>
                <select id="dev-dmg">
                    <option value="1">1x</option>
                    <option value="5">5x</option>
                    <option value="25">25x</option>
                    <option value="100">100x (One-Shot)</option>
                </select>
            </div>

            <hr style="border-color:#263052; width:100%;">
            <div style="color:#55f6ff;">Players:</div>
            <select id="dev-player-index">
                <option value="0">Player 1</option>
                <option value="1">Player 2</option>
                <option value="2">Player 3</option>
                <option value="3">Player 4</option>
            </select>
            <button id="dev-kill-player">Kill Player</button>
            <button id="dev-revive-player">Revive Player</button>

            <hr style="border-color:#263052; width:100%;">
            <div style="color:#55f6ff;">Spawn Enemy:</div>
            <div id="dev-enemy-btns" style="display:grid; grid-template-columns:1fr 1fr; gap:4px;"></div>

            <hr style="border-color:#263052; width:100%;">
            <div style="color:#55f6ff;">Room / Wave Controls:</div>
            <button id="dev-clear-enemies">Kill All Enemies</button>
            <button id="dev-unlock-airlocks">Force Clear Room</button>
            <select id="dev-encounter-select"></select>
            <button id="dev-load-encounter">Start Selected Encounter</button>

            <hr style="border-color:#263052; width:100%;">
            <div style="color:#55f6ff;">Objectives:</div>
            <button id="dev-clear-objective">Complete Objective</button>
            <select id="dev-objective-select"></select>
            <button id="dev-load-objective">Start Selected Objective</button>
        </div>
    `;

    document.body.appendChild(panel);

    // Wire checkboxes & stat dropdown
    const bindCheck = (id: string, key: "godMode" | "pauseSpawning" | "disableEnemyAI") => {
        const el = panel.querySelector<HTMLInputElement>(id)!;
        el.checked = devState[key];
        el.onchange = () => (devState[key] = el.checked);
    };
    bindCheck("#dev-god", "godMode");
    bindCheck("#dev-pause-spawn", "pauseSpawning");
    bindCheck("#dev-no-ai", "disableEnemyAI");

    const dmgSelect = panel.querySelector<HTMLSelectElement>("#dev-dmg")!;
    dmgSelect.onchange = () => (devState.damageMultiplier = Number(dmgSelect.value));
    
    let playerIndex: number = 0;
    const playerSelect = panel.querySelector<HTMLSelectElement>("#dev-player-index")!;
    playerSelect.onchange = () => (playerIndex = Number(playerSelect.value));

    panel.querySelector<HTMLButtonElement>("#dev-kill-player")!.onclick = () => {
        const player = scene.getPlayers()[playerIndex];
        player?.takeDamage(100000);
    };

    panel.querySelector<HTMLButtonElement>("#dev-revive-player")!.onclick = () => {
        const player = scene.getPlayers()[playerIndex];
        player?.revive(1);
    };

    // Enemy spawn buttons
    const enemyGrid = panel.querySelector("#dev-enemy-btns")!;
    ENEMY_TYPES.forEach((type: EnemyType) => {
        const btn = document.createElement("button");
        btn.textContent = `+ ${type}`;
        btn.style.cursor = "pointer";
        btn.onclick = () => scene.spawnEnemy(type);
        enemyGrid.appendChild(btn);
    });

    // Encounter selector & room actions
    const encSelect = panel.querySelector<HTMLSelectElement>("#dev-encounter-select")!;
    ROOM_ENCOUNTERS.forEach((enc) => {
        const opt = document.createElement("option");
        opt.value = enc.id;
        opt.textContent = enc.label;
        encSelect.appendChild(opt);
    });

    // Objective selector
    const objSelect = panel.querySelector<HTMLSelectElement>("#dev-objective-select")!;
    objectiveTypes.forEach((obj) => {
        const opt = document.createElement("option");
        opt.value = obj;
        opt.textContent = obj;
        objSelect.appendChild(opt);
    });

    panel.querySelector<HTMLButtonElement>("#dev-clear-enemies")!.onclick = () => {
        scene.getEnemies().forEach((e) => e.destroy());
    };

    panel.querySelector<HTMLButtonElement>("#dev-unlock-airlocks")!.onclick = () => {
        scene.getEnemies().forEach((e) => e.destroy());
        scene.onRoomCleared();
    };

    panel.querySelector<HTMLButtonElement>("#dev-load-encounter")!.onclick = () => {
        const chosen = ROOM_ENCOUNTERS.find((e) => e.id === encSelect.value);
        if (chosen) scene.debugStartEncounter(chosen);
    };

    panel.querySelector<HTMLButtonElement>("#dev-load-objective")!.onclick = () => {
        const chosen = objectiveTypes.find((e) => e === objSelect.value);
        if (chosen) scene.debugStartObjective(chosen);
    };

    panel.querySelector<HTMLButtonElement>("#dev-clear-objective")!.onclick = () => {
        scene.objectiveManager.completeObjective();
    };

    // Collapse toggle
    const body = panel.querySelector<HTMLElement>("#dev-body")!;
    panel.querySelector<HTMLButtonElement>("#dev-collapse")!.onclick = () => {
        body.style.display = body.style.display === "none" ? "flex" : "none";
    };

    return () => panel.remove();
}
