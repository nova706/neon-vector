import type { RoomLayout } from "../interfaces/RoomInterfaces";

export function createRoomLayouts(width: number, height: number): RoomLayout[] {
    const pad = 12;

    return [
        {
            id: "hub_crossroads",
            // Wide central octagonal-style cross that reaches all 6 airlock slots
            ports: ["N1", "N2", "S1", "S2", "W", "E"],
            walkable: [
                // Horizontal bar connecting W and E ports
                { x: pad, y: height * 0.3, width: width - pad * 2, height: height * 0.4 },
                // Vertical core connecting N1, N2, S1, and S2 ports
                { x: width * 0.16, y: pad, width: width * 0.68, height: height - pad * 2 },
            ],
        },
        {
            id: "cross_arena",
            // Tactical plus-shaped arena with deep corner cover
            ports: ["N1", "S1", "W", "E"],
            walkable: [
                { x: pad, y: height * 0.28, width: width - pad * 2, height: height * 0.44 },
                { x: width * 0.16, y: pad, width: width * 0.56, height: height - pad * 2 },
            ],
        },
        {
            id: "vertical_corridor",
            // Twin parallel vertical lanes (left & right) joined by a central catwalk
            ports: ["N1", "N2", "S1", "S2"],
            walkable: [
                // Left lane (connects N1 <-> S1)
                { x: width * 0.15, y: pad, width: width * 0.24, height: height - pad * 2 },
                // Right lane (connects N2 <-> S2)
                { x: width * 0.61, y: pad, width: width * 0.24, height: height - pad * 2 },
                // Center crossover bridge
                { x: width * 0.15, y: height * 0.38, width: width * 0.7, height: height * 0.24 },
            ],
        },
        {
            id: "horizontal_bridge",
            // Narrow West/East approach ramps opening into a wide central diamond/hex platform
            ports: ["W", "E"],
            walkable: [
                // West & East bridge approaches
                { x: pad, y: height * 0.36, width: width - pad * 2, height: height * 0.28 },
                // Central combat platform
                { x: width * 0.26, y: height * 0.16, width: width * 0.48, height: height * 0.68 },
            ],
        },
        {
            id: "corner_dogleg_ne",
            // S-bend / zig-zag corridor forcing players to round blind corners
            ports: ["N1", "E", "S1", "W"],
            walkable: [
                // West entry corridor leading up to N1
                { x: pad, y: height * 0.35, width: width * 0.38, height: height * 0.28 },
                { x: width * 0.16, y: pad, width: width * 0.24, height: height * 0.62 },
                // Central jog down to bottom-right, leading out to E and S1
                { x: width * 0.16, y: height * 0.44, width: width * 0.64, height: height * 0.24 },
                { x: width * 0.56, y: height * 0.44, width: width - pad - width * 0.56, height: height * 0.26 },
                { x: width * 0.16, y: height * 0.68, width: width * 0.24, height: height - pad - height * 0.68 },
            ],
        },
        {
            id: "ring_gauntlet",
            // Hollow square track around a massive central monolith (great for kiting enemies)
            ports: ["N1", "N2", "S1", "S2", "W", "E"],
            walkable: [
                // Top & bottom hallways
                { x: width * 0.14, y: pad, width: width * 0.72, height: height * 0.24 },
                { x: width * 0.14, y: height * 0.76 - pad, width: width * 0.72, height: height * 0.24 },
                // Left & right hallways (extending to W and E doors)
                { x: pad, y: height * 0.32, width: width * 0.28, height: height * 0.36 },
                { x: width * 0.72 - pad, y: height * 0.32, width: width * 0.28, height: height * 0.36 },
                { x: width * 0.14, y: pad, width: width * 0.16, height: height - pad * 2 },
                { x: width * 0.7, y: pad, width: width * 0.16, height: height - pad * 2 },
            ],
        },
        {
            id: "boss_sanctum",
            // Grand stepped arena: wide central boss pit with recessed side alcoves
            ports: ["S1", "S2", "W", "N1"],
            walkable: [
                // Main boss floor
                { x: width * 0.14, y: height * 0.14, width: width * 0.72, height: height * 0.72 },
                // North-1 & South-1/South-2 entry vestibules
                { x: width * 0.18, y: pad, width: width * 0.2, height: height - pad * 2 },
                { x: width * 0.62, y: height * 0.75, width: width * 0.2, height: height * 0.25 - pad },
                // West entry vestibule
                { x: pad, y: height * 0.35, width: width * 0.2, height: height * 0.3 },
            ],
        },
        {
            id: "split_dual_chambers",
            // Two isolated chambers with staggered bottlenecks (Left side narrow top, Right side narrow bottom)
            ports: ["N1", "N2", "S1", "S2"],
            isSplit: true,
            minPlayers: 2,
            walkable: [
                // Left chamber (N1 -> S1): narrow upper neck opening into a wider lower arena
                { x: width * 0.16, y: pad, width: width * 0.2, height: height * 0.45 },
                { x: pad, y: height * 0.42, width: width * 0.45 - pad, height: height * 0.58 - pad },

                // Right chamber (N2 -> S2): wide upper arena funneling into a narrow lower neck
                { x: width * 0.55, y: pad, width: width * 0.45 - pad, height: height * 0.58 - pad },
                { x: width * 0.64, y: height * 0.55, width: width * 0.2, height: height * 0.45 - pad },
            ],
        },
    ];
}
