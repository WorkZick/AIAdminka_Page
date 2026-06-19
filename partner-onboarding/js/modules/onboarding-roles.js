/* onboarding-roles.js — Per-step role configuration (leader/admin) */

const OnboardingRoles = (() => {
    'use strict';

    // Default: matches current hardcoded roleMap behavior
    const DEFAULTS = {
        1: { executors: ['sales'], reviewer: null },
        2: { executors: ['sales'], reviewer: 'assistant' },
        3: { executors: ['sales'], reviewer: 'assistant' },
        4: { executors: ['sales'], reviewer: 'assistant' },
        5: { executors: ['assistant'], reviewer: null },
        6: { executors: ['sales'], reviewer: 'assistant' },
        7: { executors: ['sales'], reviewer: 'assistant' },
        8: { executors: ['assistant'], reviewer: null }
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
        // Phase 30 LIT-MIG-04: <app-modal> uses boolean property API (was .modal class .active)
        const modal = document.getElementById('roleConfigModal');
        if (modal) {
            if (modal.tagName === 'APP-MODAL') modal.open = true;
            else modal.classList.add('active');
        }
    }

    function _renderSettings() {
        const body = document.getElementById('roleConfigBody');
        if (!body) return;

        const config = _getConfig();
        const steps = OnboardingConfig.STEPS;
        const roles = typeof RolesConfig !== 'undefined' ? RolesConfig.ASSIGNABLE_ROLES : [];

        let html = '<div class="rc-steps">';

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const sc = config[step.number] || { executors: [], reviewer: null };
            const origStep = OnboardingConfig.getStep(step.number);
            const hasReview = origStep && origStep.reviewer !== null;

            html += '<div class="rc-step">';
            html += `<div class="rc-step-header">`;
            html += `<span class="rc-step-num">${step.number}</span>`;
            html += `<span class="rc-step-name">${Utils.escapeHtml(step.shortName)}</span>`;
            if (!hasReview) html += '<span class="rc-no-review">без проверки</span>';
            html += '</div>';

            html += '<div class="rc-step-body">';

            // Executor pills
            html += '<div class="rc-section">';
            html += '<span class="rc-label">Исполнитель</span>';
            html += '<div class="rc-pills">';
            for (let j = 0; j < roles.length; j++) {
                const role = roles[j];
                const checked = sc.executors.indexOf(role) !== -1;
                const roleName = typeof RolesConfig !== 'undefined' ? RolesConfig.getName(role) : role;
                html += `<label class="rc-pill${checked ? ' active' : ''}">
                    <input type="checkbox" name="exec_${step.number}" value="${Utils.escapeHtml(role)}"${checked ? ' checked' : ''}>
                    <span>${Utils.escapeHtml(roleName)}</span>
                </label>`;
            }
            html += '</div></div>';

            // Reviewer select
            if (hasReview) {
                html += '<div class="rc-section">';
                html += '<span class="rc-label">Проверяющий</span>';
                const revMenuId = `menu_rev_${step.number}`;
                const selRole = sc.reviewer || '';
                const selRoleName = selRole && typeof RolesConfig !== 'undefined' ? RolesConfig.getName(selRole) : '';
                const revTrigLabel = selRoleName || '— нет —';
                const revPhClass = selRole ? '' : ' placeholder';
                html += `<div class="dropdown-wrap dropdown-wrap--form">`;
                html += `<button class="dropdown-trigger dropdown-trigger--form${revPhClass}" type="button" data-action="onb-toggleFormDropdown" data-target="${revMenuId}"><span>${Utils.escapeHtml(revTrigLabel)}</span></button>`;
                html += `<div class="dropdown-menu hidden" id="${revMenuId}">`;
                html += `<div class="dropdown-item${!selRole ? ' active' : ''}" data-action="onb-selectFormDropdown" data-value="">— нет —</div>`;
                for (let j = 0; j < roles.length; j++) {
                    const role = roles[j];
                    const selected = sc.reviewer === role;
                    const roleName = typeof RolesConfig !== 'undefined' ? RolesConfig.getName(role) : role;
                    html += `<div class="dropdown-item${selected ? ' active' : ''}" data-action="onb-selectFormDropdown" data-value="${Utils.escapeHtml(role)}">${Utils.escapeHtml(roleName)}</div>`;
                }
                html += '</div>';
                html += `<input type="hidden" name="rev_${step.number}" value="${Utils.escapeHtml(selRole)}">`;
                html += '</div>';
                html += '</div>';
            }

            html += '</div></div>';
        }

        html += '</div>';
        body.innerHTML = html;

        // Toggle pill active state on checkbox change
        body.addEventListener('change', function(e) {
            if (e.target.type === 'checkbox' && e.target.closest('.rc-pill')) {
                e.target.closest('.rc-pill').classList.toggle('active', e.target.checked);
            }
        });
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
                const revInput = body.querySelector(`input[type="hidden"][name="rev_${num}"]`);
                reviewer = revInput ? (revInput.value || null) : null;
            }

            newConfig[num] = { executors: executors, reviewer: reviewer };
        }

        _config = newConfig;
        const btn = document.querySelector('[data-action="onb-saveRoleConfig"]');
        if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }
        try {
            await CloudStorage.postApi('saveOnboardingRoleConfig', { config: newConfig });
            CloudStorage.clearCache('onboardingSettings');
            Toast.success('Роли сохранены');
            // BFIX (audit 2026-05-20): close modal только ПОСЛЕ успешного save.
            // Раньше handler закрывал immediately → пользователь не видел индикации
            // ошибки если backend упал. Сейчас: btn-loading spinner до server-ack,
            // close on success, оставить открытой на error (Toast.error от ErrorHandler).
            var modal = document.getElementById('roleConfigModal');
            if (modal) modal.open = false;
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'saveRoleConfig' });
        } finally {
            if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
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
