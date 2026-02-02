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
        document.getElementById('exportCount').textContent = `Будет экспортировано: ${TeamState.data.length} сотрудников`;
        document.getElementById('exportModal').classList.add('active');
    },

    /**
     * Закрыть диалог экспорта
     */
    closeExportDialog() {
        document.getElementById('exportModal').classList.remove('active');
    },

    /**
     * Выполнить экспорт
     */
    async doExport() {
        if (await storage.exportToFile(TeamState.data)) {
            this.closeExportDialog();
            Toast.success(`Экспортировано ${TeamState.data.length} сотрудников!`);
        } else {
            Toast.error('Ошибка экспорта');
        }
    },

    /**
     * Показать диалог импорта
     */
    showImportDialog() {
        document.getElementById('importModal').classList.add('active');

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
            if (file && file.type === 'application/json') {
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
                    }
                } catch (error) {
                    preview.innerHTML = '❌ Неверный формат';
                    preview.classList.remove('hidden');
                    preview.classList.add('visible');
                }
            }
        };

        fileInput.addEventListener('change', TeamState.importFileHandler);
    },

    /**
     * Закрыть диалог импорта
     */
    closeImportDialog() {
        document.getElementById('importModal').classList.remove('active');
    },

    /**
     * Выполнить импорт
     */
    async importData() {
        const file = document.getElementById('importFileInput').files[0];
        if (!file) return;

        if (confirm('Заменить всех сотрудников?')) {
            try {
                TeamState.data = await storage.importFromFile(file);
                await storage.saveData(TeamState.data);
                TeamRenderer.render();
                TeamRenderer.updateStats();
                this.closeImportDialog();
                Toast.success(`Импортировано ${TeamState.data.length} сотрудников!`);
            } catch (error) {
                Toast.error('Ошибка импорта: ' + error.message);
            }
        }
    }
};
