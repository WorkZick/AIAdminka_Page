/**
 * ConfirmModal - Замена window.confirm() на кастомный модальный диалог
 * Использует CSS из shared/css/components/modal.css (.modal-confirm)
 *
 * Использование:
 *   const ok = await ConfirmModal.show('Удалить запись?');
 *   const ok = await ConfirmModal.show('Удалить?', { description: 'Это действие нельзя отменить' });
 *   const ok = await ConfirmModal.show('Сбросить?', { confirmText: 'Сбросить', danger: true });
 */
const ConfirmModal = {
    _overlay: null,

    /**
     * Показать диалог подтверждения
     * @param {string} message - Основной текст
     * @param {Object} [options] - Опции
     * @param {string} [options.description] - Дополнительное описание
     * @param {string} [options.confirmText='Подтвердить'] - Текст кнопки подтверждения
     * @param {string} [options.cancelText='Отмена'] - Текст кнопки отмены
     * @param {boolean} [options.danger=false] - Красная кнопка подтверждения
     * @returns {Promise<boolean>} true если подтверждено
     */
    show(message, options) {
        var opts = options || {};
        var confirmText = opts.confirmText || 'Подтвердить';
        var cancelText = opts.cancelText || 'Отмена';
        var description = opts.description || '';
        var isDanger = opts.danger || false;

        return new Promise(function(resolve) {
            // Удаляем предыдущий диалог если есть
            ConfirmModal._remove();

            // Создаём overlay
            var overlay = document.createElement('div');
            overlay.className = 'modal active';
            overlay.id = 'confirmModalOverlay';

            var btnClass = isDanger ? 'btn-danger btn-sm' : 'btn-primary btn-sm';

            overlay.innerHTML =
                '<div class="modal-dialog modal-sm modal-confirm">' +
                    '<div class="modal-body">' +
                        '<p class="modal-message">' + ConfirmModal._escape(message) + '</p>' +
                        (description ? '<p class="modal-description">' + ConfirmModal._escape(description) + '</p>' : '') +
                    '</div>' +
                    '<div class="modal-footer modal-footer-center">' +
                        '<button class="btn-secondary btn-sm" data-confirm="cancel">' + ConfirmModal._escape(cancelText) + '</button>' +
                        '<button class="' + btnClass + '" data-confirm="ok">' + ConfirmModal._escape(confirmText) + '</button>' +
                    '</div>' +
                '</div>';

            ConfirmModal._overlay = overlay;
            document.body.appendChild(overlay);

            // Фокус на кнопку подтверждения
            var confirmBtn = overlay.querySelector('[data-confirm="ok"]');
            if (confirmBtn) confirmBtn.focus();

            // Обработчики
            function handleClick(e) {
                var action = e.target.getAttribute('data-confirm');
                if (action === 'ok') {
                    cleanup();
                    resolve(true);
                } else if (action === 'cancel') {
                    cleanup();
                    resolve(false);
                }
            }

            function handleKey(e) {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                } else if (e.key === 'Enter') {
                    cleanup();
                    resolve(true);
                }
            }

            function handleOverlayClick(e) {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            }

            function cleanup() {
                overlay.removeEventListener('click', handleClick);
                document.removeEventListener('keydown', handleKey);
                overlay.removeEventListener('click', handleOverlayClick);
                ConfirmModal._remove();
            }

            overlay.addEventListener('click', handleClick);
            document.addEventListener('keydown', handleKey);
            overlay.addEventListener('click', handleOverlayClick);
        });
    },

    _escape: function(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    _remove: function() {
        if (ConfirmModal._overlay && ConfirmModal._overlay.parentNode) {
            ConfirmModal._overlay.parentNode.removeChild(ConfirmModal._overlay);
        }
        ConfirmModal._overlay = null;
    }
};
