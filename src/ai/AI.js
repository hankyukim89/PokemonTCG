// AI Opponent — Heuristic-based decision making
import { playTrainer, TRAINER_EFFECTS } from '../game/TrainerEffects.js';

export class AI {
    constructor(gameState) {
        this.game = gameState;
    }

    async takeTurn(onAction) {
        const player = this.game.opponent;
        const actions = [];

        // Small delay between actions for visual pacing
        const delay = (ms) => new Promise(r => setTimeout(r, ms));
        const act = async (desc) => {
            actions.push(desc);
            if (onAction) await onAction(desc);
            await delay(600);
        };

        // 1. Play basic Pokémon to fill bench
        await this.playBasics(player, act);

        // 2. Attach energy (once per turn)
        await this.attachEnergy(player, act);

        // 3. Try to evolve
        await this.tryEvolve(player, act);

        // 4. Use trainer cards
        await this.useTrainers(player, act);

        // 5. Consider retreat
        await this.considerRetreat(player, act);

        // 6. Attack if possible
        await this.tryAttack(player, act);

        return actions;
    }

    async playBasics(player, act) {
        const basics = player.hand.filter(c => c.isPokemon && c.isBasic);
        for (const card of basics) {
            if (!player.active) {
                this.game.playBasic(card);
                await act(`Played ${card.name} as Active`);
            } else if (player.getFirstEmptyBenchSlot() !== -1) {
                this.game.playBasic(card);
                await act(`Benched ${card.name}`);
            }
        }
    }

    async attachEnergy(player, act) {
        if (player.energyPlayedThisTurn) return;

        const energyCards = player.hand.filter(c => c.isEnergy);
        if (energyCards.length === 0) return;

        // Priority: active that needs energy for attack > bench that needs energy
        const target = this.getBestEnergyTarget(player);
        if (!target) return;

        // Find best matching energy
        let bestEnergy = null;
        const neededTypes = this.getNeededEnergyTypes(target);

        for (const energy of energyCards) {
            const energyType = energy.types?.[0] || 'Colorless';
            if (neededTypes.includes(energyType)) {
                bestEnergy = energy;
                break;
            }
        }
        if (!bestEnergy) bestEnergy = energyCards[0];

        this.game.attachEnergy(bestEnergy, target);
        await act(`Attached ${bestEnergy.name} to ${target.name}`);
    }

    getBestEnergyTarget(player) {
        const allPokemon = player.getAllPokemonInPlay();

        // Score each Pokémon
        let bestTarget = null;
        let bestScore = -1;

        for (const p of allPokemon) {
            let score = 0;

            // Active Pokémon gets priority
            if (player.active?.uid === p.uid) score += 50;

            // Pokémon close to being able to attack
            if (p.attacks) {
                for (const attack of p.attacks) {
                    const needed = attack.convertedEnergyCost - p.attachedEnergy.length;
                    if (needed === 1) score += 30; // One energy away from attacking
                    else if (needed === 0) score += 5; // Already can attack
                    else score += Math.max(0, 20 - needed * 5);
                }
            }

            // Higher HP = better target
            score += (p.hp || 0) / 10;

            if (score > bestScore) {
                bestScore = score;
                bestTarget = p;
            }
        }

        return bestTarget;
    }

    getNeededEnergyTypes(pokemon) {
        const types = [];
        if (!pokemon.attacks) return types;

        for (const attack of pokemon.attacks) {
            for (const cost of attack.cost) {
                if (cost !== 'Colorless') types.push(cost);
            }
        }
        return [...new Set(types)];
    }

    async tryEvolve(player, act) {
        if (this.game.firstTurn) return;

        const evolvable = player.hand.filter(c => c.isPokemon && c.evolvesFrom);
        for (const card of evolvable) {
            const targets = player.getAllPokemonInPlay();
            for (const target of targets) {
                if (this.game.canEvolve(card, target)) {
                    this.game.evolve(card, target);
                    await act(`Evolved ${target.name} into ${card.name}`);
                    break;
                }
            }
        }
    }

    async useTrainers(player, act) {
        // Prioritized trainer usage
        const trainerPriority = [
            'Bill', 'Professor Oak', 'Computer Search',
            'PlusPower', 'Energy Removal', 'Super Energy Removal',
            'Gust of Wind', 'Full Heal', 'Potion', 'Super Potion',
            'Switch', 'Defender'
        ];

        for (const trainerName of trainerPriority) {
            const card = player.hand.find(c => c.name === trainerName);
            if (card && TRAINER_EFFECTS[trainerName]) {
                // Decision logic
                if (this.shouldUseTrainer(trainerName, player)) {
                    const result = playTrainer(this.game, player, card);
                    if (result) {
                        await act(`Used ${trainerName}`);
                    }
                }
            }
        }
    }

