import Phaser from "phaser";
import { PLAYER_COLORS } from "../data/WeaponData";
import { AreaEntity } from "../entities/Areas/AreaEntity";
import { EnemyEntity } from "../entities/Enemies/EnemyEntity";
import { PlayerEntity } from "../entities/PlayerEntity";
import { type EnemyType, type ObjectiveType, type PlayerLoadout } from "../types";
import { ObjectiveManager } from "../systems/ObjectiveManager";
import { Hud } from "../entities/UI/Hud";
import { InputSystem } from "../systems/InputManager";
import type { IAttacker } from "../interfaces/IAttacker";
import { EnemyFactory } from "../entities/Enemies/EnemyFactory";
import { EffectsManager } from "../entities/Effects/EffectsManager";
import { RoomController } from "../systems/rooms/RoomController";
import { AirlockTrigger } from "../entities/AirlockTrigger";
import type { PortSlot, Rect, RoomEncounterConfig, RoomLayout, RunRoomNode } from "../interfaces/RoomInterfaces";
import { getLocalPortRect } from "../systems/rooms/PortHelper";
import { generateMap } from "../systems/rooms/MapGenerator";
import type { AreaType } from "../data/AreaData";
import { AreaFactory } from "../entities/Areas/AreaFactory";
import { createRoomLayouts } from "../data/RoomLayoutData";
import { ROOM_ENCOUNTERS } from "../data/RoomEncounterData";
import { buildRoomGeometry, getWalkableCenter, getWalkablePoint, type ChamberSide } from "../systems/rooms/RoomGeometry";
import { IS_TEST_MODE } from "../data/DevData";
import { mountDevOverlay } from "../ui/dev/DebugOverlay";
import { getRenderScale, ROOM_HEIGHT, ROOM_WIDTH } from "../boot/phaserConfig";

export class NeonVectorScene extends Phaser.Scene {
    private playerGroup!: Phaser.GameObjects.Group;
    private enemyGroup!: Phaser.GameObjects.Group;
    private areaGroup!: Phaser.GameObjects.Group;
    private wallGroup!: Phaser.Physics.Arcade.StaticGroup;

    private background!: Phaser.GameObjects.Graphics;
    private hud!: Hud;
    private started = false;
    private gameOver = false;

    private readonly pendingExplosions: Array<{ x: number; y: number; damage: number; radius: number; color: number }> = [];
    private processingExplosions = false;

    public effectsManager!: EffectsManager;
    public objectiveManager!: ObjectiveManager;
    public inputSystem: InputSystem;

    private runMap: RunRoomNode[] = [];
    private isTransitioning = false;
    private currentRoomIndex = 0;
    private activeRoom!: RoomController;
    private airlocks: AirlockTrigger[] = [];
    private globalRoomNumber = 1;
    private globalWaveNumber = 1;
    private nextSplitSpawnSide: 'left' | 'right' = 'left';

    public getPlayers(): PlayerEntity[] { return this.playerGroup.getChildren() as PlayerEntity[]; }
    public getEnemies(): EnemyEntity[] { return this.enemyGroup.getChildren() as EnemyEntity[]; }
    public getAreas(): AreaEntity[] { return this.areaGroup.getChildren() as AreaEntity[]; }

    constructor() {
        super({ key: "NeonVectorPhaserScene" });
        this.inputSystem = new InputSystem(this);
    }

    get isRunActive(): boolean {
        return this.started && !this.gameOver;
    }

    public get activeRoomOrigin(): { x: number; y: number } {
        return this.activeRoom ? this.activeRoom.worldOrigin : { x: 0, y: 0 };
    }

    public get activeLayout(): RoomLayout {
        return this.activeRoom.node.layout;
    }

    public get roomNumber(): number {
        return this.globalRoomNumber;
    }

    public get waveNumber(): number {
        return this.globalWaveNumber;
    }

