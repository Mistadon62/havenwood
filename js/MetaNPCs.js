// MetaNPCs — NPC definitions for the meta-world.
// Each NPC has a sprite key, schedule, dialogue branches, and action handlers.
// Schedule: array of { days: [0-6], start, end (minutes), location, gx, gy }
// days: 0=Mon..4=Fri, 5=Sat, 6=Sun
// Dialogue is friendship-aware — NPCs react differently at higher friendship tiers.
// Gift system: each NPC has giftPreferences mapping item IDs to friendship bonuses.

import MetaState from './MetaStateManager.js';
import MetaEvents from './MetaEvents.js';
import MetaClassQuiz from './MetaClassQuiz.js';

const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKEND = [5, 6];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// Gift preference tiers
const GIFT_LOVE = 12;    // Favorite gift
const GIFT_LIKE = 6;     // Liked gift
const GIFT_NEUTRAL = 3;  // Neutral gift

const NPCS = {
    prof_elara: {
        id: 'prof_elara',
        name: 'Prof. Elara',
        spriteKey: 'npc_elara',
        facing: 'down',

        // Weekday mornings: classroom; afternoons: campus quad
        // Rainy days: stays in classroom all day
        schedule: [
            { days: WEEKDAYS, start: 480, end: 495, location: 'classroom', gx: 6, gy: 2 },
            { days: WEEKDAYS, start: 495, end: 1020, location: 'campus_quad', gx: 11, gy: 8 },
        ],

        giftPreferences: {
            book: GIFT_LOVE,
            coffee: GIFT_LIKE,
            flower: GIFT_NEUTRAL,
            treat: GIFT_NEUTRAL,
        },
        giftReactions: {
            book: 'A new reference text! This is wonderful, thank you!',
            coffee: 'Ah, caffeine — a professor\'s best friend.',
            flower: 'How lovely, thank you.',
            treat: 'Oh, I\'ll save this for later.',
        },

        getDialogue(locationId) {
            const s = MetaState.state;
            const tier = MetaState.getFriendshipTier('prof_elara');

            // Weekend — no classes
            if (s.dayOfWeek >= 5) {
                if (tier === 'close') {
                    return {
                        speaker: 'Prof. Elara',
                        lines: ['Enjoying the weekend?', 'You\'ve been one of my best students.', 'Come by Monday — I have something special planned.'],
                    };
                }
                return {
                    speaker: 'Prof. Elara',
                    lines: ['No classes on weekends!', 'Enjoy your time off.', 'Try the café — their weekend specials are great.'],
                };
            }

            const attendedToday = MetaState.hasFlag(`class_day_${s.day}`);
            // Class is only available in the classroom during the scheduled window (8:00–8:15 AM)
            const classInSession = locationId === 'classroom' && s.timeOfDay >= 480 && s.timeOfDay < 495;
            const classOverForToday = s.timeOfDay >= 495;

            if (s.energy < 15) {
                return {
                    speaker: 'Prof. Elara',
                    lines: ['You look exhausted.', 'Get some rest before coming to class.'],
                };
            }

            if (attendedToday) {
                const snap = s.sanctuarySnapshot || {};
                if ((tier === 'close' || tier === 'friend') && snap.animalCount >= 5) {
                    return {
                        speaker: 'Prof. Elara',
                        lines: ['Great work today!', `I heard your sanctuary has ${snap.animalCount} animals now.`, 'Your fieldwork is paying off!'],
                    };
                }
                if (tier === 'close' || tier === 'friend') {
                    return {
                        speaker: 'Prof. Elara',
                        lines: ['Great work today!', 'Your dedication is impressive.', 'Keep it up — you\'re on track for honors.'],
                    };
                }
                return {
                    speaker: 'Prof. Elara',
                    lines: ['Great work today!', 'Come back tomorrow for the next lecture.'],
                };
            }

            // Class time has passed for today and the player hasn't attended
            if (classOverForToday) {
                if (tier === 'close' || tier === 'friend') {
                    return {
                        speaker: 'Prof. Elara',
                        lines: ['Oh, you just missed it!', 'Lectures wrap up at 8:15 sharp.', 'Come find me in the classroom tomorrow morning.'],
                    };
                }
                return {
                    speaker: 'Prof. Elara',
                    lines: ['Lectures are done for today.', 'Come by the classroom tomorrow at 8 AM if you\'d like to attend.'],
                };
            }

            if (!MetaState.hasMetNPC('prof_elara')) {
                return {
                    speaker: 'Prof. Elara',
                    lines: [
                        'Welcome! I\'m Professor Elara.',
                        'I teach Wildlife Biology here.',
                        'Ready for your first lesson?',
                    ],
                    choices: classInSession ? [
                        { label: 'Attend class (-15 energy, 1hr)', action: 'attend_class' },
                        { label: 'Maybe later', action: 'cancel' },
                    ] : [
                        { label: 'Maybe later', action: 'cancel' },
                    ],
                };
            }

            // Friendship-tiered greetings
            let greeting;
            if (tier === 'close') {
                greeting = classInSession
                    ? ['Ah, my star pupil!', 'I saved you a front-row seat.', 'Ready for today\'s lecture?']
                    : ['Ah, always good to see you!', 'If you want to attend class, catch me in here at 8 AM.'];
            } else if (tier === 'friend') {
                greeting = classInSession
                    ? ['Good to see you!', 'Today\'s topic is fascinating.', 'Shall we begin?']
                    : ['Good to see you!', 'Class starts at 8 AM in here if you\'re interested.'];
            } else {
                greeting = classInSession
                    ? ['Good to see you again!', 'Ready for today\'s lecture?']
                    : ['Hello there.', 'Class runs 8 to 8:15 in the classroom — catch me then if you\'d like to attend.'];
            }

            const choices = [];
            if (classInSession) {
                choices.push({ label: 'Attend class (-15 energy, 1hr)', action: 'attend_class' });
            }
            if (tier !== 'stranger') {
                choices.push({ label: 'Chat', action: 'chat' });
            }
            if (hasGiftableItem()) {
                choices.push({ label: 'Give Gift', action: 'give_gift' });
            }
            choices.push({ label: 'Just saying hi', action: 'cancel' });

            return {
                speaker: 'Prof. Elara',
                lines: greeting,
                choices,
            };
        },

        handleAction(action, hudScene) {
            if (action === 'cancel') return;
            if (action === 'attend_class') {
                if (!MetaState.spendEnergy(15)) {
                    hudScene.showNotification('Too tired!');
                    return;
                }
                MetaState.meetNPC('prof_elara');
                MetaState.setFlag(`class_day_${MetaState.state.day}`);

                // Launch quiz minigame
                MetaClassQuiz.start(hudScene, ({ playerScore, samScore, bonusKnowledge, grade }) => {
                    MetaState.advanceTime(60);
                    MetaState.addKnowledge(bonusKnowledge);
                    MetaState.addMood(5);
                    MetaState.state.classesAttended++;
                    MetaState.addFriendship('prof_elara', 5);
                    // Bonus friendship if you beat Sam
                    if (playerScore > samScore) MetaState.addFriendship('sam', 3);
                    hudScene.refreshStatusBar();
                    hudScene.showNotification(`Grade: ${grade} — +${bonusKnowledge} Knowledge, +5 Mood`);
                    // Unfreeze
                    const metaScene = hudScene.scene.get('MetaWorldScene');
                    if (metaScene) metaScene._frozen = false;
                });
            }
            if (action === 'chat') {
                MetaState.advanceTime(10);
                MetaState.addMood(3);
                MetaState.addFriendship('prof_elara', 3);
                hudScene.refreshStatusBar();
                hudScene.showNotification('+3 Mood — Insightful conversation!');
            }
            if (action === 'give_gift') {
                handleGiftGiving('prof_elara', hudScene);
            }
        },
    },

    sam: {
        id: 'sam',
        name: 'Sam',
        spriteKey: 'npc_sam',
        facing: 'down',

        // Weekdays: library mornings, quad afternoons
        // Weekends: park mornings, café afternoons
        schedule: [
            { days: WEEKDAYS, start: 480, end: 495, location: 'library', gx: 8, gy: 4 },
            { days: WEEKDAYS, start: 495, end: 1080, location: 'campus_quad', gx: 10, gy: 3 },
            { days: WEEKEND, start: 540, end: 780, location: 'park', gx: 9, gy: 6 },
            { days: WEEKEND, start: 780, end: 960, location: 'cafe', gx: 4, gy: 3 },
        ],

        giftPreferences: {
            coffee: GIFT_LOVE,
            treat: GIFT_LIKE,
            flower: GIFT_LIKE,
            book: GIFT_NEUTRAL,
        },
        giftReactions: {
            coffee: 'No way, you remembered I love coffee! You\'re the best!',
            treat: 'Ooh, snacks! You know me too well.',
            flower: 'Aw, that\'s really sweet of you!',
            book: 'Cool, I\'ll check it out!',
        },

        getDialogue() {
            const s = MetaState.state;
            const tier = MetaState.getFriendshipTier('sam');
            const hungOut = MetaState.hasFlag(`hangout_day_${s.day}`);

            if (s.energy < 10) {
                return {
                    speaker: 'Sam',
                    lines: ['Whoa, you look beat!', 'Go get some rest, we can hang later.'],
                };
            }

            if (hungOut) {
                const snap = s.sanctuarySnapshot || {};
                if (tier === 'close' && snap.animalCount >= 10) {
                    return {
                        speaker: 'Sam',
                        lines: ['Had a great time earlier!', `Dude, ${snap.animalCount} animals?! Your sanctuary is legendary.`, 'Same time tomorrow?'],
                    };
                }
                if (tier === 'close') {
                    return {
                        speaker: 'Sam',
                        lines: ['Had a great time earlier!', 'You\'re seriously the best.', 'Same time tomorrow?'],
                    };
                }
                if (s.npcVisitsTotal > 0 && tier === 'friend') {
                    return {
                        speaker: 'Sam',
                        lines: ['Had fun earlier!', 'BTW I visited your sanctuary — really cool place!', 'See you tomorrow?'],
                    };
                }
                return {
                    speaker: 'Sam',
                    lines: ['Had fun earlier!', 'See you tomorrow?'],
                };
            }

            if (!MetaState.hasMetNPC('sam')) {
                return {
                    speaker: 'Sam',
                    lines: [
                        'Hey! I\'m Sam.',
                        'I\'m studying wildlife conservation too.',
                        'We should hang out sometime!',
                    ],
                    choices: [
                        { label: 'Hang out (-10 energy, 30min)', action: 'hangout' },
                        { label: 'Nice to meet you!', action: 'cancel' },
                    ],
                };
            }

            // Friendship-tiered dialogue
            let greeting;
            if (tier === 'close') {
                greeting = ['Best friend alert!', 'I was hoping you\'d show up.', 'Wanna hang?'];
            } else if (tier === 'friend') {
                greeting = ['Hey, good to see you!', 'Want to hang out?'];
            } else if (s.dayOfWeek >= 5) {
                greeting = ['Weekend vibes!', 'Want to hang out?'];
            } else {
                greeting = ['Hey! Want to hang out?'];
            }

            const choices = [
                { label: 'Hang out (-10 energy, 30min)', action: 'hangout' },
            ];
            if (tier === 'friend' || tier === 'close') {
                choices.push({ label: 'Chat', action: 'chat' });
            }
            if (hasGiftableItem()) {
                choices.push({ label: 'Give Gift', action: 'give_gift' });
            }
            choices.push({ label: 'Just passing through', action: 'cancel' });

            return {
                speaker: 'Sam',
                lines: greeting,
                choices,
            };
        },

        handleAction(action, hudScene) {
            if (action === 'cancel') return;
            if (action === 'hangout') {
                if (!MetaState.spendEnergy(10)) {
                    hudScene.showNotification('Too tired!');
                    return;
                }
                MetaState.meetNPC('sam');
                MetaState.advanceTime(30);
                MetaState.addMood(15);
                MetaState.setFlag(`hangout_day_${MetaState.state.day}`);
                MetaState.addFriendship('sam', 8);
                MetaState.incrementQuestProgress('study_buddy', 'hangouts');
                hudScene.refreshStatusBar();
                hudScene.showNotification('+15 Mood — Good times!');
            }
            if (action === 'chat') {
                MetaState.advanceTime(10);
                MetaState.addMood(5);
                MetaState.addFriendship('sam', 3);
                hudScene.refreshStatusBar();
                hudScene.showNotification('+5 Mood — Fun chat!');
            }
            if (action === 'give_gift') {
                handleGiftGiving('sam', hudScene);
            }
        },
    },

    shopkeeper: {
        id: 'shopkeeper',
        name: 'Mr. Tanaka',
        spriteKey: 'npc_shopkeeper',
        facing: 'down',

        // Every day 8am-8pm
        schedule: [
            { days: ALL_DAYS, start: 480, end: 1200, location: 'pet_store', gx: 9, gy: 3 },
        ],

        giftPreferences: {
            treat: GIFT_LOVE,
            flower: GIFT_LIKE,
            coffee: GIFT_NEUTRAL,
            book: GIFT_NEUTRAL,
        },
        giftReactions: {
            treat: 'Premium treats! I know exactly which animals will love these.',
            flower: 'Beautiful! I\'ll put these by the register.',
            coffee: 'Thanks, I could use a pick-me-up!',
            book: 'I appreciate the thought!',
        },

        getDialogue() {
            const s = MetaState.state;
            const tier = MetaState.getFriendshipTier('shopkeeper');
            const disc = MetaState.hasFlag('tanaka_discount');
            const foodPrice = disc ? 16 : 20;
            const treatPrice = disc ? 12 : 15;
            const premPrice = disc ? 24 : 30;

            if (!MetaState.hasMetNPC('shopkeeper')) {
                return {
                    speaker: 'Mr. Tanaka',
                    lines: [
                        'Welcome to Paws & Claws!',
                        'I\'m Tanaka. We sell supplies for animal sanctuaries.',
                        'What can I get you?',
                    ],
                    choices: [
                        { label: `Food Supplies ($${foodPrice})`, action: 'buy_food_supplies' },
                        { label: `Treats ($${treatPrice})`, action: 'buy_treats' },
                        { label: 'Just browsing', action: 'cancel' },
                    ],
                };
            }

            const snap = s.sanctuarySnapshot || {};
            let greeting;
            if (tier === 'close' && snap.animalCount >= 8) {
                greeting = ['My favorite customer!', `${snap.animalCount} animals in your sanctuary — you must go through a lot of supplies!`, 'I set aside some premium stock for you.'];
            } else if (tier === 'close') {
                greeting = ['My favorite customer!', 'I set aside some premium stock for you.'];
            } else if (tier === 'friend' && s.npcVisitsTotal > 0) {
                greeting = ['Welcome back! Great to see you.', 'I stopped by your sanctuary the other day — impressive setup!', 'What can I get you today?'];
            } else if (tier === 'friend') {
                greeting = ['Welcome back! Great to see you.', 'What can I get you today?'];
            } else {
                greeting = ['What can I get you today?'];
            }

            const choices = [];
            // Loyalty discount at high friendship
            if (tier === 'close') {
                choices.push({ label: `Premium Pack ($${premPrice}, extra value!)`, action: 'buy_premium' });
            }
            choices.push({ label: `Food Supplies ($${foodPrice})`, action: 'buy_food_supplies' });
            choices.push({ label: `Treats ($${treatPrice})`, action: 'buy_treats' });
            if (tier === 'friend' || tier === 'close') {
                choices.push({ label: 'Chat', action: 'chat' });
            }
            if (hasGiftableItem()) {
                choices.push({ label: 'Give Gift', action: 'give_gift' });
            }
            choices.push({ label: 'Just looking', action: 'cancel' });

            return {
                speaker: 'Mr. Tanaka',
                lines: greeting,
                choices,
            };
        },

        handleAction(action, hudScene) {
            if (action === 'cancel') return;
            MetaState.meetNPC('shopkeeper');

            const disc = MetaState.hasFlag('tanaka_discount');
            const foodPrice = disc ? 16 : 20;
            const treatPrice = disc ? 12 : 15;
            const premPrice = disc ? 24 : 30;

            if (action === 'buy_food_supplies') {
                if (!MetaState.spendMoney(foodPrice)) {
                    hudScene.showNotification('Not enough money!');
                    return;
                }
                MetaState.state.pendingFood = (MetaState.state.pendingFood || 0) + 50;
                MetaState.addFriendship('shopkeeper', 5);
                MetaState.incrementQuestProgress('regular_customer', 'purchases');
                hudScene.refreshStatusBar();
                hudScene.showNotification('Bought food supplies for your sanctuary!');
            }

            if (action === 'buy_treats') {
                if (!MetaState.spendMoney(treatPrice)) {
                    hudScene.showNotification('Not enough money!');
                    return;
                }
                MetaState.state.pendingTreats = (MetaState.state.pendingTreats || 0) + 1;
                MetaState.addFriendship('shopkeeper', 5);
                MetaState.incrementQuestProgress('regular_customer', 'purchases');
                hudScene.refreshStatusBar();
                hudScene.showNotification('Bought treats for your animals!');
            }

            if (action === 'buy_premium') {
                if (!MetaState.spendMoney(premPrice)) {
                    hudScene.showNotification('Not enough money!');
                    return;
                }
                MetaState.state.pendingFood = (MetaState.state.pendingFood || 0) + 100;
                MetaState.state.pendingTreats = (MetaState.state.pendingTreats || 0) + 2;
                MetaState.addFriendship('shopkeeper', 8);
                MetaState.incrementQuestProgress('regular_customer', 'purchases');
                hudScene.refreshStatusBar();
                hudScene.showNotification('Premium pack! +100 Food, +2 Treats');
            }

            if (action === 'chat') {
                MetaState.advanceTime(10);
                MetaState.addMood(3);
                MetaState.addFriendship('shopkeeper', 3);
                hudScene.refreshStatusBar();
                hudScene.showNotification('+3 Mood — Tanaka shares pet care tips!');
            }

            if (action === 'give_gift') {
                handleGiftGiving('shopkeeper', hudScene);
            }
        },
    },
};