    shouldUseTrainer(name, player) {
        const opponent = this.game.getInactivePlayer();

        switch (name) {
            case 'Bill':
                return player.hand.length < 6;
            case 'Professor Oak':
                return player.hand.length <= 2;
            case 'Energy Removal':
            case 'Super Energy Removal':
                return opponent.getAllPokemonInPlay().some(p => p.attachedEnergy.length > 0);
            case 'PlusPower':
                return player.active?.attacks?.length > 0;
            case 'Gust of Wind':
                // Pull a weak Pokémon to active
                return opponent.bench.some(p => p && p.remainingHp < 40);
            case 'Full Heal':
                return player.active?.status !== null;
            case 'Potion':
            case 'Super Potion':
                return player.getAllPokemonInPlay().some(p => p.damage > 0);
            case 'Switch':
                return player.active && player.active.remainingHp < 30 && player.bench.some(p => p && p.remainingHp > 30);
            case 'Defender':
                return true;
            default:
                return true;
        }
    }

    async considerRetreat(player, act) {
        if (!player.active || !this.game.canRetreat()) return;

        const active = player.active;
        // Retreat if active is weak and can't attack
        const shouldRetreat = (
            (active.remainingHp <= 20) ||
            (active.status === 'paralyzed') ||
            (active.status === 'confused' && active.remainingHp <= 40) ||
            (!active.attacks?.some((_, i) => active.canUseAttack(i)) && active.attachedEnergy.length >= active.convertedRetreatCost)
        );

        if (!shouldRetreat) return;

        // Find best bench Pokémon to swap in
        let bestIdx = -1;
        let bestScore = -1;

        for (let i = 0; i < player.bench.length; i++) {
            const p = player.bench[i];
            if (!p) continue;
            let score = p.remainingHp || 0;
            if (p.attacks?.some((_, j) => p.canUseAttack(j))) score += 50;
            if (p.attachedEnergy.length > 0) score += 20;
            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }

        if (bestIdx !== -1 && bestScore > 30) {
            this.game.retreat(bestIdx);
            await act(`Retreated ${active.name}, sent out ${player.active.name}`);
        }
    }

    async tryAttack(player, act) {
        if (!player.active || this.game.phase === 'game_over') return;
        if (!player.active.canAttack()) {
            await act(`${player.active.name} can't attack (${player.active.status || 'no attacks'})!`);
            this.game.endTurnEffects();
            return;
        }

        // Find best attack
        let bestAttackIdx = -1;
        let bestDamage = -1;

        for (let i = 0; i < player.active.attacks.length; i++) {
            if (player.active.canUseAttack(i)) {
                const attack = player.active.attacks[i];
                const dmg = parseInt(attack.damage?.replace(/[^0-9]/g, '') || '0');
                if (dmg > bestDamage) {
                    bestDamage = dmg;
                    bestAttackIdx = i;
                }
            }
        }

        if (bestAttackIdx !== -1) {
            this.game.executeAttack(bestAttackIdx);
            await act(`${player.active.name} used ${player.active.attacks[bestAttackIdx].name}!`);
        } else {
            // No usable attack — end turn
            await act(`${player.active.name} can't use any attacks. Passing.`);
            this.game.endTurnEffects();
        }
    }

    // Setup phase: choose which basics to place
    setupInitialPokemon() {
        const player = this.game.opponent;
        const basics = player.hand.filter(c => c.isPokemon && c.isBasic);

        if (basics.length === 0) return;

        // Sort by HP descending — best Pokémon as active
        basics.sort((a, b) => (b.hp || 0) - (a.hp || 0));

        // Place first as active
        this.game.currentTurn = 'opponent';
        this.game.playBasic(basics[0]);

        // Place rest on bench
        for (let i = 1; i < basics.length && i <= 5; i++) {
            if (player.getFirstEmptyBenchSlot() !== -1) {
                this.game.playBasic(basics[i]);
            }
        }
    }

    // After a KO, choose which bench Pokémon to promote
    choosePromotion() {
        const player = this.game.opponent;
        let bestIdx = -1;
        let bestScore = -1;

        for (let i = 0; i < player.bench.length; i++) {
            const p = player.bench[i];
            if (!p) continue;
            let score = p.remainingHp || 0;
            if (p.attacks?.some((_, j) => p.canUseAttack(j))) score += 100;
            if (p.attachedEnergy.length > 0) score += 30;
            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }

        if (bestIdx !== -1) {
            this.game.promote(bestIdx);
        }
    }
}
