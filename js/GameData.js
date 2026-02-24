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
    meadow: { id: 'meadow', name: 'Meadow', cost: 100, w: 4, h: 3, capacity: 3, types: ['mammal_small', 'bird'], fill: 0x90EE90, stroke: 0x5a8a5a, desc: 'A sunny meadow for small mammals and birds.' },
    forest: { id: 'forest', name: 'Forest', cost: 200, w: 4, h: 4, capacity: 4, types: ['mammal_large', 'mammal_small'], fill: 0x3a7a3a, stroke: 0x1f4f1f, desc: 'A sheltered grove for forest dwellers.' },
    pond:   { id: 'pond', name: 'Pond', cost: 150, w: 3, h: 3, capacity: 3, types: ['aquatic', 'amphibian', 'bird'], fill: 0x4A80B4, stroke: 0x2a5580, desc: 'A tranquil pond for aquatic creatures.' },
    barn:   { id: 'barn', name: 'Barn', cost: 250, w: 3, h: 3, capacity: 5, types: ['domestic'], fill: 0xCD853F, stroke: 0x8B5A2B, desc: 'A warm barn for domestic animals.' },
};

export const SPECIES = {
    cat:            { id: 'cat', name: 'Cat', type: 'domestic', rarity: 'common', appeal: 2, hungerRate: 0.3, color: 0xE8A64A, names: ['Whiskers','Mittens','Luna','Oliver','Mochi','Bella','Shadow','Ginger'] },
    dog:            { id: 'dog', name: 'Dog', type: 'domestic', rarity: 'common', appeal: 3, hungerRate: 0.4, color: 0xA0724A, names: ['Buddy','Max','Daisy','Rocky','Sadie','Bear','Rusty','Coco'] },
    rabbit:         { id: 'rabbit', name: 'Rabbit', type: 'mammal_small', rarity: 'common', appeal: 3, hungerRate: 0.35, color: 0xD4C4A8, names: ['Clover','Thumper','Biscuit','Hazel','Pepper','Snowball'] },
    fox:            { id: 'fox', name: 'Fox', type: 'mammal_small', rarity: 'uncommon', appeal: 5, hungerRate: 0.3, color: 0xD2691E, names: ['Ember','Maple','Scout','Blaze','Fern','Copper'] },
    deer:           { id: 'deer', name: 'Deer', type: 'mammal_large', rarity: 'common', appeal: 4, hungerRate: 0.25, color: 0xB8860B, names: ['Willow','Bambi','Cedar','Fawn','Acorn','Birch'] },
    owl:            { id: 'owl', name: 'Owl', type: 'bird', rarity: 'uncommon', appeal: 5, hungerRate: 0.2, color: 0x8B7355, names: ['Hoot','Athena','Dusk','Plume','Strix','Talon'] },
    duck:           { id: 'duck', name: 'Duck', type: 'aquatic', rarity: 'common', appeal: 2, hungerRate: 0.3, color: 0xE8D44A, names: ['Puddle','Quackers','Waddle','Sunny','Splash','Buttercup'] },
    turtle:         { id: 'turtle', name: 'Turtle', type: 'amphibian', rarity: 'uncommon', appeal: 4, hungerRate: 0.15, color: 0x556B2F, names: ['Sheldon','Mossy','Pebble','Sage','Tank','Jade'] },
    bear_cub:       { id: 'bear_cub', name: 'Bear Cub', type: 'mammal_large', rarity: 'rare', appeal: 8, hungerRate: 0.5, color: 0x654321, names: ['Honey','Bruno','Kodiak','Berry','Ursie','Grizzly'] },
    phoenix_chick:  { id: 'phoenix_chick', name: 'Phoenix Chick', type: 'bird', rarity: 'legendary', appeal: 20, hungerRate: 0.1, color: 0xFF4500, names: ['Ember','Sol','Ignis','Pyralis','Solstice','Blaze'] },
    butterfly:      { id: 'butterfly', name: 'Butterfly', type: 'bird', rarity: 'uncommon', appeal: 3, hungerRate: 0.15, color: 0x9966FF, season: 'summer', names: ['Flutter','Iris','Petal','Monarch','Azure','Papillon'] },
    hedgehog:       { id: 'hedgehog', name: 'Hedgehog', type: 'mammal_small', rarity: 'uncommon', appeal: 6, hungerRate: 0.2, color: 0x8B7355, season: 'autumn', names: ['Bramble','Thistle','Hawthorn','Conker','Nutkin','Spike'] },
    snowy_owl:      { id: 'snowy_owl', name: 'Snowy Owl', type: 'bird', rarity: 'rare', appeal: 9, hungerRate: 0.15, color: 0xE8E8F0, season: 'winter', names: ['Frost','Blizzard','Ivory','Glacier','Pearl','Tundra'] },
    arctic_fox:     { id: 'arctic_fox', name: 'Arctic Fox', type: 'mammal_small', rarity: 'rare', appeal: 9, hungerRate: 0.25, color: 0xD8DEE8, season: 'winter', names: ['Snowdrift','Crystal','Winter','Flurry','Nimbus','Ash'] },
};

