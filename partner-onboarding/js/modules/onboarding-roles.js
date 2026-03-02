/* onboarding-roles.js — Per-step role configuration (leader/admin) */

const OnboardingRoles = (() => {
    'use strict';

    // Default: matches current hardcoded roleMap behavior
    const DEFAULTS = {
        1: { executors: ['sales', 'partners_mgr'], reviewer: null },
        2: { executors: ['sales', 'partners_mgr'], reviewer: 'assistant' },
        3: { executors: ['sales', 'partners_mgr'], reviewer: 'assistant' },
        4: { executors: ['sales', 'partners_mgr'], reviewer: 'assistant' },
        5: { executors: ['antifraud'],             reviewer: null },
        6: { executors: ['sales', 'partners_mgr'], reviewer: 'assistant' },
        7: { executors: ['sales', 'partners_mgr'], reviewer: 'assistant' },
        8: { executors: ['assistant'],             reviewer: null }
    };

    let _config = null;

    // ── Config ──

    function _mergeWithDefaults(saved) {
        const merged = {};
        const steps = OnboardingConfig.STEPS;
        for (let i = 0; i < steps.length; i++) {
            const num = steps[i].number;
            const def = DEFAULTS[num] || { executors: [], reviewer: null };
            const s = saved ? saved[num] : null;
            if (s && Array.isArray(s.executors)) {
                merged[num] = {
                    executors: s.executors.slice(),
                    reviewer: s.reviewer !== undefined ? s.reviewer : def.reviewer
                };
            } else {
                merged[num] = { executors: def.executors.slice(), reviewer: def.reviewer };
            }
        }
        return merged;
    }

    function _cloneDefaults() {
        const clone = {};
        const keys = Object.keys(DEFAULTS);
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            clone[k] = { executors: DEFAULTS[k].executors.slice(), reviewer: DEFAULTS[k].reviewer };
        }
        return clone;
    }

    function _getConfig() {
        if (!_config) _config = _cloneDefaults();
        return _config;
    }

    function _getStepConfig(stepNumber) {
        const config = _getConfig();
        return config[stepNumber] || DEFAULTS[stepNumber] || { executors: [], reviewer: null };
    }

    // Called by OnboardingSource.init() with data from getOnboardingSettings
    function initFromConfig(roleConfig) {
        _config = _mergeWithDefaults(roleConfig || {});
    }

    // ── Core Resolution ──

    function isExecutorForStep(systemRole, stepNumber) {
        if (systemRole === 'admin' || systemRole === 'leader') return true;
        const sc = _getStepConfig(stepNumber);
        return sc.executors.indexOf(systemRole) !== -1;
    }

    function isReviewerForStep(systemRole, stepNumber) {
        if (systemRole === 'admin' || systemRole === 'leader') return true;
        const sc = _getStepConfig(stepNumber);
        return sc.reviewer === systemRole;
    }

    function getGlobalModuleRole(systemRole) {
        if (systemRole === 'admin' || systemRole === 'leader') return systemRole;
        const config = _getConfig();
        const steps = OnboardingConfig.STEPS;
        let isReviewer = false;
        let isExecutor = false;
        for (let i = 0; i < steps.length; i++) {
            const sc = config[steps[i].number];
            if (!sc) continue;
            if (sc.reviewer === systemRole) isReviewer = true;
            if (sc.executors.indexOf(systemRole) !== -1) isExecutor = true;
        }
        if (isReviewer) return 'reviewer';
        if (isExecutor) return 'executor';
        return systemRole;
    }

    // ── Settings Modal UI ──

    function openSettings() {
        _renderSettings();
        const modal = document.getElementById('roleConfigModal');
        if (modal) modal.classList.add('active');
    }

    function _renderSettings() {
        const body = document.getElementById('roleConfigBody');
        if (!body) return;

        const config = _getConfig();
        const steps = OnboardingConfig.STEPS;
        const roles = typeof RolesConfig !== 'undefined' ? RolesConfig.ASSIGNABLE_ROLES : [];

        let html = '<table class="role-config-table"><thead><tr>';
        html += '<th>Шаг</th><th>Исполнитель</th><th>Проверяющий</th>';
        html += '</tr></thead><tbody>';

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const sc = config[step.number] || { executors: [], reviewer: null };
            const origStep = OnboardingConfig.getStep(step.number);
            const hasReview = origStep && origStep.reviewer !== null;

            html += '<tr>';
            html += `<td><span class="role-config-step-name">${step.number}. ${Utils.escapeHtml(step.shortName)}</span></td>`;

            html += '<td><div class="role-config-checkboxes">';
            for (let j = 0; j < roles.length; j++) {
                const role = roles[j];
                const checked = sc.executors.indexOf(role) !== -1 ? ' checked' : '';
                const roleName = typeof RolesConfig !== 'undefined' ? RolesConfig.getName(role) : role;
                html += `<label class="role-config-checkbox-label">
                    <input type="checkbox" name="exec_${step.number}" value="${Utils.escapeHtml(role)}"${checked}>
                    <span>${Utils.escapeHtml(roleName)}</span>
                </label>`;
            }
            html += '</div></td>';

            html += '<td>';
            if (hasReview) {
                html += `<select class="role-config-select" name="rev_${step.number}">`;
                html += '<option value="">— нет —</option>';
                for (let j = 0; j < roles.length; j++) {
                    const role = roles[j];
                    const selected = sc.reviewer === role ? ' selected' : '';
                    const roleName = typeof RolesConfig !== 'undefined' ? RolesConfig.getName(role) : role;
                    html += `<option value="${Utils.escapeHtml(role)}"${selected}>${Utils.escapeHtml(roleName)}</option>`;
                }
                html += '</select>';
            } else {
                html += '<span class="role-config-auto">(авто-шаг)</span>';
            }
            html += '</td>';

            html += '</tr>';
        }

        html += '</tbody></table>';
        body.innerHTML = html;
    }

    async function saveConfig() {
        const body = document.getElementById('roleConfigBody');
        if (!body) return;

        const steps = OnboardingConfig.STEPS;
        const newConfig = {};

        for (let i = 0; i < steps.length; i++) {
            const num = steps[i].number;
            const origStep = OnboardingConfig.getStep(num);
            const hasReview = origStep && origStep.reviewer !== null;

            const executors = [];
            const checkboxes = body.querySelectorAll(`input[name="exec_${num}"]:checked`);
            for (let j = 0; j < checkboxes.length; j++) {
                executors.push(checkboxes[j].value);
            }

            if (executors.length === 0) {
                Toast.error(`Шаг ${num}: выберите хотя бы одного исполнителя`);
                return;
            }

            let reviewer = null;
            if (hasReview) {
                const select = body.querySelector(`select[name="rev_${num}"]`);
                reviewer = select ? (select.value || null) : null;
            }

            newConfig[num] = { executors: executors, reviewer: reviewer };
        }

        _config = newConfig;
        try {
            await CloudStorage.postApi('saveOnboardingRoleConfig', { config: newConfig });
            Toast.success('Роли сохранены');
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'saveRoleConfig' });
        }
    }

    function resetToDefaults() {
        _config = _cloneDefaults();
        _renderSettings();
        Toast.info('Роли сброшены к значениям по умолчанию');
    }

    // ── Lifecycle ──

    function destroy() {
        _config = null;
    }

    return {
        initFromConfig, destroy,
        isExecutorForStep, isReviewerForStep, getGlobalModuleRole,
        openSettings, saveConfig, resetToDefaults
    };
})();
