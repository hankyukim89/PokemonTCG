// Title Screen
export function renderTitleScreen(container, callbacks) {
    container.innerHTML = `
    <div class="title-screen">
      <div class="title-logo">Pokémon TCG</div>
      <div class="title-subtitle">Base Set Simulator</div>
      <div class="title-buttons">
        <button id="btn-quick-play" class="btn btn-primary">⚡ Quick Play</button>
        <button id="btn-deck-builder" class="btn btn-secondary">🃏 Deck Builder</button>
      </div>
    </div>
  `;

    container.querySelector('#btn-quick-play').addEventListener('click', () => callbacks.onQuickPlay());
    container.querySelector('#btn-deck-builder').addEventListener('click', () => callbacks.onDeckBuilder());
}
