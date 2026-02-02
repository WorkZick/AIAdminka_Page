/**
 * Team Info - Main Controller
 * Главный контроллер, объединяющий все модули
 *
 * Модульная архитектура:
 * - team-state.js: Состояние приложения
 * - team-utils.js: Утилиты
 * - team-renderer.js: Рендеринг UI
 * - team-navigation.js: Навигация
 * - team-forms.js: Формы сотрудников
 * - team-templates.js: Система шаблонов
 * - team-avatars.js: Аватары и crop
 * - team-import-export.js: Импорт/Экспорт
 * - team-invites.js: Приглашения
 */

const teamInfo = {
    /**
     * Инициализация приложения
     */
    async init() {
        // Check authentication and role status (waiting_invite/blocked check)
        if (!await AuthGuard.checkWithRole()) {
            return; // Will redirect to login or waiting-invite
        }

        try {
            // Инициализируем CloudStorage
            if (typeof CloudStorage !== 'undefined') {
                await CloudStorage.init();
            }

            // Загружаем данные
            TeamState.data = await storage.loadData();
            TeamState.loadTeamName();

            // Загружаем шаблоны
            await storage.loadTemplates();

            this.setupTextareaAutoResize();
            TeamRenderer.render();
            TeamRenderer.updateStats();
            TeamInvites.loadPendingInvites();
        } catch (error) {
            console.error('Init error:', error);
            Toast.error('Ошибка загрузки данных: ' + error.message);
        }
    },

    // ========== Проксирование методов модулей ==========
    // (для обратной совместимости с HTML onclick атрибутами)

    // TeamState
    get data() { return TeamState.data; },
    set data(value) { TeamState.data = value; },
    get currentEmployeeId() { return TeamState.currentEmployeeId; },
    set currentEmployeeId(value) { TeamState.currentEmployeeId = value; },
    loadTeamName: () => TeamState.loadTeamName(),
    sortBy: (field) => { TeamState.sortBy(field); TeamRenderer.render(); },
    filterTable: () => TeamState.filterTable(),

    // TeamRenderer
    render: () => TeamRenderer.render(),
    updateStats: () => TeamRenderer.updateStats(),
    generateCardInfo: (employee) => TeamRenderer.generateCardInfo(employee),

    // TeamNavigation
    openCard: (id) => TeamNavigation.openCard(id),
    closeCard: () => TeamNavigation.closeCard(),
    editFromCard: () => TeamNavigation.editFromCard(),

    // TeamForms
    showAddModal: () => TeamForms.showAddModal(),
    showEditForm: (id) => TeamForms.showEditForm(id),
    closeForm: () => TeamForms.closeForm(),
    saveFromForm: () => TeamForms.saveFromForm(),
    deleteFromForm: () => TeamForms.deleteFromForm(),
    deleteFromCard: () => TeamForms.deleteFromCard(),
    changeFormStatus: (status) => TeamForms.changeFormStatus(status),
    changeStatus: (status) => TeamForms.changeStatus(status),
    toggleStatusDropdown: () => TeamForms.toggleStatusDropdown(),
    toggleFormStatusDropdown: () => TeamForms.toggleFormStatusDropdown(),
    setupTextareaAutoResize: () => TeamForms.setupTextareaAutoResize(),
    cleanup: () => TeamForms.cleanup(),
    getFormData: () => TeamForms.getFormData(),
    attachFormChangeListeners: () => TeamForms.attachFormChangeListeners(),
    onFormChange: () => TeamForms.onFormChange(),
    attachAutoResizeListeners: () => TeamForms.attachAutoResizeListeners(),
    syncToProfile: (employee) => TeamForms.syncToProfile(employee),

    // TeamTemplates
    handleTemplateChange: () => TeamTemplates.handleTemplateChange(),
    restoreTemplateSelection: () => TeamTemplates.restoreTemplateSelection(),
    showDeleteTemplateDialog: () => TeamTemplates.showDeleteTemplateDialog(),
    showRenameTemplateDialog: () => TeamTemplates.showRenameTemplateDialog(),
    showEditTemplateDialog: () => TeamTemplates.showEditTemplateDialog(),
    showTemplateEditor: (existingTemplate) => TeamTemplates.showTemplateEditor(existingTemplate),
    addTemplateField: () => TeamTemplates.addTemplateField(),
    updateTemplateFieldLabel: (fieldId, label) => TeamTemplates.updateTemplateFieldLabel(fieldId, label),
    updateTemplateFieldType: (fieldId, type) => TeamTemplates.updateTemplateFieldType(fieldId, type),
    removeTemplateField: (fieldId) => TeamTemplates.removeTemplateField(fieldId),
    applyTemplate: (templateId) => TeamTemplates.applyTemplate(templateId),
    saveTemplate: () => TeamTemplates.saveTemplate(),
    updateTemplateList: () => TeamTemplates.updateTemplateList(),

    // TeamAvatars
    handleAvatarUpload: (event) => TeamAvatars.handleAvatarUpload(event),
    showCropModal: (imageData) => TeamAvatars.showCropModal(imageData),
    closeCropModal: () => TeamAvatars.closeCropModal(),
    updateCropPreview: () => TeamAvatars.updateCropPreview(),
    applyCrop: () => TeamAvatars.applyCrop(),

    // TeamImportExport
    showExportDialog: () => TeamImportExport.showExportDialog(),
    closeExportDialog: () => TeamImportExport.closeExportDialog(),

    // Helper для клика по аватару
    avatarClick: () => {
        document.getElementById('formAvatarInput').click();
    },
    doExport: () => TeamImportExport.doExport(),
    showImportDialog: () => TeamImportExport.showImportDialog(),
    closeImportDialog: () => TeamImportExport.closeImportDialog(),
    importData: () => TeamImportExport.importData(),

    // TeamInvites
    switchTab: (tabName) => TeamInvites.switchTab(tabName),
    switchInviteType: (type) => TeamInvites.switchInviteType(type),
    sendInvite: () => TeamInvites.sendInvite(),
    cancelInvite: (inviteId) => TeamInvites.cancelInvite(inviteId),
    loadPendingInvites: () => TeamInvites.loadPendingInvites(),
    savePendingInvites: () => TeamInvites.savePendingInvites(),
    renderPendingInvites: () => TeamInvites.renderPendingInvites(),
    loadGuestUsers: () => TeamInvites.loadGuestUsers(),
    inviteGuest: (email) => TeamInvites.inviteGuest(email),

    // TeamUtils (редко используются напрямую, но для полноты)
    escapeHtml: (text) => TeamUtils.escapeHtml(text),
    isValidImageUrl: (url) => TeamUtils.isValidImageUrl(url),
    formatDate: (isoString) => TeamUtils.formatDate(isoString),
    getStatusClass: (status) => TeamUtils.getStatusClass(status),
    formatFullNameForTable: (fullName) => TeamUtils.formatFullNameForTable(fullName)
};

