// UIRenderer - Рендеринг UI компонентов

class UIRenderer {
    constructor(stateManager, navigator, utils) {
        this.state = stateManager;
        this.navigator = navigator;
        this.utils = utils;
        this.containers = {
            stepsIndicator: null,
            mainContent: null
        };
    }

    // Инициализация контейнеров
    init() {
        this.containers.stepsIndicator = document.getElementById('stepsIndicator');
        this.containers.mainContent = document.getElementById('mainContent');

        if (!this.containers.stepsIndicator || !this.containers.mainContent) {
            console.error('Не найдены контейнеры для рендеринга');
            return false;
        }

        return true;
    }

    // ==================== РЕНДЕРИНГ ШАГОВ ====================

    // Рендеринг текущего шага
    renderStep(stepId) {
        if (!this.containers.mainContent) return;

        const stepInfo = this.navigator.getStepInfo(stepId);
        if (!stepInfo) {
            this.renderError('Шаг не найден');
            return;
        }

        let html = '';

        switch (stepInfo.type) {
            case 'template':
                html = this.renderTemplateSelection();
                break;
            case 'file':
                html = this.renderFileUpload(stepId, stepInfo.config);
                break;
            case 'process':
                html = this.renderProcessSection();
                break;
            default:
                html = this.renderError('Неизвестный тип шага');
        }

        this.containers.mainContent.innerHTML = html;

        // Обновляем индикатор шагов
        this.updateStepsIndicator();
    }