// ── Gift System ──

// Giftable items the player can hold in inventory
const GIFT_ITEMS = {
    coffee: { name: 'Coffee', icon: 'item_coffee' },
    book: { name: 'Book', icon: 'item_book' },
    flower: { name: 'Flower', icon: 'item_flower' },
    treat: { name: 'Treat Box', icon: 'item_treat' },
};

function hasGiftableItem() {
    for (const itemId of Object.keys(GIFT_ITEMS)) {
        if (MetaState.hasItem(itemId)) return true;
    }
    return false;
}

function getGiftableItems() {
    const items = [];
    for (const [itemId, info] of Object.entries(GIFT_ITEMS)) {
        const count = MetaState.countItem(itemId);
        if (count > 0) items.push({ id: itemId, ...info, count });
    }
    return items;
}

function handleGiftGiving(npcId, hudScene) {
    const npc = NPCS[npcId];
    if (!npc) return;

    const items = getGiftableItems();
    if (items.length === 0) {
        hudScene.showNotification('No gifts to give!');
        return;
    }

    // Pick the first available gift item (simple approach — give first in inventory)
    // In the future this could be a sub-menu, but for now auto-pick the first
    const gift = items[0];
    MetaState.removeItem(gift.id);

    const prefs = npc.giftPreferences || {};
    const bonus = prefs[gift.id] || GIFT_NEUTRAL;
    MetaState.addFriendship(npcId, bonus);
    MetaState.addMood(2);

    const reaction = (npc.giftReactions && npc.giftReactions[gift.id]) || 'Thank you!';
    const bonusLabel = bonus >= GIFT_LOVE ? ' (Loved it!)' : bonus >= GIFT_LIKE ? ' (Liked it!)' : '';

    hudScene.refreshStatusBar();
    hudScene.showNotification(`Gave ${gift.name} — +${bonus} Friendship${bonusLabel}`);

    // Show NPC reaction as a brief dialogue
    const MetaDialogue = hudScene.scene.get('MetaWorldScene')?._metaDialogueRef;
    // We can't easily import MetaDialogue here without circular deps, so just use notification
}

