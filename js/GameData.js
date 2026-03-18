// Havenwood — central game data/config registry. All constants, species (with foodCost and bondTreatsBase),
// habitats, facilities (garden with produce), decorations, missions, upgrades, staff (volunteer is
// free/limited), research, and UI palette.

// Grid/layout constants — tile size, map dimensions, MAP_Y offset (top bar), canvas height includes UI bars, time scale, starting currency
export const TILE = 32;
export const COLS = 30;
export const ROWS = 20;
export const W = COLS * TILE;
export const MAP_Y = 42;
export const H = MAP_Y + ROWS * TILE + 62;
export const TIME_SCALE = 2;
export const START_COINS = 500;

// Season system — cycle length, per-season bonuses (visitors, income, hunger), tints, particles
export const SEASON_LENGTH = 7;
export const SEASON_CYCLE = 28;
export const SEASONS = {
    spring: { id: 'spring', name: 'Spring', tint: 0x113300, tintAlpha: 0.03, particle: 'particle_petal', bonuses: { happiness: 1.1 } },
    summer: { id: 'summer', name: 'Summer', tint: 0x332200, tintAlpha: 0.04, particle: null, bonuses: { visitors: 1.25, income: 1.15 } },
    autumn: { id: 'autumn', name: 'Autumn', tint: 0x442200, tintAlpha: 0.06, particle: 'particle_leaf', bonuses: { buildCost: 0.9 } },
    winter: { id: 'winter', name: 'Winter', tint: 0x001133, tintAlpha: 0.1, particle: 'particle_snow', bonuses: { hungerRate: 0.85, visitors: 0.75 } },
};
export const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];

// Habitats — 4 types (meadow, forest, pond, barn) with cost, dimensions, capacity, compatible animal types
export const HABITATS = {
    meadow: { id: 'meadow', name: 'Meadow', cost: 100, w: 5, h: 4, capacity: 3, types: ['mammal_small', 'bird'], fill: 0x90EE90, stroke: 0x5a8a5a, desc: 'A sunny meadow for small mammals and birds.' },
    forest: { id: 'forest', name: 'Forest', cost: 200, w: 5, h: 5, capacity: 4, types: ['mammal_large', 'mammal_small'], fill: 0x3a7a3a, stroke: 0x1f4f1f, desc: 'A sheltered grove for forest dwellers.' },
    pond:   { id: 'pond', name: 'Pond', cost: 150, w: 4, h: 4, capacity: 3, types: ['aquatic', 'amphibian', 'bird'], fill: 0x4A80B4, stroke: 0x2a5580, desc: 'A tranquil pond for aquatic creatures.' },
    barn:   { id: 'barn', name: 'Barn', cost: 250, w: 4, h: 4, capacity: 5, types: ['domestic'], fill: 0xCD853F, stroke: 0x8B5A2B, desc: 'A warm barn for domestic animals.' },
};

// Restroom dirtiness: accumulates over time, 0–1 scale. At 1, visitors get nauseous.
export const BATHROOM_DIRTY_RATE = 0.00003;

// Visitor trash: chance to drop when leaving. Visitors show gross emoji when walking past trash.
export const TRASH_DROP_CHANCE = 0.08;

// Facilities — zoomable multi-tile buildings (no animals). Garden grows harvestable produce.
// Gift shop: some visitors stop here before leaving; tour visitors go here then leave (no more habitats).
// Restroom: visitors may stop here before leaving; improves satisfaction.
export const FACILITIES = {
    garden:    { id: 'garden', name: 'Garden', cost: 150, w: 3, h: 4, fill: 0x88CC66, stroke: 0x5A8A3A, desc: 'A tranquil garden that beautifies the sanctuary.' },
    gift_shop: { id: 'gift_shop', name: 'Gift Shop', cost: 200, w: 3, h: 3, fill: 0xCC8866, stroke: 0x8B5A3A, desc: 'Visitors stop here before leaving. Some will browse and spend.' },
    bathroom:  { id: 'bathroom', name: 'Restroom', cost: 80, w: 2, h: 2, fill: 0x88AAEE, stroke: 0x5A7ABB, desc: 'Restroom facilities. Visitors appreciate the convenience.' },
};

// Garden produce — 3 types × 4 each (12 total). Picked items give food and regrow after 8 hours (480 min).
// New gardens start empty (all produce growing); saved gardens restore exact regrow state.
export const GARDEN_PRODUCE = [
    { id: 'tomato',  name: 'Tomato',  color: 0xDD3333, leafColor: 0x44AA44, food: 15 },
    { id: 'carrot',  name: 'Carrot',  color: 0xFF8822, leafColor: 0x55BB55, food: 12 },
    { id: 'cabbage', name: 'Cabbage', color: 0x66BB44, leafColor: 0x338822, food: 10 },
];
export const GARDEN_REGROW_TIME = 480;

