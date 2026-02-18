// Game State management — central game state class
import { Card } from './Card.js';

export const PHASES = {
    SETUP: 'setup',
    DRAW: 'draw',
    MAIN: 'main',
    ATTACK: 'attack',
    BETWEEN_TURNS: 'between_turns',
    GAME_OVER: 'game_over'
};

export class PlayerState {
    constructor(name, deckCards) {
        this.name = name;
        this.deck = [];
        this.hand = [];
        this.active = null;
        this.bench = [null, null, null, null, null]; // 5 bench slots
        this.prizes = [];
        this.discard = [];
        this.energyPlayedThisTurn = false;

        // Convert card data to Card instances and shuffle
        this.deck = deckCards.map(cd => new Card(cd));
        this.shuffleDeck();
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    drawCard() {
        if (this.deck.length === 0) return null;
        const card = this.deck.pop();
        this.hand.push(card);
        return card;
    }

    drawCards(count) {
        const drawn = [];
        for (let i = 0; i < count; i++) {
            const card = this.drawCard();
            if (!card) break;
            drawn.push(card);
        }
        return drawn;
    }

    getAllPokemonInPlay() {
        const pokemon = [];
        if (this.active) pokemon.push(this.active);
        this.bench.forEach(p => { if (p) pokemon.push(p); });
        return pokemon;
    }

    getBenchCount() {
        return this.bench.filter(p => p !== null).length;
    }

    getFirstEmptyBenchSlot() {
        return this.bench.findIndex(p => p === null);
    }

    removeFromHand(card) {
        const idx = this.hand.findIndex(c => c.uid === card.uid);
        if (idx !== -1) this.hand.splice(idx, 1);
    }

    hasBasicInHand() {
        return this.hand.some(c => c.isPokemon && c.isBasic);
    }

    resetTurnFlags() {
        this.energyPlayedThisTurn = false;
        this.getAllPokemonInPlay().forEach(p => p.resetTurnFlags());
    }
}

export class GameState {
    constructor(playerDeck, opponentDeck, playerName = 'Player', opponentName = 'Opponent') {
        this.player = new PlayerState(playerName, playerDeck);
        this.opponent = new PlayerState(opponentName, opponentDeck);
        this.currentTurn = null; // 'player' or 'opponent'
        this.phase = PHASES.SETUP;
        this.turnNumber = 0;
        this.winner = null;
        this.log = [];
        this.waitingForInput = null; // for UI interaction prompts
        this.coinFlipResult = null;
        this.firstTurn = true;
        this.plusPowerBonus = 0; // PlusPower bonus for current attack
        this.defenderBonus = 0; // Defender damage reduction
    }

    addLog(message) {
        this.log.push({ turn: this.turnNumber, message, timestamp: Date.now() });
    }

    getActivePlayer() {
        return this.currentTurn === 'player' ? this.player : this.opponent;
    }

    getInactivePlayer() {
        return this.currentTurn === 'player' ? this.opponent : this.player;
    }

    isPlayerTurn() {
        return this.currentTurn === 'player';
    }

    // ==================
    // SETUP PHASE
    // ==================

