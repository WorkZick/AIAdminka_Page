// Excel Reports Application
const excelApp = {
    selectedTemplate: null,
    step1Files: [],
    step2Files: [],
    step1Data: [],
    step2Data: [],
    result: null,
    currentStep: 'template',

    init() {
        this.renderTemplates();
        this.setupEventListeners();
        this.updateStepIndicator();
        logger.log('Excel Reports готов к работе', 'success');
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    },

    renderTemplates() {
        const container = document.getElementById('templatesContainer');
        container.innerHTML = '';

        Object.values(TEMPLATES).forEach(template => {
            const card = document.createElement('div');
            card.className = 'template-card';
            card.dataset.templateId = template.id;
            card.innerHTML = `
                <h3>${template.name}</h3>
                <p>${template.description}</p>
            `;
            card.onclick = () => this.selectTemplate(template.id);
            container.appendChild(card);
        });
    },

    selectTemplate(templateId) {
        document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
        const card = document.querySelector(`[data-template-id="${templateId}"]`);
        if (card) {
            card.classList.add('selected');
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

            if (stepName === this.currentStep) {
                step.classList.add('active');
            } else if (this.isStepCompleted(stepName)) {
                step.classList.add('completed');
            }
        });
    },

    isStepCompleted(stepName) {
        const stepOrder = ['template', 'step1', 'step2', 'process'];
        const currentIndex = stepOrder.indexOf(this.currentStep);
        const stepIndex = stepOrder.indexOf(stepName);
        return stepIndex < currentIndex;
    },

    showStep1() {
        if (!this.selectedTemplate) return;

        document.getElementById('templateSection').classList.add('hidden');
        document.getElementById('step1Section').classList.remove('hidden');

        const config = this.selectedTemplate.filesConfig.step1;
        document.getElementById('step1Title').textContent = config.name;
        document.getElementById('step1Input').multiple = config.multiple;

        this.currentStep = 'step1';
        this.updateStepIndicator();

        logger.log(`Переход к загрузке: ${config.name}`, 'info');
    },

    async handleStep1Files(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        logger.log(`Загружено файлов (шаг 1): ${files.length}`, 'info');
        this.step1Files = files;
        this.step1Data = [];

        const filesList = document.getElementById('step1Files');
        filesList.innerHTML = '';

        for (const file of files) {
            try {
                const data = await this.readExcelFile(file);
                this.step1Data.push(data);

                const item = document.createElement('div');
                item.className = 'file-item success';
                item.innerHTML = `
                    <img class="file-icon" src="icons/done.svg" alt="OK">
                    <span class="file-name">${file.name}</span>
                    <span class="file-status">Загружен</span>
                `;
                filesList.appendChild(item);

                logger.log(`Обработан файл: ${file.name}`, 'success');
            } catch (error) {
                const item = document.createElement('div');
                item.className = 'file-item error';
                item.innerHTML = `
                    <img class="file-icon" src="icons/cross.svg" alt="Error">
                    <span class="file-name">${file.name}</span>
                    <span class="file-status">Ошибка</span>
                `;
                filesList.appendChild(item);

                logger.log(`Ошибка загрузки ${file.name}: ${error.message}`, 'error');
            }
        }

        document.getElementById('step1NextBtn').disabled = this.step1Data.length === 0;
    },

    completeStep1() {
        if (this.selectedTemplate.filesConfig.step2) {
            document.getElementById('step1Section').classList.add('hidden');
            document.getElementById('step2Section').classList.remove('hidden');

            const config = this.selectedTemplate.filesConfig.step2;
            document.getElementById('step2Title').textContent = config.name;
            document.getElementById('step2Input').multiple = config.multiple;

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

        const filesList = document.getElementById('step2Files');
        filesList.innerHTML = '';

        for (const file of files) {
            try {
                const data = await this.readExcelFile(file);
                this.step2Data.push(data);

                const item = document.createElement('div');
                item.className = 'file-item success';
                item.innerHTML = `
                    <img class="file-icon" src="icons/done.svg" alt="OK">
                    <span class="file-name">${file.name}</span>
                    <span class="file-status">Загружен</span>
                `;
                filesList.appendChild(item);

                logger.log(`Обработан файл: ${file.name}`, 'success');
            } catch (error) {
                const item = document.createElement('div');
                item.className = 'file-item error';
                item.innerHTML = `
                    <img class="file-icon" src="icons/cross.svg" alt="Error">
                    <span class="file-name">${file.name}</span>
                    <span class="file-status">Ошибка</span>
                `;
                filesList.appendChild(item);

                logger.log(`Ошибка загрузки ${file.name}: ${error.message}`, 'error');
            }
        }

        document.getElementById('step2NextBtn').disabled = this.step2Data.length === 0;
    },

    completeStep2() {
        this.showProcessSection();
    },

    showProcessSection() {
        document.getElementById('step1Section').classList.add('hidden');
        document.getElementById('step2Section').classList.add('hidden');
        document.getElementById('processSection').classList.remove('hidden');

        // Update process info
        document.getElementById('processTemplateName').textContent = this.selectedTemplate.name;
        const totalFiles = this.step1Data.length + this.step2Data.length;
        document.getElementById('processFilesCount').textContent = totalFiles;

        this.currentStep = 'process';
        this.updateStepIndicator();

        logger.log('Готово к обработке', 'info');
    },

    async readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
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

            if (this.selectedTemplate.filesConfig.step2) {
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

    exportResult() {
        if (!this.result) {
            logger.log('Нет данных для экспорта', 'error');
            return;
        }

        try {
            const wb = XLSX.utils.book_new();

            if (typeof this.result === 'object' && !Array.isArray(this.result)) {
                Object.entries(this.result).forEach(([name, sheetData]) => {
                    const ws = XLSX.utils.aoa_to_sheet(sheetData);
                    XLSX.utils.book_append_sheet(wb, ws, name);
                });
            } else {
                const ws = XLSX.utils.aoa_to_sheet(this.result);
                XLSX.utils.book_append_sheet(wb, ws, 'Результат');
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            XLSX.writeFile(wb, `report_${timestamp}.xlsx`);
            logger.log('Файл успешно экспортирован!', 'success');
        } catch (error) {
            logger.log(`Ошибка экспорта: ${error.message}`, 'error');
        }
    },

    reset() {
        this.selectedTemplate = null;
        this.step1Files = [];
        this.step2Files = [];
        this.step1Data = [];
        this.step2Data = [];
        this.result = null;

        document.getElementById('templateSection').classList.remove('hidden');
        document.getElementById('step1Section').classList.add('hidden');
        document.getElementById('step2Section').classList.add('hidden');
        document.getElementById('processSection').classList.add('hidden');

        document.getElementById('step1Files').innerHTML = '';
        document.getElementById('step2Files').innerHTML = '';
        document.getElementById('confirmTemplateBtn').disabled = true;
        document.getElementById('processBtn').disabled = false;
        document.getElementById('exportBtn').disabled = true;

        document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));

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

        if (this.selectedTemplate && this.selectedTemplate.filesConfig.step2) {
            document.getElementById('step2Section').classList.remove('hidden');
            this.currentStep = 'step2';
        } else {
            document.getElementById('step1Section').classList.remove('hidden');
            this.currentStep = 'step1';
        }

        this.updateStepIndicator();
        logger.log('Возврат к предыдущему шагу', 'info');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    excelApp.init();
});
