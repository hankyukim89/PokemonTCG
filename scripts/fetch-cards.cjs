// Fetch all Base Set cards from the Pokémon TCG API v2
// Run: node scripts/fetch-cards.cjs

const fs = require('fs');
const path = require('path');
const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 60000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`  Fetching page (attempt ${i + 1})...`);
      const data = await httpsGet(url);
      return data;
    } catch (err) {
      console.log(`  Error: ${err.message}`);
      if (i < retries - 1) {
        const wait = 3000 * (i + 1);
        console.log(`  Waiting ${wait / 1000}s before retry...`);
        await sleep(wait);
      }
    }
  }
  throw new Error(`Failed to fetch after ${retries} retries`);
}

async function fetchCards() {
  console.log('Fetching Base Set cards from Pokémon TCG API v2...');

  let allCards = [];
  let page = 1;
  const pageSize = 30; // Smaller pages to avoid timeouts

  while (true) {
    const url = `https://api.pokemontcg.io/v2/cards?q=set.id:base1&page=${page}&pageSize=${pageSize}&orderBy=number`;
    console.log(`Fetching page ${page}...`);

    const data = await fetchWithRetry(url);
    allCards = allCards.concat(data.data);
    console.log(`  Got ${data.data.length} cards (total: ${allCards.length}/${data.totalCount})`);

    if (allCards.length >= data.totalCount || data.data.length < pageSize) {
      break;
    }
    page++;
    await sleep(1000); // Rate limiting
  }

  console.log(`\nFetched ${allCards.length} cards total`);

  const processedCards = allCards.map(card => ({
    id: card.id,
    name: card.name,
    supertype: card.supertype,
    subtypes: card.subtypes || [],
    hp: card.hp ? parseInt(card.hp) : null,
    types: card.types || [],
    evolvesFrom: card.evolvesFrom || null,
    evolvesTo: card.evolvesTo || [],
    abilities: (card.abilities || []).map(a => ({
      name: a.name,
      text: a.text,
      type: a.type
    })),
    attacks: (card.attacks || []).map(a => ({
      name: a.name,
      cost: a.cost || [],
      convertedEnergyCost: a.convertedEnergyCost || 0,
      damage: a.damage || '',
      text: a.text || ''
    })),
    weaknesses: (card.weaknesses || []).map(w => ({
      type: w.type,
      value: w.value
    })),
    resistances: (card.resistances || []).map(r => ({
      type: r.type,
      value: r.value
    })),
    retreatCost: card.retreatCost || [],
    convertedRetreatCost: card.convertedRetreatCost || 0,
    number: card.number,
    rarity: card.rarity || 'Common',
    images: {
      small: card.images.small,
      large: card.images.large
    }
  }));

  processedCards.sort((a, b) => parseInt(a.number) - parseInt(b.number));

  const outputPath = path.join(__dirname, '..', 'public', 'data', 'cards.json');
  fs.writeFileSync(outputPath, JSON.stringify(processedCards, null, 2));

  console.log(`\nSaved ${processedCards.length} cards to public/data/cards.json`);
  const pokemon = processedCards.filter(c => c.supertype === 'Pokémon');
  const trainers = processedCards.filter(c => c.supertype === 'Trainer');
  const energy = processedCards.filter(c => c.supertype === 'Energy');
  console.log(`  Pokémon: ${pokemon.length}`);
  console.log(`  Trainers: ${trainers.length}`);
  console.log(`  Energy: ${energy.length}`);
}

fetchCards().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
