// Deck Builder Screen
import { createCardElement, showCardDetail } from './CardComponent.js';

const PRESET_DECKS = {
    'Fire Blast': {
        desc: 'Charizard evolution line + fire basics', cards: {
            'Charmander': 4, 'Charmeleon': 3, 'Charizard': 2, 'Vulpix': 3, 'Ninetales': 2, 'Ponyta': 3, 'Magmar': 2, 'Growlithe': 2,
            'Bill': 4, 'Professor Oak': 2, 'Switch': 2, 'Potion': 2, 'Energy Removal': 2, 'PlusPower': 2, 'Gust of Wind': 1,
            'Fire Energy': 16, 'Double Colorless Energy': 2
        }
    },
    'Raindance': {
        desc: 'Blastoise rain dance water deck', cards: {
            'Squirtle': 4, 'Wartortle': 3, 'Blastoise': 2, 'Seel': 3, 'Dewgong': 2, 'Staryu': 3, 'Starmie': 2, 'Poliwag': 2, 'Magikarp': 1,
            'Bill': 4, 'Professor Oak': 2, 'Switch': 2, 'Potion': 2, 'Energy Removal': 2, 'PlusPower': 1,
            'Water Energy': 18, 'Double Colorless Energy': 2
        }
    },
    'Haymaker': {
        desc: 'Fast basic attackers', cards: {
            'Hitmonchan': 4, 'Electabuzz': 4, 'Mewtwo': 3, 'Zapdos': 2, 'Machop': 3, 'Diglett': 2, 'Rattata': 2,
            'Bill': 4, 'Professor Oak': 2, 'Gust of Wind': 3, 'Energy Removal': 3, 'PlusPower': 3, 'Switch': 2, 'Potion': 1,
            'Fighting Energy': 8, 'Lightning Energy': 6, 'Psychic Energy': 4, 'Double Colorless Energy': 4
        }
    }
};

export function renderDeckBuilder(container, allCards, callbacks) {
    let deck = {}; // cardId -> count
    let filter = 'all';
    let selectedCardId = null;

    function getDeckCount() { return Object.values(deck).reduce((a, b) => a + b, 0); }

    function render() {
        const filtered = filter === 'all' ? allCards :
            allCards.filter(c => {
                if (filter === 'pokemon') return c.supertype === 'Pokémon';
                if (filter === 'trainer') return c.supertype === 'Trainer';
                if (filter === 'energy') return c.supertype === 'Energy';
                return true;
            });

        container.innerHTML = `
      <div class="deck-builder">
        <div class="card-pool">
          <div class="card-pool-header">
            <h2>Base Set Cards</h2>
            <div class="filter-bar">
              <button class="filter-btn ${filter === 'all' ? 'active' : ''}" data-filter="all">All</button>
              <button class="filter-btn ${filter === 'pokemon' ? 'active' : ''}" data-filter="pokemon">Pokémon</button>
              <button class="filter-btn ${filter === 'trainer' ? 'active' : ''}" data-filter="trainer">Trainer</button>
              <button class="filter-btn ${filter === 'energy' ? 'active' : ''}" data-filter="energy">Energy</button>
            </div>
          </div>
          <div class="card-grid" id="card-grid"></div>
        </div>
        <div class="deck-sidebar">
          <div class="deck-sidebar-header">
            <h3>Your Deck</h3>
            <div class="deck-count"><span id="deck-count-num">${getDeckCount()}</span> / 60 cards</div>
          </div>
          <div class="deck-list" id="deck-list"></div>
          <div class="deck-sidebar-footer">
            <div class="preset-decks" id="presets"></div>
            <button class="btn btn-sm btn-secondary" id="btn-clear">Clear Deck</button>
            <button class="btn btn-primary" id="btn-battle" ${getDeckCount() < 20 ? 'disabled' : ''}>Battle! (${getDeckCount()}/60)</button>
            <button class="btn btn-sm btn-gold" id="btn-back">← Back</button>
          </div>
        </div>
      </div>`;

        // Card grid
        const grid = container.querySelector('#card-grid');
        filtered.forEach(card => {
            const item = document.createElement('div');
            item.className = `card-grid-item ${deck[card.id] ? 'in-deck' : ''}`;
            if (card.images?.small) {
                item.innerHTML = `<img src="${card.images.small}" alt="${card.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div style=\\'padding:8px;font-size:10px;text-align:center;color:var(--text-secondary)\\'>${card.name}</div>'">`;
            } else {
                item.innerHTML = `<div style="padding:8px;font-size:10px;text-align:center;color:var(--text-secondary);height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-surface)">${card.name}</div>`;
            }
            if (deck[card.id]) {
                item.innerHTML += `<div class="card-count">${deck[card.id]}</div>`;
            }
            item.addEventListener('click', () => addToDeck(card));
            item.addEventListener('contextmenu', (e) => { e.preventDefault(); showCardDetail(card, container, () => { }); });
            grid.appendChild(item);
        });

        // Deck list
        const list = container.querySelector('#deck-list');
        Object.entries(deck).forEach(([id, qty]) => {
            const card = allCards.find(c => c.id === id);
            if (!card) return;
            const item = document.createElement('div');
            item.className = 'deck-list-item';
            item.innerHTML = `<span class="card-name">${card.name}</span><span class="card-qty">×${qty}</span><button class="remove-btn">✕</button>`;
            item.querySelector('.remove-btn').addEventListener('click', () => { removeFromDeck(card); });
            item.querySelector('.card-name').addEventListener('click', () => showCardDetail(card, container, () => { }));
            list.appendChild(item);
        });

        // Presets
        const presets = container.querySelector('#presets');
        Object.entries(PRESET_DECKS).forEach(([name, preset]) => {
            const btn = document.createElement('button');
            btn.className = 'preset-btn';
            btn.textContent = name;
            btn.title = preset.desc;
            btn.addEventListener('click', () => loadPreset(name));
            presets.appendChild(btn);
        });

        // Events
        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => { filter = btn.dataset.filter; render(); });
        });
        container.querySelector('#btn-clear').addEventListener('click', () => { deck = {}; render(); });
        container.querySelector('#btn-back').addEventListener('click', () => callbacks.onBack());
        container.querySelector('#btn-battle').addEventListener('click', () => {
            if (getDeckCount() >= 20) callbacks.onBattle(buildDeckArray());
        });
    }

    function addToDeck(card) {
        const maxCopy = card.supertype === 'Energy' && card.subtypes?.includes('Basic') ? 30 : 4;
        const current = deck[card.id] || 0;
        if (current >= maxCopy || getDeckCount() >= 60) return;
        deck[card.id] = current + 1;
        render();
    }

    function removeFromDeck(card) {
        if (!deck[card.id]) return;
        deck[card.id]--;
        if (deck[card.id] <= 0) delete deck[card.id];
        render();
    }

    function loadPreset(name) {
        deck = {};
        const preset = PRESET_DECKS[name];
        if (!preset) return;
        Object.entries(preset.cards).forEach(([cardName, qty]) => {
            const card = allCards.find(c => c.name === cardName);
            if (card) deck[card.id] = qty;
        });
        render();
    }

    function buildDeckArray() {
        const arr = [];
        Object.entries(deck).forEach(([id, qty]) => {
            const card = allCards.find(c => c.id === id);
            if (card) for (let i = 0; i < qty; i++) arr.push({ ...card });
        });
        return arr;
    }

    render();
}
