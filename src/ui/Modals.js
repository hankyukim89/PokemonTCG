// Modals — coin flip, promotion picker, game over
import { createCardElement } from './CardComponent.js';

export function showCoinFlip(container, result, message) {
    return new Promise(resolve => {
        const el = document.createElement('div');
        el.className = 'coin-flip-container animate-fade-in';
        el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:20px">
        <div class="coin">${result === 'heads' ? 'H' : 'T'}</div>
        <div class="coin-result">${result}!</div>
        <p style="color:var(--text-secondary);font-size:14px">${message}</p>
      </div>`;
        container.appendChild(el);
        setTimeout(() => { el.remove(); resolve(); }, 2200);
    });
}

export function showPromotionModal(container, benchPokemon, onSelect) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay animate-fade-in';
    overlay.innerHTML = `<div class="modal">
    <h2>Choose Active Pokémon</h2>
    <p>Your Active Pokémon was Knocked Out! Choose a Benched Pokémon to promote.</p>
    <div class="modal-cards" id="promo-cards"></div>
  </div>`;

    const cardsDiv = overlay.querySelector('#promo-cards');
    benchPokemon.forEach((p, idx) => {
        if (!p) return;
        const card = createCardElement(p, {
            onClick: () => { overlay.remove(); onSelect(idx); }
        });
        card.classList.add('selectable');
        cardsDiv.appendChild(card);
    });

    container.appendChild(overlay);
}

export function showGameOver(container, isVictory, message, onReplay, onMenu) {
    const overlay = document.createElement('div');
    overlay.className = 'game-over-screen animate-fade-in';
    overlay.innerHTML = `
    <div class="game-over-title ${isVictory ? 'victory' : 'defeat'}">${isVictory ? 'Victory!' : 'Defeat'}</div>
    <div class="game-over-subtitle">${message}</div>
    <div style="display:flex;gap:16px">
      <button class="btn btn-primary" id="go-replay">Play Again</button>
      <button class="btn btn-secondary" id="go-menu">Main Menu</button>
    </div>`;
    overlay.querySelector('#go-replay').addEventListener('click', () => { overlay.remove(); onReplay(); });
    overlay.querySelector('#go-menu').addEventListener('click', () => { overlay.remove(); onMenu(); });
    container.appendChild(overlay);
}

export function showMessage(container, text, duration = 1500) {
    return new Promise(resolve => {
        const el = document.createElement('div');
        el.className = 'coin-flip-container animate-fade-in';
        el.innerHTML = `<div style="text-align:center"><p style="font-size:22px;font-weight:700;color:var(--poke-yellow)">${text}</p></div>`;
        container.appendChild(el);
        setTimeout(() => { el.remove(); resolve(); }, duration);
    });
}
