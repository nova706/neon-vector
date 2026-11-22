import Phaser from "phaser";
import type { PortSlot, RoomEncounterConfig, RoomLayout, RunRoomNode } from "../../interfaces/RoomInterfaces";
import { PORT_GRID_DELTA, PORT_OPPOSITES } from "./PortHelper";

export function generateMap(
    layouts: RoomLayout[],
    encounters: RoomEncounterConfig[],
    roomCount: number,
    playerCount: number
): RunRoomNode[] {
    const validLayouts = layouts.filter((l) => (l.minPlayers ?? 1) <= playerCount);
    const validEncounters = encounters.filter((e) => !e.isSplitCoop || playerCount >= 2);

    const nodes: RunRoomNode[] = [];
    const occupiedCoords = new Set<string>();
    let gridX = 0;
    let gridY = 0;

    // Start in a non-split hub room
    let currentLayout = validLayouts.find((l) => l.id === "hub_crossroads" && !l.isSplit) ?? validLayouts[0];

    for (let i = 0; i < roomCount; i++) {
        occupiedCoords.add(`${gridX},${gridY}`);
        const isLastRoom = i === roomCount - 1;

        // Match encounter type to whether the chosen layout is split
        const matchingEncounters = validEncounters.filter((e) => Boolean(e.isSplitCoop) === Boolean(currentLayout.isSplit));
        const encounter = isLastRoom
            ? matchingEncounters[matchingEncounters.length - 1]
            : Phaser.Utils.Array.GetRandom(matchingEncounters);

        nodes.push({ id: `room_${i}`, gridX, gridY, layout: currentLayout, encounter, connections: {} });
        if (isLastRoom) break;

        const candidates: Array<{
            exitPort: PortSlot;
            entryPort: PortSlot;
            pairedExit?: PortSlot;
            pairedEntry?: PortSlot;
            nextLayout: RoomLayout;
            nextX: number;
            nextY: number;
        }> = [];

        for (const exitPort of currentLayout.ports) {
            const delta = PORT_GRID_DELTA[exitPort];
            const nextX = gridX + delta.dx;
            const nextY = gridY + delta.dy;
            if (occupiedCoords.has(`${nextX},${nextY}`)) continue;

            const requiredEntry = PORT_OPPOSITES[exitPort];

            for (const candidateLayout of validLayouts) {
                if (!candidateLayout.ports.includes(requiredEntry)) continue;

                const involvesSplit = Boolean(currentLayout.isSplit || candidateLayout.isSplit);

                if (involvesSplit) {
                    // Split rooms require BOTH North or BOTH South ports to connect
                    const isNorth = exitPort === "N1" || exitPort === "N2";
                    const isSouth = exitPort === "S1" || exitPort === "S2";
                    if (!isNorth && !isSouth) continue;

                    const pairA: PortSlot = isNorth ? "N1" : "S1";
                    const pairB: PortSlot = isNorth ? "N2" : "S2";
                    const targetA = PORT_OPPOSITES[pairA];
                    const targetB = PORT_OPPOSITES[pairB];

                    const bothHavePorts =
                        currentLayout.ports.includes(pairA) &&
                        currentLayout.ports.includes(pairB) &&
                        candidateLayout.ports.includes(targetA) &&
                        candidateLayout.ports.includes(targetB);

                    if (bothHavePorts && exitPort === pairA) {
                        candidates.push({
                            exitPort: pairA,
                            entryPort: targetA,
                            pairedExit: pairB,
                            pairedEntry: targetB,
                            nextLayout: candidateLayout,
                            nextX,
                            nextY,
                        });
                    }
                } else {
                    candidates.push({
                        exitPort,
                        entryPort: requiredEntry,
                        nextLayout: candidateLayout,
                        nextX,
                        nextY,
                    });
                }
            }
        }

        if (candidates.length === 0) {
            throw new Error(`RunMap generator hit a dead end at room ${i} (${currentLayout.id}).`);
        }

        const chosen = Phaser.Utils.Array.GetRandom(candidates);
        nodes[i].connections[chosen.exitPort] = {
            targetRoomIndex: i + 1,
            targetPort: chosen.entryPort,
            pairedExitPort: chosen.pairedExit,
            pairedTargetPort: chosen.pairedEntry,
        };

        // Link the paired port to the same connection so both triggers recognize it
        if (chosen.pairedExit && chosen.pairedEntry) {
            nodes[i].connections[chosen.pairedExit] = {
                targetRoomIndex: i + 1,
                targetPort: chosen.pairedEntry,
                pairedExitPort: chosen.exitPort,
                pairedTargetPort: chosen.entryPort,
            };
        }

        currentLayout = chosen.nextLayout;
        gridX = chosen.nextX;
        gridY = chosen.nextY;
    }

    return nodes;
}
