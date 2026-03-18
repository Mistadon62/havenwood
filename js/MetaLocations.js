// MetaLocations — Data-driven room/area definitions for the meta-world.
// Each location has a tile map, furniture, doors, NPCs, and interactables.
// Tile values: 0=floor, 1=wall, 2=wall_window, 3=grass, 4=stone_path,
//              5=exterior_wall, 9=door (walkable)
// Locations with outdoor:true (campus_quad, park) use larger tile maps (23×15) that
// fill the screen between the top and bottom HUD bars. Indoor rooms are smaller and
// centered with a 1.35x zoom.

const LOCATIONS = {
    bedroom: {
        id: 'bedroom',
        name: 'Your Bedroom',
        cols: 14,
        rows: 10,
        floorTile: 'floor_wood',
        outdoor: false,
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
        outdoor: false,
        tileMap: [
            [1, 1, 1, 1, 1, 1, 9, 9, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9],
            [9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 9, 9, 1, 1, 1, 1, 1, 1],
        ],
        furniture: [
            { type: 'lamp', gx: 3, gy: 1 },
            { type: 'lamp', gx: 10, gy: 1 },
            { type: 'bulletin_board', gx: 5, gy: 1 },
        ],
        doors: [
            // Back to bedroom (top)
            { gx: 6, gy: 0, targetLocation: 'bedroom', spawnGx: 6, spawnGy: 8 },
            { gx: 7, gy: 0, targetLocation: 'bedroom', spawnGx: 7, spawnGy: 8 },
            // Common Room (left)
            { gx: 0, gy: 2, targetLocation: 'common_room', spawnGx: 10, spawnGy: 3 },
            { gx: 0, gy: 3, targetLocation: 'common_room', spawnGx: 10, spawnGy: 4 },
            // Classroom (right)
            { gx: 13, gy: 2, targetLocation: 'classroom', spawnGx: 1, spawnGy: 4 },
            { gx: 13, gy: 3, targetLocation: 'classroom', spawnGx: 1, spawnGy: 5 },
            // Out to campus (bottom)
            { gx: 6, gy: 5, targetLocation: 'campus_quad', spawnGx: 10, spawnGy: 1 },
            { gx: 7, gy: 5, targetLocation: 'campus_quad', spawnGx: 11, spawnGy: 1 },
        ],
        npcs: [],
        interactables: [
            { id: 'bulletin_board', gx: 5, gy: 1, w: 1, h: 1, name: 'Bulletin Board', action: 'bulletin_board' },
        ],
    },

    common_room: {
        id: 'common_room',
        name: 'Common Room',
        cols: 12,
        rows: 8,
        floorTile: 'floor_carpet',
        outdoor: false,
        tileMap: [
            [1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ],
        furniture: [
            { type: 'couch', gx: 1, gy: 2 },
            { type: 'couch', gx: 1, gy: 4 },
            { type: 'table_cafe', gx: 3, gy: 3 },
            { type: 'vending_machine', gx: 8, gy: 1 },
            { type: 'lamp', gx: 5, gy: 1 },
            { type: 'tv', gx: 1, gy: 1 },
            { type: 'rug', gx: 3, gy: 4 },
        ],
        doors: [
            { gx: 11, gy: 3, targetLocation: 'hallway', spawnGx: 1, spawnGy: 2 },
            { gx: 11, gy: 4, targetLocation: 'hallway', spawnGx: 1, spawnGy: 3 },
        ],
        npcs: [], // Dynamic
        interactables: [
            { id: 'vending', gx: 8, gy: 1, w: 1, h: 1, name: 'Vending Machine', action: 'vending_machine' },
            { id: 'couch_rest', gx: 1, gy: 2, w: 2, h: 1, name: 'Couch', action: 'couch_rest' },
        ],
    },

    classroom: {
        id: 'classroom',
        name: 'Classroom',
        cols: 12,
        rows: 10,
        floorTile: 'floor_wood',
        outdoor: false,
        tileMap: [
            [1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ],
        furniture: [
            // Teacher area (front/top)
            { type: 'chalkboard', gx: 3, gy: 1 },
            { type: 'podium', gx: 6, gy: 2 },
            { type: 'desk', gx: 8, gy: 1 },
            // Student desks (3 rows)
            { type: 'desk', gx: 2, gy: 4 },
            { type: 'desk', gx: 5, gy: 4 },
            { type: 'desk', gx: 8, gy: 4 },
            { type: 'desk', gx: 2, gy: 6 },
            { type: 'desk', gx: 5, gy: 6 },
            { type: 'desk', gx: 8, gy: 6 },
            { type: 'desk', gx: 2, gy: 8 },
            { type: 'desk', gx: 5, gy: 8 },
            { type: 'desk', gx: 8, gy: 8 },
            // Chairs for students
            { type: 'chair', gx: 3, gy: 5 },
            { type: 'chair', gx: 6, gy: 5 },
            { type: 'chair', gx: 9, gy: 5 },
            { type: 'chair', gx: 3, gy: 7 },
            { type: 'chair', gx: 6, gy: 7 },
            { type: 'chair', gx: 9, gy: 7 },
        ],
        doors: [
            { gx: 0, gy: 4, targetLocation: 'hallway', spawnGx: 12, spawnGy: 2 },
            { gx: 0, gy: 5, targetLocation: 'hallway', spawnGx: 12, spawnGy: 3 },
        ],
        npcs: [], // Dynamic — Prof. Elara during class
        interactables: [],
    },

    campus_quad: {
        id: 'campus_quad',
        name: 'Campus Quad',
        cols: 23,
        rows: 15,
        floorTile: 'floor_grass',
        outdoor: true,
        tileMap: [
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 9, 9, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
            [3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3],
            [9, 3, 3, 3, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 3, 3, 3, 3, 9],
            [9, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 9],
            [3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3],
            [9, 3, 3, 3, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 3, 3, 3, 3, 3],
            [9, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3],
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 9, 9, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        ],
        furniture: [
            { type: 'bench', gx: 2, gy: 6 },
            { type: 'bench', gx: 2, gy: 11 },
            { type: 'bench', gx: 19, gy: 6 },
            { type: 'bench', gx: 19, gy: 3 },
            { type: 'bench', gx: 19, gy: 11 },
        ],
        doors: [
            // Hallway (top)
            { gx: 10, gy: 0, targetLocation: 'hallway', spawnGx: 6, spawnGy: 4 },
            { gx: 11, gy: 0, targetLocation: 'hallway', spawnGx: 7, spawnGy: 4 },
            // Library (left, rows 4-5)
            { gx: 0, gy: 4, targetLocation: 'library', spawnGx: 10, spawnGy: 4 },
            { gx: 0, gy: 5, targetLocation: 'library', spawnGx: 10, spawnGy: 5 },
            // Park (left, rows 10-11)
            { gx: 0, gy: 10, targetLocation: 'park', spawnGx: 21, spawnGy: 6 },
            { gx: 0, gy: 11, targetLocation: 'park', spawnGx: 21, spawnGy: 7 },
            // Pet Store (right)
            { gx: 22, gy: 4, targetLocation: 'pet_store', spawnGx: 1, spawnGy: 4 },
            { gx: 22, gy: 5, targetLocation: 'pet_store', spawnGx: 1, spawnGy: 5 },
            // Café (bottom)
            { gx: 10, gy: 14, targetLocation: 'cafe', spawnGx: 5, spawnGy: 1 },
            { gx: 11, gy: 14, targetLocation: 'cafe', spawnGx: 6, spawnGy: 1 },
        ],
        npcs: [], // Dynamic — see MetaNPCs schedules
        interactables: [
            { id: 'job_board', gx: 19, gy: 1, w: 1, h: 1, name: 'Job Board', action: 'job' },
        ],
    },

    library: {
        id: 'library',
        name: 'Library',
        cols: 12,
        rows: 10,
        floorTile: 'floor_wood',
        outdoor: false,
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
            { gx: 11, gy: 4, targetLocation: 'campus_quad', spawnGx: 1, spawnGy: 4 },
            { gx: 11, gy: 5, targetLocation: 'campus_quad', spawnGx: 1, spawnGy: 5 },
        ],
        npcs: [], // Dynamic
        interactables: [
            { id: 'lib_study', gx: 4, gy: 2, w: 2, h: 1, name: 'Study Desk', action: 'library_study' },
        ],
    },

    park: {
        id: 'park',
        name: 'Campus Park',
        cols: 23,
        rows: 15,
        floorTile: 'floor_grass',
        outdoor: true,
        tileMap: [
            [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 4, 4, 4, 3, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 9],
            [3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 9],
            [3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        ],
        furniture: [
            { type: 'tree', gx: 1, gy: 1 },
            { type: 'tree', gx: 1, gy: 7 },
            { type: 'tree', gx: 1, gy: 13 },
            { type: 'tree', gx: 21, gy: 1 },
            { type: 'tree', gx: 21, gy: 10 },
            { type: 'tree', gx: 21, gy: 13 },
            { type: 'tree', gx: 3, gy: 4 },
            { type: 'tree', gx: 18, gy: 2 },
            { type: 'tree', gx: 10, gy: 12 },
            { type: 'pond', gx: 10, gy: 6 },
            { type: 'bench', gx: 6, gy: 2 },
            { type: 'bench', gx: 15, gy: 8 },
            { type: 'bench', gx: 3, gy: 10 },
            { type: 'flower', gx: 4, gy: 12 },
            { type: 'flower', gx: 6, gy: 13 },
            { type: 'flower', gx: 15, gy: 12 },
            { type: 'flower', gx: 17, gy: 11 },
            { type: 'flower', gx: 18, gy: 4 },
            { type: 'flower', gx: 8, gy: 11 },
        ],
        doors: [
            { gx: 22, gy: 6, targetLocation: 'campus_quad', spawnGx: 1, spawnGy: 10 },
            { gx: 22, gy: 7, targetLocation: 'campus_quad', spawnGx: 1, spawnGy: 11 },
        ],
        npcs: [], // Dynamic
        interactables: [
            { id: 'park_walk', gx: 10, gy: 3, w: 2, h: 1, name: 'Nature Walk', action: 'park_walk' },
            { id: 'pick_flowers', gx: 4, gy: 12, w: 1, h: 1, name: 'Flowers', action: 'pick_flowers' },
        ],
    },

    pet_store: {
        id: 'pet_store',
        name: 'Paws & Claws',
        cols: 12,
        rows: 8,
        floorTile: 'floor_tile',
        outdoor: false,
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
            { gx: 0, gy: 4, targetLocation: 'campus_quad', spawnGx: 21, spawnGy: 4 },
            { gx: 0, gy: 5, targetLocation: 'campus_quad', spawnGx: 21, spawnGy: 5 },
        ],
        npcs: [], // Dynamic
        interactables: [],
    },

    cafe: {
        id: 'cafe',
        name: 'Campus Café',
        cols: 12,
        rows: 8,
        floorTile: 'floor_tile',
        outdoor: false,
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
            { gx: 4, gy: 0, targetLocation: 'campus_quad', spawnGx: 10, spawnGy: 13 },
            { gx: 5, gy: 0, targetLocation: 'campus_quad', spawnGx: 11, spawnGy: 13 },
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
