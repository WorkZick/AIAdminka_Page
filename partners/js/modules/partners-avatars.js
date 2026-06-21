// Partners Avatars - avatar upload, crop, compress
const PartnersAvatars = {
    _cropPreviewW: 0,
    _cropPreviewH: 0,
    _rafPending: false,

    avatarClick() {
        document.getElementById('formAvatarInput').click();
    },

    handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            PartnersState.cropData.originalSrc = e.target.result;
            PartnersAvatars.showCropModal(e.target.result);
            // Освобождаем ссылку на замыкание FileReader после срабатывания
            reader.onload = null;
            reader.onerror = null;
        };
        reader.onerror = () => {
            reader.onload = null;
            reader.onerror = null;
        };
        reader.readAsDataURL(file);
    },

    showCropModal(imageSrc) {
        const modal = document.getElementById('cropModal');
        const cropImage = document.getElementById('cropImage');
        const cropSlider = document.getElementById('cropSlider');
        const cropZoomValue = document.getElementById('cropZoomValue');

        // Reset crop data
        PartnersState.cropData.scale = 1;
        PartnersState.cropData.offsetX = 0;
        PartnersState.cropData.offsetY = 0;
        PartnersState.cropData.isDragging = false;
        PartnersState.cropData.startX = 0;
        PartnersState.cropData.startY = 0;

        cropImage.src = imageSrc;

        // Init slider
        if (cropSlider) cropSlider.value = 100;
        if (cropZoomValue) cropZoomValue.textContent = '1.0x';

        cropImage.onload = () => {
            // Cache preview geometry once — fixed during crop session
            const cropPreview = document.getElementById('cropPreview');
            PartnersAvatars._cropPreviewW = cropPreview.clientWidth;
            PartnersAvatars._cropPreviewH = cropPreview.clientHeight;
            PartnersAvatars.updateCropTransform();
        };

        modal.classList.add('active');
    },

    closeCropModal() {
        document.getElementById('cropModal').classList.remove('active');
        document.getElementById('formAvatarInput').value = '';
        PartnersAvatars._cropPreviewW = 0;
        PartnersAvatars._cropPreviewH = 0;
        PartnersAvatars._rafPending = false;

        // Освобождаем DataURL из cropImage (может удерживать несколько МБ)
        const cropImage = document.getElementById('cropImage');
        if (cropImage) {
            cropImage.src = '';
            cropImage.onload = null;
        }

        // Освобождаем originalSrc из cropData (он уже скопирован в dataset.originalSrc в applyCrop,
        // или при отмене он не нужен)
        PartnersState.cropData.originalSrc = null;

        // Reset slider
        const cropSlider = document.getElementById('cropSlider');
        const cropZoomValue = document.getElementById('cropZoomValue');
        if (cropSlider) cropSlider.value = 100;
        if (cropZoomValue) cropZoomValue.textContent = '1.0x';
    },

    setupCropHandlers() {
        const cropPreview = document.getElementById('cropPreview');
        if (!cropPreview) return;

        const cropSlider = document.getElementById('cropSlider');
        const cropZoomValue = document.getElementById('cropZoomValue');

        // Wheel zoom with slider sync
        cropPreview.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            PartnersState.cropData.scale = Math.max(1, Math.min(3, PartnersState.cropData.scale + delta));
            PartnersAvatars.updateCropTransform();

            // Sync slider
            if (cropSlider) cropSlider.value = Math.round(PartnersState.cropData.scale * 100);
            if (cropZoomValue) cropZoomValue.textContent = PartnersState.cropData.scale.toFixed(1) + 'x';
        }, { passive: false });

        // Drag handlers
        cropPreview.addEventListener('mousedown', (e) => {
            PartnersState.cropData.isDragging = true;
            PartnersState.cropData.startX = e.clientX - PartnersState.cropData.offsetX;
            PartnersState.cropData.startY = e.clientY - PartnersState.cropData.offsetY;
        });

        PartnersAvatars._mouseMoveHandler = (e) => {
            if (!PartnersState.cropData.isDragging) return;
            PartnersState.cropData.offsetX = e.clientX - PartnersState.cropData.startX;
            PartnersState.cropData.offsetY = e.clientY - PartnersState.cropData.startY;
            PartnersAvatars.updateCropTransform();
        };
        PartnersAvatars._mouseUpHandler = () => {
            PartnersState.cropData.isDragging = false;
        };

        document.addEventListener('mousemove', PartnersAvatars._mouseMoveHandler);
        document.addEventListener('mouseup', PartnersAvatars._mouseUpHandler);

        // Slider input handler
        if (cropSlider) {
            PartnersAvatars._sliderHandler = () => {
                PartnersState.cropData.scale = parseInt(cropSlider.value) / 100;
                if (cropZoomValue) cropZoomValue.textContent = PartnersState.cropData.scale.toFixed(1) + 'x';
                PartnersAvatars.updateCropTransform();
            };
            cropSlider.addEventListener('input', PartnersAvatars._sliderHandler);
        }

        PageLifecycle.addCleanup(() => {
            if (PartnersAvatars._mouseMoveHandler) {
                document.removeEventListener('mousemove', PartnersAvatars._mouseMoveHandler);
                document.removeEventListener('mouseup', PartnersAvatars._mouseUpHandler);
                PartnersAvatars._mouseMoveHandler = null;
                PartnersAvatars._mouseUpHandler = null;
            }
            if (PartnersAvatars._sliderHandler && cropSlider) {
                cropSlider.removeEventListener('input', PartnersAvatars._sliderHandler);
                PartnersAvatars._sliderHandler = null;
            }
        });
    },

    updateCropTransform() {
        const cropImage = document.getElementById('cropImage');
        if (!cropImage || !cropImage.complete) return;

        const scale = PartnersState.cropData.scale;
        const translateX = PartnersState.cropData.offsetX;
        const translateY = PartnersState.cropData.offsetY;

        if (PartnersAvatars._rafPending) return;
        PartnersAvatars._rafPending = true;
        requestAnimationFrame(() => {
            PartnersAvatars._rafPending = false;
            const previewWidth = PartnersAvatars._cropPreviewW || cropImage.parentElement.clientWidth;
            const previewHeight = PartnersAvatars._cropPreviewH || cropImage.parentElement.clientHeight;
            const imgWidth = cropImage.naturalWidth;
            const imgHeight = cropImage.naturalHeight;
            const scaleToFit = Math.max(previewWidth / imgWidth, previewHeight / imgHeight);
            cropImage.style.width = imgWidth * scaleToFit + 'px';
            cropImage.style.height = imgHeight * scaleToFit + 'px';
            cropImage.style.transform = `translate(calc(-50% + ${PartnersState.cropData.offsetX}px), calc(-50% + ${PartnersState.cropData.offsetY}px)) scale(${PartnersState.cropData.scale})`;
        });
    },

    applyCrop() {
        const originalData = PartnersState.cropData.originalSrc;
        const cropPreview = document.getElementById('cropPreview');

        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.onload = () => {
            const previewWidth = cropPreview.clientWidth;
            const previewHeight = cropPreview.clientHeight;
            const scale = PartnersState.cropData.scale;
            const translateX = PartnersState.cropData.offsetX;
            const translateY = PartnersState.cropData.offsetY;
            const imgWidth = img.width;
            const imgHeight = img.height;

            const scaleToFit = Math.max(previewWidth / imgWidth, previewHeight / imgHeight);
            const displayedWidth = imgWidth * scaleToFit * scale;
            const displayedHeight = imgHeight * scaleToFit * scale;

            const imgLeft = previewWidth / 2 - displayedWidth / 2 + translateX;
            const imgTop = previewHeight / 2 - displayedHeight / 2 + translateY;

            // Mask = 80% of preview (centered square)
            const maskSize = previewWidth * 0.8;
            const maskLeft = (previewWidth - maskSize) / 2;
            const maskTop = (previewHeight - maskSize) / 2;

            // Source rect in original image coordinates
            const srcX = (maskLeft - imgLeft) / (scaleToFit * scale);
            const srcY = (maskTop - imgTop) / (scaleToFit * scale);
            const srcW = maskSize / (scaleToFit * scale);
            const srcH = maskSize / (scaleToFit * scale);

            ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, 200, 200);

            const croppedData = canvas.toDataURL('image/jpeg', 0.9);
            const formAvatar = document.getElementById('formAvatar');
            const placeholder = document.querySelector('.form-avatar-placeholder');

            formAvatar.src = croppedData;
            formAvatar.classList.remove('hidden');
            if (placeholder) placeholder.classList.add('hidden');

            // CRITICAL: Preserve originalSrc for Drive upload
            formAvatar.dataset.originalSrc = originalData;

            PartnersAvatars.closeCropModal();
        };
        img.src = originalData;
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

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            };
            img.src = base64;
        });
    }
};
