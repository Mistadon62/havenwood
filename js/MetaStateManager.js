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

    // Progression
    classesAttended: 0,
    shiftsWorked: 0,
    npcsMetSet: [],
    flags: {},

    // Cross-mode unlock tracking
    unlocksGranted: [],

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

    spendEnergy(amount) {
        if (this.state.energy < amount) return false;
        this.state.energy -= amount;
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

    // ── Cross-mode unlocks ──

    grantUnlock(id) {
        if (!this.state.unlocksGranted.includes(id)) this.state.unlocksGranted.push(id);
    }
    hasUnlock(id) { return this.state.unlocksGranted.includes(id); }
}

// Singleton
const instance = new MetaStateManager();
export default instance;
