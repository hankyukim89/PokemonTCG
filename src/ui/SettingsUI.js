export class SettingsUI {
    constructor(settingsState) {
        this.state = settingsState;
        this.init();
    }

    init() {
        this.createBackgroundLayer();
        this.createButton();
        this.createModal();
        this.bindEvents();
        this.applyState();
    }

    createBackgroundLayer() {
        const layer = document.createElement('div');
        layer.id = 'custom-bg-layer';
        document.body.prepend(layer);
    }

    createButton() {
        const btn = document.createElement('button');
        btn.id = 'settings-btn';
        btn.innerHTML = '⚙️';
        btn.title = 'Settings';
        btn.onclick = () => this.toggle();
        document.body.appendChild(btn);
    }

    createModal() {
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
                        <p class="help-text">Upload an image (auto-compressed).</p>
                        <button id="clear-bg" class="btn btn-sm btn-danger" style="margin-top:8px">Reset to Default</button>
                    </div>

                    <div class="setting-group">
                        <label>Background Opacity: <span id="opacity-val">50%</span></label>
                        <input type="range" id="bg-opacity" min="0" max="1" step="0.05">
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    bindEvents() {
        // Toggle
        document.getElementById('close-settings').onclick = () => this.toggle();
        const modal = document.getElementById('settings-modal');
        modal.onclick = (e) => {
            if (e.target === modal) this.toggle();
        };

        // Opacity
        const opacityInput = document.getElementById('bg-opacity');
        opacityInput.value = this.state.get('bgOpacity');
        document.getElementById('opacity-val').textContent = Math.round(this.state.get('bgOpacity') * 100) + '%';

        opacityInput.oninput = (e) => {
            const val = parseFloat(e.target.value);
            this.state.set('bgOpacity', val);
            document.getElementById('opacity-val').textContent = Math.round(val * 100) + '%';
            this.applyState();
        };

        // Image Upload
        document.getElementById('bg-upload').onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            document.getElementById('file-name').textContent = 'Processing...';
            try {
                const dataUrl = await this.state.processImage(file);
                this.state.set('bgImage', dataUrl);
                this.applyState();
                document.getElementById('file-name').textContent = file.name;
            } catch (err) {
                console.error(err);
                document.getElementById('file-name').textContent = 'Error processing image';
            }
        };

        // Clear BG
        document.getElementById('clear-bg').onclick = () => {
            this.state.set('bgImage', null);
            document.getElementById('file-name').textContent = 'No file chosen';
            document.getElementById('bg-upload').value = '';
            this.applyState();
        };
    }

    applyState() {
        const layer = document.getElementById('custom-bg-layer');
        const bgImage = this.state.get('bgImage');
        const bgOpacity = this.state.get('bgOpacity');

        if (bgImage) {
            layer.style.backgroundImage = `url(${bgImage})`;
            layer.style.opacity = bgOpacity;
            layer.classList.add('active');
        } else {
            layer.style.backgroundImage = 'none';
            layer.classList.remove('active');
        }
    }

    toggle() {
        const modal = document.getElementById('settings-modal');
        modal.classList.toggle('hidden');
    }
}
