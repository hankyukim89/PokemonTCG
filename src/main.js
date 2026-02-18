// Main entry point — screen routing and app init
import './styles/variables.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/utilities.css';
import './ui/settings.css';

import { renderTitleScreen } from './ui/TitleScreen.js';
import { SettingsState } from './ui/SettingsState.js';
import { SettingsUI } from './ui/SettingsUI.js';
// Disable context menu globally
window.addEventListener('contextmenu', (e) => e.preventDefault());


import { renderDeckBuilder } from './ui/DeckBuilder.js';
import { BattleScreen } from './ui/BattleScreen.js';

// Init settings immediately
const settingsState = new SettingsState();
new SettingsUI(settingsState);

// App state
const app = document.querySelector('#app');

let allCards = [];
let currentBattle = null;

async function loadCards() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div><p style="color:var(--text-secondary)">Loading cards...</p></div>';
  try {
    const res = await fetch('/data/cards.json');
    allCards = await res.json();
    console.log(`Loaded ${allCards.length} cards`);
  } catch (err) {
    console.error('Failed to load cards:', err);
    app.innerHTML = '<div class="loading"><p style="color:var(--poke-red)">Failed to load card data. Run: node scripts/generate-cards.cjs</p></div>';
    return false;
  }
  return true;
}

function showTitle() {
  currentBattle = null;
  const app = document.getElementById('app');
  renderTitleScreen(app, {
    onQuickPlay: () => startQuickPlay(),
    onDeckBuilder: () => showDeckBuilder()
  });
}

function showDeckBuilder() {
  const app = document.getElementById('app');
  renderDeckBuilder(app, allCards, {
    onBack: () => showTitle(),
    onBattle: (deckCards) => startBattle(deckCards)
  });
}

function buildRandomDeck() {
  // Build a functional random deck
  const pokemon = allCards.filter(c => c.supertype === 'Pokémon' && c.subtypes?.includes('Basic'));
  const trainers = allCards.filter(c => c.supertype === 'Trainer');
  const energy = allCards.filter(c => c.supertype === 'Energy' && c.subtypes?.includes('Basic'));

  const deck = [];
  const pick = (arr, n) => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    for (let i = 0; i < n && i < shuffled.length; i++) deck.push({ ...shuffled[i] });
  };

  // 10-14 basic Pokémon (ensuring variety)
  const basicCount = 10 + Math.floor(Math.random() * 5);
  pick(pokemon, basicCount);

  // 8-12 trainers
  const trainerCount = 8 + Math.floor(Math.random() * 5);
  pick(trainers, trainerCount);

  // Fill rest with energy
  const energyNeeded = 60 - deck.length;
  for (let i = 0; i < energyNeeded; i++) {
    deck.push({ ...energy[Math.floor(Math.random() * energy.length)] });
  }
  return deck;
}

function startQuickPlay() {
  const playerDeck = buildRandomDeck();
  const opponentDeck = buildRandomDeck();
  startBattle(playerDeck, opponentDeck);
}

function startBattle(playerDeck, opponentDeck) {
  if (!opponentDeck) opponentDeck = buildRandomDeck();
  const app = document.getElementById('app');
  currentBattle = new BattleScreen(app, playerDeck, opponentDeck, allCards, (action) => {
    if (action === 'replay') startQuickPlay();
    else showTitle();
  });
}

// Boot
async function main() {
  const ok = await loadCards();
  if (ok) showTitle();
}

main();
