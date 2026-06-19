/**
 * Team Avatars Module
 * Загрузка и обрезка аватаров сотрудников
 */

const TeamAvatars = {
    /**
     * Обработка загрузки файла аватара
     * @param {Event} event - Event объект от input file
     */
    handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.showCropModal(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    },

    /**
     * Показать модальное окно обрезки изображения
     * @param {string} imageData - Base64 data URL изображения
     */
    showCropModal(imageData) {
        TeamState.tempImageData = imageData;
        TeamState.cropSettings = { scale: 1, posX: 0, posY: 0 };
        TeamState.isDragging = false;
        TeamState.dragStart = { x: 0, y: 0 };

        const cropImage = document.getElementById('cropImage');
        const cropPreview = document.getElementById('cropPreview');
        const cropSlider = document.getElementById('cropSlider');
        const cropZoomValue = document.getElementById('cropZoomValue');

        cropImage.src = imageData;

        // Инициализация слайдера
        cropSlider.value = 100;
        cropZoomValue.textContent = '1.0x';

        cropImage.onload = () => {
            this.updateCropPreview();
        };

        // Mouse drag handlers
        const handleMouseDown = (e) => {
            TeamState.isDragging = true;
            TeamState.dragStart = {
                x: e.clientX - TeamState.cropSettings.posX,
                y: e.clientY - TeamState.cropSettings.posY
            };
            cropPreview.style.cursor = 'grabbing';
        };

        const handleMouseMove = (e) => {
            if (!TeamState.isDragging) return;

            TeamState.cropSettings.posX = e.clientX - TeamState.dragStart.x;
            TeamState.cropSettings.posY = e.clientY - TeamState.dragStart.y;
            this.updateCropPreview();
        };

        const handleMouseUp = () => {
            TeamState.isDragging = false;
            cropPreview.style.cursor = 'move';
        };

        // Wheel zoom handler
        const handleWheel = (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            TeamState.cropSettings.scale = Math.max(1, Math.min(3, TeamState.cropSettings.scale + delta));
            // Sync slider
            cropSlider.value = Math.round(TeamState.cropSettings.scale * 100);
            cropZoomValue.textContent = TeamState.cropSettings.scale.toFixed(1) + 'x';
            this.updateCropPreview();
        };

        // Slider zoom handler
        const handleSliderInput = () => {
            TeamState.cropSettings.scale = parseInt(cropSlider.value) / 100;
            cropZoomValue.textContent = TeamState.cropSettings.scale.toFixed(1) + 'x';
            this.updateCropPreview();
        };

        // Touch handlers
        let lastTouchDistance = 0;

        const handleTouchStart = (e) => {
            if (e.touches.length === 1) {
                TeamState.isDragging = true;
                TeamState.dragStart = {
                    x: e.touches[0].clientX - TeamState.cropSettings.posX,
                    y: e.touches[0].clientY - TeamState.cropSettings.posY
                };
            } else if (e.touches.length === 2) {
                lastTouchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
            e.preventDefault();
        };

        const handleTouchMove = (e) => {
            if (e.touches.length === 1 && TeamState.isDragging) {
                TeamState.cropSettings.posX = e.touches[0].clientX - TeamState.dragStart.x;
                TeamState.cropSettings.posY = e.touches[0].clientY - TeamState.dragStart.y;
                this.updateCropPreview();
            } else if (e.touches.length === 2) {
                const newDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = (newDist - lastTouchDistance) * 0.01;
                TeamState.cropSettings.scale = Math.max(1, Math.min(3, TeamState.cropSettings.scale + delta));
                lastTouchDistance = newDist;
                // Sync slider
                cropSlider.value = Math.round(TeamState.cropSettings.scale * 100);
                cropZoomValue.textContent = TeamState.cropSettings.scale.toFixed(1) + 'x';
                this.updateCropPreview();
            }
            e.preventDefault();
        };

        const handleTouchEnd = () => {
            TeamState.isDragging = false;
            lastTouchDistance = 0;
        };

        // Сохранить ссылки на handlers для очистки
        TeamState.cropHandlers = {
            handleMouseDown,
            handleMouseMove,
            handleMouseUp,
            handleWheel,
            handleSliderInput,
            handleTouchStart,
            handleTouchMove,
            handleTouchEnd
        };

        // Удалить старые listeners
        if (TeamState.oldCropHandlers) {
            cropPreview.removeEventListener('mousedown', TeamState.oldCropHandlers.handleMouseDown);
            document.removeEventListener('mousemove', TeamState.oldCropHandlers.handleMouseMove);
            document.removeEventListener('mouseup', TeamState.oldCropHandlers.handleMouseUp);
            cropPreview.removeEventListener('wheel', TeamState.oldCropHandlers.handleWheel);
            cropSlider.removeEventListener('input', TeamState.oldCropHandlers.handleSliderInput);
            cropPreview.removeEventListener('touchstart', TeamState.oldCropHandlers.handleTouchStart);
            cropPreview.removeEventListener('touchmove', TeamState.oldCropHandlers.handleTouchMove);
            cropPreview.removeEventListener('touchend', TeamState.oldCropHandlers.handleTouchEnd);
        }

        // Добавить новые listeners
        cropPreview.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        cropPreview.addEventListener('wheel', handleWheel, { passive: false });
        cropSlider.addEventListener('input', handleSliderInput);
        cropPreview.addEventListener('touchstart', handleTouchStart, { passive: false });
        cropPreview.addEventListener('touchmove', handleTouchMove, { passive: false });
        cropPreview.addEventListener('touchend', handleTouchEnd);

        TeamState.oldCropHandlers = TeamState.cropHandlers;

        // Phase 28 LIT-MIG-02: <app-modal> Lit component использует boolean attribute API
        const m = document.getElementById('cropModal');
        if (m.tagName === 'APP-MODAL') m.setAttribute('open', '');
        else m.classList.add('active');
    },

    /**
     * Обновление превью обрезки
     */
    updateCropPreview() {
        const cropImage = document.getElementById('cropImage');
        const cropPreview = document.getElementById('cropPreview');

        if (!cropImage.complete) return;

        const scale = TeamState.cropSettings.scale;
        const translateX = TeamState.cropSettings.posX;
        const translateY = TeamState.cropSettings.posY;

        // Вычисление начального размера для покрытия контейнера (как background-size: cover)
        const previewWidth = cropPreview.clientWidth;
        const previewHeight = cropPreview.clientHeight;
        const imgWidth = cropImage.naturalWidth;
        const imgHeight = cropImage.naturalHeight;

        const scaleToFit = Math.max(
            previewWidth / imgWidth,
            previewHeight / imgHeight
        );

        // Установка базового размера для покрытия контейнера
        cropImage.style.width = imgWidth * scaleToFit + 'px';
        cropImage.style.height = imgHeight * scaleToFit + 'px';

        // Применение transform: центрирование + смещение пользователя + масштаб пользователя
        cropImage.style.transform = `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${scale})`;
    },

    /**
     * Закрыть модальное окно обрезки
     */
    closeCropModal() {
        // Phase 28 LIT-MIG-02: <app-modal> compat
        const m = document.getElementById('cropModal');
        if (m.tagName === 'APP-MODAL') m.removeAttribute('open');
        else m.classList.remove('active');
        TeamState.tempImageData = null;
        TeamState.cropSettings = { scale: 1, posX: 0, posY: 0 };
        TeamState.isDragging = false;

        // Удалить event listeners
        const cropPreview = document.getElementById('cropPreview');
        const cropSlider = document.getElementById('cropSlider');
        const cropZoomValue = document.getElementById('cropZoomValue');

        if (TeamState.cropHandlers) {
            cropPreview.removeEventListener('mousedown', TeamState.cropHandlers.handleMouseDown);
            document.removeEventListener('mousemove', TeamState.cropHandlers.handleMouseMove);
            document.removeEventListener('mouseup', TeamState.cropHandlers.handleMouseUp);
            cropPreview.removeEventListener('wheel', TeamState.cropHandlers.handleWheel);
            cropSlider.removeEventListener('input', TeamState.cropHandlers.handleSliderInput);
            cropPreview.removeEventListener('touchstart', TeamState.cropHandlers.handleTouchStart);
            cropPreview.removeEventListener('touchmove', TeamState.cropHandlers.handleTouchMove);
            cropPreview.removeEventListener('touchend', TeamState.cropHandlers.handleTouchEnd);
            TeamState.cropHandlers = null;
            TeamState.oldCropHandlers = null;
        }

        // Сброс слайдера
        if (cropSlider) cropSlider.value = 100;
        if (cropZoomValue) cropZoomValue.textContent = '1.0x';

        document.getElementById('formAvatarInput').value = '';
    },

    /**
     * Применить обрезку и сохранить аватар
     */
    applyCrop() {
        const cropPreview = document.getElementById('cropPreview');

        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.onload = () => {
            const previewWidth = cropPreview.clientWidth;
            const previewHeight = cropPreview.clientHeight;

            const scale = TeamState.cropSettings.scale;
            const translateX = TeamState.cropSettings.posX;
            const translateY = TeamState.cropSettings.posY;

            const imgWidth = img.width;
            const imgHeight = img.height;

            // Вычисление масштаба для покрытия preview
            const scaleToFit = Math.max(
                previewWidth / imgWidth,
                previewHeight / imgHeight
            );

            // Вычисление отображаемого размера в пикселях
            const displayedWidth = imgWidth * scaleToFit * scale;
            const displayedHeight = imgHeight * scaleToFit * scale;

            // Вычисление позиции изображения в preview (верхний левый угол)
            const imgLeft = previewWidth / 2 - displayedWidth / 2 + translateX;
            const imgTop = previewHeight / 2 - displayedHeight / 2 + translateY;

            // Размер маски — 80% от preview (квадратный preview -> маска тоже квадрат)
            const maskSize = previewWidth * 0.8;
            const maskLeft = (previewWidth - maskSize) / 2;
            const maskTop = (previewHeight - maskSize) / 2;

            // Source rect в координатах оригинального изображения
            const srcX = (maskLeft - imgLeft) / (scaleToFit * scale);
            const srcY = (maskTop - imgTop) / (scaleToFit * scale);
            const srcW = maskSize / (scaleToFit * scale);
            const srcH = maskSize / (scaleToFit * scale);

            ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

            TeamState.currentAvatar = canvas.toDataURL('image/jpeg', 0.9);

            const formAvatar = document.getElementById('formAvatar');
            const placeholder = document.querySelector('.form-avatar-placeholder');
            formAvatar.src = TeamState.currentAvatar;
            formAvatar.classList.remove('hidden');
            formAvatar.classList.add('visible');
            if (placeholder) {
                placeholder.classList.remove('visible');
                placeholder.classList.add('hidden');
            }

            this.closeCropModal();
        };
        img.src = TeamState.tempImageData;
    }
};
