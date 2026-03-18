// MetaLocations — Data-driven room/area definitions for the meta-world.
// Each location has a tile map, furniture, doors, NPCs, and interactables.
// Tile values: 0=floor, 1=wall, 2=wall_window, 3=grass, 4=stone_path,
//              5=exterior_wall, 9=door (walkable)

const LOCATIONS = {
    bedroom: {
        id: 'bedroom',
        name: 'Your Bedroom',
        cols: 14,
        rows: 10,
        floorTile: 'floor_wood',
        tileMap: [
            [1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 9, 9, 1, 1, 1, 1, 1, 1],
        ],
        furniture: [
            { type: 'desk', gx: 2, gy: 1 },
            { type: 'chair', gx: 3, gy: 2 },
            { type: 'bed', gx: 10, gy: 1 },
            { type: 'bookshelf', gx: 1, gy: 4 },
            { type: 'bookshelf', gx: 1, gy: 5 },
            { type: 'nightstand', gx: 9, gy: 1 },
            { type: 'lamp', gx: 9, gy: 1 },
            { type: 'rug', gx: 5, gy: 4 },
        ],
        doors: [
            { gx: 6, gy: 9, targetLocation: 'hallway', spawnGx: 7, spawnGy: 1 },
            { gx: 7, gy: 9, targetLocation: 'hallway', spawnGx: 7, spawnGy: 1 },
        ],
        npcs: [],
        interactables: [
            { id: 'bed_sleep', gx: 10, gy: 2, w: 2, h: 2, name: 'Bed', action: 'sleep' },
            { id: 'desk_study', gx: 2, gy: 1, w: 2, h: 1, name: 'Desk', action: 'study' },
        ],
    },

    hallway: {
        id: 'hallway',
        name: 'Hallway',
        cols: 14,
        rows: 6,
        floorTile: 'floor_wood',
        tileMap: [
            [1, 1, 1, 1, 1, 1, 9, 9, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 9, 9, 1, 1, 1, 1, 1, 1],
        ],
        furniture: [
            { type: 'lamp', gx: 3, gy: 1 },
            { type: 'lamp', gx: 10, gy: 1 },
        ],
        doors: [
            // Back to bedroom (top)
            { gx: 6, gy: 0, targetLocation: 'bedroom', spawnGx: 6, spawnGy: 8 },
            { gx: 7, gy: 0, targetLocation: 'bedroom', spawnGx: 7, spawnGy: 8 },
            // Out to campus (bottom)
            { gx: 6, gy: 5, targetLocation: 'campus_quad', spawnGx: 7, spawnGy: 1 },
            { gx: 7, gy: 5, targetLocation: 'campus_quad', spawnGx: 7, spawnGy: 1 },
        ],
        npcs: [],
        interactables: [],
    },

    campus_quad: {
        id: 'campus_quad',
        name: 'Campus Quad',
        cols: 14,
        rows: 10,
        floorTile: 'floor_grass',
        tileMap: [
            [5, 5, 5, 5, 5, 5, 9, 9, 5, 5, 5, 5, 5, 5],
            [3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3],
            [3, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 3],
            [3, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 3],
            [3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3],
            [3, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 3],
            [3, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 3],
            [3, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 3],
            [3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3],
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        ],
        furniture: [
            { type: 'bench', gx: 2, gy: 3 },
            { type: 'bench', gx: 11, gy: 3 },
            { type: 'bench', gx: 2, gy: 6 },
            { type: 'bench', gx: 11, gy: 6 },
        ],
        doors: [
            // Back to hallway (top)
            { gx: 6, gy: 0, targetLocation: 'hallway', spawnGx: 6, spawnGy: 4 },
            { gx: 7, gy: 0, targetLocation: 'hallway', spawnGx: 7, spawnGy: 4 },
        ],
        npcs: [
            { id: 'prof_elara', gx: 7, gy: 5 },
        ],
        interactables: [
            { id: 'job_board', gx: 12, gy: 1, w: 1, h: 1, name: 'Job Board', action: 'job' },
        ],
    },
};

export function getLocation(id) {
    return LOCATIONS[id] || LOCATIONS.bedroom;
}

export function getAllLocationIds() {
    return Object.keys(LOCATIONS);
}
