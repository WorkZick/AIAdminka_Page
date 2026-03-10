/**
 * PromptModal - Замена window.prompt() на кастомный модальный диалог
 * Использует CSS из shared/css/components/modal.css (.modal-confirm)
 *
 * Использование:
 *   const name = await PromptModal.show('Введите название:');
 *   const name = await PromptModal.show('Название:', { defaultValue: 'Мой шаблон' });
 *   const num = await PromptModal.show('Номер:', { placeholder: '1-5', confirmText: 'Выбрать' });
 */
const PromptModal = {
    _overlay: null,

    /**
     * Показать диалог ввода
     * @param {string} message - Основной текст
     * @param {Object} [options] - Опции
     * @param {string} [options.defaultValue=''] - Значение по умолчанию
     * @param {string} [options.placeholder=''] - Placeholder для input
     * @param {string} [options.confirmText='OK'] - Текст кнопки подтверждения
     * @param {string} [options.cancelText='Отмена'] - Текст кнопки отмены
     * @returns {Promise<string|null>} Введённый текст или null при отмене
     */
    show(message, options) {
        var opts = options || {};
        var defaultValue = opts.defaultValue || '';
        var placeholder = opts.placeholder || '';
        var confirmText = opts.confirmText || 'OK';
        var cancelText = opts.cancelText || 'Отмена';

        return new Promise(function(resolve) {
            PromptModal._remove();

            var overlay = document.createElement('div');
            overlay.className = 'modal active';
            overlay.id = 'promptModalOverlay';

            overlay.innerHTML =
                '<div class="modal-dialog modal-sm modal-confirm">' +
                    '<div class="modal-body">' +
                        '<p class="modal-message">' + PromptModal._escape(message) + '</p>' +
                        '<input type="text" class="prompt-modal-input"' +
                            ' value="' + PromptModal._escapeAttr(defaultValue) + '"' +
                            ' placeholder="' + PromptModal._escapeAttr(placeholder) + '"' +
                            ' autocomplete="off">' +
                    '</div>' +
                    '<div class="modal-footer modal-footer-center">' +
                        '<button class="btn-secondary btn-sm" data-prompt="cancel">' + PromptModal._escape(cancelText) + '</button>' +
                        '<button class="btn-primary btn-sm" data-prompt="ok">' + PromptModal._escape(confirmText) + '</button>' +
                    '</div>' +
                '</div>';

            PromptModal._overlay = overlay;
            document.body.appendChild(overlay);

            var input = overlay.querySelector('.prompt-modal-input');
            input.focus();
            input.select();

            function getValue() {
                return input.value;
            }

            function handleClick(e) {
                var action = e.target.getAttribute('data-prompt');
                if (action === 'ok') {
                    cleanup();
                    resolve(getValue());
                } else if (action === 'cancel') {
                    cleanup();
                    resolve(null);
                }
            }

            function handleKey(e) {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(null);
                } else if (e.key === 'Enter') {
                    cleanup();
                    resolve(getValue());
                }
            }

            function handleOverlayClick(e) {
                if (e.target === overlay) {
                    cleanup();
                    resolve(null);
                }
            }

            function cleanup() {
                overlay.removeEventListener('click', handleClick);
                document.removeEventListener('keydown', handleKey);
                overlay.removeEventListener('click', handleOverlayClick);
                PromptModal._remove();
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

    _escapeAttr: function(text) {
        if (!text) return '';
        return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _remove: function() {
        if (PromptModal._overlay && PromptModal._overlay.parentNode) {
            PromptModal._overlay.parentNode.removeChild(PromptModal._overlay);
        }
        PromptModal._overlay = null;
    }
};
