// MetaStateManager — Central state for the meta-world (real-world layer).
// Owns time, energy, mood, money, knowledge, flags, and save/load.
// Pure data — no Phaser dependency.

const STORAGE_KEY = 'havenwood_meta';

const DEFAULTS = {
    version: 1,

    // Time / Calendar
    day: 1,
    dayOfWeek: 0,       // 0=Mon .. 6=Sun
    timeOfDay: 480,      // minutes since midnight (480 = 8:00 AM)

    // Player stats
    energy: 100,
    mood: 75,
    money: 50,
    knowledge: 0,

    // Weather (rolled each morning)
    weather: 'sunny', // sunny, cloudy, rainy, snowy

    // Inventory (array of item IDs, max 8)
    inventory: [],

    // Progression
    classesAttended: 0,
    shiftsWorked: 0,
    npcsMetSet: [],
    flags: {},

    // Cross-mode unlock tracking
    unlocksGranted: [],

    // Friendships (npcId → 0-100)
    friendships: {},

    // Quests (questId → { status: 'active'|'complete', progress: {} })
    quests: {},
    questsCompleted: 0,

    // Pending purchases (applied when switching to Havenwood)
    pendingFood: 0,
    pendingTreats: 0,

    // Events
    currentEvent: null,       // { id, name, location, desc } or null
    eventHistory: [],          // IDs of scripted events already fired

    // Jobs
    totalJobEarnings: 0,
    lastJobRating: null,       // 'poor' | 'ok' | 'good' | 'excellent'

    // Friendship milestones triggered (milestoneId → true)
    friendshipMilestones: {},

    // NPC sanctuary visit cooldowns (npcId → last meta-day they visited)
    npcVisitCooldowns: {},
    // Total NPC visits to sanctuary
    npcVisitsTotal: 0,

    // Phone notifications queue (shown in meta-world about Havenwood events)
    phoneNotifications: [],

    // Snapshot of Havenwood stats (updated on mode switch for NPC dialogue)
    sanctuarySnapshot: {
        animalCount: 0,
        habitatCount: 0,
        rep: 0,
        coins: 0,
    },

    // Location
    currentLocation: 'bedroom',
    playerTileX: 6,
    playerTileY: 5,
};

class MetaStateManager {
    constructor() {
        this.state = this._freshState();
    }

    _freshState() {
        return JSON.parse(JSON.stringify(DEFAULTS));
    }

    reset() {
        this.state = this._freshState();
        return this.state;
    }

    // ── Persistence ──

