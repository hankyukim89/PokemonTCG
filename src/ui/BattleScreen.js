// Battle Screen — main game rendering and interaction loop
import { GameState, PHASES } from '../game/GameState.js';
import { playTrainer, TRAINER_EFFECTS } from '../game/TrainerEffects.js';
import { AI } from '../ai/AI.js';
import { createCardElement, showCardDetail, getEnergyOrbSrc } from './CardComponent.js';
import { createGameLog } from './GameLog.js';
import { showCoinFlip, showPromotionModal, showGameOver, showMessage } from './Modals.js';

export class BattleScreen {
    constructor(container, playerDeck, opponentDeck, allCards, onExit) {
        this.container = container;
        this.allCards = allCards;
        this.onExit = onExit;
        this.game = new GameState(playerDeck, opponentDeck, 'You', 'AI');
        this.ai = new AI(this.game);
        this.selectedCard = null;
        this.awaitingTarget = null; // 'energy'|'evolve'|null
        this.gameLog = null;
        this.init();
    }

    async init() {
        this.game.setupGame();
        this.render();
        this.gameLog = createGameLog(this.container);
        this.gameLog.syncLog(this.game.log);

        // Coin flip
        const result = this.game.flipForFirst();
        await showCoinFlip(this.container, result,
            this.game.isPlayerTurn() ? "You go first!" : "AI goes first!");

        // Setup phase — player places basics
        this.game.currentTurn = 'player';
        await this.playerSetup();

        // AI setup
        this.ai.setupInitialPokemon();
        this.game.addLog('AI set up their Pokémon.');

        // Start game
        this.game.currentTurn = result === 'heads' ? 'player' : 'opponent';
        if (this.game.isPlayerTurn()) {
            this.game.startTurn();
        } else {
            this.game.startTurn();
            await this.aiTurn();
        }
        this.renderBattle();
    }

    async playerSetup() {
        // Auto-place all basic Pokémon
        const basics = this.game.player.hand.filter(c => c.isPokemon && c.isBasic);
        if (basics.length === 0) return;

        // Sort by HP desc, place best as active
        basics.sort((a, b) => (b.hp || 0) - (a.hp || 0));
        this.game.currentTurn = 'player';

        for (const card of basics) {
            if (!this.game.player.active || this.game.player.getFirstEmptyBenchSlot() !== -1) {
                this.game.playBasic(card);
            }
        }
        await showMessage(this.container, `${this.game.player.active?.name} is your Active Pokémon!`, 1500);
    }

    render() {
        this.container.innerHTML = '<div class="battlefield" id="battlefield"></div>';
    }

    renderBattle() {
        const bf = document.getElementById('battlefield') || this.container;
        const g = this.game;
        const p = g.player;
        const o = g.opponent;
        const isPlayerTurn = g.isPlayerTurn() && g.phase !== PHASES.GAME_OVER;

        bf.innerHTML = `
      <!-- Opponent Side -->
      <div class="opponent-side">
        <div class="opponent-hand" id="opp-hand"></div>
        <div class="opponent-field">
          <div class="side-piles">
            <div class="pile"><div class="pile-label">Deck</div><div class="pile-count">${o.deck.length}</div>
              <div class="pile-card face-down"><img src="/images/cardback.jpg" alt="Deck"></div></div>
            <div class="pile"><div class="pile-label">Discard</div><div class="pile-count">${o.discard.length}</div></div>
          </div>
          <div class="center-field">
            <div class="bench-zone" id="opp-bench"></div>
            <div class="active-zone" id="opp-active"></div>
          </div>
          <div class="side-piles">
            <div class="pile"><div class="pile-label">Prizes</div>
              <div class="prize-grid" id="opp-prizes"></div></div>
          </div>
        </div>
      </div>

      <!-- Center Divider -->
      <div class="center-divider">
        <div class="turn-indicator ${isPlayerTurn ? 'your-turn' : 'opp-turn'}">
          ${g.phase === PHASES.GAME_OVER ? 'GAME OVER' :
                isPlayerTurn ? '⚔️ YOUR TURN' : '🔴 AI TURN'} — Turn ${g.turnNumber}
        </div>
      </div>

      <!-- Player Side -->
      <div class="player-side">
        <div class="player-field">
          <div class="side-piles">
            <div class="pile"><div class="pile-label">Prizes</div>
              <div class="prize-grid" id="player-prizes"></div></div>
          </div>
          <div class="center-field">
            <div class="active-zone" id="player-active"></div>
            <div class="bench-zone" id="player-bench"></div>
          </div>
          <div class="side-piles">
            <div class="pile"><div class="pile-label">Deck</div><div class="pile-count">${p.deck.length}</div>
              <div class="pile-card face-down"><img src="/images/cardback.jpg" alt="Deck"></div></div>
            <div class="pile"><div class="pile-label">Discard</div><div class="pile-count">${p.discard.length}</div></div>
          </div>
        </div>
        <div class="player-hand" id="player-hand"></div>
      </div>

      <!-- Action Bar (Buttons only) -->
      <div class="action-bar" id="action-bar"></div>
      
      <!-- Instruction Toast (Center Overlay) -->
      <div id="instruction-toast" class="instruction-toast"></div>`;

        this.renderCards();
        this.renderActionBar();
        this.gameLog?.syncLog(g.log);

        // Check game over
        if (g.phase === PHASES.GAME_OVER) {
            const isVictory = g.winner === 'player';
            const msg = g.log[g.log.length - 1]?.message || '';
            showGameOver(this.container, isVictory, msg,
                () => this.onExit('replay'),
                () => this.onExit('menu'));
        }
    }

