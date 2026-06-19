// excel-reports/js/modules/state-manager.js
//
// Phase 24 SIG-02: ExcelReportsState — signals-based state management.
// Заменяет legacy Pub/Sub StateManager (atomic per-module Pitfall #6).
//
// Discrete signals (НЕ single blob): currentStep, selectedTemplate, steps.
// Computed (auto-tracked, lazy): isTemplateCompleted, allFileStepsCompleted.
// Mutators (NEVER inside effect — Pitfall A; ALWAYS REASSIGN — Pitfall B):
//   initializeSteps/markStepCompleted/reset/setStepData/setStepFiles.
// Read helpers заменяют legacy state.get(...) patterns в consumers.

const ExcelReportsState = (() => {
    'use strict';

    if (typeof window.signal !== 'function') {
        throw new Error('ExcelReportsState: window.signal not available — cdn-deps.js not loaded');
    }

    // Discrete signals
    const currentStep = window.signal('template');
    const selectedTemplate = window.signal(null);
    const steps = window.signal({ 'template': { completed: false } });

    // Computed (auto-tracked)
    const isTemplateCompleted = window.computed(() =>
        steps.value['template']?.completed === true
    );

    const allFileStepsCompleted = window.computed(() => {
        const tmpl = selectedTemplate.value;
        if (!tmpl || !tmpl.filesConfig) return false;
        const stepsValue = steps.value;
        return Object.keys(tmpl.filesConfig).every(stepId =>
            stepsValue[stepId]?.completed === true
        );
    });

    // Mutators
    function initializeSteps(template) {
        const newSteps = { 'template': { completed: true, data: template } };
        if (template && template.filesConfig) {
            Object.keys(template.filesConfig).forEach(stepId => {
                newSteps[stepId] = { completed: false, files: [], data: [] };
            });
        }
        newSteps['process'] = { completed: false, result: null };
        // batch — multi-signal write coalescing (Pitfall B prevention)
        window.batch(() => {
            steps.value = newSteps;            // REASSIGN, не in-place
            selectedTemplate.value = template;
        });
    }

    function markStepCompleted(stepId, data = null) {
        const cur = steps.value;
        const updated = { ...cur, [stepId]: { ...cur[stepId], completed: true } };
        if (data !== null) {
            updated[stepId].data = data;
        }
        steps.value = updated; // REASSIGN
    }

    function reset() {
        window.batch(() => {
            currentStep.value = 'template';
            selectedTemplate.value = null;
            steps.value = { 'template': { completed: false } };
        });
    }

    function setStepData(stepId, data) {
        const cur = steps.value;
        steps.value = {
            ...cur,
            [stepId]: { ...(cur[stepId] || {}), data }
        };
    }

    function setStepFiles(stepId, files) {
        const cur = steps.value;
        steps.value = {
            ...cur,
            [stepId]: { ...(cur[stepId] || {}), files }
        };
    }

    return {
        // Signals (raw refs — для effect/computed чтения)
        currentStep,
        selectedTemplate,
        steps,
        // Computed
        isTemplateCompleted,
        allFileStepsCompleted,
        // Mutators
        initializeSteps,
        markStepCompleted,
        reset,
        setStepData,
        setStepFiles,
        // Read-helpers (replace Pub/Sub get patterns в consumers)
        isStepCompleted: (stepId) => steps.value[stepId]?.completed === true,
        areAllFileStepsCompleted: () => allFileStepsCompleted.value,
        getStepData: (stepId) => steps.value[stepId]?.data,
        getStepFiles: (stepId) => steps.value[stepId]?.files || []
    };
})();

// Экспорт для использования в других модулях (sourceType:'script' pattern)
if (typeof window !== 'undefined') {
    window.ExcelReportsState = ExcelReportsState;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExcelReportsState;
}
