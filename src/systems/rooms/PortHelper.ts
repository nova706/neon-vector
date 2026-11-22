import type { PortSlot, Rect } from "../../interfaces/RoomInterfaces";

export const PORT_OPPOSITES: Record<PortSlot, PortSlot> = {
    N1: "S1",
    N2: "S2",
    S1: "N1",
    S2: "N2",
    W: "E",
    E: "W",
};

export const PORT_GRID_DELTA: Record<PortSlot, { dx: number; dy: number }> = {
    N1: { dx: 0, dy: -1 },
    N2: { dx: 0, dy: -1 },
    S1: { dx: 0, dy: 1 },
    S2: { dx: 0, dy: 1 },
    W:  { dx: -1, dy: 0 },
    E:  { dx: 1, dy: 0 },
};

export function getLocalPortRect(slot: PortSlot, roomW: number, roomH: number): Rect {
    const doorW = 140;
    const doorD = 48; // Airlock depth into the room
    const pad = 10;   // Matches your outer wall border

    switch (slot) {
        case "N1": return { x: roomW * 0.25 - doorW * 0.5, y: pad, width: doorW, height: doorD };
        case "N2": return { x: roomW * 0.75 - doorW * 0.5, y: pad, width: doorW, height: doorD };
        case "S1": return { x: roomW * 0.25 - doorW * 0.5, y: roomH - pad - doorD, width: doorW, height: doorD };
        case "S2": return { x: roomW * 0.75 - doorW * 0.5, y: roomH - pad - doorD, width: doorW, height: doorD };
        case "W":  return { x: pad, y: roomH * 0.5 - doorW * 0.5, width: doorD, height: doorW };
        case "E":  return { x: roomW - pad - doorD, y: roomH * 0.5 - doorW * 0.5, width: doorD, height: doorW };
    }
}
