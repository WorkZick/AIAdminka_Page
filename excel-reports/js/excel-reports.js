// Excel Reports Application
const excelApp = {
    selectedTemplate: null,
    step1Files: [],
    step2Files: [],
    step1Data: [],
    step2Data: [],
    stepsData: {},  // Для динамических шагов (step3, step4, ...)
    currentDynamicStep: null,  // Текущий динамический шаг
    result: null,
    currentStep: 'template',

    init() {
        this.renderTemplates();
        this.setupEventListeners();
        this.updateStepIndicator();
        this.createLoadingOverlays();
        logger.log('Excel Reports готов к работе', 'success');
    },

    createLoadingOverlays() {
        // Создаем overlay для каждой секции загрузки
        ['step1Section', 'step2Section'].forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                const content = section.querySelector('.panel-content');
                if (content && !content.querySelector('.loading-overlay')) {
                    const overlay = document.createElement('div');
                    overlay.className = 'loading-overlay';
                    overlay.innerHTML = `
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Загрузка файлов...</div>
                        <div class="loading-status"></div>
                    `;
                    content.appendChild(overlay);
                }
            }
        });
    },

    showLoading(sectionId, text = 'Загрузка файлов...', status = '') {
        const section = document.getElementById(sectionId);
        if (section) {
            let overlay = section.querySelector('.loading-overlay');
            if (!overlay) {
                const content = section.querySelector('.panel-content');
                if (content) {
                    overlay = document.createElement('div');
                    overlay.className = 'loading-overlay';
                    overlay.innerHTML = `
                        <div class="loading-spinner"></div>
                        <div class="loading-text">${text}</div>
                        <div class="loading-status">${status}</div>
                    `;
                    content.appendChild(overlay);
                }
            }
            if (overlay) {
                overlay.querySelector('.loading-text').textContent = text;
                overlay.querySelector('.loading-status').textContent = status;
                overlay.classList.add('active');
            }
        }
    },

    updateLoadingStatus(sectionId, status) {
        const section = document.getElementById(sectionId);
        if (section) {
            const overlay = section.querySelector('.loading-overlay');
            if (overlay) {
                overlay.querySelector('.loading-status').textContent = status;
            }
        }
    },

    hideLoading(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            const overlay = section.querySelector('.loading-overlay');
            if (overlay) {
                overlay.classList.remove('active');
            }
        }
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    },

    renderTemplates() {
        const container = document.getElementById('templatesContainer');
        container.innerHTML = '';

        const templates = Object.values(TEMPLATES);
        const mainTemplate = templates.find(t => t.id === 'combined-report');
        const otherTemplates = templates.filter(t => t.id !== 'combined-report');

        // Главный шаблон
        if (mainTemplate) {
            const mainItem = this.createTemplateItem(mainTemplate, true);
            container.appendChild(mainItem);
        }

        // Выпадающий список с отдельными отчётами
        if (otherTemplates.length > 0) {
            const dropdown = document.createElement('div');
            dropdown.className = 'templates-dropdown';
            dropdown.innerHTML = `
                <div class="templates-dropdown-header" onclick="excelApp.toggleTemplatesDropdown()">
                    <span>Отдельные отчёты</span>
                    <img src="icons/arrow.svg" alt="Arrow" class="dropdown-arrow">
                </div>
                <div class="templates-dropdown-content"></div>
            `;
            container.appendChild(dropdown);

            const dropdownContent = dropdown.querySelector('.templates-dropdown-content');
            otherTemplates.forEach(template => {
                const item = this.createTemplateItem(template, false);
                dropdownContent.appendChild(item);
            });
        }
    },

    toggleTemplatesDropdown() {
        const dropdown = document.querySelector('.templates-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('open');
        }
    },

    createTemplateItem(template, isMain) {
        const item = document.createElement('div');
        item.className = `template-item${isMain ? ' main-template' : ''}`;
        item.dataset.templateId = template.id;
        item.innerHTML = `
            <div class="template-icon">
                <img src="icons/documents.svg" alt="Template">
            </div>
            <div class="template-info">
                <h3>${template.name}</h3>
                <p>${template.description}</p>
            </div>
        `;
        item.onclick = () => this.selectTemplate(template.id);
        return item;
    },

    selectTemplate(templateId) {
        document.querySelectorAll('.template-item').forEach(c => c.classList.remove('selected'));
        const item = document.querySelector(`[data-template-id="${templateId}"]`);
        if (item) {
            item.classList.add('selected');
            this.selectedTemplate = TEMPLATES[Object.keys(TEMPLATES).find(k => TEMPLATES[k].id === templateId)];
            document.getElementById('confirmTemplateBtn').disabled = false;
            logger.log(`Выбран шаблон: ${this.selectedTemplate.name}`, 'info');
        }
    },

    setupEventListeners() {
        document.getElementById('step1Input').onchange = (e) => this.handleStep1Files(e);
        document.getElementById('step2Input').onchange = (e) => this.handleStep2Files(e);

        // Drag and drop for upload areas
        this.setupDragDrop('step1Section', 'step1Input');
        this.setupDragDrop('step2Section', 'step2Input');
    },

    setupDragDrop(sectionId, inputId) {
        const section = document.getElementById(sectionId);
        if (!section) return;

        const uploadArea = section.querySelector('.upload-area');
        if (!uploadArea) return;

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#1a1a1a';
            uploadArea.style.background = '#f0e8d8';
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '';
            uploadArea.style.background = '';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '';
            uploadArea.style.background = '';

            const files = e.dataTransfer.files;
            const input = document.getElementById(inputId);

            // Create a new FileList-like object
            const dt = new DataTransfer();
            for (let i = 0; i < files.length; i++) {
                dt.items.add(files[i]);
            }
            input.files = dt.files;
            input.dispatchEvent(new Event('change'));
        });
    },

    updateStepIndicator() {
        const steps = document.querySelectorAll('.step');
        steps.forEach(step => {
            step.classList.remove('active', 'completed');
            const stepName = step.dataset.step;

            // Для step1 показываем активность если находимся на любом шаге загрузки файлов
            if (stepName === 'step1' && this.isOnFileUploadStep()) {
                step.classList.add('active');
            } else if (stepName === this.currentStep) {
                step.classList.add('active');
            } else if (this.isStepCompleted(stepName)) {
                step.classList.add('completed');
            }
        });
    },

    isOnFileUploadStep() {
        return this.currentStep.startsWith('step') && this.currentStep !== 'template';
    },

    isStepCompleted(stepName) {
        // Если текущий шаг - обработка, значит все шаги загрузки завершены
        if (this.currentStep === 'process') {
            return stepName === 'template' || stepName === 'step1';
        }
        // Если текущий шаг - один из шагов загрузки
        if (this.isOnFileUploadStep()) {
            return stepName === 'template';
        }
        return false;
    },

    showStep1() {
        if (!this.selectedTemplate) return;

        document.getElementById('templateSection').classList.add('hidden');
        document.getElementById('step1Section').classList.remove('hidden');

        const config = this.selectedTemplate.filesConfig.step1;
        const totalSteps = Object.keys(this.selectedTemplate.filesConfig).length;

        document.getElementById('step1Title').textContent = config.name;
        document.getElementById('step1Input').multiple = config.multiple;

        // Обновляем информацию о шаге
        document.getElementById('step1Current').textContent = '1';
        document.getElementById('step1Total').textContent = totalSteps;
        document.getElementById('step1Description').textContent = this.getStepDescription('step1', config);

        this.currentStep = 'step1';
        this.updateStepIndicator();

        logger.log(`Переход к загрузке: ${config.name}`, 'info');
    },

    getStepDescription(stepName, config) {
        const multiple = config.multiple ? ' (можно выбрать несколько файлов)' : '';
        return `Загрузите файл "${config.name}"${multiple}`;
    },

    async handleStep1Files(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        logger.log(`Загружено файлов (шаг 1): ${files.length}`, 'info');
        this.step1Files = files;
        this.step1Data = [];

        // Показываем спиннер
        this.showLoading('step1Section', 'Обработка файлов...', `0 из ${files.length}`);

        let successCount = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.updateLoadingStatus('step1Section', `${i + 1} из ${files.length}: ${file.name}`);

            try {
                const data = await this.readExcelFile(file);
                this.step1Data.push(data);
                successCount++;
                logger.log(`Обработан файл: ${file.name}`, 'success');
            } catch (error) {
                logger.log(`Ошибка загрузки ${file.name}: ${error.message}`, 'error');
            }
        }

        // Скрываем спиннер
        this.hideLoading('step1Section');

        // Показываем статус загрузки
        const status = document.getElementById('step1Status');
        const count = document.getElementById('step1Count');
        if (successCount > 0) {
            count.textContent = successCount;
            status.classList.remove('hidden');
        }

        document.getElementById('step1NextBtn').disabled = this.step1Data.length === 0;
    },

    completeStep1() {
        if (this.selectedTemplate.filesConfig.step2) {
            document.getElementById('step1Section').classList.add('hidden');
            document.getElementById('step2Section').classList.remove('hidden');

            const config = this.selectedTemplate.filesConfig.step2;
            const totalSteps = Object.keys(this.selectedTemplate.filesConfig).length;

            document.getElementById('step2Title').textContent = config.name;
            document.getElementById('step2Input').multiple = config.multiple;

            // Обновляем информацию о шаге
            document.getElementById('step2Current').textContent = '2';
            document.getElementById('step2Total').textContent = totalSteps;
            document.getElementById('step2Description').textContent = this.getStepDescription('step2', config);

            this.currentStep = 'step2';
            this.updateStepIndicator();

            logger.log(`Переход к загрузке: ${config.name}`, 'info');
        } else {
            this.showProcessSection();
        }
    },

    async handleStep2Files(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        logger.log(`Загружено файлов (шаг 2): ${files.length}`, 'info');
        this.step2Files = files;
        this.step2Data = [];

        // Показываем спиннер
        this.showLoading('step2Section', 'Обработка файлов...', `0 из ${files.length}`);

        let successCount = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.updateLoadingStatus('step2Section', `${i + 1} из ${files.length}: ${file.name}`);

            try {
                const data = await this.readExcelFile(file);
                this.step2Data.push(data);
                successCount++;
                logger.log(`Обработан файл: ${file.name}`, 'success');
            } catch (error) {
                logger.log(`Ошибка загрузки ${file.name}: ${error.message}`, 'error');
            }
        }

        // Скрываем спиннер
        this.hideLoading('step2Section');

        // Показываем статус загрузки
        const status = document.getElementById('step2Status');
        const count = document.getElementById('step2Count');
        if (successCount > 0) {
            count.textContent = successCount;
            status.classList.remove('hidden');
        }

        document.getElementById('step2NextBtn').disabled = this.step2Data.length === 0;
    },

    completeStep2() {
        // Проверяем наличие дополнительных шагов
        const nextStep = this.getNextDynamicStep('step2');
        if (nextStep) {
            this.showDynamicStep(nextStep);
        } else {
            this.showProcessSection();
        }
    },

    getNextDynamicStep(currentStep) {
        if (!this.selectedTemplate || !this.selectedTemplate.filesConfig) return null;
        const steps = Object.keys(this.selectedTemplate.filesConfig);
        const currentIndex = steps.indexOf(currentStep);
        if (currentIndex >= 0 && currentIndex < steps.length - 1) {
            return steps[currentIndex + 1];
        }
        return null;
    },

    showDynamicStep(stepName) {
        // Скрываем все секции
        document.getElementById('step1Section').classList.add('hidden');
        document.getElementById('step2Section').classList.add('hidden');
        document.getElementById('processSection').classList.add('hidden');

        // Создаем или показываем динамическую секцию
        let dynamicSection = document.getElementById('dynamicStepSection');
        if (!dynamicSection) {
            dynamicSection = this.createDynamicStepSection();
        }
        dynamicSection.classList.remove('hidden');

        const config = this.selectedTemplate.filesConfig[stepName];
        const steps = Object.keys(this.selectedTemplate.filesConfig);
        const currentStepIndex = steps.indexOf(stepName) + 1;
        const totalSteps = steps.length;

        document.getElementById('dynamicStepTitle').textContent = config.name;
        document.getElementById('dynamicStepInput').multiple = config.multiple;
        document.getElementById('dynamicStepStatus').classList.add('hidden');
        document.getElementById('dynamicStepNextBtn').disabled = true;

        // Обновляем информацию о шаге
        document.getElementById('dynamicStepCurrent').textContent = currentStepIndex;
        document.getElementById('dynamicStepTotal').textContent = totalSteps;
        document.getElementById('dynamicStepDescription').textContent = this.getStepDescription(stepName, config);

        this.currentDynamicStep = stepName;
        this.currentStep = stepName;
        this.updateStepIndicator();

        logger.log(`Переход к загрузке: ${config.name}`, 'info');
    },

    createDynamicStepSection() {
        const section = document.createElement('div');
        section.id = 'dynamicStepSection';
        section.className = 'panel files-panel';
        section.innerHTML = `
            <div class="panel-header panel-header-nav">
                <div class="header-nav-left">
                    <button class="btn-header-nav btn-back" onclick="excelApp.goBackFromDynamicStep()">
                        <img src="icons/arrow.svg" width="16" height="16" alt="Назад">
                        Назад
                    </button>
                </div>
                <span id="dynamicStepTitle">Загрузка файлов</span>
                <div class="header-nav-right">
                    <button class="btn-header-nav btn-next" id="dynamicStepNextBtn" disabled onclick="excelApp.completeDynamicStep()">
                        Далее
                        <img src="icons/arrow.svg" width="16" height="16" alt="Далее">
                    </button>
                </div>
            </div>
            <div class="panel-content">
                <div class="step-info" id="dynamicStepInfo">
                    <div class="step-counter">Шаг <span id="dynamicStepCurrent">3</span> из <span id="dynamicStepTotal">7</span></div>
                    <div class="step-description" id="dynamicStepDescription"></div>
                </div>
                <div class="upload-area" id="dynamicStepUploadArea" onclick="document.getElementById('dynamicStepInput').click()">
                    <img src="icons/download_photo.svg" width="48" height="48" alt="Upload">
                    <div class="upload-text">Нажмите для выбора файлов</div>
                    <div class="upload-hint">или перетащите файлы сюда</div>
                </div>
                <input type="file" id="dynamicStepInput" accept=".xlsx" style="display:none;">
                <div class="upload-status hidden" id="dynamicStepStatus">
                    <img src="icons/done.svg" width="20" height="20" alt="OK">
                    <span>Загружено файлов: <strong id="dynamicStepCount">0</strong></span>
                </div>
            </div>
        `;

        const mainSection = document.querySelector('.main-section');
        mainSection.appendChild(section);

        // Настройка событий
        document.getElementById('dynamicStepInput').onchange = (e) => this.handleDynamicStepFiles(e);
        this.setupDragDrop('dynamicStepSection', 'dynamicStepInput');

        return section;
    },

    async handleDynamicStepFiles(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const stepName = this.currentDynamicStep;
        logger.log(`Загружено файлов (${stepName}): ${files.length}`, 'info');

        this.stepsData[stepName] = [];

        // Показываем спиннер
        this.showLoading('dynamicStepSection', 'Обработка файлов...', `0 из ${files.length}`);

        let successCount = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.updateLoadingStatus('dynamicStepSection', `${i + 1} из ${files.length}: ${file.name}`);

            try {
                const data = await this.readExcelFile(file);
                this.stepsData[stepName].push(data);
                successCount++;
                logger.log(`Обработан файл: ${file.name}`, 'success');
            } catch (error) {
                logger.log(`Ошибка загрузки ${file.name}: ${error.message}`, 'error');
            }
        }

        // Скрываем спиннер
        this.hideLoading('dynamicStepSection');

        // Показываем статус загрузки
        const status = document.getElementById('dynamicStepStatus');
        const count = document.getElementById('dynamicStepCount');
        if (successCount > 0) {
            count.textContent = successCount;
            status.classList.remove('hidden');
        }

        document.getElementById('dynamicStepNextBtn').disabled = this.stepsData[stepName].length === 0;
    },

    completeDynamicStep() {
        const nextStep = this.getNextDynamicStep(this.currentDynamicStep);
        if (nextStep) {
            this.showDynamicStep(nextStep);
        } else {
            this.showProcessSection();
        }
    },

    goBackFromDynamicStep() {
        const dynamicSection = document.getElementById('dynamicStepSection');
        if (dynamicSection) {
            dynamicSection.classList.add('hidden');
        }

        // Определяем предыдущий шаг
        const steps = Object.keys(this.selectedTemplate.filesConfig);
        const currentIndex = steps.indexOf(this.currentDynamicStep);

        if (currentIndex > 0) {
            const prevStep = steps[currentIndex - 1];
            if (prevStep === 'step1') {
                document.getElementById('step1Section').classList.remove('hidden');
                this.currentStep = 'step1';
            } else if (prevStep === 'step2') {
                document.getElementById('step2Section').classList.remove('hidden');
                this.currentStep = 'step2';
            } else {
                this.showDynamicStep(prevStep);
                return;
            }
        }

        this.updateStepIndicator();
        logger.log('Возврат к предыдущему шагу', 'info');
    },

    showProcessSection() {
        document.getElementById('step1Section').classList.add('hidden');
        document.getElementById('step2Section').classList.add('hidden');
        const dynamicSection = document.getElementById('dynamicStepSection');
        if (dynamicSection) dynamicSection.classList.add('hidden');
        document.getElementById('processSection').classList.remove('hidden');

        // Update process info
        document.getElementById('processTemplateName').textContent = this.selectedTemplate.name;
        let totalFiles = this.step1Data.length + this.step2Data.length;
        // Добавляем файлы из динамических шагов
        Object.values(this.stepsData).forEach(stepData => {
            totalFiles += stepData.length;
        });
        document.getElementById('processFilesCount').textContent = totalFiles;

        this.currentStep = 'process';
        this.updateStepIndicator();

        logger.log('Готово к обработке', 'info');
    },

    async readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.load(e.target.result);
                    const worksheet = workbook.worksheets[0];
                    const jsonData = [];

                    worksheet.eachRow((row, rowNumber) => {
                        const rowData = [];
                        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                            // Заполняем пропущенные ячейки
                            while (rowData.length < colNumber - 1) {
                                rowData.push(null);
                            }
                            rowData.push(cell.value);
                        });
                        jsonData.push(rowData);
                    });

                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            reader.readAsArrayBuffer(file);
        });
    },

    processFiles() {
        try {
            logger.log('Начало обработки...', 'info');

            if (!this.selectedTemplate) {
                throw new Error('Шаблон не выбран');
            }

            const stepsCount = Object.keys(this.selectedTemplate.filesConfig).length;

            // Для шаблонов с более чем 2 шагами - передаем объект stepsData
            if (stepsCount > 2) {
                const allStepsData = {
                    step1: this.step1Data,
                    step2: this.step2Data,
                    ...this.stepsData
                };
                this.result = this.selectedTemplate.handler(allStepsData);
            } else if (this.selectedTemplate.filesConfig.step2) {
                this.result = this.selectedTemplate.handler(this.step1Data, this.step2Data);
            } else {
                this.result = this.selectedTemplate.handler(...this.step1Data);
            }

            logger.log('Обработка завершена успешно!', 'success');
            document.getElementById('processBtn').disabled = true;
            document.getElementById('exportBtn').disabled = false;
        } catch (error) {
            logger.log(`Ошибка обработки: ${error.message}`, 'error');
            console.error(error);
        }
    },

    async exportResult() {
        if (!this.result) {
            logger.log('Нет данных для экспорта', 'error');
            return;
        }

        try {
            await this.exportWithExcelJS();
        } catch (error) {
            logger.log(`Ошибка экспорта: ${error.message}`, 'error');
            console.error(error);
        }
    },

    async exportWithExcelJS() {
        const workbook = new ExcelJS.Workbook();

        // Поддержка нового формата (с sheets) и старого (простой объект/массив)
        let sheetsData;
        if (this.result.sheets) {
            sheetsData = this.result.sheets;
        } else if (typeof this.result === 'object' && !Array.isArray(this.result)) {
            // Старый формат: объект с листами как массивами
            sheetsData = {};
            for (const [name, data] of Object.entries(this.result)) {
                if (name !== '_useExcelJS') {
                    sheetsData[name] = { data: data, styles: [], columns: [] };
                }
            }
        } else {
            // Простой массив
            sheetsData = { 'Результат': { data: this.result, styles: [], columns: [] } };
        }

        for (const [sheetName, sheetConfig] of Object.entries(sheetsData)) {
            const worksheet = workbook.addWorksheet(sheetName);

            // Устанавливаем ширину столбцов (явно для каждой колонки)
            if (sheetConfig.columns && sheetConfig.columns.length > 0) {
                sheetConfig.columns.forEach((col, index) => {
                    worksheet.getColumn(index + 1).width = col.width;
                });
            }

            // Добавляем данные
            const data = Array.isArray(sheetConfig) ? sheetConfig : sheetConfig.data;
            if (data) {
                data.forEach((rowData) => {
                    const row = worksheet.addRow(rowData);
                    row.eachCell((cell) => {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    });
                });
            }

            // Применяем стили к ячейкам
            if (sheetConfig.styles && sheetConfig.styles.length > 0) {
                for (const style of sheetConfig.styles) {
                    const cell = worksheet.getCell(style.cell);

                    if (style.fill) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: style.fill }
                        };
                    }

                    if (style.font) {
                        cell.font = style.font;
                    }

                    if (style.border) {
                        cell.border = style.border;
                    }

                    if (style.alignment) {
                        cell.alignment = style.alignment;
                    }

                    if (style.numFmt) {
                        cell.numFmt = style.numFmt;
                    }
                }
            }

            // Объединяем ячейки
            if (sheetConfig.merges && sheetConfig.merges.length > 0) {
                sheetConfig.merges.forEach(merge => {
                    worksheet.mergeCells(merge);
                });
            }

            // Устанавливаем высоту строк
            if (sheetConfig.rowHeights) {
                for (const [rowNum, height] of Object.entries(sheetConfig.rowHeights)) {
                    worksheet.getRow(parseInt(rowNum)).height = height;
                }
            }
        }

        // Генерируем файл и скачиваем
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const link = document.createElement('a');
        link.href = url;
        link.download = `report_${timestamp}.xlsx`;
        link.click();

        URL.revokeObjectURL(url);
        logger.log('Файл успешно экспортирован!', 'success');
    },

    reset() {
        this.selectedTemplate = null;
        this.step1Files = [];
        this.step2Files = [];
        this.step1Data = [];
        this.step2Data = [];
        this.stepsData = {};
        this.currentDynamicStep = null;
        this.result = null;

        document.getElementById('templateSection').classList.remove('hidden');
        document.getElementById('step1Section').classList.add('hidden');
        document.getElementById('step2Section').classList.add('hidden');
        document.getElementById('processSection').classList.add('hidden');
        const dynamicSection = document.getElementById('dynamicStepSection');
        if (dynamicSection) dynamicSection.classList.add('hidden');

        // Сброс статусов загрузки
        document.getElementById('step1Status').classList.add('hidden');
        document.getElementById('step2Status').classList.add('hidden');
        document.getElementById('step1NextBtn').disabled = true;
        document.getElementById('step2NextBtn').disabled = true;

        document.getElementById('confirmTemplateBtn').disabled = true;
        document.getElementById('processBtn').disabled = false;
        document.getElementById('exportBtn').disabled = true;

        document.querySelectorAll('.template-item').forEach(c => c.classList.remove('selected'));

        this.currentStep = 'template';
        this.updateStepIndicator();

        logger.log('Сброс выполнен', 'info');
    },

    goBackFromStep1() {
        document.getElementById('step1Section').classList.add('hidden');
        document.getElementById('templateSection').classList.remove('hidden');
        this.currentStep = 'template';
        this.updateStepIndicator();
        logger.log('Возврат к выбору шаблона', 'info');
    },

    goBackFromStep2() {
        document.getElementById('step2Section').classList.add('hidden');
        document.getElementById('step1Section').classList.remove('hidden');
        this.currentStep = 'step1';
        this.updateStepIndicator();
        logger.log('Возврат к шагу 1', 'info');
    },

    goBackFromProcess() {
        document.getElementById('processSection').classList.add('hidden');

        // Определяем последний шаг загрузки файлов
        const steps = Object.keys(this.selectedTemplate.filesConfig);
        const lastStep = steps[steps.length - 1];

        if (lastStep === 'step1') {
            document.getElementById('step1Section').classList.remove('hidden');
            this.currentStep = 'step1';
        } else if (lastStep === 'step2') {
            document.getElementById('step2Section').classList.remove('hidden');
            this.currentStep = 'step2';
        } else {
            // Динамический шаг
            this.showDynamicStep(lastStep);
            return;
        }

        this.updateStepIndicator();
        logger.log('Возврат к предыдущему шагу', 'info');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    excelApp.init();
});