// Decorations — single-tile placeable items that improve sanctuary aesthetics.
// Path-like decors (path, path_stone, path_brick, path_gravel) are walkable and placeable on entrance.
// category: Flowers | Greenery | Flooring | Utilities (for filter dropdown)
export const DECORATIONS = {
    tree:        { id: 'tree',        name: 'Tree',        cost: 15, color: 0x2a5a2a, category: 'Greenery' },
    path:        { id: 'path',        name: 'Path',        cost: 5,  color: 0xD4B87C, isPath: true, category: 'Flooring' },
    path_stone:  { id: 'path_stone',  name: 'Stone Path',  cost: 8,  color: 0x888888, isPath: true, category: 'Flooring' },
    path_brick:  { id: 'path_brick',  name: 'Brick Path',  cost: 10, color: 0xB85C4A, isPath: true, category: 'Flooring' },
    path_gravel: { id: 'path_gravel', name: 'Gravel Path', cost: 6,  color: 0x6B6B5A, isPath: true, category: 'Flooring' },
    trashcan:    { id: 'trashcan',    name: 'Trashcan',    cost: 10, color: 0x888888, category: 'Utilities' },
    flowers:     { id: 'flowers',     name: 'Flowers',     cost: 10, color: 0xFF88AA, category: 'Flowers' },
    potted_plant:  { id: 'potted_plant',  name: 'Potted Plant',  cost: 12, color: 0x44AA44, category: 'Greenery' },
    potted_flowers:{ id: 'potted_flowers',name: 'Potted Flowers',cost: 14, color: 0xFF88CC, category: 'Flowers' },
    bush:        { id: 'bush',        name: 'Bush',        cost: 18, color: 0x2a5a2a, category: 'Greenery' },
    hedge:       { id: 'hedge',       name: 'Hedge',       cost: 20, color: 0x3a6a3a, category: 'Greenery' },
    planter:     { id: 'planter',     name: 'Planter',     cost: 16, color: 0x8B5A2B, category: 'Flowers' },
    tulips:      { id: 'tulips',      name: 'Tulips',      cost: 11, color: 0xFF4466, category: 'Flowers' },
    daisies:     { id: 'daisies',     name: 'Daisies',     cost: 9,  color: 0xFFFFFF, category: 'Flowers' },
    sunflowers:  { id: 'sunflowers',  name: 'Sunflowers',  cost: 18, color: 0xFFCC00, category: 'Flowers' },
    lavender:    { id: 'lavender',    name: 'Lavender',     cost: 13, color: 0x9966CC, category: 'Flowers' },
    roses:       { id: 'roses',       name: 'Roses',       cost: 22, color: 0xCC2244, category: 'Flowers' },
    lily:        { id: 'lily',        name: 'Lily',        cost: 15, color: 0xFFEEAA, category: 'Flowers' },
    fern:        { id: 'fern',        name: 'Fern',        cost: 11, color: 0x3a7a3a, category: 'Greenery' },
    flower_bed:  { id: 'flower_bed',  name: 'Flower Bed',  cost: 24, color: 0x88AA55, category: 'Flowers' },
    marigolds:   { id: 'marigolds',   name: 'Marigolds',   cost: 10, color: 0xFF8800, category: 'Flowers' },
};

export const DECOR_CATEGORIES = ['All', 'Flowers', 'Greenery', 'Flooring', 'Utilities'];

