export class SettingsState {
    constructor() {
        this.STORAGE_KEY = 'pokemon-tcg-settings';
        this.defaults = {
            bgImage: null,
            bgOpacity: 0.3
        };
        this.settings = { ...this.defaults };
        this.load();
    }

    load() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                this.settings = { ...this.defaults, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    }

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
        } catch (e) {
            console.error('Failed to save settings - likely quota exceeded', e);
            // Fallback: try saving without the image if it fits
            if (this.settings.bgImage) {
                const minimal = { ...this.settings, bgImage: null };
                try {
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(minimal));
                } catch (retryErr) {
                    console.error('Even minimal save failed', retryErr);
                }
            }
        }
    }

    get(key) {
        return this.settings[key];
    }

    set(key, value) {
        this.settings[key] = value;
        this.save();
    }

    reset() {
        this.settings = { ...this.defaults };
        this.save();
    }

    /**
     * Compresses an image file to a lower resolution/quality Data URL
     * to ensure it fits in localStorage (approx < 2MB usually safe).
     * @param {File} file 
     * @returns {Promise<string>} Data URL
     */
    async processImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Max dimensions
                    const MAX_WIDTH = 1920;
                    const MAX_HEIGHT = 1080;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG 0.7 quality
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    }
}