    setupGame() {
        this.addLog('Setting up the game...');

        // Both players draw 7 cards
        this.player.drawCards(7);
        this.opponent.drawCards(7);

        // Mulligan check — if no basic Pokémon, reshuffle
        let playerMulligans = 0;
        while (!this.player.hasBasicInHand()) {
            this.addLog(`${this.player.name} has no Basic Pokémon! Mulligan!`);
            // Return hand to deck and reshuffle
            this.player.deck = this.player.deck.concat(this.player.hand);
            this.player.hand = [];
            this.player.shuffleDeck();
            this.player.drawCards(7);
            playerMulligans++;
        }

        let opponentMulligans = 0;
        while (!this.opponent.hasBasicInHand()) {
            this.addLog(`${this.opponent.name} has no Basic Pokémon! Mulligan!`);
            this.opponent.deck = this.opponent.deck.concat(this.opponent.hand);
            this.opponent.hand = [];
            this.opponent.shuffleDeck();
            this.opponent.drawCards(7);
            opponentMulligans++;
        }

        // Opponent draws extra cards for player's mulligans
        if (playerMulligans > 0) {
            this.addLog(`${this.opponent.name} draws ${playerMulligans} extra card(s) for mulligans.`);
            this.opponent.drawCards(playerMulligans);
        }
        if (opponentMulligans > 0) {
            this.addLog(`${this.player.name} draws ${opponentMulligans} extra card(s) for mulligans.`);
            this.player.drawCards(opponentMulligans);
        }

        // Set up prize cards (6 each)
        for (let i = 0; i < 6; i++) {
            const pCard = this.player.deck.pop();
            if (pCard) this.player.prizes.push(pCard);
            const oCard = this.opponent.deck.pop();
            if (oCard) this.opponent.prizes.push(oCard);
        }

        this.addLog(`Prize cards set! Each player has ${this.player.prizes.length} prizes.`);
        this.phase = PHASES.SETUP;
    }

    // Flip coin to determine who goes first
    flipForFirst() {
        this.coinFlipResult = Math.random() < 0.5 ? 'heads' : 'tails';
        this.currentTurn = this.coinFlipResult === 'heads' ? 'player' : 'opponent';
        this.addLog(`Coin flip: ${this.coinFlipResult}! ${this.getActivePlayer().name} goes first!`);
        return this.coinFlipResult;
    }

    // ==================
    // TURN FLOW
    // ==================

    startTurn() {
        this.turnNumber++;
        const player = this.getActivePlayer();
        player.resetTurnFlags();
        this.plusPowerBonus = 0;
        this.defenderBonus = 0;
        this.addLog(`--- Turn ${this.turnNumber}: ${player.name}'s turn ---`);

        // Draw phase
        this.phase = PHASES.DRAW;
        const drawn = player.drawCard();
        if (!drawn) {
            this.addLog(`${player.name} can't draw — deck is empty!`);
            this.winner = this.currentTurn === 'player' ? 'opponent' : 'player';
            this.phase = PHASES.GAME_OVER;
            this.addLog(`${this.getInactivePlayer().name} wins! (opponent decked out)`);
            return;
        }
        this.addLog(`${player.name} drew a card.`);
        this.phase = PHASES.MAIN;
    }

    // ==================
    // MAIN PHASE ACTIONS
    // ==================

    canPlayBasic(card) {
        const player = this.getActivePlayer();
        if (!card.isPokemon || !card.isBasic) return false;
        if (!player.active) return true; // Need to set active first
        return player.getFirstEmptyBenchSlot() !== -1;
    }

    playBasic(card) {
        const player = this.getActivePlayer();
        player.removeFromHand(card);
        card.playedThisTurn = true;

        if (!player.active) {
            player.active = card;
            this.addLog(`${player.name} placed ${card.name} as Active Pokémon!`);
        } else {
            const slot = player.getFirstEmptyBenchSlot();
            if (slot === -1) return false;
            player.bench[slot] = card;
            this.addLog(`${player.name} placed ${card.name} on the Bench!`);
        }
        return true;
    }

    canEvolve(card, target) {
        if (!card.isPokemon) return false;
        if (!card.evolvesFrom) return false;
        if (target.playedThisTurn || target.evolvedThisTurn) return false;
        if (this.firstTurn) return false; // Can't evolve on first turn
        return target.name === card.evolvesFrom;
    }

    evolve(card, target) {
        const player = this.getActivePlayer();
        player.removeFromHand(card);

        card.evolvedFrom = target;
        card.attachedEnergy = target.attachedEnergy;
        card.damage = target.damage;
        card.evolvedThisTurn = true;
        // Evolution cures special conditions
        card.status = null;

        // Replace target with evolved card
        if (player.active && player.active.uid === target.uid) {
            player.active = card;
        } else {
            const benchIdx = player.bench.findIndex(p => p && p.uid === target.uid);
            if (benchIdx !== -1) player.bench[benchIdx] = card;
        }

        this.addLog(`${player.name} evolved ${target.name} into ${card.name}!`);
        return true;
    }