// Species — 14 animals with rarity, hunger rates; some are seasonal-only.
// Each species has variants: { name, gender ('m'/'f'), color } for unique appearances per individual.
// Special breed-only variants have { breedOnly: true, parents: [idxA, idxB] } — obtainable
// only by breeding the two specified parent variants together. Breed-only babies always
// use their variant's fixed name. Normal offspring inherit the same-gender parent's name.
// bondTreatsBase: base bond XP gained per treat (scaled by rarity; higher rarity = more XP per treat).
// foodCost: amount of food consumed per feeding action.
export const SPECIES = {
    cat: { id: 'cat', name: 'Cat', type: 'domestic', rarity: 'common', hungerRate: 0.3, bondTreatsBase: 3, foodCost: 5, color: 0xE8A64A, variants: [
        { name: 'Whiskers', gender: 'm', color: 0xE8A64A }, { name: 'Mittens',  gender: 'f', color: 0xCCCCCC },
        { name: 'Luna',     gender: 'f', color: 0x2A2A2A }, { name: 'Oliver',   gender: 'm', color: 0xE8983A },
        { name: 'Mochi',    gender: 'f', color: 0xF5F0E0 }, { name: 'Bella',    gender: 'f', color: 0xC08040 },
        { name: 'Shadow',   gender: 'm', color: 0x444455 }, { name: 'Ginger',   gender: 'f', color: 0xD06020 },
        { name: 'Marble',   gender: 'f', color: 0xB0A090, breedOnly: true, parents: [0, 2] },
        { name: 'Smokey',   gender: 'm', color: 0x777788, breedOnly: true, parents: [6, 1] },
    ]},
    dog: { id: 'dog', name: 'Dog', type: 'domestic', rarity: 'common', hungerRate: 0.4, bondTreatsBase: 3, foodCost: 8, color: 0xA0724A, variants: [
        { name: 'Buddy',  gender: 'm', color: 0xC8A060 }, { name: 'Max',    gender: 'm', color: 0x8B6540 },
        { name: 'Daisy',  gender: 'f', color: 0xF0E0C0 }, { name: 'Rocky',  gender: 'm', color: 0x706050 },
        { name: 'Sadie',  gender: 'f', color: 0xB08050 }, { name: 'Bear',   gender: 'm', color: 0x3D2B1F },
        { name: 'Rusty',  gender: 'm', color: 0xC05030 }, { name: 'Coco',   gender: 'f', color: 0x5C3A1E },
        { name: 'Copper', gender: 'm', color: 0xD49060, breedOnly: true, parents: [0, 2] },
        { name: 'Ember',  gender: 'f', color: 0xAA4422, breedOnly: true, parents: [6, 7] },
    ]},
    rabbit: { id: 'rabbit', name: 'Rabbit', type: 'mammal_small', rarity: 'common', hungerRate: 0.35, bondTreatsBase: 3, foodCost: 4, color: 0xD4C4A8, variants: [
        { name: 'Clover',   gender: 'f', color: 0xD4C4A8 }, { name: 'Thumper',  gender: 'm', color: 0xA08868 },
        { name: 'Biscuit',  gender: 'm', color: 0xDBC8A0 }, { name: 'Hazel',    gender: 'f', color: 0x9A7B5A },
        { name: 'Pepper',   gender: 'm', color: 0x555555 }, { name: 'Snowball', gender: 'f', color: 0xF0F0F0 },
        { name: 'Oreo',     gender: 'm', color: 0x888888, breedOnly: true, parents: [4, 5] },
        { name: 'Caramel',  gender: 'f', color: 0xC8A050, breedOnly: true, parents: [1, 0] },
    ]},
    fox: { id: 'fox', name: 'Fox', type: 'mammal_small', rarity: 'uncommon', hungerRate: 0.3, bondTreatsBase: 5, foodCost: 6, color: 0xD2691E, variants: [
        { name: 'Ember',  gender: 'f', color: 0xD2691E }, { name: 'Maple',  gender: 'f', color: 0xC05020 },
        { name: 'Scout',  gender: 'm', color: 0xBB6622 }, { name: 'Blaze',  gender: 'm', color: 0xE07020 },
        { name: 'Fern',   gender: 'f', color: 0xA05A28 }, { name: 'Copper', gender: 'm', color: 0xB87333 },
        { name: 'Russet', gender: 'm', color: 0x9A3010, breedOnly: true, parents: [3, 1] },
        { name: 'Amber',  gender: 'f', color: 0xDDA040, breedOnly: true, parents: [5, 0] },
    ]},
    deer: { id: 'deer', name: 'Deer', type: 'mammal_large', rarity: 'common', hungerRate: 0.25, bondTreatsBase: 3, foodCost: 10, color: 0xB8860B, variants: [
        { name: 'Willow', gender: 'f', color: 0xC09840 }, { name: 'Bambi',  gender: 'm', color: 0xB8860B },
        { name: 'Cedar',  gender: 'm', color: 0x8B6914 }, { name: 'Fawn',   gender: 'f', color: 0xD4A855 },
        { name: 'Acorn',  gender: 'm', color: 0x7A5C22 }, { name: 'Birch',  gender: 'f', color: 0xC8B080 },
        { name: 'Aspen',  gender: 'f', color: 0xE0D0A0, breedOnly: true, parents: [1, 5] },
        { name: 'Elm',    gender: 'm', color: 0x6A5010, breedOnly: true, parents: [2, 0] },
    ]},
    owl: { id: 'owl', name: 'Owl', type: 'bird', rarity: 'uncommon', hungerRate: 0.2, bondTreatsBase: 5, foodCost: 5, color: 0x8B7355, variants: [
        { name: 'Hoot',   gender: 'm', color: 0x8B7355 }, { name: 'Athena', gender: 'f', color: 0x9A8060 },
        { name: 'Dusk',   gender: 'm', color: 0x5C4A3A }, { name: 'Plume',  gender: 'f', color: 0xB09878 },
        { name: 'Strix',  gender: 'm', color: 0x6B5B4A }, { name: 'Talon',  gender: 'm', color: 0x7A6650 },
        { name: 'Eclipse',gender: 'f', color: 0x3A3040, breedOnly: true, parents: [2, 1] },
        { name: 'Sage',   gender: 'm', color: 0x8A9870, breedOnly: true, parents: [0, 3] },
    ]},
    duck: { id: 'duck', name: 'Duck', type: 'aquatic', rarity: 'common', hungerRate: 0.3, bondTreatsBase: 3, foodCost: 4, color: 0xE8D44A, variants: [
        { name: 'Puddle',    gender: 'm', color: 0xE8D44A }, { name: 'Quackers',  gender: 'm', color: 0x3A7A3A },
        { name: 'Waddle',    gender: 'f', color: 0xC0A840 }, { name: 'Sunny',     gender: 'f', color: 0xF0E060 },
        { name: 'Splash',    gender: 'm', color: 0x4A6A3A }, { name: 'Buttercup', gender: 'f', color: 0xF5E550 },
        { name: 'Jade',      gender: 'f', color: 0x50AA60, breedOnly: true, parents: [1, 3] },
        { name: 'Goldie',    gender: 'm', color: 0xF0C020, breedOnly: true, parents: [0, 5] },
    ]},
    turtle: { id: 'turtle', name: 'Turtle', type: 'amphibian', rarity: 'uncommon', hungerRate: 0.15, bondTreatsBase: 5, foodCost: 3, color: 0x556B2F, variants: [
        { name: 'Sheldon', gender: 'm', color: 0x556B2F }, { name: 'Mossy',  gender: 'm', color: 0x4A6A28 },
        { name: 'Pebble',  gender: 'f', color: 0x7A8060 }, { name: 'Sage',   gender: 'f', color: 0x6B8B50 },
        { name: 'Tank',    gender: 'm', color: 0x3A4A20 }, { name: 'Jade',   gender: 'f', color: 0x448844 },
        { name: 'Emerald', gender: 'f', color: 0x30AA50, breedOnly: true, parents: [1, 5] },
        { name: 'Basalt',  gender: 'm', color: 0x3A3A3A, breedOnly: true, parents: [4, 2] },
    ]},
    bear_cub: { id: 'bear_cub', name: 'Bear Cub', type: 'mammal_large', rarity: 'rare', hungerRate: 0.5, bondTreatsBase: 8, foodCost: 15, color: 0x654321, variants: [
        { name: 'Honey',   gender: 'f', color: 0x8B6C30 }, { name: 'Bruno',   gender: 'm', color: 0x654321 },
        { name: 'Kodiak',  gender: 'm', color: 0x4A3018 }, { name: 'Berry',   gender: 'f', color: 0x5A3828 },
        { name: 'Ursie',   gender: 'f', color: 0x7A5C40 }, { name: 'Grizzly', gender: 'm', color: 0x3A2A1A },
        { name: 'Cinnamon',gender: 'f', color: 0xA06030, breedOnly: true, parents: [1, 0] },
        { name: 'Midnight',gender: 'm', color: 0x1A1A20, breedOnly: true, parents: [5, 3] },
    ]},
    phoenix_chick: { id: 'phoenix_chick', name: 'Phoenix Chick', type: 'bird', rarity: 'legendary', hungerRate: 0.1, bondTreatsBase: 12, foodCost: 3, color: 0xFF4500, variants: [
        { name: 'Ember',    gender: 'f', color: 0xFF4500 }, { name: 'Sol',      gender: 'm', color: 0xFFAA00 },
        { name: 'Ignis',    gender: 'm', color: 0xFF2200 }, { name: 'Pyralis',  gender: 'f', color: 0xFF6600 },
        { name: 'Solstice', gender: 'f', color: 0xFFCC00 }, { name: 'Blaze',    gender: 'm', color: 0xEE3300 },
        { name: 'Inferno',  gender: 'm', color: 0xFF0000, breedOnly: true, parents: [2, 0] },
        { name: 'Aurora',   gender: 'f', color: 0xFFDD88, breedOnly: true, parents: [1, 4] },
    ]},
    butterfly: { id: 'butterfly', name: 'Butterfly', type: 'bird', rarity: 'uncommon', hungerRate: 0.15, bondTreatsBase: 5, foodCost: 2, color: 0x9966FF, season: 'summer', variants: [
        { name: 'Flutter',  gender: 'f', color: 0x9966FF }, { name: 'Iris',     gender: 'f', color: 0x6644CC },
        { name: 'Petal',    gender: 'f', color: 0xFF88AA }, { name: 'Monarch',  gender: 'm', color: 0xEE8822 },
        { name: 'Azure',    gender: 'm', color: 0x4488DD }, { name: 'Papillon', gender: 'm', color: 0x44BB88 },
        { name: 'Prism',    gender: 'f', color: 0xEE44FF, breedOnly: true, parents: [3, 0] },
        { name: 'Galaxy',   gender: 'm', color: 0x2244AA, breedOnly: true, parents: [4, 1] },
    ]},
    hedgehog: { id: 'hedgehog', name: 'Hedgehog', type: 'mammal_small', rarity: 'uncommon', hungerRate: 0.2, bondTreatsBase: 5, foodCost: 4, color: 0x8B7355, season: 'autumn', variants: [
        { name: 'Bramble',  gender: 'm', color: 0x8B7355 }, { name: 'Thistle',  gender: 'f', color: 0x9A8060 },
        { name: 'Hawthorn', gender: 'm', color: 0x6A5A44 }, { name: 'Conker',   gender: 'm', color: 0x6B3A1A },
        { name: 'Nutkin',   gender: 'f', color: 0xAA9068 }, { name: 'Spike',    gender: 'm', color: 0x554430 },
        { name: 'Truffle',  gender: 'f', color: 0x4A3020, breedOnly: true, parents: [3, 1] },
        { name: 'Acorn',    gender: 'm', color: 0x886644, breedOnly: true, parents: [0, 4] },
    ]},
    snowy_owl: { id: 'snowy_owl', name: 'Snowy Owl', type: 'bird', rarity: 'rare', hungerRate: 0.15, bondTreatsBase: 8, foodCost: 5, color: 0xE8E8F0, season: 'winter', variants: [
        { name: 'Frost',    gender: 'm', color: 0xE8E8F0 }, { name: 'Blizzard', gender: 'm', color: 0xD8D8E8 },
        { name: 'Ivory',    gender: 'f', color: 0xFFF8F0 }, { name: 'Glacier',  gender: 'm', color: 0xC8D0E0 },
        { name: 'Pearl',    gender: 'f', color: 0xF0E8E0 }, { name: 'Tundra',   gender: 'f', color: 0xD0D8E0 },
        { name: 'Opal',     gender: 'f', color: 0xE0E8FF, breedOnly: true, parents: [0, 2] },
        { name: 'Storm',    gender: 'm', color: 0xA0A8C0, breedOnly: true, parents: [1, 5] },
    ]},
    arctic_fox: { id: 'arctic_fox', name: 'Arctic Fox', type: 'mammal_small', rarity: 'rare', hungerRate: 0.25, bondTreatsBase: 8, foodCost: 7, color: 0xD8DEE8, season: 'winter', variants: [
        { name: 'Snowdrift', gender: 'm', color: 0xE8E8F0 }, { name: 'Crystal', gender: 'f', color: 0xD8E0F0 },
        { name: 'Winter',    gender: 'f', color: 0xC8D0E0 }, { name: 'Flurry',  gender: 'f', color: 0xF0F0F8 },
        { name: 'Nimbus',    gender: 'm', color: 0xC0C8D8 }, { name: 'Ash',     gender: 'm', color: 0xA0A8B8 },
        { name: 'Frost',     gender: 'f', color: 0xF8F8FF, breedOnly: true, parents: [0, 3] },
        { name: 'Slate',     gender: 'm', color: 0x808898, breedOnly: true, parents: [5, 2] },
    ]},
};