    create(): void {
        this.inputSystem.start();

        const renderScale = getRenderScale();
        this.cameras.main.setZoom(renderScale);
        this.cameras.main.centerOn(ROOM_WIDTH * 0.5, ROOM_HEIGHT * 0.5);

        this.background = this.add.graphics().setDepth(-10);

        this.hud = new Hud(this);
        this.add.existing(this.hud);

        this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
        this.physics.world.on("worldstep", this.fixedUpdate, this);
        this.inputSystem.start();
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

        this.playerGroup = this.add.group();
        this.enemyGroup = this.add.group();
        this.areaGroup = this.add.group();

        this.wallGroup = this.physics.add.staticGroup();
        this.physics.add.collider(this.playerGroup, this.wallGroup);
        this.physics.add.collider(this.enemyGroup, this.wallGroup);

        this.effectsManager = new EffectsManager(this);
        this.objectiveManager = new ObjectiveManager(this);

        this.events.on("player-died", this.onPlayerDied, this);

        if (IS_TEST_MODE) {
            const cleanupDev = mountDevOverlay(this);
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupDev);
        }
    }

    startRun(loadouts: PlayerLoadout[]): void {
        this.clearRun();
        if (loadouts.length < 1 || loadouts.length > 4) {
            throw new RangeError("Neon Vector requires between one and four player loadouts.");
        }

        this.started = true;
        this.gameOver = false;
        this.isTransitioning = false;
        this.globalRoomNumber = 1;
        this.currentRoomIndex = 0;

        // 1. Build or load the linear RunMap
        const layouts = createRoomLayouts(ROOM_WIDTH, ROOM_HEIGHT);
        this.runMap = generateMap(layouts, ROOM_ENCOUNTERS, 5, loadouts.length);
        const startNode = this.runMap[0];
        this.activeRoom = new RoomController(this, this.objectiveManager, startNode);

        const { x: roomX, y: roomY } = this.activeRoom.worldOrigin;

        // 2. Align physics bounds, camera, and floor graphics to Room 0
        this.physics.world.setBounds(roomX, roomY, ROOM_WIDTH, ROOM_HEIGHT);
        this.cameras.main.centerOn(roomX + ROOM_WIDTH * 0.5, roomY + ROOM_HEIGHT * 0.5);
        this.drawRoomBackground(roomX, roomY, ROOM_WIDTH, ROOM_HEIGHT, startNode.layout);

        // 3. Spawn players around Room 0's center
        loadouts.forEach((loadout, index) => this.spawnPlayer(loadout, index, loadouts.length));

        // 4. Create locked airlocks and begin Room 0's encounter
        this.spawnRoomAirlocks(startNode, roomX, roomY);
        this.activeRoom.startEncounter();
    }

    setPlayerLoadouts(loadouts: PlayerLoadout[]): void {
        if (!this.isRunActive) return;
        if (loadouts.length < 1 || loadouts.length > 4) {
            throw new RangeError("Neon Vector requires between one and four player loadouts.");
        }

        const currentPlayers = this.getPlayers();
        loadouts.forEach((loadout, index) => {
            const player = currentPlayers[index];
            if (player) {
                player.applyLoadout(loadout);
            } else {
                this.spawnPlayer(loadout, index, loadouts.length);
            }
        });

        while (this.getPlayers().length > loadouts.length) {
            const extraPlayer = this.getPlayers().pop();
            extraPlayer?.destroy();
        }
    }

    update(_time: number, deltaMilliseconds: number): void {
        if (!this.started || this.gameOver) return;
        const delta = Math.min(deltaMilliseconds / 1000, 0.05);

        // Always update HUD and visual effects even during camera pans
        this.effectsManager.update(delta);
        this.hud.update();

        if (this.isTransitioning) return;

        const livingPlayers = this.getPlayers().filter((p) => p.alive);
        const downPlayers = this.getPlayers().filter((p) => !p.alive);

        livingPlayers.forEach((player) => {
            const command = this.inputSystem.readCommand(player.playerIndex, player);
            player.setCommand(command);
            player.update(delta);
        });

        downPlayers.forEach((player) => player.updateDowned(delta, livingPlayers));

        this.getEnemies().forEach((enemy) => enemy.update(delta));
        this.getAreas().forEach((area) => area.update(delta));

        this.objectiveManager.update(delta);
        this.activeRoom.update(delta);

        this.updateAirlocks();
    }

    private fixedUpdate(): void {
        if (!this.started || this.gameOver || this.isTransitioning) return;
        const activePlayers = this.getPlayers();
        activePlayers.forEach((player) => player.fixedUpdate());
        this.getEnemies().forEach((enemy) => enemy.fixedUpdate(activePlayers));
    }

    private updateAirlocks(): void {
        const livingPlayers = this.getPlayers().filter((player) => player.alive);
        if (!this.activeRoom.isCleared || livingPlayers.length === 0) return;

        const checkedPairs = new Set<PortSlot>();

        for (const airlock of this.airlocks) {
            if (airlock.isLocked || checkedPairs.has(airlock.slot)) continue;

            const conn = this.activeRoom.node.connections[airlock.slot];
            if (!conn) continue;

            // Case A: Paired Dual-Airlock (e.g., N1 + N2 or S1 + S2)
            if (conn.pairedExitPort) {
                const partner = this.airlocks.find((a) => a.slot === conn.pairedExitPort);
                checkedPairs.add(airlock.slot);
                if (partner) checkedPairs.add(partner.slot);

                const countA = livingPlayers.filter((p) => airlock.bounds.contains(p.x, p.y)).length;
                const countB = partner ? livingPlayers.filter((p) => partner.bounds.contains(p.x, p.y)).length : 0;
                const totalInside = countA + countB;

                // Update visual labels on both airlocks
                const bothOccupied = livingPlayers.length >= 2 ? (countA >= 1 && countB >= 1) : totalInside === 1;
                const allPlayersInDoors = totalInside === livingPlayers.length;

                airlock.setSplitStatus(countA, livingPlayers.length, bothOccupied && allPlayersInDoors);
                partner?.setSplitStatus(countB, livingPlayers.length, bothOccupied && allPlayersInDoors);

                if (bothOccupied && allPlayersInDoors) {
                    this.transitionThroughPort(airlock.slot);
                    return;
                }
            }
            // Case B: Standard Single Airlock
            else {
                const insideCount = livingPlayers.filter((p) => airlock.bounds.contains(p.x, p.y)).length;
                airlock.setSingleStatus(insideCount, livingPlayers.length);

                if (insideCount === livingPlayers.length) {
                    this.transitionThroughPort(airlock.slot);
                    return;
                }
            }
        }
    }

    public debugStartEncounter(encounter: RoomEncounterConfig): void {
        this.getEnemies().forEach((e) => e.destroy());
        this.objectiveManager.completeObjective();
        this.activeRoom.node.encounter = encounter;
        this.activeRoom.startEncounter();
    }

    public debugStartObjective(objective: ObjectiveType): void {
        this.objectiveManager.completeObjective();
        this.objectiveManager.beginObjective(objective);
    }

    private spawnPlayer(loadout: PlayerLoadout, index: number, playerCount: number): PlayerEntity {
        const { x: roomX, y: roomY } = this.activeRoomOrigin;
        const layout = this.activeRoom.node.layout;
        const center = getWalkableCenter(layout.walkable, { x: roomX, y: roomY }, ROOM_WIDTH);

        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / playerCount;
        const radius = playerCount > 1 ? 45 : 0;
        const copy = { ...loadout };

        const player = new PlayerEntity(
            this,
            { index, color: PLAYER_COLORS[index], loadout: copy },
            center.x + Math.cos(angle) * radius,
            center.y + Math.sin(angle) * radius,
            copy
        );
        this.playerGroup.add(player);
        return player;
    }

    public spawnEnemy(type: EnemyType): EnemyEntity {
        const origin = this.activeRoomOrigin;
        const layout = this.activeRoom.node.layout;
        const livingPlayers = this.getPlayers().filter((p) => p.alive);

        // Alternate left/right chambers if the room is split
        let side: ChamberSide = "all";
        if (layout.isSplit) {
            side = this.nextSplitSpawnSide;
            this.nextSplitSpawnSide = this.nextSplitSpawnSide === "left" ? "right" : "left";
        }

        // Try up to 8 candidate points to find one at least 180px away from players
        let bestPoint = getWalkablePoint(layout.walkable, origin, ROOM_WIDTH, 44, side);
        for (let attempt = 0; attempt < 8; attempt++) {
            const candidate = getWalkablePoint(layout.walkable, origin, ROOM_WIDTH, 44, side);
            const tooClose = livingPlayers.some(
                (p) => Phaser.Math.Distance.Between(p.x, p.y, candidate.x, candidate.y) < 180
            );
            if (!tooClose) {
                bestPoint = candidate;
                break;
            }
        }

        return this.spawnEnemyAt(type, bestPoint.x, bestPoint.y);
    }

    public spawnEnemyAt(type: EnemyType, x: number, y: number, offsetRoom: boolean = false): EnemyEntity {
        const { x: roomX, y: roomY } = this.activeRoomOrigin;
        const { x: posX, y: posY } = offsetRoom ? { x: roomX + x, y: roomY + y } : { x, y };
        // Scales enemy HP/damage using globalWaveNumber across rooms
        const enemy = EnemyFactory.create(this, posX, posY, type, this.globalWaveNumber);
        this.enemyGroup.add(enemy);
        return enemy;
    }

    public spawnAreaAt(type: AreaType, owner: number, x: number, y: number, offsetRoom: boolean = false): AreaEntity {
        const { x: roomX, y: roomY } = this.activeRoomOrigin;
        const { x: posX, y: posY } = offsetRoom ? { x: roomX + x, y: roomY + y } : { x, y };
        const area = AreaFactory.create(this, type, owner, posX, posY);
        area.setDepth(-1);
        this.areaGroup.add(area);
        return area;
    }

    public explodeAt(x: number, y: number, radius: number, damage: number, color: number, offsetRoom: boolean = false): void {
        const { x: roomX, y: roomY } = this.activeRoomOrigin;
        const { x: posX, y: posY } = offsetRoom ? { x: roomX + x, y: roomY + y } : { x, y };

        this.pendingExplosions.push({
            x: posX,
            y: posY,
            damage,
            radius,
            color
        });

        if (this.processingExplosions) return;

        this.processingExplosions = true;
        try {
            while (this.pendingExplosions.length > 0) {
                const explosion = this.pendingExplosions.shift()!;
                this.effectsManager.addExpandingRing(explosion.x, explosion.y, explosion.radius, color, 0.38);
                this.effectsManager.emitParticles(explosion.x, explosion.y, color, 24);

                for (const player of this.getPlayers()) {
                    if (player.alive && Phaser.Math.Distance.Between(explosion.x, explosion.y, player.x, player.y) <= explosion.radius) {
                        player.takeDamage(explosion.damage);
                    }
                }

                for (const target of this.getEnemies()) {
                    if (Phaser.Math.Distance.Between(explosion.x, explosion.y, target.x, target.y) <= explosion.radius) {
                        target.takeDamage(explosion.damage, undefined, 180);
                    }
                }
            }
        } finally {
            this.processingExplosions = false;
        }
    }

    public damageEnemiesNear(x: number, y: number, radius: number, damage: number, knockback: number, source?: IAttacker, offsetRoom: boolean = false): void {
        const { x: roomX, y: roomY } = this.activeRoomOrigin;
        const { x: posX, y: posY } = offsetRoom ? { x: roomX + x, y: roomY + y } : { x, y };

        this.getEnemies().forEach((enemy) => {
            const distance = Phaser.Math.Distance.Between(posX, posY, enemy.x, enemy.y);
            if (distance > radius) return;
            const amount = damage * (1 - distance / radius * 0.45);
            enemy.takeDamage(amount, source, knockback);
        });
    }

    private onPlayerDied(player: PlayerEntity): void {
        if (this.getPlayers().every((candidate) => !candidate.alive)) {
            setTimeout(() => {
                this.gameOver = true;
                this.events.emit("game-over", { wave: this.globalWaveNumber, room: this.globalRoomNumber });
            }, 2000);
        }
    }

    private spawnRoomAirlocks(node: RunRoomNode, roomX: number, roomY: number): void {
        this.clearAirlocks();

        for (const slot of node.layout.ports) {
            // Only spawn functional triggers on ports that actually connect forward
            if (!node.connections[slot]) continue;

            const localRect = getLocalPortRect(slot, ROOM_WIDTH, ROOM_HEIGHT);
            const worldRect: Rect = {
                x: roomX + localRect.x,
                y: roomY + localRect.y,
                width: localRect.width,
                height: localRect.height,
            };

            const airlock = new AirlockTrigger(this, slot, worldRect);

            this.add.existing(airlock);
            this.airlocks.push(airlock);
        }
    }

    public onRoomCleared(): void {
        // Check if this was the final room in the RunMap
        if (this.currentRoomIndex >= this.runMap.length - 1) {
            this.gameOver = true;
            this.events.emit("room-cleared", { room: this.globalRoomNumber, wave: this.globalWaveNumber });
            return;
        }

        // Unlock exit airlocks so living players can gather inside
        for (const airlock of this.airlocks) {
            airlock.setLocked(false);
        }
    }

    public onWaveCleared(): void {
        this.globalWaveNumber++;
    }

    private clearAirlocks(): void {
        this.airlocks.forEach((airlock) => airlock.destroy());
        this.airlocks = [];
    }

    public transitionThroughPort(exitSlot: PortSlot): void {
        if (this.isTransitioning) return;

        const currentNode = this.activeRoom.node;
        const connection = currentNode.connections[exitSlot];
        if (!connection) return;

        this.isTransitioning = true;
        this.globalRoomNumber++;

        // 1. Snapshot which players stood in Port A vs. Port B before clearing airlocks
        const airlockA = this.airlocks.find((a) => a.slot === exitSlot);
        const airlockB = connection.pairedExitPort
            ? this.airlocks.find((a) => a.slot === connection.pairedExitPort)
            : undefined;

        const groupA: PlayerEntity[] = [];
        const groupB: PlayerEntity[] = [];
        const downedPlayers: PlayerEntity[] = [];

        for (const player of this.getPlayers()) {
            if (!player.alive) {
                downedPlayers.push(player);
            } else if (airlockB && airlockB.bounds.contains(player.x, player.y)) {
                groupB.push(player);
            } else {
                groupA.push(player);
            }
        }

        // 2. Clean up old room areas & airlocks
        this.areaGroup.clear(true, true);
        this.clearAirlocks();

        // 3. Advance to next room node
        this.currentRoomIndex = connection.targetRoomIndex;
        const nextNode = this.runMap[this.currentRoomIndex];
        this.activeRoom = new RoomController(this, this.objectiveManager, nextNode);

        const { x: roomX, y: roomY } = this.activeRoom.worldOrigin;

        // 4. Render new room background (including split center wall if isSplit) & move world bounds
        this.drawRoomBackground(roomX, roomY, ROOM_WIDTH, ROOM_HEIGHT, nextNode.layout);
        this.physics.world.setBounds(roomX, roomY, ROOM_WIDTH, ROOM_HEIGHT);

        // 5. Place Group A into targetPort (e.g., S1)
        const entryRectA = getLocalPortRect(connection.targetPort, ROOM_WIDTH, ROOM_HEIGHT);
        this.placePlayersInAirlock(groupA, roomX, roomY, entryRectA);

        // 6. Place Group B into pairedTargetPort (e.g., S2), reviving downed players if needed for split rooms
        if (connection.pairedTargetPort) {
            const entryRectB = getLocalPortRect(connection.pairedTargetPort, ROOM_WIDTH, ROOM_HEIGHT);

            // Ensure neither chamber is empty if entering a split co-op room
            if (nextNode.layout.isSplit && groupB.length === 0 && downedPlayers.length > 0) {
                const revived = downedPlayers.shift()!;
                revived.revive(0.5); // Restores alive = true at 50% maxHealth
                groupB.push(revived);
            }

            this.placePlayersInAirlock(groupB, roomX, roomY, entryRectB);
        }

        // Revive any remaining downed players at the primary entrance
        downedPlayers.forEach((p) => p.revive(0.5));
        this.placePlayersInAirlock(downedPlayers, roomX, roomY, entryRectA);

        // 7. Pan camera to the new room, then unlock encounter
        this.cameras.main.pan(roomX + ROOM_WIDTH * 0.5, roomY + ROOM_HEIGHT * 0.5, 650, "Cubic.easeInOut", true, (_cam, progress) => {
            if (progress === 1) {
                this.spawnRoomAirlocks(nextNode, roomX, roomY);
                this.isTransitioning = false;
                this.activeRoom.startEncounter();
            }
        });
    }

    private placePlayersInAirlock(players: PlayerEntity[], roomX: number, roomY: number, localRect: Rect): void {
        players.forEach((player, idx) => {
            player.body?.setVelocity(0, 0);
            const spreadX = (idx - (players.length - 1) * 0.5) * 24;
            player.setPosition(
                roomX + localRect.x + localRect.width * 0.5 + spreadX,
                roomY + localRect.y + localRect.height * 0.5
            );
        });
    }

    private drawRoomBackground(roomX: number, roomY: number, width: number, height: number, layout: RoomLayout): void {
        const { perimeterEdges, wallRects } = buildRoomGeometry(layout.walkable, width, height);

        // 1. Continuous floor gradient + unified grid
        this.background.fillGradientStyle(0x13162d, 0x13162d, 0x070916, 0x070916, 1);
        this.background.fillRect(roomX, roomY, width, height);

        this.background.lineStyle(1, 0x52678f, 0.12);
        for (let x = 20; x < width; x += 42) this.background.lineBetween(roomX + x, roomY, roomX + x, roomY + height);
        for (let y = 20; y < height; y += 42) this.background.lineBetween(roomX, roomY + y, roomX + width, roomY + y);

        // 2. Mask out void areas AND build static wall colliders in a single pass
        this.wallGroup.clear(true, true);
        this.background.fillStyle(0x070916, 1);

        for (const { x, y, width: w, height: h } of wallRects) {
            if (w <= 0 || h <= 0) continue;
            this.background.fillRect(roomX + x, roomY + y, w, h);

            const zone = this.add.zone(roomX + x + w * 0.5, roomY + y + h * 0.5, w, h);
            this.physics.add.existing(zone, true);
            this.wallGroup.add(zone);
        }

        // 3. Stroke neon perimeter walls
        this.background.lineStyle(2.5, 0x55f6ff, 0.75);
        for (const { x1, y1, x2, y2 } of perimeterEdges) {
            this.background.lineBetween(roomX + x1, roomY + y1, roomX + x2, roomY + y2);
        }
    }

    private clearRun(): void {
        this.playerGroup.clear(true, true);
        this.enemyGroup.clear(true, true);
        this.areaGroup.clear(true, true);
        this.clearAirlocks();
        this.background.clear();
        this.started = false;
        this.gameOver = false;
        this.isTransitioning = false;
    }

    private onShutdown(): void {
        this.physics.world.off("worldstep", this.fixedUpdate, this);
        this.effectsManager.destroy();
        this.objectiveManager.destroy();
        this.clearRun();
    }
}
