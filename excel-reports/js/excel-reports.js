// Excel Reports Application - Новая модульная архитектура

const excelApp = {
    // Модули
    state: null,
    navigator: null,
    fileProcessor: null,
    uiRenderer: null,
    utils: null,

    // Результат обработки
    result: null,

    // Инициализация приложения
    init() {
        try {
            // Инициализация модулей
            this.utils = new ExcelReportsUtils();
            this.state = new StateManager();
            this.navigator = new StepsNavigator(this.state);
            this.fileProcessor = new FileProcessor(this.utils);
            this.uiRenderer = new UIRenderer(this.state, this.navigator, this.utils);

            // Инициализация UI
            if (!this.uiRenderer.init()) {
                throw new Error('Не удалось инициализировать UI');
            }

            // Подписки на изменения состояния
            this.setupSubscriptions();

            // Подключаем event listeners
            this.setupEventListeners();

            // Рендерим начальный шаг (выбор шаблона)
            this.uiRenderer.renderStep('template');

            logger.log('Excel Reports готов к работе', 'success');
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            logger.log(`Ошибка инициализации: ${error.message}`, 'error');
        }
    },

    // Настройка подписок на изменения состояния
    setupSubscriptions() {
        // При изменении текущего шага - обновляем UI
        this.state.subscribe('currentStep', (newStep) => {
            this.uiRenderer.renderStep(newStep);
            logger.log(`Переход к шагу: ${newStep}`, 'info');
        });

        // При инициализации шагов - обновляем индикатор
        this.state.subscribe('stepsInitialized', (template) => {
            this.uiRenderer.updateStepsIndicator();
            logger.log(`Шаблон выбран: ${template.name}`, 'success');
        });
    },

    // Настройка event listeners для кнопок
    setupEventListeners() {
        // Log panel toggle buttons
        const logToggleBtn = document.getElementById('logToggleBtn');
        const logCloseBtn = document.getElementById('logCloseBtn');
        if (logToggleBtn) {
            logToggleBtn.addEventListener('click', toggleLogPanel);
        }
        if (logCloseBtn) {
            logCloseBtn.addEventListener('click', toggleLogPanel);
        }

        // Log clear button
        const logClearBtn = document.getElementById('logClearBtn');
        if (logClearBtn) {
            logClearBtn.addEventListener('click', () => logger.clear());
        }

        // Reset modal buttons
        const resetModalClose = document.getElementById('resetModalClose');
        const resetModalCancel = document.getElementById('resetModalCancel');
        const resetModalConfirm = document.getElementById('resetModalConfirm');

        if (resetModalClose) {
            resetModalClose.addEventListener('click', () => this.closeResetModal());
        }
        if (resetModalCancel) {
            resetModalCancel.addEventListener('click', () => this.closeResetModal());
        }
        if (resetModalConfirm) {
            resetModalConfirm.addEventListener('click', () => this.confirmReset());
        }

        // Event delegation для динамического контента
        this.setupEventDelegation();
    },

    // Настройка event delegation для динамически генерируемого HTML
    setupEventDelegation() {
        // Делегирование для кликов
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;

            switch (action) {
                case 'select-template':
                    e.preventDefault();
                    this.selectTemplate(target.dataset.templateId);
                    break;

                case 'toggle-components':
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleComponents(target.dataset.targetId, e);
                    break;

                case 'toggle-required-columns':
                    e.preventDefault();
                    this.toggleRequiredColumns(target.dataset.targetId, e);
                    break;

                case 'navigate-back':
                    e.preventDefault();
                    this.navigateBack();
                    break;

                case 'navigate-next':
                    e.preventDefault();
                    this.navigateNext();
                    break;

                case 'navigate-to-step':
                    e.preventDefault();
                    this.navigateToStep(target.dataset.stepId);
                    break;

                case 'show-reset-modal':
                    e.preventDefault();
                    this.showResetModal();
                    break;

                case 'process-files':
                    e.preventDefault();
                    this.processFiles();
                    break;
            }
        });

        // Делегирование для изменения файловых input'ов
        document.addEventListener('change', (e) => {
            const target = e.target;
            if (!target.matches('[data-action]')) return;

            const action = target.dataset.action;

            switch (action) {
                case 'upload-file':
                    this.handleFileUpload(target.dataset.stepId, target.files);
                    break;

                case 'upload-sub-file':
                    try {
                        const subFileConfig = JSON.parse(target.dataset.subFileConfig);
                        this.handleSubFileUpload(
                            target.dataset.stepId,
                            target.dataset.subFileId,
                            target.files,
                            subFileConfig
                        );
                    } catch (error) {
                        console.error('Ошибка парсинга конфигурации sub-file:', error);
                    }
                    break;
            }
        });
    },

    // ==================== ПУБЛИЧНЫЕ МЕТОДЫ (вызываются из HTML) ====================

    // Выбор шаблона
    selectTemplate(templateId) {
        try {
            // Находим шаблон
            const template = this.getTemplateById(templateId);
            if (!template) {
                throw new Error(`Шаблон ${templateId} не найден`);
            }

            // Инициализируем шаги на основе шаблона
            this.state.initializeSteps(template);

            // Переходим к первому файловому шагу
            const allSteps = this.navigator.getAllSteps();
            const firstFileStep = allSteps.find(step => step.type === 'file');

            if (firstFileStep) {
                this.navigator.navigateTo(firstFileStep.id);
            }

        } catch (error) {
            console.error('Ошибка выбора шаблона:', error);
            this.utils.showError(error.message);
            logger.log(`Ошибка: ${error.message}`, 'error');
        }
    },

    // Загрузка файлов для шага
    async handleFileUpload(stepId, files) {
        if (!files || files.length === 0) return;

        try {
            const template = this.state.get('selectedTemplate');
            if (!template || !template.filesConfig[stepId]) {
                throw new Error('Конфигурация шага не найдена');
            }

            const config = template.filesConfig[stepId];
            const totalFiles = files.length;

            // Показываем inline индикатор с прогрессом
            this.showInlineLoader(stepId, `Загрузка 1 из ${totalFiles}...`, 0, totalFiles);

            logger.log(`Начало загрузки ${totalFiles} файл(ов) для шага ${stepId}`, 'info');

            // Загружаем файлы с callback прогресса
            const results = await this.fileProcessor.loadFiles(
                Array.from(files),
                config,
                (current, total, fileName) => {
                    this.updateInlineLoader(stepId, current, total, fileName);
                }
            );

            // Скрываем inline индикатор
            this.hideInlineLoader(stepId);

            // Проверяем результаты
            if (!this.fileProcessor.areAllValid(results)) {
                const errorMessage = this.fileProcessor.formatResults(results);
                logger.log(errorMessage, 'error');
                this.utils.showError('Ошибка загрузки файлов. См. детали в журнале.');
                return;
            }

            // Сохраняем данные в состояние
            const mergedData = this.fileProcessor.mergeFileData(results);
            this.state.setStepData(stepId, mergedData);
            this.state.setStepFiles(stepId, Array.from(files).map(f => f.name));
            this.state.markStepCompleted(stepId, mergedData);

            // Логируем успех
            const stats = this.fileProcessor.getLoadStats(results);
            logger.log(`✓ Загружено: ${stats.successful} файл(ов), ${stats.totalRows} строк`, 'success');

            // Обновляем UI
            this.uiRenderer.renderStep(stepId);
            this.uiRenderer.updateStepsIndicator();

        } catch (error) {
            this.hideInlineLoader(stepId);
            console.error('Ошибка загрузки файлов:', error);
            this.utils.showError(error.message);
            logger.log(`Ошибка: ${error.message}`, 'error');
        }
    },

    // Загрузка файлов для sub-шага
    async handleSubFileUpload(stepId, subFileId, files, subFileConfig) {
        if (!files || files.length === 0) return;

        try {
            const subId = `${stepId}_${subFileId}`;

            // Показываем inline индикатор для subFile
            this.showSubFileLoader(subId, subFileConfig.name);

            logger.log(`Начало загрузки файла для ${subFileConfig.name}`, 'info');

            // Загружаем файл
            const results = await this.fileProcessor.loadFiles(Array.from(files), subFileConfig);

            // Скрываем индикатор
            this.hideSubFileLoader(subId);

            // Проверяем результаты
            if (!this.fileProcessor.areAllValid(results)) {
                const errorMessage = this.fileProcessor.formatResults(results);
                logger.log(errorMessage, 'error');
                this.utils.showError('Ошибка загрузки файла. См. детали в журнале.');
                return;
            }

            // Сохраняем данные для subFile
            const mergedData = this.fileProcessor.mergeFileData(results);
            this.state.setStepData(subId, mergedData);
            this.state.setStepFiles(subId, Array.from(files).map(f => f.name));

            // Сохраняем данные в основной шаг для обработки
            const template = this.state.get('selectedTemplate');
            const config = template.filesConfig[stepId];

            // Собираем данные всех subFiles
            const allSubFilesData = {};
            config.subFiles.forEach(sf => {
                const sid = `${stepId}_${sf.id}`;
                const data = this.state.getStepData(sid);
                if (data) {
                    allSubFilesData[sf.id] = data;
                }
            });

            // Сохраняем объединённые данные для основного шага
            this.state.setStepData(stepId, allSubFilesData);

            // Проверяем все ли subFiles загружены
            const allLoaded = config.subFiles.every(sf => {
                const sid = `${stepId}_${sf.id}`;
                return this.state.getStepData(sid) !== null;
            });

            if (allLoaded) {
                this.state.markStepCompleted(stepId, allSubFilesData);
            }

            // Логируем успех
            const stats = this.fileProcessor.getLoadStats(results);
            logger.log(`✓ Загружено: ${subFileConfig.name}, ${stats.totalRows} строк`, 'success');

            // Обновляем UI
            this.uiRenderer.renderStep(stepId);
            this.uiRenderer.updateStepsIndicator();

        } catch (error) {
            this.hideSubFileLoader(`${stepId}_${subFileId}`);
            console.error('Ошибка загрузки файла:', error);
            this.utils.showError(error.message);
            logger.log(`Ошибка: ${error.message}`, 'error');
        }
    },

    // Показать inline loader для основного шага
    showInlineLoader(stepId, message, current = 0, total = 1) {
        const uploadArea = document.querySelector(`#fileInput_${stepId}`)?.closest('.file-upload-label');
        if (uploadArea) {
            const percent = total > 0 ? Math.round((current / total) * 100) : 0;
            const loader = document.createElement('div');
            loader.id = `loader_${stepId}`;
            loader.className = 'inline-loader';
            loader.innerHTML = `
                <div class="inline-loader-content">
                    <div class="inline-loader-header">
                        <div class="inline-loader-spinner"></div>
                        <span class="inline-loader-text">${message}</span>
                    </div>
                    <div class="inline-loader-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" data-percent="${percent}"></div>
                        </div>
                        <span class="progress-percent">${percent}%</span>
                    </div>
                    <div class="inline-loader-filename"></div>
                </div>
            `;
            uploadArea.parentNode.insertBefore(loader, uploadArea.nextSibling);

            // Применяем процент через data-атрибут и CSS
            const fill = loader.querySelector('.progress-fill');
            if (fill) {
                fill.style.setProperty('--progress-width', `${percent}%`);
            }

            uploadArea.classList.add('loading');
        }
    },

    // Обновить прогресс inline loader
    updateInlineLoader(stepId, current, total, fileName) {
        const loader = document.getElementById(`loader_${stepId}`);
        if (!loader) return;

        const percent = Math.round((current / total) * 100);
        const text = loader.querySelector('.inline-loader-text');
        const fill = loader.querySelector('.progress-fill');
        const percentText = loader.querySelector('.progress-percent');
        const fileNameEl = loader.querySelector('.inline-loader-filename');

        if (text) text.textContent = `Загрузка ${current} из ${total}`;
        if (fill) fill.style.setProperty('--progress-width', `${percent}%`);
        if (percentText) percentText.textContent = `${percent}%`;
        if (fileNameEl) fileNameEl.textContent = fileName;
    },

    // Скрыть inline loader
    hideInlineLoader(stepId) {
        const loader = document.getElementById(`loader_${stepId}`);
        if (loader) loader.remove();

        const uploadArea = document.querySelector(`#fileInput_${stepId}`)?.closest('.file-upload-label');
        if (uploadArea) {
            uploadArea.classList.remove('loading');
        }
    },

    // Показать loader для subFile
    showSubFileLoader(subId, name) {
        const card = document.querySelector(`#fileInput_${subId}`)?.closest('.sub-file-card');
        if (card) {
            card.classList.add('loading');
            const uploadArea = card.querySelector('.file-upload-area-compact');
            if (uploadArea) {
                uploadArea.innerHTML = `
                    <div class="inline-loader-spinner"></div>
                    <div class="upload-text-compact">Загрузка...</div>
                `;
            }
        }
    },

    // Скрыть loader для subFile
    hideSubFileLoader(subId) {
        const card = document.querySelector(`#fileInput_${subId}`)?.closest('.sub-file-card');
        if (card) {
            card.classList.remove('loading');
        }
    },

    // Навигация к шагу (клик по индикатору)
    navigateToStep(stepId) {
        if (this.navigator.navigateTo(stepId)) {
            // Навигация успешна, UI обновится через подписку
        } else {
            logger.log(`Невозможно перейти к шагу: ${stepId}`, 'warning');
        }
    },

    // Навигация назад
    navigateBack() {
        if (this.navigator.navigateBack()) {
            // Навигация успешна, UI обновится через подписку
        } else {
            logger.log('Невозможно вернуться назад', 'warning');
        }
    },

    // Навигация вперёд
    navigateNext() {
        if (this.navigator.navigateNext()) {
            // Навигация успешна, UI обновится через подписку
        } else {
            logger.log('Невозможно перейти к следующему шагу', 'warning');
        }
    },

    // Обработка и экспорт данных
    async processFiles() {
        try {
            const template = this.state.get('selectedTemplate');
            if (!template) {
                throw new Error('Шаблон не выбран');
            }

            if (!this.navigator.areAllFilesLoaded()) {
                throw new Error('Не все файлы загружены');
            }

            this.uiRenderer.showLoadingSpinner('Обработка данных...');
            logger.log('Начало обработки данных...', 'info');

            // Собираем данные из всех шагов
            const fileSteps = Object.keys(template.filesConfig);
            const stepsData = {};
            fileSteps.forEach(stepId => {
                stepsData[stepId] = this.state.getStepData(stepId);
            });

            // Вызываем обработчик шаблона
            this.result = template.handler(stepsData);

            this.uiRenderer.hideLoadingSpinner();

            if (!this.result) {
                throw new Error('Обработка не вернула результат');
            }

            logger.log('✓ Данные успешно обработаны', 'success');

            // Сразу экспортируем
            await this.exportResult();

        } catch (error) {
            this.uiRenderer.hideLoadingSpinner();
            console.error('Ошибка обработки:', error);
            this.utils.showError(error.message);
            logger.log(`Ошибка: ${error.message}`, 'error');
        }
    },

    // Экспорт результата
    async exportResult() {
        if (!this.result) {
            this.utils.showError('Нет данных для экспорта');
            return;
        }

        try {
            this.uiRenderer.showLoadingSpinner('Экспорт в Excel...');

            const template = this.state.get('selectedTemplate');
            const workbook = new ExcelJS.Workbook();

            // Создаём листы из результата
            for (const [sheetName, sheetData] of Object.entries(this.result.sheets)) {
                const worksheet = workbook.addWorksheet(sheetName);

                // Устанавливаем ширину колонок
                if (sheetData.columns) {
                    sheetData.columns.forEach((col, idx) => {
                        worksheet.getColumn(idx + 1).width = col.width || 10;
                    });
                }

                // Добавляем данные
                if (sheetData.data) {
                    sheetData.data.forEach(row => {
                        worksheet.addRow(row);
                    });
                }

                // Применяем объединения ячеек
                if (sheetData.merges) {
                    sheetData.merges.forEach(merge => {
                        worksheet.mergeCells(merge);
                    });
                }

                // Применяем стили
                if (sheetData.styles) {
                    sheetData.styles.forEach(styleInfo => {
                        const cell = worksheet.getCell(styleInfo.cell);

                        if (styleInfo.fill) {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: styleInfo.fill }
                            };
                        }

                        if (styleInfo.font) {
                            cell.font = styleInfo.font;
                        }

                        if (styleInfo.border) {
                            cell.border = styleInfo.border;
                        }

                        if (styleInfo.alignment) {
                            cell.alignment = styleInfo.alignment;
                        }

                        if (styleInfo.numFmt) {
                            cell.numFmt = styleInfo.numFmt;
                        }
                    });
                }

                // Устанавливаем высоту строк
                if (sheetData.rowHeights) {
                    Object.entries(sheetData.rowHeights).forEach(([rowNum, height]) => {
                        worksheet.getRow(parseInt(rowNum)).height = height;
                    });
                }
            }

            // Генерируем файл
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            // Скачиваем
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${template.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
            link.click();
            window.URL.revokeObjectURL(url);

            this.uiRenderer.hideLoadingSpinner();
            this.utils.showSuccess('Файл успешно сохранён');
            logger.log('✓ Файл успешно экспортирован', 'success');

        } catch (error) {
            this.uiRenderer.hideLoadingSpinner();
            console.error('Ошибка экспорта:', error);
            this.utils.showError(error.message);
            logger.log(`Ошибка экспорта: ${error.message}`, 'error');
        }
    },

    // Показать модальное окно подтверждения сброса
    showResetModal() {
        document.getElementById('resetModal').classList.add('active');
    },

    // Закрыть модальное окно подтверждения сброса
    closeResetModal() {
        document.getElementById('resetModal').classList.remove('active');
    },

    // Подтверждение и выполнение сброса
    confirmReset() {
        this.closeResetModal();
        this.state.reset();
        this.result = null;
        this.navigator.navigateTo('template');
        logger.log('Приложение сброшено', 'info');
        this.utils.showSuccess('Данные очищены. Начните заново.');
    },

    // Переключение сайдбара
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
        }
    },

    // Переключение списка требуемых колонок
    toggleRequiredColumns(uniqueId, event) {
        const list = document.getElementById(uniqueId);
        const icon = event?.target.closest('.required-columns-toggle')?.querySelector('.toggle-icon');

        if (list && icon) {
            const isHidden = list.classList.contains('hidden');
            if (isHidden) {
                list.classList.remove('hidden');
                icon.textContent = '▼';
            } else {
                list.classList.add('hidden');
                icon.textContent = '▶';
            }
        }
    },

    // Переключение списка компонентов отчёта
    toggleComponents(uniqueId, event) {
        // Останавливаем всплытие события, чтобы не сработал клик по карточке
        if (event) {
            event.stopPropagation();
        }

        const list = document.getElementById(uniqueId);
        const icon = event?.target.closest('.components-toggle')?.querySelector('.toggle-icon');

        if (list && icon) {
            const isHidden = list.classList.contains('hidden');
            if (isHidden) {
                list.classList.remove('hidden');
                icon.textContent = '▼';
            } else {
                list.classList.add('hidden');
                icon.textContent = '▶';
            }
        }
    },

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    // Получить шаблон по ID
    getTemplateById(templateId) {
        const templateMap = {
            'registrations': window.TEMPLATE_REGISTRATIONS,
            'active-users': window.TEMPLATE_ACTIVE_USERS,
            'deposits-withdrawals': window.TEMPLATE_DEPOSITS_WITHDRAWALS,
            'combined-report': window.TEMPLATE_COMBINED_REPORT,
            'b-tag': window.TEMPLATE_B_TAG,
            'analytics-t9': window.TEMPLATE_ANALYTICS_T9
        };

        return templateMap[templateId] || null;
    }
};

// Глобальная функция для toggle log panel
function toggleLogPanel() {
    const drawer = document.getElementById('logDrawer');
    const btn = document.getElementById('logToggleBtn');
    if (drawer) {
        drawer.classList.toggle('open');
    }
    if (btn) {
        btn.classList.toggle('hidden');
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication and role status (waiting_invite/blocked check)
    if (!await AuthGuard.checkWithRole()) {
        return; // Will redirect to login or waiting-invite
    }

    // Инициализация компонентов
    ComponentLoader.init('../shared');
    await ComponentLoader.load('sidebar', '#sidebar-container', {
        basePath: '..',
        activeModule: 'reports'
    });
    await ComponentLoader.load('about-modal', '#about-modal-container', {
        basePath: '..'
    });
    SidebarController.init({ basePath: '..' });

    // Инициализация приложения
    excelApp.init();

    // Обработчик клика по overlay модального окна сброса
    const resetModal = document.getElementById('resetModal');
    if (resetModal) {
        resetModal.addEventListener('click', function(e) {
            if (e.target === this) excelApp.closeResetModal();
        });
    }
});
