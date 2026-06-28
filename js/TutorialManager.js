// TutorialManager.js — Gradual tutorial system for the sanctuary.
// Tracks progress through steps, gates toolbar buttons, and shows
// dialogue with Warden Maple to introduce game systems one by one.
// Used exclusively on the sanctuary side (GameScene + HUDScene).

import MetaDialogue from './MetaDialogue.js';

const STEPS = [
    {
        id: 'welcome',
        unlocks: ['build'],
        completesOnClose: true,
        dialogue: {
            speaker: 'Warden Maple',
            spriteKey: 'npc_maple',
            lines: [
                "Thanks for agreeing to take over things around here...",
                "I'm Warden Maple. I've been running Havenwood Sanctuary for years, but it's time I passed the torch.",
                "This place is home to all sorts of animals in need — and now it's your job to keep them safe and happy.",
                "Let me show you the ropes!",
            ],
        },
    },
    {
        id: 'build_habitat',
        unlocks: [],
        buildRestrictions: { categories: ['habitats'], items: ['meadow'] },
        dialogue: {
            speaker: 'Warden Maple',
            spriteKey: 'npc_maple',
            lines: [
                "First, we need a home for our animals.",
                "Tap Build on the bottom toolbar, then choose Habitats.",
                "A Meadow is a great start — use the move stick to aim at open grass, then tap Place!",
            ],
        },
        condition: (gs) => gs.state.habitats.length > 0,
    },
    {
        id: 'first_rescue',
        unlocks: [],
        buildRestrictions: { categories: ['habitats'] },
        dialogue: {
            speaker: 'Warden Maple',
            spriteKey: 'npc_maple',
            lines: [
                "Wonderful! You've built your first habitat!",
                "Now we need some animals. I've just gotten word about a rabbit that needs rescuing...",
                "Let me radio it in!",
            ],
        },
        onAfterDialogue: (gs) => {
            if (gs.state.animals.length === 0) {
                gs.time.delayedCall(600, () => gs.triggerRescue('rabbit'));
            }
        },
        condition: (gs) => gs.state.animals.length > 0,
    },
    {
        id: 'animal_care_zoom',
        unlocks: [],
        buildRestrictions: { categories: ['habitats'] },
        dialogue: {
            speaker: 'Warden Maple',
            spriteKey: 'npc_maple',
            lines: [
                "Welcome to the family, little one!",
                "Pan to a habitat with the move stick, then tap Interact to zoom in and see your animals up close.",
            ],
        },
        condition: (gs) => gs._tutorialZoomed,
    },
    {
        id: 'animal_care_feed',
        unlocks: [],
        buildRestrictions: { categories: ['habitats'] },
        dialogue: {
            speaker: 'Warden Maple',
            spriteKey: 'npc_maple',
            lines: [
                "There they are!",
                "Keep your animals fed and happy — hungry animals get sad, and sad animals can get sick!",
                "Tap Feed on the animal panel and feed them until their hunger bar is completely full!",
            ],
        },
        condition: (gs) => gs.state.animals.length > 0 && gs.state.animals[0].hunger >= 100,
    },
    {
        id: 'animal_care_pet',
        unlocks: [],
        buildRestrictions: { categories: ['habitats'] },
        dialogue: {
            speaker: 'Warden Maple',
            spriteKey: 'npc_maple',
            lines: [
                "Well done! A full belly makes for a happy critter.",
                "You can also pet your animals to build your bond and boost their happiness.",
                "Give them some love — pet them until their happiness bar is full!",
            ],
        },
        condition: (gs) => gs.state.animals.length > 0 && gs.state.animals[0].happiness >= 100,
    },
    {
        id: 'animal_care_treat',
        unlocks: [],
        buildRestrictions: { categories: ['habitats'] },
        dialogue: {
            speaker: 'Warden Maple',
            spriteKey: 'npc_maple',
            lines: [
                "You're a natural!",
                "One more thing — you can give your animals treats to raise their Bond level even faster.",
                "Treats cost a few coins, but a strong bond makes for a happier animal. Give it a try!",
            ],
        },
        condition: (gs) => gs._tutorialTreated,
    },
    {
        id: 'care_complete',
        unlocks: [],
        completesOnClose: true,
        dialogue: {
            speaker: 'Warden Maple',
            spriteKey: 'npc_maple',
            lines: [
                "Nice job! You're already a wonderful caretaker.",
                "Head back out and let's get the rest of the sanctuary set up!",
            ],
        },
    },
    {
        id: 'place_path',
        unlocks: [],
        requiresSanctuaryView: true,
        buildRestrictions: { categories: ['habitats', 'decorations'] },
        dialogue: {
            speaker: 'Warden Maple',
            spriteKey: 'npc_maple',
            lines: [
                "Visitors will start arriving soon to see the animals!",
                "Happy visitors donate more coins — but they need to find their way around.",
                "Open Build → Decorations. Use the move stick to aim, then tap Place on the map!",
            ],
        },
        condition: (gs) => gs.state.decorations.length > 0 && !gs.state.buildMode,
    },
    {
        id: 'dispatch_mission',
        unlocks: ['missions'],
        requiresSanctuaryView: true,
        dialogue: {
            speaker: 'Warden Maple',
            spriteKey: 'npc_maple',
            lines: [
                "Now that the sanctuary is taking shape, it's time to go find more animals!",
                "Tap Rescue on the bottom toolbar to open the Rescue Missions panel.",
                "From there you can dispatch a team to search different areas — each mission costs some coins and takes time, but you might find a new animal!",
                "Try launching a mission now!",
            ],
        },
        condition: (gs) => gs.state.activeMissions.length > 0 || gs.state.stats.missionsComplete > 0,
    },
    {
        id: 'visitors_and_more',
        unlocks: ['staff', 'upgrades', 'research', 'journal'],
        completesOnClose: true,
        dialogue: {
            speaker: 'Warden Maple',
            spriteKey: 'npc_maple',
            lines: [
                "Looking good! Paths help visitors navigate, and decorations make everyone happier.",
                "Rescue Missions are the main way you'll find new animals for the sanctuary — keep sending them out!",
                "As the sanctuary grows, hire Staff to help with chores, Research new techniques, and check out Upgrades.",
                "Your Journal will track every species you discover along the way.",
            ],
        },
    },
    {
        id: 'phone_unlock',
        unlocks: ['phone'],
        completesOnClose: true,
        dialogue: {
            speaker: 'Warden Maple',
            spriteKey: 'npc_maple',
            lines: [
                "One last thing before I head off...",
                "Here — take this phone. Something makes me think it might be important to you.",
                "Tap Phone on the bottom toolbar to try it out. Good luck, and take care of Havenwood!",
            ],
        },
    },
];

