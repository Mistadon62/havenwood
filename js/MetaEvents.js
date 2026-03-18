// MetaEvents — Campus event system for the meta-world.
// Fires scripted events on specific days and random events each morning.
// Events can override NPC locations, add temporary interactables, and offer rewards.

import MetaState from './MetaStateManager.js';

// Scripted events fire on specific days (checked first)
const SCRIPTED_EVENTS = [
    {
        id: 'wildlife_fair',
        name: 'Wildlife Fair',
        day: 7,
        location: 'campus_quad',
        desc: 'A wildlife fair has set up in the quad!',
        npcOverrides: { prof_elara: { location: 'campus_quad', gx: 7, gy: 6 } },
        interactables: [
            { id: 'fair_booth', gx: 12, gy: 5, w: 2, h: 1, name: 'Fair Booth', action: 'evt_fair_booth' },
        ],
        furniture: [
            { type: 'fair_booth', gx: 12, gy: 4 },
        ],
    },
    {
        id: 'campus_festival',
        name: 'Campus Festival',
        day: 14,
        location: 'campus_quad',
        desc: 'The annual campus festival is in full swing!',
        npcOverrides: {
            sam: { location: 'campus_quad', gx: 6, gy: 8 },
            shopkeeper: { location: 'campus_quad', gx: 16, gy: 8 },
        },
        interactables: [
            { id: 'festival_stage', gx: 10, gy: 7, w: 2, h: 1, name: 'Festival Stage', action: 'evt_festival' },
        ],
        furniture: [
            { type: 'fair_booth', gx: 10, gy: 6 },
            { type: 'fair_booth', gx: 16, gy: 7 },
        ],
    },
    {
        id: 'midterm_week',
        name: 'Midterm Week',
        day: 21,
        location: null,
        desc: 'Midterm exams — studying is extra effective today!',
        npcOverrides: { prof_elara: { location: 'classroom', gx: 6, gy: 2 } },
        interactables: [],
        furniture: [],
    },
    {
        id: 'founders_day',
        name: 'Founder\'s Day',
        day: 28,
        location: 'campus_quad',
        desc: 'A campus holiday! Everyone is relaxing in the quad.',
        npcOverrides: {
            sam: { location: 'campus_quad', gx: 10, gy: 8 },
            prof_elara: { location: 'campus_quad', gx: 7, gy: 5 },
            shopkeeper: { location: 'campus_quad', gx: 16, gy: 5 },
        },
        interactables: [
            { id: 'founders_statue', gx: 11, gy: 7, w: 1, h: 1, name: 'Founder\'s Statue', action: 'evt_founders' },
        ],
        furniture: [],
    },
];

// Random events — rolled when no scripted event applies
const RANDOM_EVENTS = [
    {
        id: 'bake_sale',
        name: 'Bake Sale',
        weight: 12,
        location: 'common_room',
        desc: 'Bake sale in the common room!',
        interactables: [
            { id: 'bake_table', gx: 5, gy: 3, w: 1, h: 1, name: 'Bake Sale Table', action: 'evt_bake_sale' },
        ],
        furniture: [],
    },
    {
        id: 'guest_lecture',
        name: 'Guest Lecture',
        weight: 10,
        location: 'classroom',
        desc: 'A guest speaker is giving a lecture today!',
        interactables: [
            { id: 'guest_podium', gx: 6, gy: 2, w: 1, h: 1, name: 'Guest Speaker', action: 'evt_guest_lecture' },
        ],
        furniture: [],
    },
    {
        id: 'lost_cat',
        name: 'Lost Cat on Quad',
        weight: 10,
        location: 'campus_quad',
        desc: 'A stray cat is wandering the quad!',
        interactables: [
            { id: 'lost_cat', gx: 9, gy: 8, w: 1, h: 1, name: 'Stray Cat', action: 'evt_lost_cat' },
        ],
        furniture: [
            { type: 'lost_cat', gx: 9, gy: 8 },
        ],
    },
    {
        id: 'book_fair',
        name: 'Book Fair',
        weight: 10,
        location: 'library',
        desc: 'A book fair is happening at the library!',
        interactables: [
            { id: 'book_cart', gx: 7, gy: 3, w: 1, h: 1, name: 'Book Cart', action: 'evt_book_fair' },
        ],
        furniture: [],
    },
    {
        id: 'food_truck',
        name: 'Food Truck',
        weight: 8,
        location: 'campus_quad',
        desc: 'A food truck is parked outside!',
        interactables: [
            { id: 'food_truck', gx: 18, gy: 5, w: 1, h: 1, name: 'Food Truck', action: 'evt_food_truck' },
        ],
        furniture: [
            { type: 'fair_booth', gx: 18, gy: 4 },
        ],
    },
    {
        id: 'study_group',
        name: 'Study Group',
        weight: 8,
        location: 'library',
        desc: 'A study group is meeting in the library!',
        interactables: [],
        furniture: [],
    },
    // No event — weighted heavily
    { id: 'none', name: null, weight: 42 },
];

