export const TILE = 32;
export const COLS = 30;
export const ROWS = 20;
export const W = COLS * TILE;
export const H = ROWS * TILE;

export const TIME_SCALE = 2;
export const START_COINS = 500;

export const HABITATS = {
    meadow: {
        id: 'meadow', name: 'Meadow', cost: 100,
        w: 4, h: 3, capacity: 3,
        types: ['mammal_small', 'bird'],
        fill: 0x90EE90, stroke: 0x5a8a5a,
        desc: 'A sunny meadow for small mammals and birds.'
    },
    forest: {
        id: 'forest', name: 'Forest', cost: 200,
        w: 4, h: 4, capacity: 4,
        types: ['mammal_large', 'mammal_small'],
        fill: 0x3a7a3a, stroke: 0x1f4f1f,
        desc: 'A sheltered grove for forest dwellers.'
    },
    pond: {
        id: 'pond', name: 'Pond', cost: 150,
        w: 3, h: 3, capacity: 3,
        types: ['aquatic', 'amphibian', 'bird'],
        fill: 0x4A80B4, stroke: 0x2a5580,
        desc: 'A tranquil pond for aquatic creatures.'
    },
    barn: {
        id: 'barn', name: 'Barn', cost: 250,
        w: 3, h: 3, capacity: 5,
        types: ['domestic'],
        fill: 0xCD853F, stroke: 0x8B5A2B,
        desc: 'A warm barn for domestic animals.'
    }
};

export const SPECIES = {
    cat: {
        id: 'cat', name: 'Cat', type: 'domestic', rarity: 'common',
        appeal: 2, hungerRate: 0.3, color: 0xE8A64A,
        names: ['Whiskers', 'Mittens', 'Luna', 'Oliver', 'Mochi', 'Bella', 'Shadow', 'Ginger']
    },
    dog: {
        id: 'dog', name: 'Dog', type: 'domestic', rarity: 'common',
        appeal: 3, hungerRate: 0.4, color: 0xA0724A,
        names: ['Buddy', 'Max', 'Daisy', 'Rocky', 'Sadie', 'Bear', 'Rusty', 'Coco']
    },
    rabbit: {
        id: 'rabbit', name: 'Rabbit', type: 'mammal_small', rarity: 'common',
        appeal: 3, hungerRate: 0.35, color: 0xD4C4A8,
        names: ['Clover', 'Thumper', 'Biscuit', 'Hazel', 'Pepper', 'Snowball']
    },
    fox: {
        id: 'fox', name: 'Fox', type: 'mammal_small', rarity: 'uncommon',
        appeal: 5, hungerRate: 0.3, color: 0xD2691E,
        names: ['Ember', 'Maple', 'Scout', 'Blaze', 'Fern', 'Copper']
    },
    deer: {
        id: 'deer', name: 'Deer', type: 'mammal_large', rarity: 'common',
        appeal: 4, hungerRate: 0.25, color: 0xB8860B,
        names: ['Willow', 'Bambi', 'Cedar', 'Fawn', 'Acorn', 'Birch']
    },
    owl: {
        id: 'owl', name: 'Owl', type: 'bird', rarity: 'uncommon',
        appeal: 5, hungerRate: 0.2, color: 0x8B7355,
        names: ['Hoot', 'Athena', 'Dusk', 'Plume', 'Strix', 'Talon']
    },
    duck: {
        id: 'duck', name: 'Duck', type: 'aquatic', rarity: 'common',
        appeal: 2, hungerRate: 0.3, color: 0xE8D44A,
        names: ['Puddle', 'Quackers', 'Waddle', 'Sunny', 'Splash', 'Buttercup']
    },
    turtle: {
        id: 'turtle', name: 'Turtle', type: 'amphibian', rarity: 'uncommon',
        appeal: 4, hungerRate: 0.15, color: 0x556B2F,
        names: ['Sheldon', 'Mossy', 'Pebble', 'Sage', 'Tank', 'Jade']
    },
    bear_cub: {
        id: 'bear_cub', name: 'Bear Cub', type: 'mammal_large', rarity: 'rare',
        appeal: 8, hungerRate: 0.5, color: 0x654321,
        names: ['Honey', 'Bruno', 'Kodiak', 'Berry', 'Ursie', 'Grizzly']
    },
    phoenix_chick: {
        id: 'phoenix_chick', name: 'Phoenix Chick', type: 'bird', rarity: 'legendary',
        appeal: 20, hungerRate: 0.1, color: 0xFF4500,
        names: ['Ember', 'Sol', 'Ignis', 'Pyralis', 'Solstice', 'Blaze']
    }
};

export const RARITY_WEIGHT = { common: 50, uncommon: 30, rare: 15, legendary: 5 };
export const RARITY_COLOR = { common: 0x999999, uncommon: 0x55cc55, rare: 0x6688ff, legendary: 0xffaa00 };

export const RESCUE_MSG = [
    '{name} the {species} was found wandering near the highway!',
    'A family can no longer care for {name} the {species}.',
    '{name} the {species} was found injured in the woods.',
    'An abandoned {species} named {name} needs a home!',
    '{name} the {species} was rescued from a storm.',
];

export const CLR = {
    grass1: 0x5B8C3E, grass2: 0x4E7A35, grass3: 0x6B9C4E, grass4: 0x558B3E,
    path: 0xD4B87C, fence: 0x8B7355, fenceLight: 0xA08060,
    uiBg: 0x2D1B0E, uiBorder: 0x5C3A1E, uiText: '#FFF8DC',
    gold: '#FFD700', goldHex: 0xFFD700,
};