    canAttachEnergy(card) {
        const player = this.getActivePlayer();
        return card.isEnergy && !player.energyPlayedThisTurn;
    }

    attachEnergy(energyCard, targetPokemon) {
        const player = this.getActivePlayer();
        player.removeFromHand(energyCard);
        targetPokemon.attachedEnergy.push(energyCard);
        player.energyPlayedThisTurn = true;
        this.addLog(`${player.name} attached ${energyCard.name} to ${targetPokemon.name}.`);
        return true;
    }

    canAttack(attackIndex) {
        const player = this.getActivePlayer();
        if (!player.active) return false;
        if (!player.active.canAttack()) return false;
        return player.active.canUseAttack(attackIndex);
    }

    // ==================
    // ATTACK RESOLUTION
    // ==================

    executeAttack(attackIndex) {
        const attacker = this.getActivePlayer();
        const defender = this.getInactivePlayer();
        const attackingPokemon = attacker.active;
        const defendingPokemon = defender.active;
        const attack = attackingPokemon.attacks[attackIndex];

        this.addLog(`${attackingPokemon.name} used ${attack.name}!`);

        // Handle confusion check
        if (attackingPokemon.isConfused()) {
            const confusionFlip = Math.random() < 0.5 ? 'heads' : 'tails';
            this.addLog(`Confusion check: ${confusionFlip}!`);
            if (confusionFlip === 'tails') {
                attackingPokemon.damage += 30;
                this.addLog(`${attackingPokemon.name} hurt itself in confusion for 30 damage!`);
                this.phase = PHASES.BETWEEN_TURNS;
                this.endTurnEffects();
                return { confused: true };
            }
        }

        // Calculate base damage
        let baseDamage = 0;
        if (attack.damage) {
            // Parse damage string (e.g., "60", "30+", "10×")
            const dmgStr = attack.damage.replace(/[^0-9]/g, '');
            baseDamage = parseInt(dmgStr) || 0;
        }

        // Special attack effects (simplified for Base Set)
        const result = this.resolveAttackEffect(attack, attackingPokemon, defendingPokemon, baseDamage);
        baseDamage = result.damage;

        // Apply PlusPower
        baseDamage += this.plusPowerBonus;

        if (baseDamage > 0 && defendingPokemon) {
            // Apply weakness
            if (defendingPokemon.weaknesses) {
                for (const weakness of defendingPokemon.weaknesses) {
                    if (attackingPokemon.types?.includes(weakness.type)) {
                        baseDamage *= 2;
                        this.addLog(`It's super effective! (weakness)`);
                        break;
                    }
                }
            }

            // Apply resistance
            if (defendingPokemon.resistances) {
                for (const resistance of defendingPokemon.resistances) {
                    if (attackingPokemon.types?.includes(resistance.type)) {
                        baseDamage -= 30;
                        this.addLog(`Not very effective... (resistance -30)`);
                        break;
                    }
                }
            }

            // Apply Defender
            baseDamage -= this.defenderBonus;
            baseDamage = Math.max(0, baseDamage);

            defendingPokemon.damage += baseDamage;
            this.addLog(`${defendingPokemon.name} took ${baseDamage} damage! (${defendingPokemon.remainingHp} HP remaining)`);

            // Check KO
            if (defendingPokemon.isKnockedOut) {
                this.handleKnockout(defender, defendingPokemon, attacker);
            }
        }

        this.phase = PHASES.BETWEEN_TURNS;
        this.endTurnEffects();

        return { damage: baseDamage, ...result };
    }