const TutorialManager = {
    step: 0,
    _dialogueShown: false,
    _dialogueLine: 0,
    _checking: false,
    _started: false,
    _rescueRetrying: false,

    reset() {
        this.step = 0;
        this._dialogueShown = false;
        this._dialogueLine = 0;
        this._checking = false;
        this._started = false;
        this._rescueRetrying = false;
    },

    /** Load tutorial state from save data. */
    load(step, dialogueShown, dialogueLine) {
        this.step = (step !== undefined && step !== null) ? step : STEPS.length;
        this._dialogueShown = dialogueShown || false;
        this._dialogueLine = dialogueLine || 0;
        this._checking = false;
        this._started = false;
        this._rescueRetrying = false;
    },

    isComplete() {
        return this.step >= STEPS.length;
    },

    getStepCount() {
        return STEPS.length;
    },

    currentStepId() {
        return STEPS[this.step]?.id || null;
    },

    /** True if the given toolbar button key has been unlocked by completed/current steps. */
    isButtonUnlocked(key) {
        if (this.isComplete()) return true;
        // Past steps: always unlocked
        for (let i = 0; i < this.step; i++) {
            if (STEPS[i].unlocks.includes(key)) return true;
        }
        const step = STEPS[this.step];
        if (!step) return false;
        if (step.id === 'phone_unlock' && key === 'phone') return true;
        if (this._dialogueShown && step.unlocks.includes(key)) return true;
        return false;
    },

    isPhoneUnlocked() {
        return this.isButtonUnlocked('phone');
    },

    /** Returns { categories, items } restrictions for the build menu, or null if unrestricted. */
    getBuildRestrictions() {
        if (this.isComplete()) return null;
        const step = STEPS[this.step];
        return step.buildRestrictions || null;
    },

    /** True if the player should be prevented from zooming out (during animal care steps). */
    shouldBlockZoomOut() {
        if (this.isComplete()) return false;
        const id = STEPS[this.step]?.id;
        return id === 'animal_care_zoom' || id === 'animal_care_feed' || id === 'animal_care_pet' || id === 'animal_care_treat';
    },

    /** Start the tutorial (new game or resumed from save). */
    start(hudScene) {
        if (this._started || this.isComplete()) return;
        this._started = true;
        this._dialogueShown = false;
        hudScene.time.delayedCall(800, () => this.check(hudScene));
    },

    /** Show dialogue for the current step or advance if condition met. */
    check(hudScene) {
        if (this._checking && !MetaDialogue.isActive()) this._checking = false;
        if (this.isComplete() || this._checking) return;
        if (MetaDialogue.isActive()) return;
        this._checking = true;
        const step = STEPS[this.step];

        // Wait until player is back at sanctuary level before showing dialogue
        if (step.requiresSanctuaryView && (hudScene.gs.state.viewingHabitat || hudScene.gs.state.viewingFacility)) {
            this._checking = false;
            return;
        }

        if (!this._dialogueShown) {
            MetaDialogue.show(hudScene, {
                ...step.dialogue,
                startLine: this._dialogueLine,
                onAdvanceLine: (line) => { this._dialogueLine = line; },
                onClose: () => {
                    if (step.onAfterDialogue) step.onAfterDialogue(hudScene.gs);
                    if (step.completesOnClose) {
                        this._checking = false;
                        this._advance(hudScene);
                    } else {
                        this._checking = false;
                    }
                },
            });
            this._dialogueShown = true;
            this._checking = false;
            hudScene.updateTutorialButtons();
            if (window.__havenwoodReportSnapshot) window.__havenwoodReportSnapshot(true);
            return;
        }

        // Condition already met (e.g. after reload)
        if (step.condition && step.condition(hudScene.gs)) {
            this._checking = false;
            this._advance(hudScene);
            return;
        }
        this._checking = false;
    },

    _advance(hudScene) {
        this.step++;
        this._dialogueShown = false;
        this._dialogueLine = 0;
        this._rescueRetrying = false;
        hudScene.updateTutorialButtons();
        hudScene.refreshTutorialPanels();
        if (window.__havenwoodReportSnapshot) window.__havenwoodReportSnapshot(true);
        if (!this.isComplete()) {
            hudScene.time.delayedCall(800, () => this.check(hudScene));
        }
    },

    /** Called every frame from HUDScene.update(). */
    update(hudScene) {
        if (this._checking && !MetaDialogue.isActive()) this._checking = false;
        if (this.isComplete() || !this._started) return;
        if (MetaDialogue.isActive()) return;
        const step = STEPS[this.step];

        // Retry showing dialogue if it hasn't appeared yet (e.g. waiting for sanctuary view)
        if (!this._dialogueShown) { this.check(hudScene); return; }

        // Check completion condition
        if (this._dialogueShown && step.condition && step.condition(hudScene.gs)) {
            this._advance(hudScene);
            return;
        }

        // Retry rescue if player declined during first_rescue step
        if (step.id === 'first_rescue' && this._dialogueShown && !this._rescueRetrying) {
            const gs = hudScene.gs;
            if (gs.state.animals.length === 0 && !gs.state.rescuePaused && !gs.state.pendingRescue) {
                this._rescueRetrying = true;
                hudScene.time.delayedCall(2000, () => {
                    this._rescueRetrying = false;
                    if (gs.state.animals.length === 0 && !gs.state.rescuePaused) {
                        gs.triggerRescue('rabbit');
                    }
                });
            }
        }
    },

    /** Replay Warden Maple's lines for the current step without advancing progress. */
    replayCurrentStep(hudScene) {
        if (this.isComplete() || MetaDialogue.isActive()) return;
        const step = STEPS[this.step];
        if (!step || !step.dialogue) return;
        MetaDialogue.show(hudScene, {
            ...step.dialogue,
            startLine: 0,
            onAdvanceLine: (line) => { this._dialogueLine = line; },
            onClose: () => {
                if (window.__havenwoodReportSnapshot) window.__havenwoodReportSnapshot(true);
            },
        });
        if (window.__havenwoodReportSnapshot) window.__havenwoodReportSnapshot(true);
    },

    getMobileProgressSnapshot() {
        return {
            complete: this.isComplete(),
            stepIndex: this.step,
            stepCount: this.getStepCount(),
        };
    },

    finishPhoneUnlock(hudScene) {
        if (this.isComplete() || this.currentStepId() !== 'phone_unlock') return;
        if (MetaDialogue.isActive()) MetaDialogue.close(hudScene);
        this._checking = false;
        if (!this._dialogueShown) this._dialogueShown = true;
        this._advance(hudScene);
    },
};

export { STEPS as TUTORIAL_STEPS };

export default TutorialManager;