// Rarity weights (rescue odds) and colors for UI display
export const RARITY_WEIGHT = { common: 50, uncommon: 30, rare: 15, legendary: 5 };
export const RARITY_COLOR = { common: 0x999999, uncommon: 0x55cc55, rare: 0x6688ff, legendary: 0xffaa00 };

// Traits — personality modifiers for happiness, hunger, petting, enrichment bonuses
export const TRAITS = {
    playful:  { id: 'playful',  name: 'Playful',  happyMult: 1.2, hungerMult: 1.1, petBonus: 1.5, desc: 'Loves play, hungry often' },
    shy:      { id: 'shy',      name: 'Shy',       happyMult: 1.1, hungerMult: 0.9, petBonus: 0.7, desc: 'Timid but low maintenance' },
    grumpy:   { id: 'grumpy',   name: 'Grumpy',    happyMult: 1.3, hungerMult: 1.0, petBonus: 0.5, desc: 'Hard to please' },
    social:   { id: 'social',   name: 'Social',    happyMult: 0.8, hungerMult: 1.0, petBonus: 1.2, desc: 'Loves company, bonds easily' },
    curious:  { id: 'curious',  name: 'Curious',   happyMult: 1.0, hungerMult: 1.0, petBonus: 1.0, enrichBonus: 1.5, desc: 'Benefits extra from enrichments' },
    lazy:     { id: 'lazy',     name: 'Lazy',      happyMult: 0.7, hungerMult: 0.8, petBonus: 0.9, desc: 'Relaxed, rarely unhappy' },
};
export const TRAIT_IDS = Object.keys(TRAITS);

