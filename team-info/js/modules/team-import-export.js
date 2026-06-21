/**
 * Team Import/Export Module
 * Импорт и экспорт данных сотрудников
 */

const TeamImportExport = {
    /**
     * Показать диалог экспорта
     */
    showExportDialog() {
        if (TeamState.data.length === 0) {
            Toast.warning('Нет данных для экспорта');
            return;
        }
        const count = TeamState.data.length;
        const word = count === 1 ? 'сотрудник' : (count >= 2 && count <= 4) ? 'сотрудника' : 'сотрудников';
        document.getElementById('exportCount').textContent = `Будет экспортировано: ${count} ${word}`;
        // Phase 28 LIT-MIG-02: <app-modal> Lit component использует boolean attribute API
        const m = document.getElementById('exportModal');
        if (m.tagName === 'APP-MODAL') m.setAttribute('open', '');
        else m.classList.add('active');
    },

    /**
     * Закрыть диалог экспорта
     */
    closeExportDialog() {
        // Phase 28 LIT-MIG-02: <app-modal> compat
        const m = document.getElementById('exportModal');
        if (m.tagName === 'APP-MODAL') m.removeAttribute('open');
        else m.classList.remove('active');
    },

    /**
     * Выполнить экспорт
     */
    async doExport() {
        if (await storage.exportToFile(TeamState.data)) {
            this.closeExportDialog();
            const ec = TeamState.data.length;
            const ew = ec === 1 ? 'сотрудник' : (ec >= 2 && ec <= 4) ? 'сотрудника' : 'сотрудников';
            Toast.success(`Экспортировано ${ec} ${ew}!`);
        } else {
            Toast.error('Ошибка экспорта');
        }
    },

    /**
     * Показать диалог импорта
     */
    showImportDialog() {
        // Phase 28 LIT-MIG-02: <app-modal> Lit component использует boolean attribute API
        const m = document.getElementById('importModal');
        if (m.tagName === 'APP-MODAL') m.setAttribute('open', '');
        else m.classList.add('active');

        const fileInput = document.getElementById('importFileInput');
        const preview = document.getElementById('importPreview');
        const importBtn = document.getElementById('importBtn');

        fileInput.value = '';
        preview.classList.remove('visible');
        preview.classList.add('hidden');
        importBtn.disabled = true;

        // Удалить старый обработчик если существует
        if (TeamState.importFileHandler) {
            fileInput.removeEventListener('change', TeamState.importFileHandler);
        }

        // Создать новый обработчик
        TeamState.importFileHandler = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            // MIME-type detection не всегда работает (некоторые браузеры/конфигурации
            // не выставляют 'application/json' для .json файлов). Fallback по extension.
            const isJsonFile = file.type === 'application/json' || /\.json$/i.test(file.name);
            if (!isJsonFile) {
                preview.innerHTML = '❌ Поддерживается только формат JSON';
                preview.classList.remove('hidden');
                preview.classList.add('visible');
                importBtn.disabled = true;
                return;
            }
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                const count = (data.data && data.data.length) || (Array.isArray(data) ? data.length : 0);

                if (count > 0) {
                    preview.innerHTML = `✅ Готов к импорту: ${count} записей`;
                    preview.classList.remove('hidden');
                    preview.classList.add('visible');
                    importBtn.disabled = false;
                } else {
                    preview.innerHTML = '⚠️ Нет данных';
                    preview.classList.remove('hidden');
                    preview.classList.add('visible');
                    importBtn.disabled = true;
                }
            } catch (error) {
                preview.innerHTML = '❌ Неверный формат';
                preview.classList.remove('hidden');
                preview.classList.add('visible');
                importBtn.disabled = true;
            }
        };

        fileInput.addEventListener('change', TeamState.importFileHandler);
    },

    /**
     * Закрыть диалог импорта
     */
    closeImportDialog() {
        // Phase 28 LIT-MIG-02: <app-modal> compat
        const m = document.getElementById('importModal');
        if (m.tagName === 'APP-MODAL') m.removeAttribute('open');
        else m.classList.remove('active');
    },

    /**
     * Выполнить импорт
     */
    async importData() {
        const file = document.getElementById('importFileInput').files[0];
        if (!file) return;

        if (await ConfirmModal.show('Заменить всех сотрудников?', { description: 'Текущие данные будут перезаписаны', danger: true })) {
            try {
                TeamState.data = await storage.importFromFile(file);
                TeamState._rebuildSearchableText();
                TeamState._invalidateFiltered();
                await storage.saveData(TeamState.data);
                TeamRenderer.render();
                TeamRenderer.updateStats();
                this.closeImportDialog();
                const ic = TeamState.data.length;
                const iw = ic === 1 ? 'сотрудник' : (ic >= 2 && ic <= 4) ? 'сотрудника' : 'сотрудников';
                Toast.success(`Импортировано ${ic} ${iw}!`);
            } catch (error) {
                Toast.error('Ошибка импорта: ' + error.message);
            }
        }
    }
};
