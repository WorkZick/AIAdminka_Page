/* onboarding-steps.js — Steps indicator + навигация */

const OnboardingSteps = (() => {
    'use strict';

    function render(containerId, currentStep, totalCompleted) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const steps = OnboardingConfig.STEPS;
        container.innerHTML = steps.map((step, i) => {
            const num = step.number;
            let cls = 'step';
            if (num < currentStep) cls += ' completed';
            else if (num === currentStep) cls += ' active';
            cls += ' clickable';

            return `<div class="${cls}" data-action="onb-goToStep" data-value="${num}" data-title="${Utils.escapeHtml(step.name)}">
                <div class="step-number">${num}</div>
            </div>${i < steps.length - 1 ? '<div class="step-line"></div>' : ''}`;
        }).join('');
    }

    return { render };
})();