// Illnesses — health/happiness drain, treatment cost, duration in days
export const ILLNESSES = {
    cold:        { id: 'cold', name: 'Cold', healthDrain: 0.2, happyDrain: 0.3, treatCost: 30, days: 5 },
    injury:      { id: 'injury', name: 'Injury', healthDrain: 0.4, happyDrain: 0.5, treatCost: 50, days: 7 },
    stomach_bug: { id: 'stomach_bug', name: 'Stomach Bug', healthDrain: 0.15, happyDrain: 0.2, treatCost: 25, days: 3 },
    fatigue:     { id: 'fatigue', name: 'Fatigue', healthDrain: 0.1, happyDrain: 0.4, treatCost: 20, days: 4 },
};

// Enrichments — habitat items that boost animal happiness
export const ENRICHMENTS = {
    scratching_post: { id: 'scratching_post', name: 'Scratching Post', cost: 50, habitats: ['barn'], happyBonus: 5 },
    bird_bath:       { id: 'bird_bath', name: 'Bird Bath', cost: 45, habitats: ['meadow','pond'], happyBonus: 5 },
    log_pile:        { id: 'log_pile', name: 'Log Pile', cost: 55, habitats: ['forest'], happyBonus: 4 },
    rock_garden:     { id: 'rock_garden', name: 'Rock Garden', cost: 40, habitats: ['pond'], happyBonus: 5 },
    toy_ball:        { id: 'toy_ball', name: 'Toy Ball', cost: 35, habitats: null, happyBonus: 3 },
    cozy_bed:        { id: 'cozy_bed', name: 'Cozy Bed', cost: 60, habitats: null, happyBonus: 4 },
};