export const RARITY_WEIGHT = { common: 50, uncommon: 30, rare: 15, legendary: 5 };
export const RARITY_COLOR = { common: 0x999999, uncommon: 0x55cc55, rare: 0x6688ff, legendary: 0xffaa00 };

export const TRAITS = {
    playful:  { id: 'playful',  name: 'Playful',  happyMult: 1.2, hungerMult: 1.1, petBonus: 1.5, desc: 'Loves play, hungry often' },
    shy:      { id: 'shy',      name: 'Shy',       happyMult: 1.1, hungerMult: 0.9, petBonus: 0.7, desc: 'Timid but low maintenance' },
    grumpy:   { id: 'grumpy',   name: 'Grumpy',    happyMult: 1.3, hungerMult: 1.0, petBonus: 0.5, desc: 'Hard to please' },
    social:   { id: 'social',   name: 'Social',    happyMult: 0.8, hungerMult: 1.0, petBonus: 1.2, desc: 'Loves company, bonds easily' },
    curious:  { id: 'curious',  name: 'Curious',   happyMult: 1.0, hungerMult: 1.0, petBonus: 1.0, enrichBonus: 1.5, desc: 'Benefits extra from enrichment' },
    lazy:     { id: 'lazy',     name: 'Lazy',      happyMult: 0.7, hungerMult: 0.8, petBonus: 0.9, desc: 'Relaxed, rarely unhappy' },
};
export const TRAIT_IDS = Object.keys(TRAITS);

export const ILLNESSES = {
    cold:        { id: 'cold', name: 'Cold', healthDrain: 0.2, happyDrain: 0.3, treatCost: 30, days: 5 },
    injury:      { id: 'injury', name: 'Injury', healthDrain: 0.4, happyDrain: 0.5, treatCost: 50, days: 7 },
    stomach_bug: { id: 'stomach_bug', name: 'Stomach Bug', healthDrain: 0.15, happyDrain: 0.2, treatCost: 25, days: 3 },
    fatigue:     { id: 'fatigue', name: 'Fatigue', healthDrain: 0.1, happyDrain: 0.4, treatCost: 20, days: 4 },
};

export const ENRICHMENTS = {
    scratching_post: { id: 'scratching_post', name: 'Scratching Post', cost: 50, habitats: ['barn'], happyBonus: 5, appealBonus: 1 },
    bird_bath:       { id: 'bird_bath', name: 'Bird Bath', cost: 45, habitats: ['meadow','pond'], happyBonus: 5, appealBonus: 1 },
    log_pile:        { id: 'log_pile', name: 'Log Pile', cost: 55, habitats: ['forest'], happyBonus: 4, appealBonus: 1 },
    rock_garden:     { id: 'rock_garden', name: 'Rock Garden', cost: 40, habitats: ['pond'], happyBonus: 5, appealBonus: 1 },
    toy_ball:        { id: 'toy_ball', name: 'Toy Ball', cost: 35, habitats: null, happyBonus: 3, appealBonus: 1 },
    cozy_bed:        { id: 'cozy_bed', name: 'Cozy Bed', cost: 60, habitats: null, happyBonus: 4, appealBonus: 1 },
};

