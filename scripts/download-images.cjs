// Download all Base Set card images organized into folders
// Images come from: https://images.pokemontcg.io/base1/{number}.png
// Run: node scripts/download-images.cjs

const fs = require('fs');
const path = require('path');
const https = require('https');

const CARDS_PATH = path.join(__dirname, '..', 'public', 'data', 'cards.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'card-images');

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, { timeout: 30000 }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                // Follow redirect
                file.close();
                fs.unlinkSync(dest);
                downloadFile(res.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                file.close();
                fs.unlinkSync(dest);
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => { file.close(resolve); });
        }).on('error', (err) => {
            file.close();
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            reject(err);
        }).on('timeout', function () {
            this.destroy();
            reject(new Error('Timeout'));
        });
    });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
    // Load card data
    if (!fs.existsSync(CARDS_PATH)) {
        console.error('No cards.json found. Run: node scripts/generate-cards.cjs first');
        process.exit(1);
    }
    const cards = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf-8'));
    console.log(`Found ${cards.length} cards to download images for\n`);

    // Create organized folder structure
    const folders = {
        'Pokemon/Basic': [],
        'Pokemon/Stage_1': [],
        'Pokemon/Stage_2': [],
        'Trainers': [],
        'Energy': []
    };

    // Sort cards into folders
    for (const card of cards) {
        if (card.supertype === 'Pokémon') {
            if (card.subtypes?.includes('Stage 2')) folders['Pokemon/Stage_2'].push(card);
            else if (card.subtypes?.includes('Stage 1')) folders['Pokemon/Stage_1'].push(card);
            else folders['Pokemon/Basic'].push(card);
        } else if (card.supertype === 'Trainer') {
            folders['Trainers'].push(card);
        } else if (card.supertype === 'Energy') {
            folders['Energy'].push(card);
        }
    }

    // Create directories
    for (const folder of Object.keys(folders)) {
        const dir = path.join(OUTPUT_DIR, folder);
        fs.mkdirSync(dir, { recursive: true });
    }

    let downloaded = 0;
    let failed = 0;
    const failedCards = [];

    for (const [folder, folderCards] of Object.entries(folders)) {
        console.log(`\n📁 ${folder} (${folderCards.length} cards)`);

        for (const card of folderCards) {
            // Build filename: "001_Alakazam.png" (padded number + name)
            const num = String(card.number).padStart(3, '0');
            const safeName = card.name.replace(/[^a-zA-Z0-9é♂♀ ]/g, '').replace(/ /g, '_');
            const filename = `${num}_${safeName}.png`;
            const hiresFilename = `${num}_${safeName}_hires.png`;

            const dir = path.join(OUTPUT_DIR, folder);
            const filepath = path.join(dir, filename);
            const hiresPath = path.join(dir, hiresFilename);

            // Skip if already downloaded
            if (fs.existsSync(filepath)) {
                console.log(`  ✅ ${filename} (already exists)`);
                downloaded++;
                continue;
            }

            // Try small image first
            const smallUrl = card.images?.small;
            const largeUrl = card.images?.large;

            if (smallUrl) {
                try {
                    process.stdout.write(`  ⬇️  ${filename}...`);
                    await downloadFile(smallUrl, filepath);
                    downloaded++;
                    console.log(' ✅');
                } catch (err) {
                    console.log(` ❌ (${err.message})`);
                    failed++;
                    failedCards.push({ name: card.name, url: smallUrl, error: err.message });
                }
            } else {
                console.log(`  ⚠️  ${card.name} — no image URL`);
                failed++;
                failedCards.push({ name: card.name, url: 'none', error: 'No image URL in data' });
            }

            // Try high-res too
            if (largeUrl) {
                try {
                    await downloadFile(largeUrl, hiresPath);
                } catch (err) {
                    // hi-res failing is OK, we have the small one
                }
            }

            await sleep(200); // rate limit
        }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ Downloaded: ${downloaded}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📁 Output: ${OUTPUT_DIR}`);

    if (failedCards.length > 0) {
        console.log(`\n⚠️  Failed cards:`);
        failedCards.forEach(f => console.log(`   - ${f.name}: ${f.error}`));
    }

    // Print folder structure
    console.log(`\n📂 Folder structure:`);
    console.log(`   card-images/`);
    for (const folder of Object.keys(folders)) {
        const dir = path.join(OUTPUT_DIR, folder);
        const count = fs.readdirSync(dir).length;
        console.log(`   ├── ${folder}/ (${count} files)`);
    }
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
