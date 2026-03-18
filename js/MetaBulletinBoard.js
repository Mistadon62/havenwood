// MetaBulletinBoard — Rotating bulletin board content for the hallway.
// Shows campus news, NPC gossip, tips, event announcements, and help-wanted posts.

import MetaState from './MetaStateManager.js';

const CAMPUS_NEWS = [
    'Campus library hours extended this semester!',
    'New vending machines installed in common room.',
    'Wildlife Biology dept wins research award!',
    'Campus park flowers are blooming beautifully.',
    'Student satisfaction survey — results look great!',
    'Paws & Claws voted best local pet store!',
    'Café introducing new seasonal menu items.',
    'Campus cleanup volunteers needed this weekend.',
    'New study spaces opening in the library.',
    'Prof. Elara\'s latest paper published in Nature!',
];

const NPC_GOSSIP = [
    { text: 'Sam was seen pulling an all-nighter at the library again...', minFriendship: { sam: 20 } },
    { text: 'Prof. Elara is working on something big in her research lab.', minFriendship: { prof_elara: 30 } },
    { text: 'Mr. Tanaka got a new shipment of premium animal supplies!', minFriendship: { shopkeeper: 20 } },
    { text: 'Sam and some friends are planning a weekend park hangout.', minFriendship: { sam: 40 } },
    { text: 'Prof. Elara mentioned you in class as a promising student!', minFriendship: { prof_elara: 50 } },
    { text: 'Tanaka is thinking about expanding his store. Business is good!', minFriendship: { shopkeeper: 40 } },
];

const HAVENWOOD_TIPS = [
    'Tip: Animals in Havenwood need food regularly. Stock up!',
    'Tip: Building habitats attracts new animals to your sanctuary.',
    'Tip: Higher reputation means more visitors and more income.',
    'Tip: NPC friends can visit your sanctuary for bonus rewards!',
    'Tip: Buying treats at Paws & Claws makes your animals happier.',
    'Tip: Study wildlife biology to unlock research in Havenwood.',
    'Tip: Check your phone notifications after playing Havenwood!',
    'Tip: Cross-mode unlocks trigger when switching between worlds.',
];

const HELP_WANTED = [
    {
        title: 'HELP WANTED: Lost Textbook',
        body: 'Prof. Elara lost her wildlife textbook. Check the library, then return it to the classroom.',
        questId: 'lost_textbook',
        condition: () => !MetaState.getQuest('lost_textbook') && MetaState.hasMetNPC('prof_elara'),
    },
    {
        title: 'VOLUNTEERS: Campus Cleanup',
        body: 'Help clean up the park! Visit the park twice to help out.',
        questId: 'campus_cleanup',
        condition: () => !MetaState.getQuest('campus_cleanup') && MetaState.hasFlag('visited_park'),
    },
    {
        title: 'WANTED: Book Donations',
        body: 'The library needs book donations. Bring 2 books to the library study desk.',
        questId: 'book_donations',
        condition: () => !MetaState.getQuest('book_donations') && MetaState.state.inventory.includes('book'),
    },
];

// Use day as seed for deterministic content selection
function seededPick(arr, day, slot) {
    const idx = ((day * 7 + slot * 13) % arr.length + arr.length) % arr.length;
    return arr[idx];
}

const MetaBulletinBoard = {
    // Get bulletin board content for the current day
    getContent(day) {
        const posts = [];

        // 1. Event announcement (if any active today)
        const evt = MetaState.state.currentEvent;
        if (evt && evt.name) {
            posts.push({ title: 'TODAY\'S EVENT', body: evt.desc, type: 'event' });
        }

        // 2. Campus news (1-2 items)
        posts.push({
            title: 'Campus News',
            body: seededPick(CAMPUS_NEWS, day, 0),
            type: 'news',
        });

        // 3. NPC gossip (if friendship gate met)
        for (const gossip of NPC_GOSSIP) {
            let qualifies = true;
            for (const [npcId, minF] of Object.entries(gossip.minFriendship)) {
                if (MetaState.getFriendship(npcId) < minF) { qualifies = false; break; }
            }
            if (qualifies) {
                posts.push({ title: 'Overheard...', body: gossip.text, type: 'gossip' });
                break; // Just one gossip item
            }
        }

        // 4. Havenwood tip
        posts.push({
            title: 'Sanctuary Tip',
            body: seededPick(HAVENWOOD_TIPS, day, 1),
            type: 'tip',
        });

        // 5. Help wanted (if conditions met)
        for (const hw of HELP_WANTED) {
            if (hw.condition()) {
                posts.push({
                    title: hw.title,
                    body: hw.body,
                    type: 'quest',
                    questId: hw.questId,
                });
                break; // Just one help-wanted at a time
            }
        }

        return posts;
    },
};

export default MetaBulletinBoard;
