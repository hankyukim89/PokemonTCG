// Reusable card rendering utilities
const STATUS_EMOJI = {
  poisoned: '☠️', confused: '😵', paralyzed: '⚡', asleep: '💤', burned: '🔥'
};

// Map TCG energy types to orb icon filenames
const ENERGY_ORB_MAP = {
  Fire: 'Fire', Water: 'Water', Grass: 'Grass', Lightning: 'Electric',
  Psychic: 'Psychic', Fighting: 'Fighting', Colorless: 'Normal',
  Darkness: 'Dark', Metal: 'Steel', Dragon: 'Dragon'
};

function getEnergyOrbSrc(type) {
  const file = ENERGY_ORB_MAP[type] || 'Normal';
  return `/images/energy-orbs/${file}.png`;
}

export function createCardElement(card, opts = {}) {
  const { faceDown = false, showDamage = true, showEnergy = true, showStatus = true, onClick, onContextMenu, onDragStart, className = '' } = opts;
  const el = document.createElement('div');
  el.className = `card ${className}`;
  if (card?.status) el.classList.add(`status-${card.status}`);
  el.dataset.uid = card?.uid || '';

  const inner = document.createElement('div');
  inner.className = 'card-inner';

  // Front
  const front = document.createElement('div');
  front.className = 'card-front';
  if (card?.images?.small) {
    const img = document.createElement('img');
    img.src = card.images.small;
    img.alt = card.name || 'Card';
    img.loading = 'lazy';
    img.onerror = () => { img.style.display = 'none'; front.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:var(--bg-surface);padding:4px;text-align:center;font-size:10px;color:var(--text-secondary)">${card.name || 'Card'}</div>`; };
    front.appendChild(img);
  } else {
    front.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:var(--bg-surface);padding:6px;text-align:center">
      <span style="font-size:10px;font-weight:700;color:var(--text-primary)">${card?.name || 'Card'}</span>
      ${card?.hp ? `<span style="font-size:9px;color:var(--poke-red)">${card.hp} HP</span>` : ''}
      ${card?.supertype ? `<span style="font-size:8px;color:var(--text-muted)">${card.supertype}</span>` : ''}
    </div>`;
  }

  // Back — use actual cardback image
  const back = document.createElement('div');
  back.className = 'card-back';
  const backImg = document.createElement('img');
  backImg.src = '/images/cardback.jpg';
  backImg.alt = 'Card Back';
  backImg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit';
  back.appendChild(backImg);

  inner.appendChild(front);
  inner.appendChild(back);
  el.appendChild(inner);

  if (faceDown) el.classList.add('flipped');

  // Overlays — damage counter at TOP RIGHT
  if (showDamage && card?.damage > 0) {
    const dmg = document.createElement('div');
    dmg.className = 'damage-counter';
    dmg.textContent = `-${card.damage}`;
    el.appendChild(dmg);
  }

  if (showStatus && card?.status && STATUS_EMOJI[card.status]) {
    const badge = document.createElement('div');
    badge.className = 'status-badge';
    badge.textContent = STATUS_EMOJI[card.status];
    el.appendChild(badge);
  }

  // Energy badges — at TOP RIGHT, below damage
  if (showEnergy && card?.attachedEnergy?.length > 0) {
    const badges = document.createElement('div');
    badges.className = 'energy-badges';
    card.attachedEnergy.forEach(e => {
      const b = document.createElement('div');
      const type = e.types?.[0] || 'Colorless';
      b.className = `energy-badge ${type}`;
      const orbImg = document.createElement('img');
      orbImg.src = getEnergyOrbSrc(type);
      orbImg.alt = type;
      orbImg.style.cssText = 'width:100%;height:100%;object-fit:contain';
      b.textContent = '';
      b.appendChild(orbImg);
      badges.appendChild(b);
    });
    el.appendChild(badges);
  }

  if (onClick) el.addEventListener('click', (e) => onClick(card, e));
  if (onContextMenu) {
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      onContextMenu(card, e);
    });
  }

  if (onDragStart) {
    el.draggable = true;
    el.addEventListener('dragstart', (e) => { el.classList.add('dragging'); onDragStart(e, card); });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
  }

  return el;
}

export function createCardBack() {
  const el = document.createElement('div');
  el.className = 'card flipped';
  el.innerHTML = `<div class="card-inner"><div class="card-front"></div><div class="card-back"><img src="/images/cardback.jpg" alt="Card Back" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"></div></div>`;
  return el;
}

export function showCardDetail(card, container, onClose, actions = []) {
  const overlay = document.createElement('div');
  overlay.className = 'card-detail-overlay animate-fade-in';

  // Close on background click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      onClose?.();
    }
  });

  const imgSrc = card.images?.large || card.images?.small;

  // Build energy cost using orb images
  const energyCostHtml = (cost) => (cost || []).map(c =>
    `<img class="energy-orb-icon" src="${getEnergyOrbSrc(c)}" alt="${c}">`
  ).join('');

  const attacksHtml = (card.attacks || []).map(a => `
    <div class="attack-item">
      <div class="attack-name">${a.name} <span class="attack-damage">${a.damage || ''}</span></div>
      <div class="attack-cost">${energyCostHtml(a.cost)}</div>
      ${a.text ? `<div class="attack-text">${a.text}</div>` : ''}
    </div>
  `).join('');

  const abilitiesHtml = (card.abilities || []).map(a => `
    <div class="attack-item" style="border-left:3px solid var(--poke-yellow)">
      <div class="attack-name" style="color:var(--poke-yellow)">${a.name} <span style="font-size:10px;color:var(--text-muted)">(${a.type})</span></div>
      <div class="attack-text">${a.text}</div>
    </div>
  `).join('');

  const weaknessHtml = (card.weaknesses || []).map(w =>
    `<img class="energy-orb-icon" src="${getEnergyOrbSrc(w.type)}" alt="${w.type}"> ${w.value}`
  ).join(', ');

  const resistanceHtml = (card.resistances || []).map(r =>
    `<img class="energy-orb-icon" src="${getEnergyOrbSrc(r.type)}" alt="${r.type}"> ${r.value}`
  ).join(', ');

  const retreatHtml = card.retreatCost?.length ?
    card.retreatCost.map(c => `<img class="energy-orb-icon" src="${getEnergyOrbSrc(c)}" alt="${c}">`).join('') : '';

  // Render actions if provided
  let actionsHtml = '';
  if (actions && actions.length > 0) {
    actionsHtml = `<div class="card-actions" style="margin-top:20px;display:flex;flex-direction:column;gap:10px;">
      ${actions.map((act, i) => `
        <button class="btn btn-${act.variant || 'primary'} action-btn" data-idx="${i}" ${act.disabled ? 'disabled' : ''} style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px;">
          ${act.icon ? act.icon : ''} ${act.label}
        </button>
      `).join('')}
    </div>`;
  }

  overlay.innerHTML = `<div class="card-detail" onclick="event.stopPropagation()">
    ${imgSrc ? `<img class="card-detail-image" src="${imgSrc}" alt="${card.name}" onerror="this.style.display='none'">` : ''}
    <div class="card-detail-info">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <h2>${card.name}</h2>
        <button class="close-btn" style="background:none;border:none;color:var(--text-muted);font-size:24px;cursor:pointer;">×</button>
      </div>
      <p>${card.supertype}${card.subtypes?.length ? ` — ${card.subtypes.join(', ')}` : ''}</p>
      ${card.hp ? `<p>HP: ${card.hp} ${card.types?.length ? `| Type: ${card.types.join(', ')}` : ''}</p>` : ''}
      ${card.evolvesFrom ? `<p>Evolves from: ${card.evolvesFrom}</p>` : ''}
      
      ${actionsHtml}
      
      ${abilitiesHtml ? `<div class="attack-list">${abilitiesHtml}</div>` : ''}
      ${attacksHtml ? `<div class="attack-list">${attacksHtml}</div>` : ''}
      ${weaknessHtml ? `<p style="margin-top:8px">Weakness: ${weaknessHtml}</p>` : ''}
      ${resistanceHtml ? `<p>Resistance: ${resistanceHtml}</p>` : ''}
      ${retreatHtml ? `<p>Retreat: ${retreatHtml}</p>` : ''}
    </div>
  </div>`;

  container.appendChild(overlay);

  // Bind close button
  overlay.querySelector('.close-btn').addEventListener('click', () => {
    overlay.remove();
    onClose?.();
  });

  // Bind action buttons
  overlay.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const action = actions[idx];
      if (action.action) {
        action.action();
        overlay.remove();
        onClose?.();
      }
    });
  });
}

export { ENERGY_ORB_MAP, getEnergyOrbSrc, STATUS_EMOJI };