// Missions — biome-based rescue missions with cost, duration, and possible species
export const MISSIONS = {
    urban:    { id: 'urban', name: 'Urban Area', cost: 60, duration: 120, species: ['cat','dog','rabbit'], desc: 'Search the city outskirts' },
    coastal:  { id: 'coastal', name: 'Coastline', cost: 100, duration: 150, species: ['duck','turtle','butterfly'], desc: 'Patrol the rocky shores' },
    wetland:  { id: 'wetland', name: 'Wetlands', cost: 80, duration: 160, species: ['duck','turtle','owl'], desc: 'Explore marshy terrain' },
    forest_m: { id: 'forest_m', name: 'Deep Forest', cost: 120, duration: 200, species: ['deer','fox','bear_cub','hedgehog','owl'], desc: 'Venture into dense woods' },
    mountain: { id: 'mountain', name: 'Mountains', cost: 150, duration: 260, species: ['bear_cub','snowy_owl','arctic_fox','phoenix_chick'], desc: 'Climb the high peaks' },
};

// Visitor types — spawn weights, income multipliers, stay duration multipliers
export const VISITOR_TYPES = {
    family:       { id: 'family', name: 'Family', weight: 40, incomeMult: 1.0, stayMult: 1.0, spriteIdx: 0 },
    tourist:      { id: 'tourist', name: 'Tourist', weight: 25, incomeMult: 1.2, stayMult: 1.0, spriteIdx: 2 },
    photographer: { id: 'photographer', name: 'Photographer', weight: 15, incomeMult: 2.0, stayMult: 1.4, spriteIdx: 1 },
    school:       { id: 'school', name: 'School Group', weight: 15, incomeMult: 0.7, stayMult: 0.7, spriteIdx: 2 },
    vip:          { id: 'vip', name: 'VIP', weight: 5, incomeMult: 3.0, stayMult: 1.2, minRep: 100, spriteIdx: 3 },
};

// NPC visitors — meta-world characters who visit the sanctuary (friendship-gated)
// These use named sprite keys instead of spriteIdx, higher income, longer stays, and special bubbles.
export const NPC_VISITOR_TYPES = {
    sam:    { id: 'sam', name: 'Sam', spriteKey: 'visitor_sam', incomeMult: 2.5, stayMult: 1.8, minFriendship: 30, bubbleText: 'So cool!', repBonus: 5 },
    elara:  { id: 'elara', name: 'Prof. Elara', spriteKey: 'visitor_elara', incomeMult: 3.0, stayMult: 2.0, minFriendship: 40, bubbleText: 'Fascinating!', repBonus: 8 },
    tanaka: { id: 'tanaka', name: 'Mr. Tanaka', spriteKey: 'visitor_tanaka', incomeMult: 2.0, stayMult: 1.5, minFriendship: 20, bubbleText: 'Well done!', repBonus: 3 },
};

