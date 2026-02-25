/**
 * OnboardingSteps — Steps indicator + навигация по шагам
 * Рендеринг шагов, переходы, обновление визуального состояния
 * Поддерживает noApproval и auto шаги
 */

const OnboardingSteps = {
    /** Рендеринг steps indicator в контейнер
     * @param {string} containerId
     * @param {number} currentStep - активный шаг (подсвечивается)
     * @param {number[]} [completedSteps] - завершённые шаги
     * @param {Object} [options]
     * @param {number} [options.clickableUpTo] - все шаги <= этого номера кликабельны
     */
    render(containerId, currentStep, completedSteps, options) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const stages = OnboardingConfig.stages;
        const clickableUpTo = options?.clickableUpTo || 0;
        let html = '';

        stages.forEach((stage, index) => {
            const isCompleted = completedSteps ? completedSteps.includes(stage.number) : stage.number < currentStep;
            const isActive = stage.number === currentStep;
            const isClickable = stage.number !== currentStep;

            let stepClass = 'step';
            if (isCompleted) stepClass += ' completed';
            if (isActive) stepClass += ' active';
            if (isClickable) stepClass += ' clickable';
            if (stage.auto) stepClass += ' auto';

            // Step line (before each step except first)
            if (index > 0) {
                const lineClass = isCompleted || isActive ? 'completed' : '';
                html += `<div class="step-line ${lineClass}"></div>`;
            }

            const numberContent = isCompleted ? '&#10003;' : (stage.auto ? '&#9881;' : stage.number);

            html += `
                <div class="${stepClass}" data-title="${Utils.escapeHtml(stage.name)}"
                     ${isClickable ? `data-action="onboarding-goToStep" data-value="${stage.number}"` : ''}>
                    <div class="step-number">${numberContent}</div>
                    <div class="step-text">${Utils.escapeHtml(stage.shortName)}</div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    /** Обновить заголовок текущего шага */
    updateStepInfo(stageNumber) {
        const stage = OnboardingConfig.getStage(stageNumber);
        if (!stage) return;

        const titleEl = document.getElementById('stepTitle');
        if (titleEl) {
            titleEl.textContent = `Шаг ${stage.number}: ${stage.name}`;
        }
    },

    /** Перейти к следующему шагу */
    nextStep() {
        const current = OnboardingState.get('currentStep');
        if (current < OnboardingConfig.totalStages) {
            OnboardingState.set('currentStep', current + 1);
        }
    },

    /** Перейти к конкретному шагу */
    goToStep(stepNumber) {
        const num = parseInt(stepNumber, 10);
        if (num >= 1 && num <= OnboardingConfig.totalStages) {
            OnboardingState.set('currentStep', num);
        }
    },

    /** Обновить видимость кнопок executor/reviewer */
    updateActionButtons(stageNumber, request) {
        const userRole = OnboardingState.get('userRole');
        const stage = OnboardingConfig.getStage(stageNumber);
        const isExecutor = OnboardingConfig.isExecutor(stageNumber, userRole);
        const isReviewer = OnboardingConfig.isReviewer(stageNumber, userRole);
        const status = request?.status || 'executor';

        // Executor buttons
        const btnSaveDraft = document.getElementById('btnSaveDraft');
        const btnSubmit = document.getElementById('btnSubmitReview');

        // Reviewer buttons
        const btnReject = document.getElementById('btnReject');
        const btnApprove = document.getElementById('btnApprove');

        // Form vs Review
        const stepForm = document.getElementById('stepForm');
        const stepReview = document.getElementById('stepReview');

        // Автоматический шаг — скрываем все кнопки
        if (stage?.auto) {
            stepForm?.classList.remove('hidden');
            stepReview?.classList.add('hidden');
            [btnSaveDraft, btnSubmit, btnReject, btnApprove].forEach(btn => btn?.classList.add('hidden'));
            return;
        }

        // autoSubmit шаг — executor не заполняет форму, сразу на ревью
        if (stage?.autoSubmit) {
            stepForm?.classList.remove('hidden');
            stepReview?.classList.add('hidden');
            [btnSaveDraft, btnSubmit, btnReject, btnApprove].forEach(btn => btn?.classList.add('hidden'));
            return;
        }

        // Шаг 3 — фазовый workflow
        if (stageNumber === 3) {
            const accountStatus = request?.stageData?.[3]?.phase || '';

            if (accountStatus === 'filled') {
                // Phase 4: reviewer проверяет чеклист → approve/reject
                stepForm?.classList.remove('hidden');
                stepReview?.classList.add('hidden');
                btnSaveDraft?.classList.add('hidden');
                btnSubmit?.classList.add('hidden');

                if (isReviewer && status === 'reviewer') {
                    btnReject?.classList.remove('hidden');
                    btnApprove?.classList.remove('hidden');
                } else {
                    btnReject?.classList.add('hidden');
                    btnApprove?.classList.add('hidden');
                }
            } else {
                // Другие фазы — кнопки управляются через _updateAccountUI
                stepForm?.classList.remove('hidden');
                stepReview?.classList.add('hidden');
                [btnSaveDraft, btnSubmit, btnReject, btnApprove].forEach(btn => btn?.classList.add('hidden'));
                // _updateAccountUI() покажет нужную кнопку через btnSaveDraft
            }

            return;
        }

        // Шаг 5 — фазовый workflow (мессенджер), пока партнёр не зашёл
        if (stageNumber === 5) {
            const messengerStatus = request?.stageData?.[5]?.phase || '';
            if (messengerStatus !== 'logged') {
                stepForm?.classList.remove('hidden');
                stepReview?.classList.add('hidden');
                [btnSaveDraft, btnSubmit, btnReject, btnApprove].forEach(btn => btn?.classList.add('hidden'));
                return;
                // _updateMessengerUI() покажет нужную кнопку через btnSaveDraft
            }
        }

        // noApproval шаг — кнопка действия скрыта, показывается через _updateLeadStatusUI
        if (stage?.noApproval && isExecutor && (status === 'executor' || status === 'revision')) {
            stepForm?.classList.remove('hidden');
            stepReview?.classList.add('hidden');
            btnSaveDraft?.classList.add('hidden'); // Показывается через _updateLeadStatusUI
            btnSubmit?.classList.add('hidden');
            btnReject?.classList.add('hidden');
            btnApprove?.classList.add('hidden');
        } else if (status === 'reviewer' && isReviewer) {
            // Reviewer mode
            stepForm?.classList.add('hidden');
            stepReview?.classList.remove('hidden');
            btnSaveDraft?.classList.add('hidden');
            btnSubmit?.classList.add('hidden');
            btnReject?.classList.remove('hidden');
            btnApprove?.classList.remove('hidden');
        } else if (isExecutor && (status === 'executor' || status === 'revision')) {
            // Executor mode — черновик сохраняется автоматически
            stepForm?.classList.remove('hidden');
            stepReview?.classList.add('hidden');
            btnSaveDraft?.classList.add('hidden');
            if (btnSubmit) {
                btnSubmit.classList.remove('hidden');
                btnSubmit.textContent = 'Отправить на проверку';
            }
            btnReject?.classList.add('hidden');
            btnApprove?.classList.add('hidden');
        } else {
            // Read-only (completed or no access)
            stepForm?.classList.add('hidden');
            stepReview?.classList.remove('hidden');
            btnSaveDraft?.classList.add('hidden');
            btnSubmit?.classList.add('hidden');
            btnReject?.classList.add('hidden');
            btnApprove?.classList.add('hidden');
        }

    }
};