    resolveAttackEffect(attack, attacker, defender, baseDamage) {
        const text = (attack.text || '').toLowerCase();
        let damage = baseDamage;
        let statusEffect = null;

        // Coin flip attacks
        if (text.includes('flip a coin') || text.includes('flip 2 coins')) {
            if (text.includes('tails, this attack does nothing')) {
                const flip = Math.random() < 0.5 ? 'heads' : 'tails';
                this.addLog(`Coin flip: ${flip}!`);
                if (flip === 'tails') {
                    damage = 0;
                    this.addLog(`The attack failed!`);
                    return { damage, statusEffect };
                }
            }
            if (text.includes('flip 2 coins')) {
                let heads = 0;
                for (let i = 0; i < 2; i++) {
                    if (Math.random() < 0.5) heads++;
                }
                this.addLog(`Flipped 2 coins: ${heads} heads!`);
                if (text.includes('damage for each heads')) {
                    damage = heads * baseDamage;
                }
            }
        }

        // Damage multipliers
        if (text.includes('times the number of')) {
            if (text.includes('energy')) {
                const count = attacker.attachedEnergy.length;
                damage = baseDamage * count;
                this.addLog(`${count} Energy cards attached — ${damage} damage!`);
            }
        }

        // Self-damage
        if (text.includes('does') && text.includes('damage to itself')) {
            const selfDmg = parseInt(text.match(/does (\d+) damage to itself/)?.[1] || '0');
            if (selfDmg) {
                attacker.damage += selfDmg;
                this.addLog(`${attacker.name} did ${selfDmg} damage to itself!`);
            }
        }

        // Status effects
        if (text.includes('paralyz')) {
            statusEffect = 'paralyzed';
            if (defender) {
                defender.status = 'paralyzed';
                defender.turnsSinceStatus = 0;
                this.addLog(`${defender.name} is now Paralyzed!`);
            }
        }
        if (text.includes('poison')) {
            statusEffect = 'poisoned';
            if (defender) {
                defender.status = 'poisoned';
                this.addLog(`${defender.name} is now Poisoned!`);
            }
        }
        if (text.includes('confus')) {
            statusEffect = 'confused';
            if (defender) {
                defender.status = 'confused';
                this.addLog(`${defender.name} is now Confused!`);
            }
        }
        if (text.includes('asleep') || text.includes('sleep')) {
            statusEffect = 'asleep';
            if (defender) {
                defender.status = 'asleep';
                this.addLog(`${defender.name} is now Asleep!`);
            }
        }

        // Healing
        if (text.includes('remove') && text.includes('damage counter')) {
            const healAmount = parseInt(text.match(/remove (\d+) damage/)?.[1] || '1') * 10;
            attacker.damage = Math.max(0, attacker.damage - healAmount);
            this.addLog(`${attacker.name} healed ${healAmount} damage!`);
        }

        // Discard energy cost
        if (text.includes('discard') && text.includes('energy')) {
            const discardCount = text.includes('all') ? attacker.attachedEnergy.length :
                (parseInt(text.match(/discard (\d+)/)?.[1]) || 1);
            const discarded = attacker.attachedEnergy.splice(0, discardCount);
            const player = this.getActivePlayer();
            player.discard.push(...discarded);
            this.addLog(`${attacker.name} discarded ${discarded.length} Energy card(s).`);
        }

        return { damage, statusEffect };
    }

