// StepsNavigator - Навигация между шагами

class StepsNavigator {
    constructor(stateManager) {
        this.state = stateManager;
    }

    // Построить список шагов из выбранного шаблона
    buildStepsFromTemplate(template) {
        const steps = [];

        // 1. Первый шаг - выбор шаблона
        steps.push({
            id: 'template',
            name: 'Выберите шаблон',
            type: 'template'
        });

        // 2. Шаги загрузки файлов из конфигурации шаблона
        if (template && template.filesConfig) {
            Object.keys(template.filesConfig).forEach((stepId, index) => {
                const config = template.filesConfig[stepId];
                steps.push({
                    id: stepId,
                    name: config.name,
                    type: 'file',
                    config: config
                });
            });
        }

        // 3. Финальный шаг - обработка
        steps.push({
            id: 'process',
            name: 'Обработка',
            type: 'process'
        });

        return steps;
    }

    // Получить все шаги для текущего шаблона
    getAllSteps() {
        const template = this.state.get('selectedTemplate');

        if (!template) {
            // Если шаблон не выбран, показываем только первый шаг
            return [
                { id: 'template', name: 'Выберите шаблон', type: 'template' }
            ];
        }

        return this.buildStepsFromTemplate(template);
    }

    // Переход к шагу
    navigateTo(stepId) {
        // Проверяем доступность шага
        if (!this.canNavigateTo(stepId)) {
            console.warn(`Невозможно перейти к шагу: ${stepId}`);
            return false;
        }

        // Если возвращаемся к выбору шаблона - очищаем всё состояние
        if (stepId === 'template') {
            this.state.reset();
        }

        // Устанавливаем текущий шаг
        this.state.set('currentStep', stepId);

        return true;
    }

    // Проверка доступности шага для навигации
    canNavigateTo(stepId) {
        // Шаблон всегда доступен
        if (stepId === 'template') {
            return true;
        }

        // Обработка доступна ТОЛЬКО если все файловые шаги завершены
        if (stepId === 'process') {
            return this.areAllFilesLoaded();
        }

        // После выбора шаблона ВСЕ файловые шаги доступны для клика
        // (свободная навигация как в traffic-calculation)
        const template = this.state.get('selectedTemplate');
        if (template) {
            // Проверяем что шаг существует в конфигурации шаблона
            return template.filesConfig && stepId in template.filesConfig;
        }

        return false;
    }

    // Проверка завершённости шага
    isStepCompleted(stepId) {
        // template завершён, если выбран шаблон
        if (stepId === 'template') {
            return this.state.get('selectedTemplate') !== null;
        }

        // process никогда не завершён (конечный шаг)
        if (stepId === 'process') {
            return false;
        }

        // Проверяем что шаг существует в текущем шаблоне
        const template = this.state.get('selectedTemplate');
        if (!template || !template.filesConfig || !(stepId in template.filesConfig)) {
            return false;
        }

        // Проверяем что есть данные для этого шага
        return this.state.isStepCompleted(stepId);
    }

    // Проверка, все ли файловые шаги загружены
    areAllFilesLoaded() {
        return this.state.areAllFileStepsCompleted();
    }

    // Получить текущий шаг
    getCurrentStep() {
        return this.state.get('currentStep');
    }

    // Получить следующий доступный шаг
    getNextStep() {
        const currentStep = this.getCurrentStep();
        const allSteps = this.getAllSteps();
        const currentIndex = allSteps.findIndex(step => step.id === currentStep);

        if (currentIndex === -1 || currentIndex === allSteps.length - 1) {
            return null; // Текущий шаг не найден или это последний шаг
        }

        // Находим следующий доступный шаг
        for (let i = currentIndex + 1; i < allSteps.length; i++) {
            const nextStep = allSteps[i];
            if (this.canNavigateTo(nextStep.id)) {
                return nextStep;
            }
        }

        return null;
    }

    // Получить предыдущий шаг
    getPreviousStep() {
        const currentStep = this.getCurrentStep();
        const allSteps = this.getAllSteps();
        const currentIndex = allSteps.findIndex(step => step.id === currentStep);

        if (currentIndex <= 0) {
            return null; // Текущий шаг не найден или это первый шаг
        }

        return allSteps[currentIndex - 1];
    }

    // Навигация вперёд (к следующему шагу)
    navigateNext() {
        const nextStep = this.getNextStep();
        if (nextStep) {
            return this.navigateTo(nextStep.id);
        }
        return false;
    }

    // Навигация назад (к предыдущему шагу)
    navigateBack() {
        const prevStep = this.getPreviousStep();
        if (prevStep) {
            return this.navigateTo(prevStep.id);
        }
        return false;
    }

    // Получить информацию о шаге
    getStepInfo(stepId) {
        const allSteps = this.getAllSteps();
        return allSteps.find(step => step.id === stepId);
    }

    // Получить процент завершения
    getCompletionPercentage() {
        const allSteps = this.getAllSteps();
        const fileSteps = allSteps.filter(step => step.type === 'file');

        if (fileSteps.length === 0) return 0;

        const completedSteps = fileSteps.filter(step => this.isStepCompleted(step.id));
        return Math.round((completedSteps.length / fileSteps.length) * 100);
    }
}

// Экспорт для использования в других модулях
window.StepsNavigator = StepsNavigator;