    // Рендеринг выбора шаблона
    renderTemplateSelection() {
        const selectedTemplate = this.state.get('selectedTemplate');

        // Главный шаблон
        const mainTemplate = { id: 'combined-report', obj: window.TEMPLATE_COMBINED_REPORT };

        // Компоненты отчёта
        const reportComponents = [
            { id: 'registrations', obj: window.TEMPLATE_REGISTRATIONS },
            { id: 'active-users', obj: window.TEMPLATE_ACTIVE_USERS },
            { id: 'deposits-withdrawals', obj: window.TEMPLATE_DEPOSITS_WITHDRAWALS },
            { id: 'b-tag', obj: window.TEMPLATE_B_TAG },
            { id: 'analytics-t9', obj: window.TEMPLATE_ANALYTICS_T9 }
        ];

        const uniqueId = this.utils.generateId('components');

        let html = `
            <div class="step-content">
                <div class="step-header-nav">
                    <div class="nav-left"></div>
                    <div class="nav-right"></div>
                </div>
        `;

        // Главный шаблон (Общий отчёт)
        if (mainTemplate.obj) {
            const isSelected = selectedTemplate && selectedTemplate.id === mainTemplate.id;
            const selectedClass = isSelected ? 'selected' : '';

            html += `
                <div class="template-featured-section">
                    <div class="template-card-featured ${selectedClass}" onclick="excelApp.selectTemplate('${mainTemplate.id}')">
                        <div class="featured-badge">Общий отчёт</div>
                        <div class="template-header">
                            <h3>${mainTemplate.obj.name}</h3>
                            ${isSelected ? '<span class="selected-badge"><img src="icons/done.svg" width="12" height="12" alt="✓"> Выбран</span>' : ''}
                        </div>
                        <p class="template-description">${mainTemplate.obj.description}</p>

                        <div class="template-components">
                            <button type="button" class="components-toggle" onclick="excelApp.toggleComponents('${uniqueId}', event)">
                                <span class="toggle-icon">▶</span>
                                <span class="toggle-text">Из чего состоит</span>
                                <span class="components-count">(${reportComponents.length} отчётов)</span>
                            </button>
                            <div id="${uniqueId}" class="components-list" style="display: none;">
                                <ul>
        `;

            reportComponents.forEach(({ id, obj }) => {
                if (!obj) return;
                html += `
                    <li class="component-item" onclick="event.stopPropagation(); excelApp.selectTemplate('${id}');">
                        <div class="component-info">
                            <span class="component-name">${obj.name}</span>
                            <span class="component-desc">${obj.description}</span>
                        </div>
                        <span class="component-arrow">→</span>
                    </li>
                `;
            });

            html += `
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        }

        return html;
    }

    // Рендеринг загрузки файлов
    renderFileUpload(stepId, config) {
        // Навигационные кнопки
        const prevStep = this.navigator.getPreviousStep();
        const nextStep = this.navigator.getNextStep();
        const isCompleted = this.navigator.isStepCompleted(stepId);

        let html = `
            <div class="step-content">
                <div class="step-header-nav">
                    <div class="nav-left">
                        ${prevStep ? `
                            <button class="btn-nav btn-back" onclick="excelApp.navigateBack()">
                                ← Назад
                            </button>
                        ` : ''}
                    </div>
                    <h2>${config.name}</h2>
                    <div class="nav-right">
                        ${nextStep && isCompleted ? `
                            <button class="btn-nav btn-next" onclick="excelApp.navigateNext()">
                                Далее →
                            </button>
                        ` : ''}
                    </div>
                </div>
        `;

        // Если есть subFiles - показываем несколько секций загрузки
        if (config.subFiles && config.subFiles.length > 0) {
            html += `<p class="step-description">Загрузите файлы для каждого периода</p>`;

            // Требуемые колонки один раз для всего шага (если они одинаковые)
            const firstSubFile = config.subFiles[0];
            if (firstSubFile.requiredColumns && firstSubFile.requiredColumns.length > 0) {
                const uniqueId = this.utils.generateId('required-cols');
                const columnsList = firstSubFile.requiredColumns
                    .map(col => `<li>${col}</li>`)
                    .join('');

                html += `
                    <div class="required-columns-block">
                        <button type="button" class="required-columns-toggle" onclick="excelApp.toggleRequiredColumns('${uniqueId}', event)">
                            <span class="toggle-icon">▶</span>
                            <span class="toggle-text">Требуемые колонки</span>
                            <span class="columns-count">(${firstSubFile.requiredColumns.length})</span>
                        </button>
                        <div id="${uniqueId}" class="required-columns-list" style="display: none;">
                            <ul>${columnsList}</ul>
                        </div>
                    </div>
                `;
            }

            // Два столбца для subFiles
            html += `<div class="sub-files-grid">`;

            config.subFiles.forEach((subFile) => {
                const subId = `${stepId}_${subFile.id}`;
                const subData = this.state.getStepData(subId);
                const subFiles = this.state.getStepFiles(subId);
                const subCompleted = subData && subData.length > 0;

                // Извлекаем короткое название (последняя часть после " - ")
                const shortName = subFile.name.split(' - ').pop();

                html += `
                    <div class="sub-file-card">
                        <h3 class="sub-file-card-title">${shortName}</h3>
                        <label class="file-upload-label">
                            <input type="file"
                                   id="fileInput_${subId}"
                                   accept=".xlsx,.xls"
                                   onchange="excelApp.handleSubFileUpload('${stepId}', '${subFile.id}', this.files, ${JSON.stringify(subFile).replace(/"/g, '&quot;')})"
                                   class="file-input">
                            <div class="file-upload-area-compact ${subCompleted ? 'uploaded' : ''}">
                                <div class="upload-icon-small">📁</div>
                                <div class="upload-text-compact">
                                    ${subCompleted ? '<strong>✓ Загружен</strong>' : '<strong>Выберите файл</strong> или перетащите сюда'}
                                </div>
                                ${!subCompleted ? '<div class="upload-hint">Поддерживаются .xlsx и .xls</div>' : ''}
                            </div>
                        </label>
                `;

                // Статус загрузки для subFile
                if (subCompleted && subFiles && subFiles.length > 0) {
                    const totalRows = Array.isArray(subData[0]) ? subData.length - 1 : 0;
                    html += `
                        <div class="file-info-compact">
                            ${this.utils.formatNumber(totalRows)} строк
                        </div>
                    `;
                }

                html += `</div>`; // sub-file-card
            });

            html += `</div>`; // sub-files-grid

        } else {
            // Обычная загрузка файлов (без subFiles)
            const stepData = this.state.getStepData(stepId);
            const stepFiles = this.state.getStepFiles(stepId);
            const multipleAttr = config.multiple ? 'multiple' : '';
            const multipleText = config.multiple ? ' (можно выбрать несколько файлов)' : '';

            html += `<p class="step-description">Загрузите файл${multipleText}</p>`;

            // Требуемые колонки (если есть)
            if (config.requiredColumns && config.requiredColumns.length > 0) {
                const uniqueId = this.utils.generateId('required-cols');
                const columnsList = config.requiredColumns
                    .map(col => `<li>${col}</li>`)
                    .join('');

                html += `
                    <div class="required-columns-block">
                        <button type="button" class="required-columns-toggle" onclick="excelApp.toggleRequiredColumns('${uniqueId}', event)">
                            <span class="toggle-icon">▶</span>
                            <span class="toggle-text">Требуемые колонки</span>
                            <span class="columns-count">(${config.requiredColumns.length})</span>
                        </button>
                        <div id="${uniqueId}" class="required-columns-list" style="display: none;">
                            <ul>${columnsList}</ul>
                        </div>
                    </div>
                `;
            }

            // Загрузка файлов
            html += `
                <div class="file-upload-section">
                    <label class="file-upload-label">
                        <input type="file"
                               id="fileInput_${stepId}"
                               accept=".xlsx,.xls"
                               ${multipleAttr}
                               onchange="excelApp.handleFileUpload('${stepId}', this.files)"
                               class="file-input">
                        <div class="file-upload-area">
                            <div class="upload-icon">📁</div>
                            <div class="upload-text">
                                <strong>Выберите файл(ы)</strong> или перетащите сюда
                            </div>
                            <div class="upload-hint">Поддерживаются .xlsx и .xls</div>
                        </div>
                    </label>
                </div>
            `;

            // Статус загрузки
            if (isCompleted && stepFiles && stepFiles.length > 0) {
                const totalRows = stepData ? (Array.isArray(stepData[0]) ? stepData.length - 1 : 0) : 0;

                html += `
                    <div class="file-status success">
                        <div class="status-icon">✓</div>
                        <div class="status-content">
                            <div class="status-title">Файлы успешно загружены</div>
                            <div class="status-details">
                                Загружено: ${stepFiles.length} файл(ов), ${this.utils.formatNumber(totalRows)} строк данных
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        html += `</div>`;
        return html;
    }

    // Рендеринг секции обработки
    renderProcessSection() {
        const canProcess = this.navigator.areAllFilesLoaded();
        const template = this.state.get('selectedTemplate');

        if (!template) {
            return this.renderError('Шаблон не выбран');
        }

        // Навигационные кнопки
        const prevStep = this.navigator.getPreviousStep();

        let html = `
            <div class="step-content">
                <div class="step-header-nav">
                    <div class="nav-left">
                        ${prevStep ? `
                            <button class="btn-nav btn-back" onclick="excelApp.navigateBack()">
                                ← Назад
                            </button>
                        ` : ''}
                    </div>
                    <h2>Обработка данных</h2>
                    <div class="nav-right">
                        <button class="btn-nav btn-reset" onclick="excelApp.reset()">
                            🔄 Начать заново
                        </button>
                    </div>
                </div>
                <p class="step-description">Объединение и экспорт данных в Excel</p>
        `;

        if (!canProcess) {
            html += `
                <div class="file-status warning">
                    <div class="status-icon">⚠</div>
                    <div class="status-content">
                        <div class="status-title">Не все файлы загружены</div>
                        <div class="status-details">
                            Загрузите все необходимые файлы перед обработкой
                        </div>
                    </div>
                </div>
            `;
        } else {
            const completionPercent = this.navigator.getCompletionPercentage();

            html += `
                <div class="file-status success">
                    <div class="status-icon">✓</div>
                    <div class="status-content">
                        <div class="status-title">Все файлы загружены</div>
                        <div class="status-details">
                            Готово к обработке (${completionPercent}%)
                        </div>
                    </div>
                </div>

                <div class="process-actions">
                    <button class="btn btn-primary" onclick="excelApp.processFiles()">
                        <span>🚀 Обработать и экспортировать</span>
                    </button>
                </div>
            `;
        }

        html += `</div>`;
        return html;
    }

    // Рендеринг ошибки
    renderError(message) {
        return `
            <div class="step-content">
                <div class="file-status error">
                    <div class="status-icon">✗</div>
                    <div class="status-content">
                        <div class="status-title">Ошибка</div>
                        <div class="status-details">${this.utils.escapeHtml(message)}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // ==================== ИНДИКАТОР ШАГОВ ====================

    // Обновление индикатора шагов
    updateStepsIndicator() {
        if (!this.containers.stepsIndicator) return;

        const currentStep = this.navigator.getCurrentStep();
        const allSteps = this.navigator.getAllSteps();

        const stepsHTML = [];

        allSteps.forEach((step, index) => {
            // Разделитель между шагами
            if (index > 0) {
                stepsHTML.push('<div class="step-line"></div>');
            }

            const isActive = step.id === currentStep;
            const isCompleted = this.navigator.isStepCompleted(step.id);
            const isClickable = this.navigator.canNavigateTo(step.id);

            const stepHtml = this.renderStepIndicator(step, {
                index: index + 1,
                isActive,
                isCompleted,
                isClickable
            });

            stepsHTML.push(stepHtml);
        });

        this.containers.stepsIndicator.innerHTML = stepsHTML.join('');
    }

    // Рендеринг одного шага в индикаторе
    renderStepIndicator(step, states) {
        const { index, isActive, isCompleted, isClickable } = states;

        const classes = ['step'];
        if (isActive) classes.push('active');
        if (isCompleted) classes.push('completed');
        if (isClickable) classes.push('clickable');

        const onclickAttr = isClickable ? `onclick="excelApp.navigateToStep('${step.id}')"` : '';

        return `
            <div class="${classes.join(' ')}"
                 data-step="${step.id}"
                 data-title="${step.name}"
                 ${onclickAttr}>
                <div class="step-number">${index}</div>
                <div class="step-text">${step.name}</div>
            </div>
        `;
    }

    // ==================== СПИННЕР И СТАТУСЫ ====================

    // Показать спиннер загрузки
    showLoadingSpinner(message = 'Загрузка...') {
        const spinner = document.createElement('div');
        spinner.id = 'loadingSpinner';
        spinner.innerHTML = `
            <div class="spinner-content">
                <div class="loading-spinner"></div>
                <div class="spinner-text">${message}</div>
            </div>
        `;
        document.body.appendChild(spinner);
    }

    // Скрыть спиннер загрузки
    hideLoadingSpinner() {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.remove();
        }
    }

    // Обновить текст спиннера
    updateSpinnerText(message) {
        const spinnerText = document.querySelector('#loadingSpinner .spinner-text');
        if (spinnerText) {
            spinnerText.textContent = message;
        }
    }

    // Показать статус загрузки файлов
    showFileStatus(stepId, results) {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'file-load-status';

        const stats = {
            total: results.length,
            success: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        };

        let html = '<div class="status-list">';

        results.forEach(result => {
            const icon = result.success ? '✓' : '✗';
            const statusClass = result.success ? 'success' : 'error';

            html += `
                <div class="status-item ${statusClass}">
                    <span class="status-icon">${icon}</span>
                    <span class="status-text">${result.fileName}</span>
                    ${result.error ? `<span class="status-error">${result.error}</span>` : ''}
                </div>
            `;
        });

        html += '</div>';
        statusDiv.innerHTML = html;

        // Добавляем после секции загрузки файлов
        const uploadSection = document.querySelector('.file-upload-section');
        if (uploadSection) {
            const existingStatus = uploadSection.nextElementSibling;
            if (existingStatus && existingStatus.classList.contains('file-load-status')) {
                existingStatus.remove();
            }
            uploadSection.after(statusDiv);
        }
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    // Очистить основной контент
    clearMainContent() {
        if (this.containers.mainContent) {
            this.containers.mainContent.innerHTML = '';
        }
    }

    // Очистить индикатор шагов
    clearStepsIndicator() {
        if (this.containers.stepsIndicator) {
            this.containers.stepsIndicator.innerHTML = '';
        }
    }

    // Полная очистка
    clear() {
        this.clearMainContent();
        this.clearStepsIndicator();
    }
}

// Экспорт для использования в других модулях
window.UIRenderer = UIRenderer;
