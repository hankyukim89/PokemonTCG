// Card instance wrapper — takes API card data and adds runtime game state

let nextUid = 1;

export class Card {
    constructor(cardData) {
        this.uid = nextUid++;
        this.data = cardData;

        // Runtime state
        this.damage = 0;
        this.attachedEnergy = []; // array of energy Card instances
        this.status = null; // 'poisoned', 'confused', 'paralyzed', 'asleep', 'burned'
        this.evolvedFrom = null; // Card instance this evolved from
        this.evolvedThisTurn = false;
        this.playedThisTurn = false;
        this.turnsSinceStatus = 0;
    }

    // Convenience getters
    get id() { return this.data.id; }
    get name() { return this.data.name; }
    get supertype() { return this.data.supertype; }
    get subtypes() { return this.data.subtypes; }
    get hp() { return this.data.hp; }
    get types() { return this.data.types; }
    get attacks() { return this.data.attacks; }
    get abilities() { return this.data.abilities; }
    get weaknesses() { return this.data.weaknesses; }
    get resistances() { return this.data.resistances; }
    get retreatCost() { return this.data.retreatCost; }
    get convertedRetreatCost() { return this.data.convertedRetreatCost; }
    get evolvesFrom() { return this.data.evolvesFrom; }
    get images() { return this.data.images; }
    get number() { return this.data.number; }
    get rarity() { return this.data.rarity; }

    get isPokemon() { return this.supertype === 'Pokémon'; }
    get isTrainer() { return this.supertype === 'Trainer'; }
    get isEnergy() { return this.supertype === 'Energy'; }
    get isBasic() { return this.subtypes?.includes('Basic'); }
    get isStage1() { return this.subtypes?.includes('Stage 1'); }
    get isStage2() { return this.subtypes?.includes('Stage 2'); }

    get remainingHp() {
        return this.hp ? this.hp - this.damage : null;
    }

    get isKnockedOut() {
        return this.hp && this.damage >= this.hp;
    }

    // Get total energy attached (by type)
    getEnergyCount(type = null) {
        if (!type) return this.attachedEnergy.length;
        return this.attachedEnergy.filter(e => {
            // Colorless energy counts for any type requirement
            if (e.name === 'Double Colorless Energy') return true;
            return e.types?.includes(type);
        }).length;
    }

    getEnergyByType() {
        const counts = {};
        this.attachedEnergy.forEach(e => {
            const type = e.types?.[0] || 'Colorless';
            counts[type] = (counts[type] || 0) + 1;
        });
        return counts;
    }

    // Check if this card can use a given attack based on attached energy
    canUseAttack(attackIndex) {
        const attack = this.attacks[attackIndex];
        if (!attack) return false;

        const energyCounts = {};
        this.attachedEnergy.forEach(e => {
            const type = e.types?.[0] || 'Colorless';
            energyCounts[type] = (energyCounts[type] || 0) + 1;
        });

        // Count total energy
        const totalEnergy = this.attachedEnergy.length;

        // Check attack cost requirements
        const costCounts = {};
        attack.cost.forEach(c => {
            costCounts[c] = (costCounts[c] || 0) + 1;
        });

        let colorlessNeeded = costCounts['Colorless'] || 0;
        let usedEnergy = 0;

        // First satisfy specific type requirements
        for (const [type, needed] of Object.entries(costCounts)) {
            if (type === 'Colorless') continue;
            const available = energyCounts[type] || 0;
            if (available < needed) return false;
            usedEnergy += needed;
        }

        // Then check if remaining energy covers colorless cost
        return (totalEnergy - usedEnergy) >= colorlessNeeded;
    }

    // Check if this pokemon can retreat (has enough energy)
    canRetreat() {
        return this.attachedEnergy.length >= this.convertedRetreatCost && !this.isParalyzed() && !this.isAsleep();
    }

    isParalyzed() { return this.status === 'paralyzed'; }
    isAsleep() { return this.status === 'asleep'; }
    isConfused() { return this.status === 'confused'; }
    isPoisoned() { return this.status === 'poisoned'; }

    canAttack() {
        return !this.isParalyzed() && !this.isAsleep();
    }

    // Reset per-turn state
    resetTurnFlags() {
        this.evolvedThisTurn = false;
        this.playedThisTurn = false;
        if (this.status === 'paralyzed') {
            this.turnsSinceStatus++;
            if (this.turnsSinceStatus >= 1) {
                this.status = null;
                this.turnsSinceStatus = 0;
            }
        }
    }

    // Clone for state display (not deep)
    toJSON() {
        return {
            uid: this.uid,
            id: this.id,
            name: this.name,
            supertype: this.supertype,
            subtypes: this.subtypes,
            hp: this.hp,
            damage: this.damage,
            remainingHp: this.remainingHp,
            types: this.types,
            attacks: this.attacks,
            abilities: this.abilities,
            weaknesses: this.weaknesses,
            resistances: this.resistances,
            retreatCost: this.retreatCost,
            attachedEnergy: this.attachedEnergy.map(e => e.name),
            status: this.status,
            images: this.images
        };
    }
}
