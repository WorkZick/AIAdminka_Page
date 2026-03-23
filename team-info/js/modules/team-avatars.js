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
        cropImage.src = imageData;

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
            TeamState.cropSettings.scale = Math.max(0.5, Math.min(3, TeamState.cropSettings.scale + delta));
            this.updateCropPreview();
        };

        // Сохранить ссылки на handlers для очистки
        TeamState.cropHandlers = {
            handleMouseDown,
            handleMouseMove,
            handleMouseUp,
            handleWheel
        };

        // Удалить старые listeners
        if (TeamState.oldCropHandlers) {
            cropPreview.removeEventListener('mousedown', TeamState.oldCropHandlers.handleMouseDown);
            document.removeEventListener('mousemove', TeamState.oldCropHandlers.handleMouseMove);
            document.removeEventListener('mouseup', TeamState.oldCropHandlers.handleMouseUp);
            cropPreview.removeEventListener('wheel', TeamState.oldCropHandlers.handleWheel);
        }

        // Добавить новые listeners
        cropPreview.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        cropPreview.addEventListener('wheel', handleWheel, { passive: false });

        TeamState.oldCropHandlers = TeamState.cropHandlers;

        document.getElementById('cropModal').classList.add('active');
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
        document.getElementById('cropModal').classList.remove('active');
        TeamState.tempImageData = null;
        TeamState.cropSettings = { scale: 1, posX: 0, posY: 0 };
        TeamState.isDragging = false;

        // Удалить event listeners
        const cropPreview = document.getElementById('cropPreview');
        if (TeamState.cropHandlers) {
            cropPreview.removeEventListener('mousedown', TeamState.cropHandlers.handleMouseDown);
            document.removeEventListener('mousemove', TeamState.cropHandlers.handleMouseMove);
            document.removeEventListener('mouseup', TeamState.cropHandlers.handleMouseUp);
            cropPreview.removeEventListener('wheel', TeamState.cropHandlers.handleWheel);
            TeamState.cropHandlers = null;
            TeamState.oldCropHandlers = null;
        }

        document.getElementById('formAvatarInput').value = '';
    },

    /**
     * Применить обрезку и сохранить аватар
     */
    applyCrop() {
        const cropImage = document.getElementById('cropImage');
        const cropPreview = document.getElementById('cropPreview');

        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
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

            // Вычисление видимой части оригинального изображения в preview
            const visibleLeft = Math.max(0, -imgLeft);
            const visibleTop = Math.max(0, -imgTop);
            const visibleRight = Math.min(displayedWidth, previewWidth - imgLeft);
            const visibleBottom = Math.min(displayedHeight, previewHeight - imgTop);

            const visibleWidth = visibleRight - visibleLeft;
            const visibleHeight = visibleBottom - visibleTop;

            // Преобразование видимой области обратно в координаты оригинального изображения
            const sourceX = (visibleLeft / displayedWidth) * imgWidth;
            const sourceY = (visibleTop / displayedHeight) * imgHeight;
            const sourceWidth = (visibleWidth / displayedWidth) * imgWidth;
            const sourceHeight = (visibleHeight / displayedHeight) * imgHeight;

            // Отрисовка видимой части для заполнения всего canvas (растягивание до квадрата)
            ctx.drawImage(
                img,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                0,
                0,
                canvas.width,
                canvas.height
            );

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