    renderCards() {
        const g = this.game;
        const p = g.player;
        const o = g.opponent;

        // Opponent hand (face down)
        const oppHand = document.getElementById('opp-hand');
        for (let i = 0; i < o.hand.length; i++) {
            const el = document.createElement('div');
            el.className = 'card flipped';
            el.innerHTML = `<div class="card-inner"><div class="card-front"></div><div class="card-back"><img src="/images/cardback.jpg" alt="Card" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"></div></div>`;
            el.style.width = '48px'; el.style.height = '67px';
            oppHand.appendChild(el);
        }

        // Opponent active
        const oppActive = document.getElementById('opp-active');
        if (o.active) {
            oppActive.appendChild(createCardElement(o.active, {
                onContextMenu: (c) => showCardDetail(c, this.container),
                onClick: () => { } // No op left click
            }));
        }

        // Opponent bench
        const oppBench = document.getElementById('opp-bench');
        for (let i = 0; i < 5; i++) {
            if (o.bench[i]) {
                const slot = createCardElement(o.bench[i], {
                    onContextMenu: (c) => showCardDetail(c, this.container),
                    onClick: () => { } // No op left click
                });
                oppBench.appendChild(slot);
            } else {
                const empty = document.createElement('div');
                empty.className = 'bench-slot';
                oppBench.appendChild(empty);
            }
        }

        // Opponent prizes
        const oppPrizes = document.getElementById('opp-prizes');
        for (let i = 0; i < 6; i++) {
            const pc = document.createElement('div');
            pc.className = `prize-card ${i >= o.prizes.length ? 'collected' : ''}`;
            if (i < o.prizes.length) pc.innerHTML = `<img src="/images/cardback.jpg" alt="Prize">`;
            oppPrizes.appendChild(pc);
        }

        // Player active
        const playerActive = document.getElementById('player-active');
        if (p.active) {
            const el = createCardElement(p.active, {
                className: 'active-highlight',
                onClick: (c) => this.handleActiveClick(c),
                onContextMenu: (c) => this.handleCardContextMenu(c, 'active')
            });
            playerActive.appendChild(el);
        }

        // Player bench
        const playerBench = document.getElementById('player-bench');
        for (let i = 0; i < 5; i++) {
            if (p.bench[i]) {
                const slot = createCardElement(p.bench[i], {
                    onClick: (c) => this.handleBenchClick(c, i),
                    onContextMenu: (c) => this.handleCardContextMenu(c, 'bench')
                });
                if (this.awaitingTarget === 'energy' || this.awaitingTarget === 'evolve' || this.awaitingTarget === 'retreat') {
                    slot.classList.add('selectable');
                }
                playerBench.appendChild(slot);
            } else {
                const empty = document.createElement('div');
                empty.className = 'bench-slot';
                if (this.awaitingTarget === 'bench') {
                    empty.classList.add('droppable');
                    empty.addEventListener('click', () => this.handleEmptyBenchClick(i));
                }
                playerBench.appendChild(empty);
            }
        }

        // Player prizes
        const playerPrizes = document.getElementById('player-prizes');
        for (let i = 0; i < 6; i++) {
            const pc = document.createElement('div');
            pc.className = `prize-card ${i >= p.prizes.length ? 'collected' : ''}`;
            if (i < p.prizes.length) pc.innerHTML = `<img src="/images/cardback.jpg" alt="Prize">`;
            playerPrizes.appendChild(pc);
        }

        // Player hand
        const playerHand = document.getElementById('player-hand');
        const isPlayerTurn = g.isPlayerTurn() && g.phase === PHASES.MAIN;
        p.hand.forEach(card => {
            const el = createCardElement(card, {
                className: this.selectedCard?.uid === card.uid ? 'selected' : '',
                onClick: () => this.handleHandClick(card),
                onContextMenu: (c) => showCardDetail(c, this.container)
            });
            if (isPlayerTurn) el.classList.add('selectable');
            playerHand.appendChild(el);
        });
    }