    save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    }

    load() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        try {
            const d = JSON.parse(raw);
            // Merge with defaults so new fields get populated
            this.state = { ...this._freshState(), ...d };
            return true;
        } catch (e) {
            console.error('Failed to load meta save:', e);
            return false;
        }
    }

    clearSave() {
        localStorage.removeItem(STORAGE_KEY);
    }

    // ── Time ──

    advanceTime(minutes) {
        this.state.timeOfDay += minutes;
        while (this.state.timeOfDay >= 1440) {
            this.state.timeOfDay -= 1440;
            this._rollDay();
        }
    }

    nextDay() {
        this.state.day++;
        this.state.dayOfWeek = (this.state.dayOfWeek + 1) % 7;
        this.state.timeOfDay = 360; // wake at 6:00 AM
        this.state.energy = 100;
        // Mood drifts toward 50 overnight
        if (this.state.mood > 50) this.state.mood = Math.max(50, this.state.mood - 5);
        else if (this.state.mood < 50) this.state.mood = Math.min(50, this.state.mood + 5);
        // Roll weather
        this.rollWeather();
    }

    rollWeather() {
        const r = Math.random();
        if (r < 0.40) this.state.weather = 'sunny';
        else if (r < 0.70) this.state.weather = 'cloudy';
        else if (r < 0.90) this.state.weather = 'rainy';
        else this.state.weather = 'snowy';
    }

    getWeatherLabel() {
        return { sunny: 'Sunny', cloudy: 'Cloudy', rainy: 'Rainy', snowy: 'Snowy' }[this.state.weather] || 'Sunny';
    }

    passOut() {
        // Fell asleep too late — penalty
        this.state.day++;
        this.state.dayOfWeek = (this.state.dayOfWeek + 1) % 7;
        this.state.timeOfDay = 420; // wake at 7:00 AM
        this.state.energy = 70;
        this.state.mood = Math.max(0, this.state.mood - 10);
    }

    _rollDay() {
        this.state.day++;
        this.state.dayOfWeek = (this.state.dayOfWeek + 1) % 7;
    }

    getTimeString() {
        const h = Math.floor(this.state.timeOfDay / 60);
        const m = this.state.timeOfDay % 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
    }

    getDayName() {
        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][this.state.dayOfWeek];
    }

    isLate() { return this.state.timeOfDay >= 1320; } // 10:00 PM+
    isPastMidnight() { return this.state.timeOfDay < 360 && this.state.day > 1; }

    // ── Stats ──

    getEnergyCostMultiplier() {
        return this.state.timeOfDay >= 1320 ? 2 : 1; // Double energy cost after 10 PM
    }

    spendEnergy(amount) {
        const actual = amount * this.getEnergyCostMultiplier();
        if (this.state.energy < actual) return false;
        this.state.energy -= actual;
        return true;
    }

    addEnergy(amount) {
        this.state.energy = Math.min(100, this.state.energy + amount);
    }

    addMood(amount) {
        this.state.mood = Math.min(100, Math.max(0, this.state.mood + amount));
    }

    addKnowledge(amount) {
        this.state.knowledge += amount;
    }

    addMoney(amount) {
        this.state.money += amount;
    }

    spendMoney(amount) {
        if (this.state.money < amount) return false;
        this.state.money -= amount;
        return true;
    }

    // ── Flags ──

    setFlag(key, val = true) { this.state.flags[key] = val; }
    hasFlag(key) { return !!this.state.flags[key]; }
    clearFlag(key) { delete this.state.flags[key]; }

    // ── NPCs ──

    meetNPC(id) {
        if (!this.state.npcsMetSet.includes(id)) this.state.npcsMetSet.push(id);
    }
    hasMetNPC(id) { return this.state.npcsMetSet.includes(id); }

    // ── Friendships ──

    getFriendship(npcId) {
        return this.state.friendships[npcId] || 0;
    }

    addFriendship(npcId, amount) {
        const cur = this.state.friendships[npcId] || 0;
        this.state.friendships[npcId] = Math.min(100, Math.max(0, cur + amount));
        return this.state.friendships[npcId];
    }

    getFriendshipTier(npcId) {
        const f = this.getFriendship(npcId);
        if (f >= 80) return 'close';    // Close friend
        if (f >= 50) return 'friend';   // Friend
        if (f >= 20) return 'acquaintance'; // Acquaintance
        return 'stranger';              // Stranger
    }

    // ── Quests ──

    getQuest(questId) {
        return this.state.quests[questId] || null;
    }

    startQuest(questId) {
        if (this.state.quests[questId]) return false;
        this.state.quests[questId] = { status: 'active', progress: {} };
        return true;
    }

    updateQuestProgress(questId, key, value) {
        const q = this.state.quests[questId];
        if (!q || q.status !== 'active') return;
        q.progress[key] = value;
    }

    incrementQuestProgress(questId, key, amount = 1) {
        const q = this.state.quests[questId];
        if (!q || q.status !== 'active') return;
        q.progress[key] = (q.progress[key] || 0) + amount;
    }

    completeQuest(questId) {
        const q = this.state.quests[questId];
        if (!q || q.status !== 'active') return false;
        q.status = 'complete';
        this.state.questsCompleted++;
        return true;
    }

    isQuestActive(questId) {
        const q = this.state.quests[questId];
        return q && q.status === 'active';
    }

    isQuestComplete(questId) {
        const q = this.state.quests[questId];
        return q && q.status === 'complete';
    }

    // ── Cross-mode unlocks ──

    grantUnlock(id) {
        if (!this.state.unlocksGranted.includes(id)) this.state.unlocksGranted.push(id);
    }
    hasUnlock(id) { return this.state.unlocksGranted.includes(id); }

    // ── Inventory ──

    addItem(itemId) {
        if (this.state.inventory.length >= 8) return false;
        this.state.inventory.push(itemId);
        return true;
    }

    removeItem(itemId) {
        const idx = this.state.inventory.indexOf(itemId);
        if (idx < 0) return false;
        this.state.inventory.splice(idx, 1);
        return true;
    }

    hasItem(itemId) {
        return this.state.inventory.includes(itemId);
    }

    countItem(itemId) {
        return this.state.inventory.filter(i => i === itemId).length;
    }
}

// Singleton
const instance = new MetaStateManager();
export default instance;