    handleKnockout(ownerState, knockedOutPokemon, otherPlayerState) {
        this.addLog(`${knockedOutPokemon.name} was Knocked Out!`);

        // Move to discard with attached energy
        ownerState.discard.push(knockedOutPokemon);
        ownerState.discard.push(...knockedOutPokemon.attachedEnergy);
        knockedOutPokemon.attachedEnergy = [];

        // Remove from active/bench
        if (ownerState.active && ownerState.active.uid === knockedOutPokemon.uid) {
            ownerState.active = null;
        } else {
            const benchIdx = ownerState.bench.findIndex(p => p && p.uid === knockedOutPokemon.uid);
            if (benchIdx !== -1) ownerState.bench[benchIdx] = null;
        }

        // Prize collection
        if (otherPlayerState.prizes.length > 0) {
            const prize = otherPlayerState.prizes.pop();
            otherPlayerState.hand.push(prize);
            this.addLog(`${otherPlayerState.name} collected a Prize card! (${otherPlayerState.prizes.length} remaining)`);

            if (otherPlayerState.prizes.length === 0) {
                this.winner = otherPlayerState === this.player ? 'player' : 'opponent';
                this.phase = PHASES.GAME_OVER;
                this.addLog(`${otherPlayerState.name} wins! (all prizes collected)`);
            }
        }

        // Check if owner has no Pokémon left
        if (!ownerState.active && ownerState.bench.every(p => p === null)) {
            this.winner = otherPlayerState === this.player ? 'player' : 'opponent';
            this.phase = PHASES.GAME_OVER;
            this.addLog(`${otherPlayerState.name} wins! (opponent has no Pokémon left)`);
        }
    }

    // ==================
    // RETREAT
    // ==================

    canRetreat() {
        const player = this.getActivePlayer();
        if (!player.active) return false;
        if (!player.active.canRetreat()) return false;
        return player.bench.some(p => p !== null);
    }

    retreat(newActiveIndex) {
        const player = this.getActivePlayer();
        const oldActive = player.active;
        const newActive = player.bench[newActiveIndex];
        if (!newActive) return false;

        // Pay retreat cost — discard energy
        const cost = oldActive.convertedRetreatCost;
        const discarded = oldActive.attachedEnergy.splice(0, cost);
        player.discard.push(...discarded);

        // Swap
        player.bench[newActiveIndex] = oldActive;
        player.active = newActive;

        // Retreating clears status
        oldActive.status = null;

        this.addLog(`${player.name} retreated ${oldActive.name} and sent out ${newActive.name}! (discarded ${cost} energy)`);
        return true;
    }

    // ==================
    // BETWEEN-TURNS EFFECTS
    // ==================

    endTurnEffects() {
        // Apply poison damage
        const activePlayer = this.getActivePlayer();
        if (activePlayer.active?.isPoisoned()) {
            activePlayer.active.damage += 10;
            this.addLog(`${activePlayer.active.name} took 10 poison damage! (${activePlayer.active.remainingHp} HP)`);
            if (activePlayer.active.isKnockedOut) {
                this.handleKnockout(activePlayer, activePlayer.active, this.getInactivePlayer());
            }
        }

        // Sleep check
        if (activePlayer.active?.isAsleep()) {
            const flip = Math.random() < 0.5 ? 'heads' : 'tails';
            this.addLog(`Sleep check for ${activePlayer.active.name}: ${flip}!`);
            if (flip === 'heads') {
                activePlayer.active.status = null;
                this.addLog(`${activePlayer.active.name} woke up!`);
            }
        }

        if (this.phase !== PHASES.GAME_OVER) {
            this.endTurn();
        }
    }

    endTurn() {
        this.firstTurn = false;
        // Switch turns
        this.currentTurn = this.currentTurn === 'player' ? 'opponent' : 'player';
        this.phase = PHASES.MAIN;
    }

    // ==================
    // PROMOTE (after KO)
    // ==================

    needsToPromote(playerKey) {
        const state = playerKey === 'player' ? this.player : this.opponent;
        return !state.active && state.bench.some(p => p !== null);
    }

    promote(benchIndex) {
        const player = this.getActivePlayer();
        const pokemon = player.bench[benchIndex];
        if (!pokemon) return false;
        player.bench[benchIndex] = null;
        player.active = pokemon;
        this.addLog(`${player.name} promoted ${pokemon.name} to the Active position!`);
        return true;
    }

    // ==================
    // COIN FLIP UTILITY
    // ==================

    flipCoin() {
        return Math.random() < 0.5 ? 'heads' : 'tails';
    }
}