    renderActionBar() {
        const bar = document.getElementById('action-bar');
        const toast = document.getElementById('instruction-toast');
        if (!bar) return;
        const g = this.game;
        const isPlayerTurn = g.isPlayerTurn() && g.phase === PHASES.MAIN;

        if (!isPlayerTurn) {
            bar.innerHTML = '';
            if (toast) toast.innerText = '⏳ Waiting for AI...';
            if (toast) toast.className = 'instruction-toast show';
            return;
        }

        let msg = '';
        if (this.awaitingTarget === 'energy') {
            msg = '⚡ Select a Pokémon to attach energy';
        } else if (this.awaitingTarget === 'bench') {
            msg = '👆 Select a bench slot';
        } else if (this.awaitingTarget === 'evolve') {
            msg = '🔄 Select a Pokémon to evolve';
        } else if (this.awaitingTarget === 'retreat') {
            msg = '↩ Select a bench Pokémon to swap';
        }

        if (toast) {
            toast.innerText = msg;
            toast.className = `instruction-toast ${msg ? 'show' : ''}`;
        }

        let html = '';
        // Only End Turn in sidebar now
        html += `<button class="btn btn-sm btn-gold" id="btn-end-turn">End Turn ▶</button>`;

        if (this.selectedCard) {
            html += `<button class="btn btn-sm" style="background:var(--bg-surface);color:var(--text-secondary)" id="btn-deselect">✕ Cancel</button>`;
        }

        bar.innerHTML = html;

        // Bind events
        bar.querySelector('#btn-end-turn')?.addEventListener('click', () => this.handleEndTurn());
        bar.querySelector('#btn-deselect')?.addEventListener('click', () => { this.selectedCard = null; this.awaitingTarget = null; this.renderBattle(); });
    }

    handleCardContextMenu(card, type) {
        // Generate actions if it's player active pokemon and player turn
        const actions = [];
        const g = this.game;

        if (g.isPlayerTurn() && g.phase === PHASES.MAIN && type === 'active') {
            // Attacks
            if (card.attacks) {
                card.attacks.forEach((atk, i) => {
                    const canUse = g.canAttack(i);
                    const cost = (atk.cost || []).map(c => getEnergyOrbSrc(c)).map(src => `<img src="${src}" style="width:14px;height:14px;vertical-align:middle">`).join('');
                    actions.push({
                        label: `${cost} ${atk.name} ${atk.damage || ''}`,
                        variant: 'primary',
                        disabled: !canUse,
                        action: () => this.handleAttack(i)
                    });
                });
            }

            // Retreat
            actions.push({
                label: '↩ Retreat',
                variant: 'secondary',
                disabled: !g.canRetreat(),
                action: () => this.handleRetreat()
            });
        }

        showCardDetail(card, this.container, null, actions);
    }

    handleHandClick(card) {
        if (!this.game.isPlayerTurn() || this.game.phase !== PHASES.MAIN) return;

        // If clicking same card again, deselect
        if (this.selectedCard?.uid === card.uid) {
            this.selectedCard = null;
            this.awaitingTarget = null;
            this.renderBattle();
            return;
        }

        // Energy — select and wait for target click
        if (card.isEnergy && this.game.canAttachEnergy(card)) {
            this.selectedCard = card;
            this.awaitingTarget = 'energy';
            this.renderBattle();
            // Basic Pokémon — select and wait for bench click
        } else if (card.isPokemon && card.isBasic && this.game.canPlayBasic(card)) {
            this.selectedCard = card;
            this.awaitingTarget = 'bench';
            this.renderBattle();
            // Evolvable Pokémon — select and wait for target
        } else if (card.isPokemon && card.evolvesFrom) {
            this.selectedCard = card;
            this.awaitingTarget = 'evolve';
            this.renderBattle();
            // Trainer — play immediately
        } else if (card.isTrainer) {
            const result = playTrainer(this.game, this.game.player, card);
            this.selectedCard = null;
            this.renderBattle();
        }
        // Left click no longer opens details
    }

