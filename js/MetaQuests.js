// MetaQuests — Quest definitions for the meta-world.
// Each quest has steps, conditions, and rewards.
// Quests can be auto-started by triggers or started by NPCs.

import MetaState from './MetaStateManager.js';

const QUESTS = {
    welcome_to_campus: {
        id: 'welcome_to_campus',
        name: 'Welcome to Campus',
        giver: null,
        desc: 'Get settled in — meet the professor, find the library, and grab a coffee.',
        steps: [
            { key: 'met_elara', label: 'Meet Prof. Elara', check: () => MetaState.hasMetNPC('prof_elara') },
            { key: 'visited_library', label: 'Visit the Library', check: () => MetaState.hasFlag('visited_library') },
            { key: 'bought_coffee', label: 'Buy a coffee at the café', check: () => MetaState.hasFlag('bought_coffee') },
        ],
        reward: { money: 20, mood: 10 },
        rewardText: '+$20, +10 Mood',
        autoStart: true,
    },

    study_buddy: {
        id: 'study_buddy',
        name: 'Study Buddy',
        giver: 'sam',
        desc: 'Sam wants to study together. Hang out with Sam 3 times.',
        steps: [
            { key: 'hangouts', label: 'Hang out with Sam (0/3)', target: 3, counter: true,
              check: () => (MetaState.getQuest('study_buddy')?.progress.hangouts || 0) >= 3 },
        ],
        reward: { knowledge: 15, mood: 10 },
        rewardText: '+15 Knowledge, +10 Mood',
        startCondition: () => MetaState.hasMetNPC('sam') && MetaState.getFriendship('sam') >= 20,
    },

    top_student: {
        id: 'top_student',
        name: 'Top Student',
        giver: 'prof_elara',
        desc: 'Prof. Elara challenges you to attend 5 classes.',
        steps: [
            { key: 'classes', label: 'Attend class (0/5)', target: 5, counter: true,
              check: () => MetaState.state.classesAttended >= 5 },
        ],
        reward: { money: 50, knowledge: 20 },
        rewardText: '+$50, +20 Knowledge',
        startCondition: () => MetaState.hasMetNPC('prof_elara') && MetaState.state.classesAttended >= 2,
    },

    regular_customer: {
        id: 'regular_customer',
        name: 'Regular Customer',
        giver: 'shopkeeper',
        desc: 'Mr. Tanaka appreciates loyal customers. Buy from the store 3 times.',
        steps: [
            { key: 'purchases', label: 'Buy from Paws & Claws (0/3)', target: 3, counter: true,
              check: () => (MetaState.getQuest('regular_customer')?.progress.purchases || 0) >= 3 },
        ],
        reward: { money: 30 },
        rewardText: '+$30 — Loyalty discount!',
        startCondition: () => MetaState.hasMetNPC('shopkeeper') && MetaState.getFriendship('shopkeeper') >= 15,
    },

    hard_worker: {
        id: 'hard_worker',
        name: 'Hard Worker',
        giver: null,
        desc: 'Prove your work ethic — complete 5 shifts at the job board.',
        steps: [
            { key: 'shifts', label: 'Work shifts (0/5)', target: 5, counter: true,
              check: () => MetaState.state.shiftsWorked >= 5 },
        ],
        reward: { money: 75, mood: 5 },
        rewardText: '+$75 bonus, +5 Mood',
        startCondition: () => MetaState.state.shiftsWorked >= 1,
    },

    lost_textbook: {
        id: 'lost_textbook',
        name: 'Lost Textbook',
        giver: 'prof_elara',
        desc: 'Prof. Elara lost her wildlife textbook. Check the library, then return to the classroom.',
        steps: [
            { key: 'checked_library', label: 'Search the library', check: () => MetaState.hasFlag('quest_lt_library') },
            { key: 'returned_book', label: 'Return to classroom', check: () => MetaState.hasFlag('quest_lt_returned') },
        ],
        reward: { money: 15 },
        rewardText: '+$15, +5 Friendship with Elara',
        onComplete: () => { MetaState.addFriendship('prof_elara', 5); },
    },

    campus_cleanup: {
        id: 'campus_cleanup',
        name: 'Campus Cleanup',
        giver: null,
        desc: 'Help clean up the campus park. Visit the park twice to help out.',
        steps: [
            { key: 'visits', label: 'Visit the park (0/2)', target: 2, counter: true,
              check: () => (MetaState.getQuest('campus_cleanup')?.progress.visits || 0) >= 2 },
        ],
        reward: { mood: 10, money: 10 },
        rewardText: '+10 Mood, +$10',
    },

    book_donations: {
        id: 'book_donations',
        name: 'Book Donations',
        giver: null,
        desc: 'The library needs book donations. Bring 2 books to the library.',
        steps: [
            { key: 'books', label: 'Donate books (0/2)', target: 2, counter: true,
              check: () => (MetaState.getQuest('book_donations')?.progress.books || 0) >= 2 },
        ],
        reward: { knowledge: 15, mood: 5 },
        rewardText: '+15 Knowledge, +5 Mood',
    },

    campus_socialite: {
        id: 'campus_socialite',
        name: 'Campus Socialite',
        giver: null,
        desc: 'Make friends with everyone on campus.',
        steps: [
            { key: 'friends', label: 'Reach "Friend" with 3 NPCs', target: 3, counter: true,
              check: () => {
                  let count = 0;
                  for (const id of MetaState.state.npcsMetSet) {
                      if (MetaState.getFriendship(id) >= 50) count++;
                  }
                  return count >= 3;
              }},
        ],
        reward: { mood: 25, money: 40 },
        rewardText: '+25 Mood, +$40 — Popular!',
        startCondition: () => MetaState.state.npcsMetSet.length >= 2,
    },
};