export function getNPC(id) {
    return NPCS[id] || null;
}

export function getAllNPCIds() {
    return Object.keys(NPCS);
}

export function getGiftItemInfo() {
    return GIFT_ITEMS;
}

// Returns NPCs that should be at a given location right now based on schedules
// Weather-aware: on rainy/snowy days, outdoor NPCs move to indoor fallback
export function getNPCsAtLocation(locationId) {
    const s = MetaState.state;
    const isRainy = s.weather === 'rainy' || s.weather === 'snowy';
    const eventOverrides = MetaEvents.getEventNPCOverrides();
    const results = [];

    for (const npc of Object.values(NPCS)) {
        // Check event override first
        const override = eventOverrides[npc.id];
        if (override) {
            if (override.location === locationId) {
                results.push({ id: npc.id, gx: override.gx, gy: override.gy });
            }
            continue; // Event override takes priority over schedule
        }

        if (!npc.schedule) continue;
        for (const slot of npc.schedule) {
            if (!slot.days.includes(s.dayOfWeek)) continue;
            if (s.timeOfDay < slot.start || s.timeOfDay >= slot.end) continue;

            // Weather redirect: if rainy and scheduled outdoors, redirect to indoor location
            let effectiveLocation = slot.location;
            let effectiveGx = slot.gx;
            let effectiveGy = slot.gy;

            if (isRainy && isOutdoorLocation(slot.location)) {
                const redirect = getRainyRedirect(npc.id, slot.location);
                if (redirect) {
                    effectiveLocation = redirect.location;
                    effectiveGx = redirect.gx;
                    effectiveGy = redirect.gy;
                }
            }

            if (effectiveLocation === locationId) {
                results.push({ id: npc.id, gx: effectiveGx, gy: effectiveGy });
                break;
            }
        }
    }
    return results;
}

