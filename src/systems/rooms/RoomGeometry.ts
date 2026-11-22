import Phaser from "phaser";
import type { Rect } from "../../interfaces/RoomInterfaces";

export interface LineSegment {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface RoomGeometryData {
    perimeterEdges: LineSegment[];
    wallRects: Rect[];
}

export function buildRoomGeometry(walkable: Rect[], roomWidth: number, roomHeight: number): RoomGeometryData {
    // 1. Collect sorted unique X and Y coordinates (including room outer bounds)
    const xs = Array.from(new Set([0, roomWidth, ...walkable.flatMap((r) => [r.x, r.x + r.width])])).sort((a, b) => a - b);
    const ys = Array.from(new Set([0, roomHeight, ...walkable.flatMap((r) => [r.y, r.y + r.height])])).sort((a, b) => a - b);

    const cols = xs.length - 1;
    const rows = ys.length - 1;

    // 2. Build 2D grid marking which cells are walkable
    const isWalkable: boolean[][] = Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => {
            const cx = (xs[col] + xs[col + 1]) * 0.5;
            const cy = (ys[row] + ys[row + 1]) * 0.5;
            return walkable.some((r) => cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height);
        })
    );

    // 3. Collect all non-walkable cells as solid wall rectangles for Arcade Physics
    const wallRects: Rect[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (!isWalkable[row][col]) {
                wallRects.push({
                    x: xs[col],
                    y: ys[row],
                    width: xs[col + 1] - xs[col],
                    height: ys[row + 1] - ys[row],
                });
            }
        }
    }

    // 4. Extract exterior perimeter edges (walkable cell bordering a wall or room edge)
    const perimeterEdges: LineSegment[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (!isWalkable[row][col]) continue;

            const x0 = xs[col];
            const x1 = xs[col + 1];
            const y0 = ys[row];
            const y1 = ys[row + 1];

            // Top edge
            if (row === 0 || !isWalkable[row - 1][col]) perimeterEdges.push({ x1: x0, y1: y0, x2: x1, y2: y0 });
            // Bottom edge
            if (row === rows - 1 || !isWalkable[row + 1][col]) perimeterEdges.push({ x1: x0, y1: y1, x2: x1, y2: y1 });
            // Left edge
            if (col === 0 || !isWalkable[row][col - 1]) perimeterEdges.push({ x1: x0, y1: y0, x2: x0, y2: y1 });
            // Right edge
            if (col === cols - 1 || !isWalkable[row][col + 1]) perimeterEdges.push({ x1: x1, y1: y0, x2: x1, y2: y1 });
        }
    }

    return { perimeterEdges, wallRects };
}

export type ChamberSide = "all" | "left" | "right";

export function getWalkablePoint(
    walkable: Rect[],
    roomOrigin: { x: number; y: number },
    roomWidth: number,
    margin = 48,
    side: ChamberSide = "all"
): { x: number; y: number } {
    const midX = roomWidth * 0.5;

    // Filter walkable rects by chamber side if requested (for split co-op rooms)
    const candidates = walkable.filter((r) => {
        const centerX = r.x + r.width * 0.5;
        if (side === "left") return centerX < midX;
        if (side === "right") return centerX >= midX;
        return true;
    });

    const pool = candidates.length > 0 ? candidates : walkable;
    const rect = Phaser.Utils.Array.GetRandom(pool);

    // Clamp margin so narrow corridors never invert min/max bounds
    const padX = Math.min(margin, rect.width * 0.35);
    const padY = Math.min(margin, rect.height * 0.35);

    const localX = Phaser.Math.Between(rect.x + padX, rect.x + rect.width - padX);
    const localY = Phaser.Math.Between(rect.y + padY, rect.y + rect.height - padY);

    return {
        x: roomOrigin.x + localX,
        y: roomOrigin.y + localY,
    };
}

export function getWalkableCenter(
    walkable: Rect[],
    roomOrigin: { x: number; y: number },
    roomWidth: number,
    side: ChamberSide = "all"
): { x: number; y: number } {
    const midX = roomWidth * 0.5;
    const candidates = walkable.filter((r) => {
        const centerX = r.x + r.width * 0.5;
        if (side === "left") return centerX < midX;
        if (side === "right") return centerX >= midX;
        return true;
    });

    const target = candidates[0] ?? walkable;
    return {
        x: roomOrigin.x + target.x + target.width * 0.5,
        y: roomOrigin.y + target.y + target.height * 0.5,
    };
}
