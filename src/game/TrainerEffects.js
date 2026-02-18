// Trainer card effect implementations for Base Set
// Each function takes (gameState, playerState, card) and returns true if effect was resolved

export const TRAINER_EFFECTS = {
    // Bill — Draw 2 cards
    'Bill': (game, player) => {
        const drawn = player.drawCards(2);
        game.addLog(`Bill: Drew ${drawn.length} cards.`);
        return true;
    },

    // Professor Oak — Discard hand, draw 7
    'Professor Oak': (game, player) => {
        const discardCount = player.hand.length;
        player.discard.push(...player.hand.filter(c => c.name !== 'Professor Oak'));
        player.hand = [];
        const drawn = player.drawCards(7);
        game.addLog(`Professor Oak: Discarded ${discardCount - 1} cards, drew ${drawn.length}.`);
        return true;
    },

    // Energy Removal — Remove 1 energy from opponent's Pokémon
    'Energy Removal': (game, player, card, targetInfo) => {
        const opponent = game.getInactivePlayer();
        const allOppPokemon = opponent.getAllPokemonInPlay();
        const target = allOppPokemon.find(p => p.attachedEnergy.length > 0);
        if (!target) {
            game.addLog('Energy Removal: No valid target.');
            return false;
        }
        const removed = target.attachedEnergy.pop();
        opponent.discard.push(removed);
        game.addLog(`Energy Removal: Removed ${removed.name} from ${target.name}.`);
        return true;
    },

    // Super Energy Removal — Discard 1 of your Energy, remove 2 from opponent
    'Super Energy Removal': (game, player) => {
        const myPokemon = player.getAllPokemonInPlay().find(p => p.attachedEnergy.length > 0);
        const opponent = game.getInactivePlayer();
        const oppPokemon = opponent.getAllPokemonInPlay().find(p => p.attachedEnergy.length > 0);
        if (!myPokemon || !oppPokemon) return false;

        // Discard 1 of own
        const myRemoved = myPokemon.attachedEnergy.pop();
        player.discard.push(myRemoved);

        // Remove up to 2 from opponent
        const count = Math.min(2, oppPokemon.attachedEnergy.length);
        const removed = oppPokemon.attachedEnergy.splice(0, count);
        opponent.discard.push(...removed);

        game.addLog(`Super Energy Removal: Discarded own ${myRemoved.name}, removed ${count} energy from ${oppPokemon.name}.`);
        return true;
    },

    // Gust of Wind — Switch opponent's active with a benched Pokémon
    'Gust of Wind': (game, player) => {
        const opponent = game.getInactivePlayer();
        const benchPokemon = opponent.bench.filter(p => p !== null);
        if (benchPokemon.length === 0) return false;

        // Pick random bench for AI / first for simplicity
        const targetIdx = opponent.bench.findIndex(p => p !== null);
        const oldActive = opponent.active;
        opponent.active = opponent.bench[targetIdx];
        opponent.bench[targetIdx] = oldActive;
        game.addLog(`Gust of Wind: ${opponent.active.name} is now the Active Pokémon!`);
        return true;
    },

    // Switch — Switch your active with a benched Pokémon
    'Switch': (game, player) => {
        const benchPokemon = player.bench.filter(p => p !== null);
        if (benchPokemon.length === 0 || !player.active) return false;

        const targetIdx = player.bench.findIndex(p => p !== null);
        const oldActive = player.active;
        player.active = player.bench[targetIdx];
        player.bench[targetIdx] = oldActive;
        // Switch removes status
        oldActive.status = null;
        game.addLog(`Switch: Swapped ${oldActive.name} with ${player.active.name}.`);
        return true;
    },

    // Potion — Remove up to 20 damage from 1 Pokémon
    'Potion': (game, player) => {
        const pokemon = player.getAllPokemonInPlay().find(p => p.damage > 0);
        if (!pokemon) return false;
        const healed = Math.min(20, pokemon.damage);
        pokemon.damage -= healed;
        game.addLog(`Potion: Healed ${healed} damage from ${pokemon.name}.`);
        return true;
    },

    // Super Potion — Discard 1 Energy, remove up to 40 damage
    'Super Potion': (game, player) => {
        const pokemon = player.getAllPokemonInPlay().find(p => p.damage > 0 && p.attachedEnergy.length > 0);
        if (!pokemon) return false;
        const removed = pokemon.attachedEnergy.pop();
        player.discard.push(removed);
        const healed = Math.min(40, pokemon.damage);
        pokemon.damage -= healed;
        game.addLog(`Super Potion: Discarded ${removed.name}, healed ${healed} from ${pokemon.name}.`);
        return true;
    },

    // PlusPower — Attacks do 10 more damage this turn
    'PlusPower': (game, player) => {
        game.plusPowerBonus += 10;
        game.addLog(`PlusPower: Next attack does 10 more damage.`);
        return true;
    },

    // Defender — Active takes 20 less damage next turn
    'Defender': (game, player) => {
        game.defenderBonus += 20;
        game.addLog(`Defender: Active Pokémon takes 20 less damage.`);
        return true;
    },

    // Full Heal — Remove status condition
    'Full Heal': (game, player) => {
        if (player.active && player.active.status) {
            game.addLog(`Full Heal: Cured ${player.active.name}'s ${player.active.status}!`);
            player.active.status = null;
            return true;
        }
        return false;
    },

    // Revive — Put a Basic from discard onto bench with half HP
    'Revive': (game, player) => {
        const basic = player.discard.find(c => c.isPokemon && c.isBasic);
        if (!basic || player.getFirstEmptyBenchSlot() === -1) return false;
        const idx = player.discard.indexOf(basic);
        player.discard.splice(idx, 1);
        basic.damage = Math.floor(basic.hp / 2);
        const slot = player.getFirstEmptyBenchSlot();
        player.bench[slot] = basic;
        game.addLog(`Revive: ${basic.name} returned to the Bench with ${basic.remainingHp} HP!`);
        return true;
    },

    // Maintenance — Shuffle 2 cards from hand into deck, draw 1
    'Maintenance': (game, player) => {
        if (player.hand.length < 3) return false; // need 2 + the trainer itself
        // Return first 2 non-trainer cards to deck
        let returned = 0;
        for (let i = player.hand.length - 1; i >= 0 && returned < 2; i--) {
            if (player.hand[i].name !== 'Maintenance') {
                player.deck.push(player.hand[i]);
                player.hand.splice(i, 1);
                returned++;
            }
        }
        player.shuffleDeck();
        player.drawCard();
        game.addLog(`Maintenance: Shuffled 2 cards into deck, drew 1.`);
        return true;
    },

    // Computer Search — Discard 2 cards, search deck for any card
    'Computer Search': (game, player) => {
        if (player.hand.length < 3) return false;
        // Discard first 2 non-trainer
        let discarded = 0;
        for (let i = player.hand.length - 1; i >= 0 && discarded < 2; i--) {
            if (player.hand[i].name !== 'Computer Search') {
                player.discard.push(player.hand[i]);
                player.hand.splice(i, 1);
                discarded++;
            }
        }
        // Take first card from deck (simplified — should let player choose)
        if (player.deck.length > 0) {
            const card = player.deck.pop();
            player.hand.push(card);
            game.addLog(`Computer Search: Discarded 2, found ${card.name}!`);
        }
        return true;
    },

    // Item Finder — Discard 2 cards, get a Trainer from discard
    'Item Finder': (game, player) => {
        if (player.hand.length < 3) return false;
        const trainer = player.discard.find(c => c.isTrainer);
        if (!trainer) return false;

        let discarded = 0;
        for (let i = player.hand.length - 1; i >= 0 && discarded < 2; i--) {
            if (player.hand[i].name !== 'Item Finder') {
                player.discard.push(player.hand[i]);
                player.hand.splice(i, 1);
                discarded++;
            }
        }
        const idx = player.discard.indexOf(trainer);
        player.discard.splice(idx, 1);
        player.hand.push(trainer);
        game.addLog(`Item Finder: Retrieved ${trainer.name} from discard.`);
        return true;
    },

    // Pokémon Trader — Swap a Pokémon from hand with one from deck
    'Pokémon Trader': (game, player) => {
        const handPokemon = player.hand.find(c => c.isPokemon);
        const deckPokemon = player.deck.find(c => c.isPokemon);
        if (!handPokemon || !deckPokemon) return false;

        const handIdx = player.hand.indexOf(handPokemon);
        const deckIdx = player.deck.indexOf(deckPokemon);
        player.hand.splice(handIdx, 1);
        player.deck.push(handPokemon);
        player.deck.splice(deckIdx, 1);
        player.hand.push(deckPokemon);
        player.shuffleDeck();
        game.addLog(`Pokémon Trader: Traded ${handPokemon.name} for ${deckPokemon.name}.`);
        return true;
    },

    // Pokémon Breeder — Evolve Basic directly to Stage 2 (skip Stage 1)
    'Pokémon Breeder': (game, player) => {
        // Find a Stage 2 in hand and a matching Basic in play
        const stage2 = player.hand.find(c => c.isPokemon && c.isStage2);
        if (!stage2) return false;

        // Find a basic that can eventually evolve to this Stage 2
        const target = player.getAllPokemonInPlay().find(p => {
            if (!p.isBasic || p.playedThisTurn) return false;
            // Check evolution chain
            return stage2.evolvesFrom && p.evolvesTo?.includes(stage2.evolvesFrom);
        });

        if (!target) return false;

        player.removeFromHand(stage2);
        stage2.evolvedFrom = target;
        stage2.attachedEnergy = target.attachedEnergy;
        stage2.damage = target.damage;
        stage2.evolvedThisTurn = true;
        stage2.status = null;

        if (player.active?.uid === target.uid) {
            player.active = stage2;
        } else {
            const idx = player.bench.findIndex(p => p?.uid === target.uid);
            if (idx !== -1) player.bench[idx] = stage2;
        }
        game.addLog(`Pokémon Breeder: Evolved ${target.name} directly into ${stage2.name}!`);
        return true;
    },

    // Pokémon Center — Heal all damage from all your Pokémon, discard all Energy from healed Pokémon
    'Pokémon Center': (game, player) => {
        const pokemon = player.getAllPokemonInPlay().filter(p => p.damage > 0);
        if (pokemon.length === 0) return false;

        pokemon.forEach(p => {
            p.damage = 0;
            player.discard.push(...p.attachedEnergy);
            p.attachedEnergy = [];
        });
        game.addLog(`Pokémon Center: Healed ${pokemon.length} Pokémon (discarded all their Energy).`);
        return true;
    },

    // Scoop Up — Return Pokémon and all cards attached to it to hand
    'Scoop Up': (game, player) => {
        // Prefer a damaged Pokémon on bench
        let target = null;
        let benchIdx = -1;
        for (let i = 0; i < player.bench.length; i++) {
            if (player.bench[i] && player.bench[i].damage > 0) {
                target = player.bench[i];
                benchIdx = i;
                break;
            }
        }
        if (!target && player.active?.damage > 0 && player.bench.some(p => p)) {
            target = player.active;
        }
        if (!target) return false;

        // Return to hand
        player.hand.push(target);
        player.hand.push(...target.attachedEnergy);
        target.attachedEnergy = [];
        target.damage = 0;
        target.status = null;

        if (player.active?.uid === target.uid) {
            player.active = null;
            const newActiveIdx = player.bench.findIndex(p => p !== null);
            if (newActiveIdx !== -1) {
                player.active = player.bench[newActiveIdx];
                player.bench[newActiveIdx] = null;
            }
        } else {
            player.bench[benchIdx] = null;
        }

        game.addLog(`Scoop Up: Returned ${target.name} to hand.`);
        return true;
    },

    // Lass — Both players reveal hands, shuffle all Trainers back
    'Lass': (game, player) => {
        const opponent = game.getInactivePlayer();

        const pTrainers = player.hand.filter(c => c.isTrainer && c.name !== 'Lass');
        pTrainers.forEach(c => {
            player.hand.splice(player.hand.indexOf(c), 1);
            player.deck.push(c);
        });

        const oTrainers = opponent.hand.filter(c => c.isTrainer);
        oTrainers.forEach(c => {
            opponent.hand.splice(opponent.hand.indexOf(c), 1);
            opponent.deck.push(c);
        });

        player.shuffleDeck();
        opponent.shuffleDeck();
        game.addLog(`Lass: Shuffled ${pTrainers.length + oTrainers.length} Trainer cards back into decks.`);
        return true;
    },

    // Imposter Professor Oak — Opponent shuffles hand into deck, draws 7
    'Imposter Professor Oak': (game, player) => {
        const opponent = game.getInactivePlayer();
        opponent.deck.push(...opponent.hand);
        opponent.hand = [];
        opponent.shuffleDeck();
        opponent.drawCards(7);
        game.addLog(`Imposter Professor Oak: Opponent shuffled hand and drew 7!`);
        return true;
    },

    // Devolution Spray — Devolve your Pokémon
    'Devolution Spray': (game, player) => {
        const evolved = player.getAllPokemonInPlay().find(p => p.evolvedFrom);
        if (!evolved) return false;

        const basic = evolved.evolvedFrom;
        basic.attachedEnergy = evolved.attachedEnergy;
        basic.damage = evolved.damage;

        if (player.active?.uid === evolved.uid) {
            player.active = basic;
        } else {
            const idx = player.bench.findIndex(p => p?.uid === evolved.uid);
            if (idx !== -1) player.bench[idx] = basic;
        }
        player.hand.push(evolved);
        evolved.attachedEnergy = [];
        evolved.evolvedFrom = null;

        game.addLog(`Devolution Spray: ${evolved.name} devolved back to ${basic.name}.`);
        return true;
    },

    // Clefairy Doll / Mysterious Fossil — Place as Basic Pokémon
    'Clefairy Doll': (game, player, card) => {
        if (player.getFirstEmptyBenchSlot() === -1 && player.active) return false;
        card.data.hp = 10;
        card.data.supertype = 'Pokémon';
        card.data.subtypes = ['Basic'];
        if (!player.active) {
            player.active = card;
        } else {
            const slot = player.getFirstEmptyBenchSlot();
            player.bench[slot] = card;
        }
        game.addLog(`Clefairy Doll placed on the field!`);
        return true;
    },
};

export function playTrainer(game, player, card) {
    const effect = TRAINER_EFFECTS[card.name];
    if (effect) {
        player.removeFromHand(card);
        const result = effect(game, player, card);
        if (result) {
            player.discard.push(card);
        } else {
            player.hand.push(card); // Return to hand if effect couldn't resolve
        }
        return result;
    }
    game.addLog(`${card.name}: No effect implemented yet.`);
    player.removeFromHand(card);
    player.discard.push(card);
    return true;
}