// Check if a location is outdoors
function isOutdoorLocation(locId) {
    return locId === 'campus_quad' || locId === 'park';
}

// Where NPCs go when it rains (instead of outdoor locations)
function getRainyRedirect(npcId, outdoorLoc) {
    const redirects = {
        prof_elara: { location: 'classroom', gx: 6, gy: 2 },
        sam: { location: 'common_room', gx: 4, gy: 3 },
    };
    return redirects[npcId] || null;
}

// Get the effective location and position for an NPC at a specific time
function _getEffectiveSchedule(npc, timeOfDay, dayOfWeek, weather) {
    const isRainy = weather === 'rainy' || weather === 'snowy';
    if (!npc.schedule) return null;
    for (const slot of npc.schedule) {
        if (!slot.days.includes(dayOfWeek)) continue;
        if (timeOfDay < slot.start || timeOfDay >= slot.end) continue;
        let loc = slot.location, gx = slot.gx, gy = slot.gy;
        if (isRainy && isOutdoorLocation(slot.location)) {
            const redirect = getRainyRedirect(npc.id, slot.location);
            if (redirect) { loc = redirect.location; gx = redirect.gx; gy = redirect.gy; }
        }
        return { location: loc, gx, gy };
    }
    return null;
}

// Detect NPCs departing or arriving at a location between two time points.
// Returns { departing: [{ id, targetLocation, targetGx, targetGy }], arriving: [{ id, fromLocation, gx, gy }] }
export function getTransitioningNPCs(locationId, prevTime, currTime, dayOfWeek, weather) {
    const eventOverrides = MetaEvents.getEventNPCOverrides();
    const departing = [];
    const arriving = [];

    for (const npc of Object.values(NPCS)) {
        if (eventOverrides[npc.id]) continue;
        const prev = _getEffectiveSchedule(npc, prevTime, dayOfWeek, weather);
        const curr = _getEffectiveSchedule(npc, currTime, dayOfWeek, weather);
        const prevLoc = prev ? prev.location : null;
        const currLoc = curr ? curr.location : null;

        if (prevLoc === currLoc) continue;

        if (prevLoc === locationId && currLoc !== locationId) {
            departing.push({ id: npc.id, targetLocation: currLoc, targetGx: curr ? curr.gx : 0, targetGy: curr ? curr.gy : 0 });
        }
        if (currLoc === locationId && prevLoc !== locationId) {
            arriving.push({ id: npc.id, fromLocation: prevLoc, gx: curr.gx, gy: curr.gy });
        }
    }
    return { departing, arriving };
}

// Get ALL NPCs that are changing locations between two time points (not filtered by room).
// Returns array of { id, fromLocation, toLocation, destGx, destGy }
export function getAllTransitioningNPCs(prevTime, currTime, dayOfWeek, weather) {
    const eventOverrides = MetaEvents.getEventNPCOverrides();
    const transitions = [];
    for (const npc of Object.values(NPCS)) {
        if (eventOverrides[npc.id]) continue;
        const prev = _getEffectiveSchedule(npc, prevTime, dayOfWeek, weather);
        const curr = _getEffectiveSchedule(npc, currTime, dayOfWeek, weather);
        const prevLoc = prev ? prev.location : null;
        const currLoc = curr ? curr.location : null;
        if (prevLoc === currLoc) continue;
        if (prevLoc && currLoc) {
            transitions.push({ id: npc.id, fromLocation: prevLoc, toLocation: currLoc, destGx: curr.gx, destGy: curr.gy });
        }
    }
    return transitions;
}
