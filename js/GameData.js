export const TILE = 32;
export const COLS = 30;
export const ROWS = 20;
export const W = COLS * TILE;
export const H = ROWS * TILE;

export const TIME_SCALE = 2;
export const START_COINS = 500;

export const SEASON_LENGTH = 7;
export const SEASON_CYCLE = 28;
export const SEASONS = {
    spring: { id: 'spring', name: 'Spring', tint: 0x113300, tintAlpha: 0.03, particle: 'particle_petal', bonuses: { happiness: 1.1 } },
    summer: { id: 'summer', name: 'Summer', tint: 0x332200, tintAlpha: 0.04, particle: null, bonuses: { visitors: 1.25, income: 1.15 } },
    autumn: { id: 'autumn', name: 'Autumn', tint: 0x442200, tintAlpha: 0.06, particle: 'particle_leaf', bonuses: { buildCost: 0.9 } },
    winter: { id: 'winter', name: 'Winter', tint: 0x001133, tintAlpha: 0.1, particle: 'particle_snow', bonuses: { hungerRate: 0.85, visitors: 0.75 } },
};
export const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];

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
    },
    butterfly: {
        id: 'butterfly', name: 'Butterfly', type: 'bird', rarity: 'uncommon',
        appeal: 3, hungerRate: 0.15, color: 0x9966FF,
        season: 'summer',
        names: ['Flutter', 'Iris', 'Petal', 'Monarch', 'Azure', 'Papillon']
    },
    hedgehog: {
        id: 'hedgehog', name: 'Hedgehog', type: 'mammal_small', rarity: 'uncommon',
        appeal: 6, hungerRate: 0.2, color: 0x8B7355,
        season: 'autumn',
        names: ['Bramble', 'Thistle', 'Hawthorn', 'Conker', 'Nutkin', 'Spike']
    },
    snowy_owl: {
        id: 'snowy_owl', name: 'Snowy Owl', type: 'bird', rarity: 'rare',
        appeal: 9, hungerRate: 0.15, color: 0xE8E8F0,
        season: 'winter',
        names: ['Frost', 'Blizzard', 'Ivory', 'Glacier', 'Pearl', 'Tundra']
    },
    arctic_fox: {
        id: 'arctic_fox', name: 'Arctic Fox', type: 'mammal_small', rarity: 'rare',
        appeal: 9, hungerRate: 0.25, color: 0xD8DEE8,
        season: 'winter',
        names: ['Snowdrift', 'Crystal', 'Winter', 'Flurry', 'Nimbus', 'Ash']
    }
};

export const RARITY_WEIGHT = { common: 50, uncommon: 30, rare: 15, legendary: 5 };
export const RARITY_COLOR = { common: 0x999999, uncommon: 0x55cc55, rare: 0x6688ff, legendary: 0xffaa00 };

export const UPGRADES = {
    better_feed:    { id: 'better_feed',    name: 'Better Feed',    cost: 200,  desc: 'Feeding restores 45 hunger (+50%)' },
    enrichment:     { id: 'enrichment',     name: 'Enrichment',     cost: 300,  desc: 'Happiness decays 50% slower' },
    sanctuary_sign: { id: 'sanctuary_sign', name: 'Sanctuary Sign', cost: 150,  desc: '+20% visitor income' },
    medical_kit:    { id: 'medical_kit',    name: 'Medical Kit',    cost: 250,  desc: 'Unlocks Heal action for animals' },
    gift_shop:      { id: 'gift_shop',      name: 'Gift Shop',      cost: 400,  desc: '+3 bonus coins per visitor' },
    habitat_plus:   { id: 'habitat_plus',   name: 'Habitat Plus',   cost: 500,  desc: 'All habitats gain +1 capacity' },
    premium_food:   { id: 'premium_food',   name: 'Premium Food',   cost: 600,  desc: 'Feed gives 60 hunger + 15 happy' },
    conservation:   { id: 'conservation',   name: 'Conservation',   cost: 800,  desc: 'Rescues arrive 30% faster' },
};

export const STAFF_TYPES = {
    volunteer:  { id: 'volunteer',  name: 'Volunteer',    hireCost: 50,  salary: 10, desc: 'Auto-feeds one habitat',      color: 0x55AA55 },
    caretaker:  { id: 'caretaker',  name: 'Caretaker',    hireCost: 150, salary: 30, desc: 'Auto-feeds all animals',      color: 0x5566AA },
    vet:        { id: 'vet',        name: 'Veterinarian', hireCost: 200, salary: 40, desc: 'Keeps all animals healthy',   color: 0xAA5555 },
    guide:      { id: 'guide',      name: 'Tour Guide',   hireCost: 100, salary: 25, desc: '+25% visitor income',         color: 0xAA8855 },
};

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