// ========== Инициализация при загрузке страницы ==========

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Инициализируем RoleGuard для получения роли пользователя
        if (typeof RoleGuard !== 'undefined') {
            await RoleGuard.init();
        }

        await teamInfo.init();
    } catch (error) {
        console.error('❌ Loading error:', error);
    }
});

// ========== Глобальные event listeners ==========

// Закрытие модальных окон по Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (document.getElementById('exportModal').classList.contains('active')) {
            teamInfo.closeExportDialog();
        }
        if (document.getElementById('cropModal').classList.contains('active')) {
            teamInfo.closeCropModal();
        }
        if (document.getElementById('importModal').classList.contains('active')) {
            teamInfo.closeImportDialog();
        }
        if (!document.getElementById('employeeCard').classList.contains('hidden')) {
            teamInfo.closeCard();
        }
        // Закрыть status dropdowns
        const cardDropdown = document.getElementById('cardStatusDropdown');
        if (cardDropdown && cardDropdown.classList.contains('visible')) {
            cardDropdown.classList.remove('visible');
            cardDropdown.classList.add('hidden');
        }
        const formDropdown = document.getElementById('formStatusDropdown');
        if (formDropdown && formDropdown.classList.contains('visible')) {
            formDropdown.classList.remove('visible');
            formDropdown.classList.add('hidden');
        }
    }
});