const MetaEvents = {
    // Roll the daily event. Called during nextDay processing.
    rollDailyEvent(day) {
        // Check scripted events first
        for (const evt of SCRIPTED_EVENTS) {
            if (evt.day === day && !MetaState.state.eventHistory.includes(evt.id)) {
                MetaState.state.currentEvent = {
                    id: evt.id,
                    name: evt.name,
                    location: evt.location,
                    desc: evt.desc,
                };
                MetaState.state.eventHistory.push(evt.id);
                return evt;
            }
        }

        // Roll random event
        const totalWeight = RANDOM_EVENTS.reduce((s, e) => s + e.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const evt of RANDOM_EVENTS) {
            roll -= evt.weight;
            if (roll <= 0) {
                if (evt.id === 'none' || !evt.name) {
                    MetaState.state.currentEvent = null;
                    return null;
                }
                MetaState.state.currentEvent = {
                    id: evt.id,
                    name: evt.name,
                    location: evt.location,
                    desc: evt.desc,
                };
                return evt;
            }
        }
        MetaState.state.currentEvent = null;
        return null;
    },

    getCurrentEvent() {
        return MetaState.state.currentEvent;
    },

    // Get the full event definition (with interactables/furniture) for the active event
    _getFullEvent() {
        const cur = MetaState.state.currentEvent;
        if (!cur) return null;
        const all = [...SCRIPTED_EVENTS, ...RANDOM_EVENTS];
        return all.find(e => e.id === cur.id) || null;
    },

    // Get temporary interactables for a given location from the active event
    getEventInteractables(locationId) {
        const evt = this._getFullEvent();
        if (!evt || evt.location !== locationId) return [];
        return evt.interactables || [];
    },

    // Get temporary furniture for a given location from the active event
    getEventFurniture(locationId) {
        const evt = this._getFullEvent();
        if (!evt || evt.location !== locationId) return [];
        return evt.furniture || [];
    },

    // Get NPC location overrides from the active event
    getEventNPCOverrides() {
        const evt = this._getFullEvent();
        if (!evt || !evt.npcOverrides) return {};
        return evt.npcOverrides;
    },

    // Handle event-specific interactions
    handleEventAction(actionId, hudScene) {
        if (actionId === 'evt_fair_booth') {
            if (!MetaState.spendEnergy(5)) {
                hudScene.showNotification('Too tired!');
                return;
            }
            MetaState.advanceTime(30);
            MetaState.addKnowledge(10);
            MetaState.addMood(10);
            hudScene.refreshStatusBar();
            hudScene.showNotification('+10 Knowledge, +10 Mood — Amazing exhibit!');
        } else if (actionId === 'evt_festival') {
            if (!MetaState.spendEnergy(10)) {
                hudScene.showNotification('Too tired!');
                return;
            }
            MetaState.advanceTime(60);
            MetaState.addMood(20);
            MetaState.addMoney(5);
            hudScene.refreshStatusBar();
            hudScene.showNotification('+20 Mood, +$5 — Festival was a blast!');
        } else if (actionId === 'evt_bake_sale') {
            if (!MetaState.spendMoney(5)) {
                hudScene.showNotification('Not enough money!');
                return;
            }
            MetaState.addMood(10);
            MetaState.addEnergy(10);
            MetaState.advanceTime(10);
            hudScene.refreshStatusBar();
            hudScene.showNotification('+10 Mood, +10 Energy — Delicious treats!');
        } else if (actionId === 'evt_guest_lecture') {
            if (!MetaState.spendEnergy(15)) {
                hudScene.showNotification('Too tired!');
                return;
            }
            MetaState.advanceTime(60);
            MetaState.addKnowledge(18);
            MetaState.addMood(5);
            hudScene.refreshStatusBar();
            hudScene.showNotification('+18 Knowledge — Brilliant lecture!');
        } else if (actionId === 'evt_lost_cat') {
            if (MetaState.hasFlag('found_lost_cat_today')) {
                hudScene.showNotification('The cat seems happy now!');
                return;
            }
            MetaState.addMood(15);
            MetaState.addFriendship('shopkeeper', 5);
            MetaState.setFlag('found_lost_cat_today');
            hudScene.refreshStatusBar();
            hudScene.showNotification('+15 Mood — You helped the stray cat! Tanaka is grateful.');
        } else if (actionId === 'evt_book_fair') {
            if (!MetaState.spendMoney(8)) {
                hudScene.showNotification('Not enough money!');
                return;
            }
            if (MetaState.state.inventory.length < 8) {
                MetaState.addItem('book');
                hudScene.showNotification('Bought a rare book — great gift!');
            } else {
                MetaState.addKnowledge(8);
                hudScene.showNotification('+8 Knowledge — Interesting reads!');
            }
            hudScene.refreshStatusBar();
        } else if (actionId === 'evt_food_truck') {
            if (!MetaState.spendMoney(7)) {
                hudScene.showNotification('Not enough money!');
                return;
            }
            MetaState.addEnergy(20);
            MetaState.addMood(12);
            MetaState.advanceTime(15);
            hudScene.refreshStatusBar();
            hudScene.showNotification('+20 Energy, +12 Mood — Amazing food!');
        } else if (actionId === 'evt_founders') {
            MetaState.addMood(10);
            MetaState.advanceTime(10);
            hudScene.refreshStatusBar();
            hudScene.showNotification('+10 Mood — The campus has such a rich history!');
        }
    },

    // Check if today's event gives a study bonus (midterm week)
    isStudyBonusActive() {
        const cur = MetaState.state.currentEvent;
        return cur && cur.id === 'midterm_week';
    },

    // Check if today's event gives a social bonus (festival/founder's day)
    isSocialBonusActive() {
        const cur = MetaState.state.currentEvent;
        return cur && (cur.id === 'campus_festival' || cur.id === 'founders_day');
    },
};

export default MetaEvents;
