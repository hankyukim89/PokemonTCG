
export class Settings {
    constructor() {
        this.STORAGE_KEY = 'pokemon-tcg-settings';
        this.settings = {
            bgImage: null,
            bgOpacity: 0.3 // Default opacity
        };
        this.loadSettings();
        this.initUI();
        this.applySettings();
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    }

    saveSettings() {
        try {
            // Don't save extremely large image strings to avoid quota errors
            if (this.settings.bgImage && this.settings.bgImage.length > 2000000) {
                console.warn('Image too large to save to localStorage');
                // We'll save just the opacity in this case to avoid breaking everything
                const minimal = { ...this.settings, bgImage: null };
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(minimal));
                return;
            }
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
        } catch (e) {
            console.error('Failed to save settings', e);
        }
    }

    initUI() {
        // Create the background layer
        const bgLayer = document.createElement('div');
        bgLayer.id = 'custom-bg-layer';
        document.body.prepend(bgLayer); // Prepend to be behind everything

        // Create Settings Button
        const btn = document.createElement('button');
        btn.id = 'settings-btn';
        btn.innerHTML = '⚙️';
        btn.title = 'Settings';
        btn.onclick = () => this.toggleModal();
        document.body.appendChild(btn);

        // Create Modal
        const modal = document.createElement('div');
        modal.id = 'settings-modal';
        modal.className = 'modal-overlay hidden';
        modal.innerHTML = `
            <div class="modal-content settings-popup">
                <div class="modal-header">
                    <h2>Game Settings</h2>
                    <button class="close-btn" id="close-settings">×</button>
                </div>
                <div class="settings-body">
                    <div class="setting-group">
                        <label>Custom Background Image</label>
                        <div class="file-input-wrapper">
                            <input type="file" id="bg-upload" accept="image/*">
                            <button class="btn btn-sm btn-secondary" onclick="document.getElementById('bg-upload').click()">Choose Image</button>
                            <span id="file-name">No file chosen</span>
                        </div>
                        <p class="help-text">Upload an image to replace the default background.</p>
                        <button id="clear-bg" class="btn btn-sm btn-danger" style="margin-top:8px">Reset to Default</button>
                    </div>

                    <div class="setting-group">
                        <label>Background Opacity: <span id="opacity-val">${Math.round(this.settings.bgOpacity * 100)}%</span></label>
                        <input type="range" id="bg-opacity" min="0" max="1" step="0.05" value="${this.settings.bgOpacity}">
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Bind Events
        document.getElementById('close-settings').onclick = () => this.toggleModal();
        document.getElementById('bg-opacity').oninput = (e) => {
            this.settings.bgOpacity = parseFloat(e.target.value);
            document.getElementById('opacity-val').textContent = Math.round(this.settings.bgOpacity * 100) + '%';
            this.applySettings();
            this.saveSettings();
        };

        document.getElementById('bg-upload').onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            document.getElementById('file-name').textContent = file.name;

            const reader = new FileReader();
            reader.onload = (event) => {
                this.settings.bgImage = event.target.result;
                this.applySettings();
                this.saveSettings();
            };
            reader.readAsDataURL(file);
        };

        document.getElementById('clear-bg').onclick = () => {
            this.settings.bgImage = null;
            document.getElementById('file-name').textContent = 'No file chosen';
            document.getElementById('bg-upload').value = '';
            this.applySettings();
            this.saveSettings();
        };

        // Close on outside click
        modal.onclick = (e) => {
            if (e.target === modal) this.toggleModal();
        };
    }

    toggleModal() {
        const modal = document.getElementById('settings-modal');
        modal.classList.toggle('hidden');
    }

    applySettings() {
        const layer = document.getElementById('custom-bg-layer');

        if (this.settings.bgImage) {
            layer.style.backgroundImage = `url(${this.settings.bgImage})`;
            layer.style.opacity = this.settings.bgOpacity;
            layer.classList.add('active');
        } else {
            layer.style.backgroundImage = 'none';
            layer.classList.remove('active');
        }
    }
}