// Achievements — 22 milestones for rescues, breeding, species, coins, upgrades, etc.
export const ACHIEVEMENTS = [
    { id: 'first_rescue', name: 'First Rescue', desc: 'Rescue your first animal' },
    { id: 'five_animals', name: 'Getting Started', desc: 'Have 5 animals at once' },
    { id: 'ten_animals', name: 'Growing Sanctuary', desc: 'Have 10 animals at once' },
    { id: 'twenty_animals', name: 'Thriving', desc: 'Have 20 animals at once' },
    { id: 'all_habitats', name: 'Full Range', desc: 'Build all 4 habitat types' },
    { id: 'first_breed', name: 'New Life', desc: 'Breed your first baby animal' },
    { id: 'five_breeds', name: 'Nursery', desc: 'Breed 5 baby animals' },
    { id: 'rare_find', name: 'Rare Find', desc: 'Discover a rare species' },
    { id: 'legendary_find', name: 'Legendary!', desc: 'Discover a legendary species' },
    { id: 'rich', name: 'Prosperous', desc: 'Earn 5,000 coins total' },
    { id: 'millionaire', name: 'Millionaire', desc: 'Earn 50,000 coins total' },
    { id: 'full_year', name: 'Full Year', desc: 'Survive all 4 seasons' },
    { id: 'half_bestiary', name: 'Naturalist', desc: 'Discover half of all species' },
    { id: 'full_bestiary', name: 'Master Collector', desc: 'Discover every species' },
    { id: 'first_mission', name: 'Explorer', desc: 'Complete a rescue mission' },
    { id: 'first_staff', name: 'Manager', desc: 'Hire your first staff member' },
    { id: 'first_upgrade', name: 'Improving', desc: 'Buy your first upgrade' },
    { id: 'all_upgrades', name: 'Fully Loaded', desc: 'Buy all upgrades' },
    { id: 'first_enrichment', name: 'Interior Designer', desc: 'Add an enrichment item' },
    { id: 'healer', name: 'Healer', desc: 'Cure a sick animal' },
    { id: 'first_research', name: 'Scholar', desc: 'Complete your first research' },
    { id: 'full_research', name: 'Genius', desc: 'Complete all research' },
];

// Upgrades — 7 purchasable improvements (feed, enrichment, sign, medical, etc.)
export const UPGRADES = {
    better_feed:    { id: 'better_feed', name: 'Better Feed', cost: 200, desc: 'Feeding restores 45 hunger (+50%)' },
    enrichment_up:  { id: 'enrichment_up', name: 'Enrichment', cost: 300, desc: 'Happiness decays 50% slower' },
    sanctuary_sign: { id: 'sanctuary_sign', name: 'Sanctuary Sign', cost: 150, desc: '+20% visitor income' },
    medical_kit:    { id: 'medical_kit', name: 'Medical Kit', cost: 250, desc: 'Unlocks Heal action for animals' },
    habitat_plus:   { id: 'habitat_plus', name: 'Habitat Plus', cost: 500, desc: 'All habitats gain +1 capacity' },
    premium_food:   { id: 'premium_food', name: 'Premium Food', cost: 600, desc: 'Feed gives 60 hunger + 15 happy' },
    conservation:   { id: 'conservation', name: 'Conservation', cost: 800, desc: 'Rescues arrive 30% faster' },
};

// Staff types — 5 hirable roles (volunteer, vet, guide, gardener, janitor) with costs and effects.
// Volunteers are free (0g hire, 0g salary) but limited to 1.
export const STAFF_TYPES = {
    volunteer:  { id: 'volunteer', name: 'Volunteer', hireCost: 0, salary: 0, maxCount: 1, desc: 'Keeps animals fed and happy', color: 0x55AA55 },
    vet:        { id: 'vet', name: 'Veterinarian', hireCost: 200, salary: 40, desc: 'Keeps animals healthy', color: 0xAA5555 },
    guide:      { id: 'guide', name: 'Tour Guide', hireCost: 100, salary: 25, desc: '+25% visitor income', color: 0xAA8855 },
    gardener:   { id: 'gardener', name: 'Gardener', hireCost: 120, salary: 20, desc: 'Auto-harvests garden crops', color: 0x66AA44 },
    janitor:    { id: 'janitor', name: 'Janitor', hireCost: 80, salary: 15, desc: 'Keeps restrooms clean', color: 0x88AAEE },
};

