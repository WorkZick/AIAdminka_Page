// Partners Avatars - avatar upload, crop, compress
const PartnersAvatars = {
    avatarClick() {
        document.getElementById('formAvatarInput').click();
    },

    handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        const MAX_SIZE = 10 * 1024 * 1024; // 10MB

        if (!ALLOWED_TYPES.includes(file.type)) {
            Toast.error('Допустимые форматы: JPEG, PNG, WebP, GIF');
            event.target.value = '';
            return;
        }
        if (file.size > MAX_SIZE) {
            Toast.error('Максимальный размер файла: 10 МБ');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            PartnersState.cropData.originalSrc = e.target.result;
            PartnersAvatars.showCropModal(e.target.result);
        };
        reader.readAsDataURL(file);
    },

    showCropModal(imageSrc) {
        const modal = document.getElementById('cropModal');
        const cropImage = document.getElementById('cropImage');

        cropImage.src = imageSrc;
        PartnersState.cropData.scale = 1;
        PartnersState.cropData.offsetX = 0;
        PartnersState.cropData.offsetY = 0;

        modal.classList.add('active');

        cropImage.onload = () => {
            PartnersAvatars.updateCropTransform();
        };
    },

    closeCropModal() {
        document.getElementById('cropModal').classList.remove('active');
        document.getElementById('formAvatarInput').value = '';
    },

    _docHandlers: null,

    setupCropHandlers() {
        // Remove previous handlers to prevent memory leak on repeated calls
        this.removeCropHandlers();

        const cropPreview = document.getElementById('cropPreview');
        if (!cropPreview) return;

        cropPreview.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            PartnersState.cropData.scale = Math.max(0.5, Math.min(3, PartnersState.cropData.scale + delta));
            PartnersAvatars.updateCropTransform();
        }, { passive: false });

        cropPreview.addEventListener('mousedown', (e) => {
            PartnersState.cropData.isDragging = true;
            PartnersState.cropData.startX = e.clientX - PartnersState.cropData.offsetX;
            PartnersState.cropData.startY = e.clientY - PartnersState.cropData.offsetY;
        });

        this._docHandlers = {
            mousemove: (e) => {
                if (!PartnersState.cropData.isDragging) return;
                PartnersState.cropData.offsetX = e.clientX - PartnersState.cropData.startX;
                PartnersState.cropData.offsetY = e.clientY - PartnersState.cropData.startY;
                PartnersAvatars.updateCropTransform();
            },
            mouseup: () => {
                PartnersState.cropData.isDragging = false;
            }
        };

        document.addEventListener('mousemove', this._docHandlers.mousemove);
        document.addEventListener('mouseup', this._docHandlers.mouseup);
    },

    removeCropHandlers() {
        if (this._docHandlers) {
            document.removeEventListener('mousemove', this._docHandlers.mousemove);
            document.removeEventListener('mouseup', this._docHandlers.mouseup);
            this._docHandlers = null;
        }
    },

    updateCropTransform() {
        const cropImage = document.getElementById('cropImage');
        const cropPreview = document.getElementById('cropPreview');
        if (!cropImage || !cropImage.complete) return;

        const scale = PartnersState.cropData.scale;
        const translateX = PartnersState.cropData.offsetX;
        const translateY = PartnersState.cropData.offsetY;

        // Calculate initial size to cover container (like background-size: cover)
        const previewWidth = cropPreview.clientWidth;
        const previewHeight = cropPreview.clientHeight;
        const imgWidth = cropImage.naturalWidth;
        const imgHeight = cropImage.naturalHeight;

        const scaleToFit = Math.max(
            previewWidth / imgWidth,
            previewHeight / imgHeight
        );

        // Set base size to cover the container using CSS custom properties (CSP compliant)
        cropImage.style.setProperty('--crop-width', imgWidth * scaleToFit + 'px');
        cropImage.style.setProperty('--crop-height', imgHeight * scaleToFit + 'px');
        cropImage.style.setProperty('--crop-translate-x', translateX + 'px');
        cropImage.style.setProperty('--crop-translate-y', translateY + 'px');
        cropImage.style.setProperty('--crop-scale', scale);
    },

    applyCrop() {
        // Сохраняем оригинал для загрузки в Drive
        const originalData = PartnersState.cropData.originalSrc;

        // Создаём сжатую версию для предпросмотра в UI (быстро)
        PartnersAvatars.compressImage(originalData, 400, 0.85).then(compressedPreview => {
            const formAvatar = document.getElementById('formAvatar');
            const placeholder = document.querySelector('.form-avatar-placeholder');

            // Показываем сжатый предпросмотр в UI
            formAvatar.src = compressedPreview;
            formAvatar.classList.remove('hidden');
            if (placeholder) placeholder.classList.add('hidden');

            // Сохраняем оригинал для отправки в Drive (в data-атрибуте)
            formAvatar.dataset.originalSrc = originalData;

            PartnersAvatars.closeCropModal();
        });
    },

    /**
     * Сжатие изображения для оптимизации загрузки
     * @param {string} base64 - Base64 изображения
     * @param {number} maxSize - Максимальный размер стороны (px)
     * @param {number} quality - Качество JPEG (0-1)
     * @returns {Promise<string>} - Сжатый base64
     */
    compressImage(base64, maxSize = 800, quality = 0.8) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // Вычисляем новый размер с сохранением пропорций
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                }

                // Создаём canvas и рисуем сжатое изображение
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Конвертируем в JPEG с указанным качеством
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            };
            img.src = base64;
        });
    }
};