// Закрытие status dropdowns при клике вне
document.addEventListener('click', (e) => {
    // Card status dropdown
    const cardDropdown = document.getElementById('cardStatusDropdown');
    const cardStatusBadge = document.getElementById('cardStatusBadge');
    if (cardDropdown && cardDropdown.classList.contains('visible')) {
        if (!cardDropdown.contains(e.target) && !cardStatusBadge.contains(e.target)) {
            cardDropdown.classList.remove('visible');
            cardDropdown.classList.add('hidden');
        }
    }

    // Form status dropdown
    const formDropdown = document.getElementById('formStatusDropdown');
    const formStatusBadge = document.getElementById('formStatusBadge');
    if (formDropdown && formDropdown.classList.contains('visible')) {
        if (!formDropdown.contains(e.target) && !formStatusBadge.contains(e.target)) {
            formDropdown.classList.remove('visible');
            formDropdown.classList.add('hidden');
        }
    }
});

// Закрытие модальных окон при клике на backdrop
document.getElementById('exportModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        teamInfo.closeExportDialog();
    }
});

document.getElementById('importModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        teamInfo.closeImportDialog();
    }
});

document.getElementById('cropModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        teamInfo.closeCropModal();
    }
});

// Event delegation для всех data-action атрибутов
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action^="team-"]');
    if (!target) return;

    const action = target.dataset.action.replace('team-', '');
    const value = target.dataset.value;
    const fieldId = target.dataset.fieldId;
    const inviteId = target.dataset.inviteId;
    const email = target.dataset.email;

    // Для status dropdown нужно остановить всплытие
    if (action.includes('changeStatus') || action.includes('changeFormStatus')) {
        e.stopPropagation();
    }

    // Вызов соответствующего метода
    if (typeof teamInfo[action] === 'function') {
        if (action === 'removeTemplateField' && fieldId) {
            teamInfo[action](fieldId);
        } else if (action === 'cancelInvite' && inviteId) {
            teamInfo[action](parseInt(inviteId));
        } else if (action === 'inviteGuest' && email) {
            teamInfo[action](email);
        } else if (value !== undefined) {
            teamInfo[action](value);
        } else {
            teamInfo[action]();
        }
    } else {
        console.warn('Метод не найден:', action);
    }
});

// Event delegation для input событий
document.addEventListener('input', (e) => {
    const target = e.target.closest('[data-action^="team-"]');
    if (!target) return;

    const action = target.dataset.action.replace('team-', '');
    const fieldId = target.dataset.fieldId;

    if (typeof teamInfo[action] === 'function') {
        if (action === 'updateTemplateFieldLabel' && fieldId) {
            teamInfo[action](fieldId, target.value);
        } else {
            teamInfo[action]();
        }
    }
});

// Event delegation для change событий (file input, select)
document.addEventListener('change', (e) => {
    const target = e.target.closest('[data-action^="team-"]');
    if (!target) return;

    const action = target.dataset.action.replace('team-', '');
    const fieldId = target.dataset.fieldId;

    if (action === 'handleAvatarUpload') {
        teamInfo.handleAvatarUpload(e);
    } else if (action === 'updateTemplateFieldType' && fieldId) {
        teamInfo.updateTemplateFieldType(fieldId, target.value);
    } else if (typeof teamInfo[action] === 'function') {
        teamInfo[action]();
    }
});

// Инициализация компонентов при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    ComponentLoader.init('../shared');
    await ComponentLoader.load('sidebar', '#sidebar-container', {
        basePath: '..',
        activeModule: 'team-info'
    });
    await ComponentLoader.load('about-modal', '#about-modal-container', {
        basePath: '..'
    });
    SidebarController.init({ basePath: '..' });
});
