// Главное приложение Excel Reports
class ExcelReportsApp {
    constructor() {
        this.selectedTemplate = null;
        this.step1Files = [];
        this.step2Files = [];
        this.step1Data = [];
        this.step2Data = [];
        this.result = null;
        this.currentStep = 'template'; // Отслеживание текущего шага
        this.init();
    }

    init() {
        this.renderTemplates();
        this.setupEventListeners();
        logger.log('Excel Reports готов к работе', 'success');
    }

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
    }

    selectTemplate(templateId) {
        document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
        const card = document.querySelector(`[data-template-id="${templateId}"]`);
        if (card) {
            card.classList.add('selected');
            this.selectedTemplate = TEMPLATES[Object.keys(TEMPLATES).find(k => TEMPLATES[k].id === templateId)];
            document.getElementById('confirmTemplateBtn').disabled = false;
            logger.log(`Выбран шаблон: ${this.selectedTemplate.name}`, 'info');
        }
    }

    setupEventListeners() {
        document.getElementById('confirmTemplateBtn').onclick = () => this.showStep1();
        document.getElementById('step1Input').onchange = (e) => this.handleStep1Files(e);
        document.getElementById('step1NextBtn').onclick = () => this.completeStep1();
        document.getElementById('step2Input').onchange = (e) => this.handleStep2Files(e);
        document.getElementById('step2NextBtn').onclick = () => this.completeStep2();
        document.getElementById('processBtn').onclick = () => this.processFiles();
        document.getElementById('exportBtn').onclick = () => this.exportResult();
        document.getElementById('resetBtn').onclick = () => this.reset();
        
        // Кнопки "Назад" на каждом шаге
        document.getElementById('step1BackBtn').onclick = () => this.goBackFromStep1();
        document.getElementById('step2BackBtn').onclick = () => this.goBackFromStep2();
        document.getElementById('processBackBtn').onclick = () => this.goBackFromProcess();
    }

    showStep1() {
        if (!this.selectedTemplate) return;
        
        document.getElementById('templateSection').classList.add('hidden');
        document.getElementById('step1Section').classList.remove('hidden');
        
        const config = this.selectedTemplate.filesConfig.step1;
        document.getElementById('step1Title').textContent = config.name;
        document.getElementById('step1Input').multiple = config.multiple;
        
        this.currentStep = 'step1';
        
        logger.log(`Переход к загрузке: ${config.name}`, 'info');
    }

    async handleStep1Files(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        logger.log(`Загружено файлов (шаг 1): ${files.length}`, 'info');
        this.step1Files = files;
        this.step1Data = [];

        const filesList = document.getElementById('step1Files');
        filesList.innerHTML = '<div style="margin-top: 16px;">Загруженные файлы:</div>';

        for (const file of files) {
            try {
                const data = await this.readExcelFile(file);
                this.step1Data.push(data);
                
                const item = document.createElement('div');
                item.style.padding = '8px';
                item.style.background = '#f0f0f0';
                item.style.margin = '4px 0';
                item.style.borderRadius = '4px';
                item.textContent = `✓ ${file.name}`;
                filesList.appendChild(item);
                
                logger.log(`Обработан файл: ${file.name}`, 'success');
            } catch (error) {
                logger.log(`Ошибка загрузки ${file.name}: ${error.message}`, 'error');
            }
        }

        document.getElementById('step1NextBtn').disabled = this.step1Data.length === 0;
    }

    completeStep1() {
        if (this.selectedTemplate.filesConfig.step2) {
            document.getElementById('step1Section').classList.add('hidden');
            document.getElementById('step2Section').classList.remove('hidden');
            
            const config = this.selectedTemplate.filesConfig.step2;
            document.getElementById('step2Title').textContent = config.name;
            document.getElementById('step2Input').multiple = config.multiple;
            
            const stepNum = 3;
            document.getElementById('processStepTitle').textContent = `${stepNum + 1}. Обработка`;
            
            this.currentStep = 'step2';
            
            logger.log(`Переход к загрузке: ${config.name}`, 'info');
        } else {
            this.showProcessSection();
        }
    }

    async handleStep2Files(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        logger.log(`Загружено файлов (шаг 2): ${files.length}`, 'info');
        this.step2Files = files;
        this.step2Data = [];

        const filesList = document.getElementById('step2Files');
        filesList.innerHTML = '<div style="margin-top: 16px;">Загруженные файлы:</div>';

        for (const file of files) {
            try {
                const data = await this.readExcelFile(file);
                this.step2Data.push(data);
                
                const item = document.createElement('div');
                item.style.padding = '8px';
                item.style.background = '#f0f0f0';
                item.style.margin = '4px 0';
                item.style.borderRadius = '4px';
                item.textContent = `✓ ${file.name}`;
                filesList.appendChild(item);
                
                logger.log(`Обработан файл: ${file.name}`, 'success');
            } catch (error) {
                logger.log(`Ошибка загрузки ${file.name}: ${error.message}`, 'error');
            }
        }

        document.getElementById('step2NextBtn').disabled = this.step2Data.length === 0;
    }

    completeStep2() {
        this.showProcessSection();
    }

    showProcessSection() {
        document.getElementById('step1Section').classList.add('hidden');
        document.getElementById('step2Section').classList.add('hidden');
        document.getElementById('processSection').classList.remove('hidden');
        
        this.currentStep = 'process';
        
        logger.log('Готово к обработке', 'info');
    }

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
    }

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
    }

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
    }

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
        
        logger.log('Сброс выполнен', 'info');
    }

    // Возврат с шага 1 к выбору шаблона
    goBackFromStep1() {
        document.getElementById('step1Section').classList.add('hidden');
        document.getElementById('templateSection').classList.remove('hidden');
        this.currentStep = 'template';
        logger.log('Возврат к выбору шаблона', 'info');
    }

    // Возврат с шага 2 к шагу 1
    goBackFromStep2() {
        document.getElementById('step2Section').classList.add('hidden');
        document.getElementById('step1Section').classList.remove('hidden');
        this.currentStep = 'step1';
        logger.log('Возврат к шагу 1', 'info');
    }

    // Возврат с обработки к предыдущему шагу
    goBackFromProcess() {
        document.getElementById('processSection').classList.add('hidden');
        
        if (this.selectedTemplate && this.selectedTemplate.filesConfig.step2) {
            document.getElementById('step2Section').classList.remove('hidden');
            this.currentStep = 'step2';
            logger.log('Возврат к шагу 2', 'info');
        } else {
            document.getElementById('step1Section').classList.remove('hidden');
            this.currentStep = 'step1';
            logger.log('Возврат к шагу 1', 'info');
        }
    }
}

const app = new ExcelReportsApp();
