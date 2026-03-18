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
            [9, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 9],
            [9, 3, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 3, 9],
            [3, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 3],
            [3, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 3],
            [3, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 3],
            [3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3],
            [5, 5, 5, 5, 5, 5, 9, 9, 5, 5, 5, 5, 5, 5],
        ],
        furniture: [
            { type: 'bench', gx: 2, gy: 5 },
            { type: 'bench', gx: 11, gy: 5 },
            { type: 'bench', gx: 2, gy: 7 },
            { type: 'bench', gx: 11, gy: 7 },
        ],
        doors: [
            // Hallway (top)
            { gx: 6, gy: 0, targetLocation: 'hallway', spawnGx: 6, spawnGy: 4 },
            { gx: 7, gy: 0, targetLocation: 'hallway', spawnGx: 7, spawnGy: 4 },
            // Library (left)
            { gx: 0, gy: 3, targetLocation: 'library', spawnGx: 10, spawnGy: 4 },
            { gx: 0, gy: 4, targetLocation: 'library', spawnGx: 10, spawnGy: 5 },
            // Pet Store (right)
            { gx: 13, gy: 3, targetLocation: 'pet_store', spawnGx: 1, spawnGy: 4 },
            { gx: 13, gy: 4, targetLocation: 'pet_store', spawnGx: 1, spawnGy: 5 },
            // Café (bottom)
            { gx: 6, gy: 9, targetLocation: 'cafe', spawnGx: 5, spawnGy: 1 },
            { gx: 7, gy: 9, targetLocation: 'cafe', spawnGx: 6, spawnGy: 1 },
        ],
        npcs: [], // Dynamic — see MetaNPCs schedules
        interactables: [
            { id: 'job_board', gx: 12, gy: 1, w: 1, h: 1, name: 'Job Board', action: 'job' },
        ],
    },

    library: {
        id: 'library',
        name: 'Library',
        cols: 12,
        rows: 10,
        floorTile: 'floor_wood',
        tileMap: [
            [1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ],
        furniture: [
            { type: 'bookshelf', gx: 1, gy: 1 },
            { type: 'bookshelf', gx: 1, gy: 2 },
            { type: 'bookshelf', gx: 1, gy: 3 },
            { type: 'bookshelf', gx: 1, gy: 6 },
            { type: 'bookshelf', gx: 1, gy: 7 },
            { type: 'bookshelf', gx: 1, gy: 8 },
            { type: 'desk', gx: 4, gy: 2 },
            { type: 'desk', gx: 4, gy: 6 },
            { type: 'chair', gx: 5, gy: 3 },
            { type: 'chair', gx: 5, gy: 7 },
            { type: 'lamp', gx: 3, gy: 1 },
            { type: 'lamp', gx: 9, gy: 1 },
        ],
        doors: [
            { gx: 11, gy: 4, targetLocation: 'campus_quad', spawnGx: 1, spawnGy: 3 },
            { gx: 11, gy: 5, targetLocation: 'campus_quad', spawnGx: 1, spawnGy: 4 },
        ],
        npcs: [], // Dynamic — see MetaNPCs schedules
        interactables: [
            { id: 'lib_study', gx: 4, gy: 2, w: 2, h: 1, name: 'Study Desk', action: 'library_study' },
        ],
    },

    pet_store: {
        id: 'pet_store',
        name: 'Paws & Claws',
        cols: 12,
        rows: 8,
        floorTile: 'floor_tile',
        tileMap: [
            [1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ],
        furniture: [
            { type: 'shelf_store', gx: 1, gy: 1 },
            { type: 'shelf_store', gx: 2, gy: 1 },
            { type: 'shelf_store', gx: 4, gy: 1 },
            { type: 'shelf_store', gx: 5, gy: 1 },
            { type: 'shelf_store', gx: 1, gy: 2 },
            { type: 'shelf_store', gx: 2, gy: 2 },
            { type: 'counter', gx: 8, gy: 2 },
            { type: 'shelf_store', gx: 9, gy: 5 },
            { type: 'shelf_store', gx: 10, gy: 5 },
            { type: 'shelf_store', gx: 9, gy: 6 },
            { type: 'shelf_store', gx: 10, gy: 6 },
        ],
        doors: [
            { gx: 0, gy: 4, targetLocation: 'campus_quad', spawnGx: 12, spawnGy: 3 },
            { gx: 0, gy: 5, targetLocation: 'campus_quad', spawnGx: 12, spawnGy: 4 },
        ],
        npcs: [], // Dynamic — see MetaNPCs schedules
        interactables: [],
    },

    cafe: {
        id: 'cafe',
        name: 'Campus Café',
        cols: 12,
        rows: 8,
        floorTile: 'floor_tile',
        tileMap: [
            [1, 1, 1, 1, 9, 9, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ],
        furniture: [
            { type: 'counter', gx: 7, gy: 5 },
            { type: 'register', gx: 9, gy: 5 },
            { type: 'menu_board', gx: 10, gy: 5 },
            { type: 'table_cafe', gx: 2, gy: 2 },
            { type: 'table_cafe', gx: 5, gy: 2 },
            { type: 'table_cafe', gx: 2, gy: 4 },
            { type: 'table_cafe', gx: 5, gy: 4 },
            { type: 'stool', gx: 3, gy: 2 },
            { type: 'stool', gx: 6, gy: 2 },
            { type: 'stool', gx: 3, gy: 4 },
            { type: 'stool', gx: 6, gy: 4 },
        ],
        doors: [
            { gx: 4, gy: 0, targetLocation: 'campus_quad', spawnGx: 6, spawnGy: 8 },
            { gx: 5, gy: 0, targetLocation: 'campus_quad', spawnGx: 7, spawnGy: 8 },
        ],
        npcs: [],
        interactables: [
            { id: 'cafe_counter', gx: 7, gy: 5, w: 2, h: 1, name: 'Café Counter', action: 'buy_coffee' },
        ],
    },
};

export function getLocation(id) {
    return LOCATIONS[id] || LOCATIONS.bedroom;
}

export function getAllLocationIds() {
    return Object.keys(LOCATIONS);
}
