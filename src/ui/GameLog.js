// Game Log — floating log panel
export function createGameLog(container) {
    const toggle = document.createElement('button');
    toggle.className = 'game-log-toggle';
    toggle.textContent = '📋';
    toggle.id = 'log-toggle';

    const log = document.createElement('div');
    log.className = 'game-log';
    log.id = 'game-log';
    log.innerHTML = `<div class="game-log-header">Game Log</div><div class="game-log-body" id="log-body"></div>`;

    toggle.addEventListener('click', () => log.classList.toggle('open'));
    container.appendChild(toggle);
    container.appendChild(log);

    return {
        addEntry(msg) {
            const body = document.getElementById('log-body');
            if (!body) return;
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.textContent = msg;
            body.appendChild(entry);
            body.scrollTop = body.scrollHeight;
        },
        syncLog(gameLog) {
            const body = document.getElementById('log-body');
            if (!body) return;
            body.innerHTML = '';
            gameLog.forEach(l => {
                const entry = document.createElement('div');
                entry.className = 'log-entry';
                entry.textContent = l.message;
                body.appendChild(entry);
            });
            body.scrollTop = body.scrollHeight;
        },
        remove() { toggle.remove(); log.remove(); }
    };
}