    handleActiveClick(card) {
        if (!this.game.isPlayerTurn()) return;

        // Attach energy to active
        if (this.awaitingTarget === 'energy' && this.selectedCard) {
            this.game.attachEnergy(this.selectedCard, card);
            this.selectedCard = null;
            this.awaitingTarget = null;
            this.renderBattle();
            // Evolve active
        } else if (this.awaitingTarget === 'evolve' && this.selectedCard) {
            if (this.game.canEvolve(this.selectedCard, card)) {
                this.game.evolve(this.selectedCard, card);
                this.selectedCard = null;
                this.awaitingTarget = null;
                this.renderBattle();
            }
        }
        // Left click no longer opens details
    }

    handleBenchClick(card, benchIndex) {
        if (!this.game.isPlayerTurn()) return;

        if (this.awaitingTarget === 'energy' && this.selectedCard) {
            this.game.attachEnergy(this.selectedCard, card);
            this.selectedCard = null;
            this.awaitingTarget = null;
            this.renderBattle();
        } else if (this.awaitingTarget === 'evolve' && this.selectedCard) {
            if (card && this.game.canEvolve(this.selectedCard, card)) {
                this.game.evolve(this.selectedCard, card);
                this.selectedCard = null;
                this.awaitingTarget = null;
                this.renderBattle();
            }
        } else if (this.awaitingTarget === 'retreat') {
            this.game.retreat(benchIndex);
            this.selectedCard = null;
            this.awaitingTarget = null;
            this.renderBattle();
        }
        // Left click no longer opens details
    }

    handleEmptyBenchClick(slotIndex) {
        if (!this.game.isPlayerTurn()) return;

        // Place basic Pokémon from hand onto empty bench slot
        if (this.awaitingTarget === 'bench' && this.selectedCard) {
            this.game.playBasic(this.selectedCard);
            this.selectedCard = null;
            this.awaitingTarget = null;
            this.renderBattle();
        }
    }

    async handleAttack(attackIndex) {
        if (!this.game.canAttack(attackIndex)) return;

        this.game.executeAttack(attackIndex);
        this.selectedCard = null;
        this.awaitingTarget = null;

        // Check if defender needs to promote
        if (this.game.phase !== PHASES.GAME_OVER && this.game.needsToPromote('opponent')) {
            this.ai.choosePromotion();
        }

        // Check if player needs to promote
        if (this.game.phase !== PHASES.GAME_OVER && this.game.needsToPromote('player')) {
            this.renderBattle();
            await this.playerPromotion();
        }

        if (this.game.phase !== PHASES.GAME_OVER) {
            // AI turn
            this.game.startTurn();
            this.renderBattle();
            await this.aiTurn();
        }
        this.renderBattle();
    }

    handleRetreat() {
        if (!this.game.canRetreat()) return;
        this.awaitingTarget = 'retreat';
        this.renderBattle();
    }

    async handleEndTurn() {
        this.game.endTurnEffects();
        this.selectedCard = null;
        this.awaitingTarget = null;

        // Check promotions
        if (this.game.phase !== PHASES.GAME_OVER && this.game.needsToPromote('player')) {
            this.renderBattle();
            await this.playerPromotion();
        }

        if (this.game.phase !== PHASES.GAME_OVER) {
            this.game.startTurn();
            this.renderBattle();
            await this.aiTurn();
        }
        this.renderBattle();
    }

    async aiTurn() {
        if (this.game.phase === PHASES.GAME_OVER) return;
        this.renderBattle();
        await new Promise(r => setTimeout(r, 800));

        await this.ai.takeTurn((desc) => {
            this.renderBattle();
        });

        // Check promotions after AI turn
        if (this.game.phase !== PHASES.GAME_OVER && this.game.needsToPromote('player')) {
            this.renderBattle();
            await this.playerPromotion();
        }
        if (this.game.phase !== PHASES.GAME_OVER && this.game.needsToPromote('opponent')) {
            this.ai.choosePromotion();
        }

        // Player's turn starts
        if (this.game.phase !== PHASES.GAME_OVER) {
            this.game.startTurn();
        }
        this.renderBattle();
    }

    playerPromotion() {
        return new Promise(resolve => {
            showPromotionModal(this.container, this.game.player.bench, (idx) => {
                this.game.currentTurn = 'player';
                this.game.promote(idx);
                this.renderBattle();
                resolve();
            });
        });
    }
}