// Research tree — 4 branches x 4 tiers; unlock dependencies and effect keys drive gameplay
export const RESEARCH = {
    // ── Wildlife Biology ──
    wildlife_1:   { id: 'wildlife_1',   branch: 'wildlife', tier: 1, name: 'Field Study',         cost: 3,  requires: null,          desc: '+2 max species per rescue mission',    effect: 'mission_species_bonus' },
    wildlife_2:   { id: 'wildlife_2',   branch: 'wildlife', tier: 2, name: 'Habitat Science',      cost: 5,  requires: 'wildlife_1',  desc: 'All habitats +1 capacity',             effect: 'habitat_cap_1' },
    wildlife_3:   { id: 'wildlife_3',   branch: 'wildlife', tier: 3, name: 'Behavioral Study',     cost: 8,  requires: 'wildlife_2',  desc: 'Bonds form 3x faster',                 effect: 'fast_bonds' },
    wildlife_4:   { id: 'wildlife_4',   branch: 'wildlife', tier: 4, name: 'Apex Conservation',    cost: 12, requires: 'wildlife_3',  desc: 'Rare/legendary rescues 2x more likely', effect: 'rare_boost' },

    // ── Veterinary Science ──
    vet_1:        { id: 'vet_1',        branch: 'vet', tier: 1, name: 'First Aid',            cost: 3,  requires: null,      desc: 'Illness chance reduced 40%',            effect: 'illness_resist' },
    vet_2:        { id: 'vet_2',        branch: 'vet', tier: 2, name: 'Animal Nutrition',     cost: 5,  requires: 'vet_1',   desc: 'All feeding +20% effectiveness',        effect: 'feed_boost' },
    vet_3:        { id: 'vet_3',        branch: 'vet', tier: 3, name: 'Breeding Program',     cost: 8,  requires: 'vet_2',   desc: 'Pregnancy time halved, cooldown -3 days', effect: 'breed_boost' },
    vet_4:        { id: 'vet_4',        branch: 'vet', tier: 4, name: 'Miracle Medicine',     cost: 12, requires: 'vet_3',   desc: 'Vets cure instantly, heal cost -50%',   effect: 'super_vet' },

    // ── Ecology & Enrichment ──
    eco_1:        { id: 'eco_1',        branch: 'eco', tier: 1, name: 'Nature Crafts',        cost: 3,  requires: null,      desc: 'Enrichment costs -30%',                 effect: 'cheap_enrich' },
    eco_2:        { id: 'eco_2',        branch: 'eco', tier: 2, name: 'Eco Design',           cost: 5,  requires: 'eco_1',   desc: 'Habitats hold 4 enrichments (was 3)',   effect: 'enrich_cap_4' },
    eco_3:        { id: 'eco_3',        branch: 'eco', tier: 3, name: 'Seasonal Harmony',     cost: 8,  requires: 'eco_2',   desc: 'Season penalties removed',              effect: 'no_season_penalty' },
    eco_4:        { id: 'eco_4',        branch: 'eco', tier: 4, name: 'Perfect Habitat',      cost: 12, requires: 'eco_3',   desc: 'Enrichment bonuses doubled',            effect: 'double_enrich' },

    // ── Public Outreach ──
    outreach_1:   { id: 'outreach_1',   branch: 'outreach', tier: 1, name: 'Flyer Campaign',      cost: 3,  requires: null,          desc: '+30% visitor frequency',                effect: 'more_visitors' },
    outreach_2:   { id: 'outreach_2',   branch: 'outreach', tier: 2, name: 'Education Center',    cost: 5,  requires: 'outreach_1',  desc: 'School groups pay 2x',                  effect: 'school_boost' },
    outreach_3:   { id: 'outreach_3',   branch: 'outreach', tier: 3, name: 'Media Coverage',      cost: 8,  requires: 'outreach_2',  desc: 'VIP min rep lowered to 50',             effect: 'vip_easier' },
    outreach_4:   { id: 'outreach_4',   branch: 'outreach', tier: 4, name: 'World Renown',        cost: 12, requires: 'outreach_3',  desc: 'All visitor income +50%',               effect: 'income_50' },
};

// Research branches — metadata (name, color, icon) for the 4 research trees
export const RESEARCH_BRANCHES = {
    wildlife: { name: 'Wildlife Biology', color: 0x55AA55, icon: '\u{1F43E}' },
    vet:      { name: 'Veterinary Science', color: 0xAA5555, icon: '\u{2695}' },
    eco:      { name: 'Ecology', color: 0x55AAAA, icon: '\u{1F33F}' },
    outreach: { name: 'Public Outreach', color: 0xAAAA55, icon: '\u{1F4E2}' },
};

// Rescue messages — templates for animal arrival notifications ({name}, {species})
export const RESCUE_MSG = [
    '{name} the {species} was found wandering near the highway!',
    'A family can no longer care for {name} the {species}.',
    '{name} the {species} was found injured in the woods.',
    'An abandoned {species} named {name} needs a home!',
    '{name} the {species} was rescued from a storm.',
];

// Color palette — grass, path, fence, UI, gold for consistent theming.
// In-game UI uses a navy/indigo palette. Title screen keeps its own styling.
export const CLR = {
    grass1: 0x5B8C3E, grass2: 0x4E7A35, grass3: 0x6B9C4E, grass4: 0x558B3E,
    path: 0xD4B87C, fence: 0x8B7355, fenceLight: 0xA08060,
    uiBg: 0x252F40, uiBorder: 0x3D4F6B, uiText: '#FFF5E6',
    uiPanelBg: 0x1A2438,
    gold: '#E8B84A', goldHex: 0xE8B84A,
};