const MetaQuests = {
    getQuest(id) {
        return QUESTS[id] || null;
    },

    getAllQuests() {
        return Object.values(QUESTS);
    },

    // Check for quests that should auto-start or become available.
    // Returns array of notification strings for newly started quests.
    checkForNewQuests() {
        const notifications = [];
        for (const quest of Object.values(QUESTS)) {
            if (MetaState.getQuest(quest.id)) continue; // already started or complete

            const shouldStart = quest.autoStart ||
                (quest.startCondition && quest.startCondition());

            if (shouldStart) {
                MetaState.startQuest(quest.id);
                notifications.push(`New Quest: ${quest.name}`);
            }
        }
        return notifications;
    },

    // Check active quests for completion. Returns notifications for newly completed quests.
    checkForCompletions() {
        const notifications = [];
        for (const quest of Object.values(QUESTS)) {
            if (!MetaState.isQuestActive(quest.id)) continue;

            const allDone = quest.steps.every(step => step.check());
            if (allDone) {
                MetaState.completeQuest(quest.id);
                // Apply rewards
                if (quest.reward.money) MetaState.addMoney(quest.reward.money);
                if (quest.reward.mood) MetaState.addMood(quest.reward.mood);
                if (quest.reward.knowledge) MetaState.addKnowledge(quest.reward.knowledge);
                if (quest.reward.energy) MetaState.addEnergy(quest.reward.energy);
                if (quest.onComplete) quest.onComplete();
                notifications.push(`Quest Complete: ${quest.name} — ${quest.rewardText}`);
            }
        }
        return notifications;
    },

    // Get active quests with their current progress for display.
    getActiveQuestsDisplay() {
        const active = [];
        for (const quest of Object.values(QUESTS)) {
            if (!MetaState.isQuestActive(quest.id)) continue;
            const steps = quest.steps.map(step => {
                const done = step.check();
                let label = step.label;
                if (step.counter && step.target) {
                    const qData = MetaState.getQuest(quest.id);
                    const current = qData?.progress[step.key] || 0;
                    // For quests tracking global state, use the actual value
                    let displayVal = current;
                    if (step.key === 'classes') displayVal = MetaState.state.classesAttended;
                    else if (step.key === 'shifts') displayVal = MetaState.state.shiftsWorked;
                    else if (step.key === 'friends') {
                        displayVal = 0;
                        for (const id of MetaState.state.npcsMetSet) {
                            if (MetaState.getFriendship(id) >= 50) displayVal++;
                        }
                    }
                    label = label.replace(/\(\d+\/\d+\)/, `(${Math.min(displayVal, step.target)}/${step.target})`);
                }
                return { label, done };
            });
            active.push({ id: quest.id, name: quest.name, desc: quest.desc, giver: quest.giver, steps, rewardText: quest.rewardText });
        }
        return active;
    },

    // Get completed quest count
    getCompletedQuests() {
        const completed = [];
        for (const quest of Object.values(QUESTS)) {
            if (MetaState.isQuestComplete(quest.id)) {
                completed.push({ id: quest.id, name: quest.name });
            }
        }
        return completed;
    },
};

export default MetaQuests;