export const MISSIONS = {
    urban:    { id: 'urban', name: 'Urban Area', cost: 60, duration: 120, species: ['cat','dog','rabbit'], desc: 'Search the city outskirts' },
    coastal:  { id: 'coastal', name: 'Coastline', cost: 100, duration: 150, species: ['duck','turtle','butterfly'], desc: 'Patrol the rocky shores' },
    wetland:  { id: 'wetland', name: 'Wetlands', cost: 80, duration: 160, species: ['duck','turtle','owl'], desc: 'Explore marshy terrain' },
    forest_m: { id: 'forest_m', name: 'Deep Forest', cost: 120, duration: 200, species: ['deer','fox','bear_cub','hedgehog','owl'], desc: 'Venture into dense woods' },
    mountain: { id: 'mountain', name: 'Mountains', cost: 150, duration: 260, species: ['bear_cub','snowy_owl','arctic_fox','phoenix_chick'], desc: 'Climb the high peaks' },
};

export const VISITOR_TYPES = {
    family:       { id: 'family', name: 'Family', weight: 40, incomeMult: 1.0, prefTypes: ['domestic'], stayMult: 1.0, spriteIdx: 0 },
    tourist:      { id: 'tourist', name: 'Tourist', weight: 25, incomeMult: 1.2, prefTypes: [], stayMult: 1.0, spriteIdx: 2 },
    photographer: { id: 'photographer', name: 'Photographer', weight: 15, incomeMult: 2.0, prefRarity: ['rare','legendary'], stayMult: 1.4, spriteIdx: 1 },
    school:       { id: 'school', name: 'School Group', weight: 15, incomeMult: 0.7, prefTypes: [], stayMult: 0.7, spriteIdx: 2 },
    vip:          { id: 'vip', name: 'VIP', weight: 5, incomeMult: 3.0, prefRarity: ['rare','legendary'], stayMult: 1.2, minRep: 100, spriteIdx: 3 },
};

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
];

export const UPGRADES = {
    better_feed:    { id: 'better_feed', name: 'Better Feed', cost: 200, desc: 'Feeding restores 45 hunger (+50%)' },
    enrichment_up:  { id: 'enrichment_up', name: 'Enrichment', cost: 300, desc: 'Happiness decays 50% slower' },
    sanctuary_sign: { id: 'sanctuary_sign', name: 'Sanctuary Sign', cost: 150, desc: '+20% visitor income' },
    medical_kit:    { id: 'medical_kit', name: 'Medical Kit', cost: 250, desc: 'Unlocks Heal action for animals' },
    gift_shop:      { id: 'gift_shop', name: 'Gift Shop', cost: 400, desc: '+3 bonus coins per visitor' },
    habitat_plus:   { id: 'habitat_plus', name: 'Habitat Plus', cost: 500, desc: 'All habitats gain +1 capacity' },
    premium_food:   { id: 'premium_food', name: 'Premium Food', cost: 600, desc: 'Feed gives 60 hunger + 15 happy' },
    conservation:   { id: 'conservation', name: 'Conservation', cost: 800, desc: 'Rescues arrive 30% faster' },
};

export const STAFF_TYPES = {
    volunteer:  { id: 'volunteer', name: 'Volunteer', hireCost: 50, salary: 10, desc: 'Auto-feeds one habitat', color: 0x55AA55 },
    caretaker:  { id: 'caretaker', name: 'Caretaker', hireCost: 150, salary: 30, desc: 'Auto-feeds all animals', color: 0x5566AA },
    vet:        { id: 'vet', name: 'Veterinarian', hireCost: 200, salary: 40, desc: 'Keeps animals healthy', color: 0xAA5555 },
    guide:      { id: 'guide', name: 'Tour Guide', hireCost: 100, salary: 25, desc: '+25% visitor income', color: 0xAA8855 },
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
