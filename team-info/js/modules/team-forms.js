/**
 * Team Forms Module
 * Работа с формами добавления и редактирования сотрудников
 */

const TeamForms = {
    /**
     * Показать модальное окно добавления нового сотрудника
     */
    showAddModal() {
        // Скрыть hint и карточку
        const hintPanel = document.getElementById('hintPanel');
        const employeeCard = document.getElementById('employeeCard');
        hintPanel.classList.remove('visible-flex');
        hintPanel.classList.add('hidden');
        employeeCard.classList.remove('visible-flex');
        employeeCard.classList.add('hidden');

        // Показать форму
        const form = document.getElementById('employeeForm');
        form.classList.remove('hidden');
        form.classList.add('visible');

        // Добавить в стек навигации
        TeamNavigation.pushNavigation('form', null);

        // Сбросить форму
        TeamState.currentEmployeeId = null;
        TeamState.currentAvatar = null;
        document.getElementById('formTitle').textContent = 'Новый сотрудник';
        document.getElementById('formSaveBtnText').textContent = 'Добавить сотрудника';
        const deleteBtn = document.getElementById('formDeleteBtn');
        deleteBtn.classList.add('hidden');

        this._clearFormFields();
        this._resetFormStatus();
        this._resetAvatar();
        this._initFormState();

        document.getElementById('formFullName').focus();
    },

    /**
     * Показать форму редактирования сотрудника
     * @param {number} id - ID сотрудника
     */
    showEditForm(id) {
        const employee = TeamState.data.find(e => e.id === id);
        if (!employee) return;

        // Скрыть карточку
        const employeeCard = document.getElementById('employeeCard');
        employeeCard.classList.remove('visible-flex');
        employeeCard.classList.add('hidden');

        // Показать форму
        const form = document.getElementById('employeeForm');
        form.classList.remove('hidden');
        form.classList.add('visible');

        // Добавить в стек навигации
        TeamNavigation.pushNavigation('form', id);

        // Заполнить форму данными сотрудника
        TeamState.currentEmployeeId = id;
        TeamState.currentAvatar = employee.avatar || null;
        document.getElementById('formTitle').textContent = 'Редактирование';
        document.getElementById('formSaveBtnText').textContent = 'Сохранить';
        const deleteBtn = document.getElementById('formDeleteBtn');
        deleteBtn.classList.remove('hidden');

        this._fillFormFields(employee);
        this._initFormState();
    },

    /**
     * Закрыть форму и вернуться к предыдущему представлению
     */
    closeForm() {
        const form = document.getElementById('employeeForm');
        form.classList.remove('visible');
        form.classList.add('hidden');
        TeamState.formChanged = false;
        TeamState.originalFormData = null;

        // Удалить текущую форму из навигации
        TeamNavigation.popNavigation();

        // Вернуться к предыдущему представлению
        const previousView = TeamState.navigationStack.length > 0
            ? TeamState.navigationStack[TeamState.navigationStack.length - 1]
            : null;

        if (previousView && previousView.view === 'card' && previousView.employeeId) {
            this._returnToCard(previousView.employeeId);
        } else {
            // Вернуться к hint panel
            const hintPanel = document.getElementById('hintPanel');
            hintPanel.classList.remove('hidden');
            hintPanel.classList.add('visible-flex');
            TeamState.currentEmployeeId = null;
        }
        TeamRenderer.render();
    },

    /**
     * Сохранить данные формы
     */
    async saveFromForm() {
        const fullName = document.getElementById('formFullName').value.trim();
        const position = (document.getElementById('formPositionValue')?.value || '').trim();
        const status = TeamState.currentFormStatus || 'Работает';

        // Валидация
        if (!fullName) {
            Toast.warning('Введите ФИО');
            return;
        }

        if (!position) {
            Toast.warning('Выберите роль');
            return;
        }

        const employeeData = this._collectFormData(fullName, position, status);

        if (TeamState.currentEmployeeId) {
            // Редактирование существующего
            await this._updateEmployee(employeeData);
        } else {
            // Добавление нового
            await this._addEmployee(employeeData);
        }
    },

    /**
     * Удалить сотрудника из формы
     */
    async deleteFromForm() {
        if (!TeamState.currentEmployeeId) return;

        const employee = TeamState.data.find(e => e.id === TeamState.currentEmployeeId);
        if (employee && await ConfirmModal.show('Удалить "' + employee.fullName + '"?', { danger: true })) {
            const employeeId = TeamState.currentEmployeeId;
            const snapshot = structuredClone(TeamState.data);
            const deleteIdx = TeamState.data.findIndex(e => e.id === employeeId);
            const deletedEmployee = TeamState.data[deleteIdx];

            // Optimistic: splice to preserve array reference (Phase 8 pattern)
            if (deleteIdx !== -1) TeamState.data.splice(deleteIdx, 1);
            TeamState._invalidateFiltered();

            // Close form and re-render immediately
            this.closeForm();
            TeamRenderer.render();
            TeamRenderer.updateStats();

            const onRollback = (error) => {
                TeamState._invalidateFiltered();
                TeamRenderer.render();
                TeamRenderer.updateStats();
                Toast.error('Ошибка удаления: ' + error.message, 6000, {
                    action: { label: 'Повторить', callback: () => {
                        TeamState.currentEmployeeId = employeeId;
                        TeamForms.deleteFromForm();
                    }}
                });
            };

            const opId = TeamState._optimistic.apply({
                stateRef: TeamState.data,
                index: deleteIdx,
                snapshot,
                operation: 'delete',
                item: deletedEmployee || { id: employeeId },
                onRollback
            });

            try {
                const result = await storage.deleteEmployee(employeeId);
                if (result && result.success === false) {
                    TeamState._optimistic.rollback(opId, new Error(result.error || 'Ошибка удаления'));
                } else {
                    TeamState._optimistic.confirm(opId);
                    if (TeamState.serverPaginationEnabled) {
                        await goToTeamPage(TeamState.currentPage);
                    }
                    Toast.success('Сотрудник удален!');
                }
            } catch (error) {
                TeamState._optimistic.rollback(opId, error);
            }
        }
    },

    /**
     * Удалить сотрудника из карточки
     */
    async deleteFromCard() {
        if (!TeamState.currentEmployeeId) return;

        const employee = TeamState.data.find(e => e.id === TeamState.currentEmployeeId);
        if (employee && await ConfirmModal.show('Удалить "' + employee.fullName + '"?', { danger: true })) {
            const employeeId = TeamState.currentEmployeeId;
            const snapshot = structuredClone(TeamState.data);
            const deleteIdx = TeamState.data.findIndex(e => e.id === employeeId);
            const deletedEmployee = TeamState.data[deleteIdx];

            // Optimistic: splice to preserve array reference
            if (deleteIdx !== -1) TeamState.data.splice(deleteIdx, 1);
            TeamState._invalidateFiltered();

            TeamNavigation.closeCard();
            TeamRenderer.render();
            TeamRenderer.updateStats();

            const onRollback = (error) => {
                TeamState._invalidateFiltered();
                TeamRenderer.render();
                TeamRenderer.updateStats();
                Toast.error('Ошибка удаления: ' + error.message, 6000, {
                    action: { label: 'Повторить', callback: () => {
                        TeamState.currentEmployeeId = employeeId;
                        TeamForms.deleteFromCard();
                    }}
                });
            };

            const opId = TeamState._optimistic.apply({
                stateRef: TeamState.data,
                index: deleteIdx,
                snapshot,
                operation: 'delete',
                item: deletedEmployee || { id: employeeId },
                onRollback
            });

            try {
                const result = await storage.deleteEmployee(employeeId);
                if (result && result.success === false) {
                    TeamState._optimistic.rollback(opId, new Error(result.error || 'Ошибка удаления'));
                } else {
                    TeamState._optimistic.confirm(opId);
                    if (TeamState.serverPaginationEnabled) {
                        await goToTeamPage(TeamState.currentPage);
                    }
                    Toast.success('Сотрудник удален!');
                }
            } catch (error) {
                TeamState._optimistic.rollback(opId, error);
            }
        }
    },

    /**
     * Изменить статус сотрудника в форме
     * @param {string} newStatus - Новый статус
     */
    changeFormStatus(newStatus) {
        TeamState.currentFormStatus = newStatus;
        TeamUtils.setStatusText(document.getElementById('formStatusText'), newStatus);

        // Скрыть dropdown
        const dropdown = document.getElementById('formStatusDropdown');
        dropdown.classList.add('hidden');

        // Триггер детекции изменений
        this.onFormChange();
    },

    /**
     * Изменить статус сотрудника в карточке
     * @param {string} newStatus - Новый статус
     */
    async changeStatus(newStatus) {
        if (!TeamState.currentEmployeeId) return;

        const employee = TeamState.data.find(e => e.id === TeamState.currentEmployeeId);
        if (!employee) return;

        const snapshot = structuredClone(TeamState.data);
        const index = TeamState.data.findIndex(e => e.id === TeamState.currentEmployeeId);
        const oldStatus = employee.status;

        // Скрыть dropdown
        const dropdown = document.getElementById('cardStatusDropdown');
        dropdown.classList.add('hidden');

        // Optimistic: update status
        employee.status = newStatus;
        employee.updatedAt = new Date().toISOString();
        employee._pending = true;
        TeamState._invalidateFiltered();

        // Update UI immediately
        TeamUtils.setStatusText(document.getElementById('cardStatusText'), newStatus);
        TeamRenderer.render();
        TeamRenderer.updateStats();

        const onRollback = (error) => {
            employee._pending = false;
            TeamState._invalidateFiltered();
            TeamUtils.setStatusText(document.getElementById('cardStatusText'), oldStatus);
            TeamRenderer.render();
            TeamRenderer.updateStats();
            Toast.error('Ошибка сохранения статуса: ' + error.message, 6000, {
                action: { label: 'Повторить', callback: () => TeamForms.changeStatus(newStatus) }
            });
        };

        const opId = TeamState._optimistic.apply({
            stateRef: TeamState.data,
            index,
            snapshot,
            operation: 'update',
            item: employee,
            onRollback
        });

        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Сервер не отвечает')), 30000)
            );
            const result = await Promise.race([storage.saveEmployee(employee), timeoutPromise]);
            if (!result.error) {
                employee._pending = false;
                TeamState._optimistic.confirm(opId);
                TeamRenderer.render();
                this.syncToProfile(employee);
            } else {
                employee._pending = false;
                TeamState._optimistic.rollback(opId, new Error(result.error));
                TeamRenderer.render();
            }
        } catch (error) {
            employee._pending = false;
            TeamState._optimistic.rollback(opId, error);
            TeamRenderer.render();
        }
    },

    /**
     * Переключить dropdown статуса в карточке
     */
    toggleStatusDropdown() {
        const dropdown = document.getElementById('cardStatusDropdown');
        dropdown.classList.toggle('hidden');
    },

    /**
     * Переключить dropdown статуса в форме
     */
    toggleFormStatusDropdown() {
        const dropdown = document.getElementById('formStatusDropdown');
        dropdown.classList.toggle('hidden');
    },

    /**
     * Настроить auto-resize для textarea
     */
    setupTextareaAutoResize() {
        const textarea = document.getElementById('formComment');
        if (!textarea) return;

        // Удалить предыдущие listeners (предотвращение memory leaks)
        if (TeamState.eventHandlers.textareaAutoResize) {
            textarea.removeEventListener('input', TeamState.eventHandlers.textareaAutoResize);
            textarea.removeEventListener('change', TeamState.eventHandlers.textareaAutoResize);
        }

        // Сохранить ссылку для очистки
        TeamState.eventHandlers.textareaAutoResize = () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        };

        textarea.addEventListener('input', TeamState.eventHandlers.textareaAutoResize);
        textarea.addEventListener('change', TeamState.eventHandlers.textareaAutoResize);
    },

    /**
     * Очистка event listeners
     */
    cleanup() {
        const textarea = document.getElementById('formComment');
        if (textarea && TeamState.eventHandlers.textareaAutoResize) {
            textarea.removeEventListener('input', TeamState.eventHandlers.textareaAutoResize);
            textarea.removeEventListener('change', TeamState.eventHandlers.textareaAutoResize);
        }
        TeamState.eventHandlers = {};
    },

    /**
     * Получить данные формы
     * @returns {object} Данные формы
     */
    getFormData() {
        return {
            fullName: document.getElementById('formFullName').value,
            position: document.getElementById('formPositionValue')?.value || '',
            status: TeamState.currentFormStatus || 'Работает',
            reddyId: document.getElementById('formReddyId').value,
            corpTelegram: document.getElementById('formCorpTelegram').value,
            personalTelegram: document.getElementById('formPersonalTelegram').value,
            birthday: document.getElementById('formBirthday').value,
            corpEmail: document.getElementById('formCorpEmail').value,
            personalEmail: document.getElementById('formPersonalEmail').value,
            corpPhone: document.getElementById('formCorpPhone').value,
            personalPhone: document.getElementById('formPersonalPhone').value,
            office: document.getElementById('formOffice').value,
            startDate: document.getElementById('formStartDate').value,
            company: document.getElementById('formCompany').value,
            crmLogin: document.getElementById('formCrmLogin').value,
            comment: document.getElementById('formComment').value
        };
    },

    /**
     * Прикрепить listeners для отслеживания изменений формы
     */
    attachFormChangeListeners() {
        const formFields = [
            'formFullName', 'formPositionValue', 'formReddyId',
            'formCorpTelegram', 'formPersonalTelegram', 'formBirthday',
            'formCorpEmail', 'formPersonalEmail', 'formCorpPhone',
            'formPersonalPhone', 'formOffice', 'formStartDate',
            'formCompany', 'formCrmLogin', 'formComment'
        ];

        formFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                const event = field.tagName === 'SELECT' ? 'change' : 'input';
                field.removeEventListener(event, this.onFormChange.bind(this));
                field.addEventListener(event, this.onFormChange.bind(this));
            }
        });
    },

    /**
     * Обработчик изменения формы
     */
    onFormChange() {
        const currentData = this.getFormData();
        const hasChanges = JSON.stringify(currentData) !== JSON.stringify(TeamState.originalFormData);
        TeamState.formChanged = hasChanges;
    },

    /**
     * Прикрепить auto-resize listeners для textarea полей
     */
    attachAutoResizeListeners() {
        const autoResize = (textarea) => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        };

        const fullNameField = document.getElementById('formFullName');

        if (fullNameField) {
            fullNameField.addEventListener('input', () => autoResize(fullNameField));
            autoResize(fullNameField);
        }
    },

    /**
     * Синхронизация карточки сотрудника с профилем в Настройках
     * @param {object} employee - Объект сотрудника
     */
    syncToProfile(employee) {
        // Получаем email текущего пользователя
        let currentUserEmail = null;
        try {
            const authData = sessionStorage.getItem('cloud-auth');
            if (authData) {
                const auth = JSON.parse(authData);
                currentUserEmail = auth.email;
            }
        } catch (e) {
            return;
        }

        if (!currentUserEmail) return;

        // Проверка: это карточка текущего пользователя?
        const employeeEmail = employee.email || employee.id;
        if (employeeEmail !== currentUserEmail) {
            return;
        }

        // Синхронизация данных в профиль настроек
        const PROFILE_KEY = 'user-profile-local';

        const profileData = {
            name: employee.fullName || '',
            position: employee.position || '',
            crmLogin: employee.crmLogin || '',
            corpTelegram: employee.corpTelegram || '',
            personalTelegram: employee.personalTelegram || '',
            corpEmail: employee.corpEmail || '',
            personalEmail: employee.personalEmail || '',
            corpPhone: employee.corpPhone || '',
            personalPhone: employee.personalPhone || '',
            birthday: employee.birthday || '',
            startDate: employee.startDate || '',
            office: employee.office || '',
            company: employee.company || '',
            comment: employee.comment || '',
            updatedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem(PROFILE_KEY, JSON.stringify(profileData));
        } catch (e) {
            console.error('[TeamInfo] Failed to sync to profile:', e);
        }
    },

    // ========== Приватные методы ==========

    /**
     * Заполнение выпадающего списка ролей
     * @private
     */
    _populateRoleDropdown(selectedValue) {
        const menu = document.getElementById('formPositionMenu');
        const input = document.getElementById('formPositionValue');
        const label = document.getElementById('formPositionLabel');
        const trigger = document.getElementById('formPositionTrigger');
        if (!menu || typeof RolesConfig === 'undefined') return;
        const currentValue = selectedValue ?? (input ? input.value : '');
        let html = '<div class="dropdown-item' + (!currentValue ? ' active' : '') + '" data-action="team-selectFormDropdown" data-value="">Выберите роль</div>';
        // Используем ASSIGNABLE_ROLES (без admin, leader, guest — это системные роли)
        const roles = RolesConfig.ASSIGNABLE_ROLES || RolesConfig.ALL_ROLES;
        roles.forEach(role => {
            if (role === 'guest' || role === 'admin' || role === 'leader') return;
            const isActive = role === currentValue ? ' active' : '';
            html += '<div class="dropdown-item' + isActive + '" data-action="team-selectFormDropdown" data-value="' + Utils.escapeHtml(role) + '">' + Utils.escapeHtml(RolesConfig.getName(role)) + '</div>';
        });
        menu.innerHTML = html;
        if (input) input.value = currentValue || '';
        if (currentValue && label) {
            label.textContent = RolesConfig.getName(currentValue);
            if (trigger) trigger.classList.remove('placeholder');
        } else {
            if (label) label.textContent = 'Выберите роль';
            if (trigger) trigger.classList.add('placeholder');
        }
    },

    /**
     * Очистка полей формы
     * @private
     */
    _clearFormFields() {
        document.getElementById('formFullName').value = '';
        this._populateRoleDropdown('');
        const posWrap = document.getElementById('formPositionWrap');
        if (posWrap) posWrap.classList.remove('disabled');
        document.getElementById('formReddyId').value = '';
        document.getElementById('formCorpTelegram').value = '';
        document.getElementById('formPersonalTelegram').value = '';
        document.getElementById('formBirthday').value = '';
        document.getElementById('formCorpEmail').value = '';
        document.getElementById('formPersonalEmail').value = '';
        document.getElementById('formCorpPhone').value = '';
        document.getElementById('formPersonalPhone').value = '';
        document.getElementById('formOffice').value = '';
        document.getElementById('formStartDate').value = '';
        document.getElementById('formCompany').value = '';
        document.getElementById('formCrmLogin').value = '';
        document.getElementById('formComment').value = '';
    },

    /**
     * Заполнение полей формы данными сотрудника
     * @private
     */
    _fillFormFields(employee) {
        document.getElementById('formFullName').value = employee.fullName || '';
        const roleKey = (typeof RolesConfig !== 'undefined' && employee.position) ? RolesConfig.resolveRoleKey(employee.position) : (employee.position || '');
        this._populateRoleDropdown(roleKey);

        // Запрет редактирования должности в своей карточке
        let isSelf = false;
        try {
            const authData = sessionStorage.getItem('cloud-auth');
            const currentEmail = authData ? JSON.parse(authData).email : null;
            const empEmail = employee.email || employee.id;
            isSelf = !!(currentEmail && empEmail === currentEmail);
        } catch (e) { /* ignore */ }
        const posWrap = document.getElementById('formPositionWrap');
        if (posWrap) posWrap.classList.toggle('disabled', isSelf);

        // Установка статуса
        TeamState.currentFormStatus = employee.status || 'Работает';
        TeamUtils.setStatusText(document.getElementById('formStatusText'), TeamState.currentFormStatus);

        document.getElementById('formReddyId').value = employee.reddyId || employee.predefinedFields?.['Reddy'] || '';
        document.getElementById('formCorpTelegram').value = employee.corpTelegram || employee.predefinedFields?.['Корп. Telegram'] || '';
        document.getElementById('formPersonalTelegram').value = employee.personalTelegram || '';
        document.getElementById('formBirthday').value = (employee.birthday || '').substring(0, 10);
        document.getElementById('formCorpEmail').value = employee.corpEmail || employee.predefinedFields?.['Корп. e-mail'] || '';
        document.getElementById('formPersonalEmail').value = employee.personalEmail || '';
        document.getElementById('formCorpPhone').value = employee.corpPhone || employee.predefinedFields?.['Корп. телефон'] || '';
        document.getElementById('formPersonalPhone').value = employee.personalPhone || '';
        document.getElementById('formOffice').value = employee.office || '';
        document.getElementById('formStartDate').value = (employee.startDate || '').substring(0, 10);
        document.getElementById('formCompany').value = employee.company || '';
        document.getElementById('formCrmLogin').value = employee.crmLogin || '';
        document.getElementById('formComment').value = employee.comment || '';

        // Установка аватара
        const formAvatar = document.getElementById('formAvatar');
        const placeholder = document.querySelector('.form-avatar-placeholder');
        if (employee.avatar) {
            formAvatar.src = employee.avatar;
            formAvatar.classList.remove('hidden');
            formAvatar.classList.add('visible');
            if (placeholder) {
                placeholder.classList.remove('visible');
                placeholder.classList.add('hidden');
            }
        } else {
            formAvatar.classList.remove('visible');
            formAvatar.classList.add('hidden');
            if (placeholder) {
                placeholder.classList.remove('hidden');
                placeholder.classList.add('visible');
            }
        }
    },

    /**
     * Сброс статуса формы
     * @private
     */
    _resetFormStatus() {
        TeamState.currentFormStatus = 'Работает';
        TeamUtils.setStatusText(document.getElementById('formStatusText'), 'Работает');
    },

    /**
     * Сброс аватара
     * @private
     */
    _resetAvatar() {
        const formAvatar = document.getElementById('formAvatar');
        const placeholder = document.querySelector('.form-avatar-placeholder');
        formAvatar.classList.remove('visible');
        formAvatar.classList.add('hidden');
        if (placeholder) {
            placeholder.classList.remove('hidden');
            placeholder.classList.add('visible');
        }
    },

    /**
     * Инициализация состояния формы
     * @private
     */
    _initFormState() {
        TeamState.formChanged = false;
        TeamState.originalFormData = this.getFormData();
        this.attachFormChangeListeners();
        this.attachAutoResizeListeners();
    },

    /**
     * Возврат к карточке сотрудника
     * @private
     */
    _returnToCard(employeeId) {
        TeamState.currentEmployeeId = employeeId;
        const employee = TeamState.data.find(e => e.id === employeeId);

        if (employee) {
            TeamRenderer.render();

            const employeeCard = document.getElementById('employeeCard');
            const hintPanel = document.getElementById('hintPanel');

            hintPanel.classList.remove('visible-flex');
            hintPanel.classList.add('hidden');
            employeeCard.classList.remove('hidden');
            employeeCard.classList.add('visible-flex');

            document.getElementById('cardFullName').textContent = employee.fullName || '';
            document.getElementById('cardPosition').textContent = (typeof RolesConfig !== 'undefined' && employee.position) ? RolesConfig.getName(RolesConfig.resolveRoleKey(employee.position)) : (employee.position || '');

            const currentStatus = employee.status || 'Работает';
            TeamUtils.setStatusText(document.getElementById('cardStatusText'), currentStatus);

            const cardAvatar = document.getElementById('cardAvatar');
            const cardPlaceholder = document.getElementById('cardAvatarPlaceholder');
            if (employee.avatar && TeamUtils.isValidImageUrl(employee.avatar)) {
                cardAvatar.src = employee.avatar;
                cardAvatar.classList.remove('hidden');
                if (cardPlaceholder) cardPlaceholder.classList.add('hidden');
            } else {
                cardAvatar.src = '';
                cardAvatar.classList.add('hidden');
                if (cardPlaceholder) cardPlaceholder.classList.remove('hidden');
            }

            const cardBody = document.getElementById('cardBody');
            cardBody.innerHTML = TeamRenderer.generateCardInfo(employee);
        } else {
            const hintPanel = document.getElementById('hintPanel');
            hintPanel.classList.remove('hidden');
            hintPanel.classList.add('visible-flex');
            TeamState.currentEmployeeId = null;
        }
    },

    /**
     * Сбор данных формы
     * @private
     */
    _collectFormData(fullName, position, status) {
        const getFieldValue = (id) => {
            const el = document.getElementById(id);
            return (el && el.offsetParent !== null) ? el.value.trim() : '';
        };

        const reddyId = getFieldValue('formReddyId');
        if (reddyId && !Utils.isValidReddyId(reddyId)) {
            Toast.warning(Utils.REDDY_ID_ERROR);
            return;
        }
        const corpTelegram = getFieldValue('formCorpTelegram');
        const personalTelegram = getFieldValue('formPersonalTelegram');
        const birthday = getFieldValue('formBirthday');
        const corpEmail = getFieldValue('formCorpEmail');
        const personalEmail = getFieldValue('formPersonalEmail');
        const corpPhone = getFieldValue('formCorpPhone');
        const personalPhone = getFieldValue('formPersonalPhone');
        const office = getFieldValue('formOffice');
        const startDate = getFieldValue('formStartDate');
        const company = getFieldValue('formCompany');
        const crmLogin = getFieldValue('formCrmLogin');
        const comment = getFieldValue('formComment');

        // Сбор пользовательских полей шаблона
        const customFields = {};
        const templateFields = document.querySelectorAll('.form-body .form-group-inline');
        templateFields.forEach(group => {
            const input = group.querySelector('input, textarea');
            const label = group.querySelector('label');
            if (input && input.id.startsWith('templateField_') && label) {
                const value = input.value.trim();
                if (value) {
                    customFields[label.textContent.replace(':', '')] = value;
                }
            }
        });

        const employeeData = {
            fullName,
            position,
            status,
            reddyId,
            corpTelegram,
            personalTelegram,
            birthday,
            corpEmail,
            personalEmail,
            corpPhone,
            personalPhone,
            office,
            startDate,
            company,
            crmLogin,
            comment,
            avatar: TeamState.currentAvatar || '',
            predefinedFields: {},
            customFields: customFields
        };

        // Хранение в predefinedFields для совместимости
        if (reddyId) employeeData.predefinedFields['Reddy'] = reddyId;
        if (corpTelegram) employeeData.predefinedFields['Корп. Telegram'] = corpTelegram;
        if (corpEmail) employeeData.predefinedFields['Корп. e-mail'] = corpEmail;
        if (corpPhone) employeeData.predefinedFields['Корп. телефон'] = corpPhone;

        // Добавление пользовательских полей в predefinedFields
        Object.entries(customFields).forEach(([key, value]) => {
            employeeData.predefinedFields[key] = value;
        });

        return employeeData;
    },

    /**
     * Обновление существующего сотрудника
     * @private
     */
    async _updateEmployee(employeeData) {
        const employee = TeamState.data.find(e => e.id === TeamState.currentEmployeeId);
        if (!employee) return;

        const oldPosition = employee.position;
        const employeeId = TeamState.currentEmployeeId;
        const snapshot = structuredClone(TeamState.data);
        const index = TeamState.data.findIndex(e => e.id === employeeId);

        // Optimistic: update in-place
        Object.assign(employee, employeeData);
        employee.id = employeeId;
        employee.updatedAt = new Date().toISOString();
        employee._pending = true;
        TeamState._invalidateFiltered();

        // Close form and show card immediately
        const form = document.getElementById('employeeForm');
        form.classList.remove('visible');
        form.classList.add('hidden');
        TeamState.formChanged = false;
        TeamState.originalFormData = null;
        TeamRenderer.render();
        TeamRenderer.updateStats();
        TeamNavigation.openCard(employeeId);

        const onRollback = (error) => {
            TeamState._invalidateFiltered();
            TeamRenderer.render();
            TeamRenderer.updateStats();
            if (TeamState.currentEmployeeId) {
                TeamNavigation.openCard(TeamState.currentEmployeeId);
            }
            Toast.error('Ошибка сохранения: ' + error.message, 6000, {
                action: { label: 'Повторить', callback: () => TeamForms.saveFromForm() }
            });
        };

        const opId = TeamState._optimistic.apply({
            stateRef: TeamState.data,
            index,
            snapshot,
            operation: 'update',
            item: employee,
            onRollback
        });

        try {
            const result = await storage.saveEmployee(employee);
            if (result.success || result.id) {
                TeamState._optimistic.confirm(opId);
                this.syncToProfile(employee);
                await this._syncSystemRole(employee, oldPosition, employeeData.position);
                Toast.success('Сотрудник обновлен!');
            } else {
                TeamState._optimistic.rollback(opId, new Error(result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            TeamState._optimistic.rollback(opId, error);
        }
    },

    /**
     * Добавление нового сотрудника
     * @private
     */
    async _addEmployee(employeeData) {
        employeeData.createdAt = new Date().toISOString();
        const tempId = 'emp-' + Date.now();
        employeeData.id = tempId;
        employeeData._pending = true;

        const snapshot = structuredClone(TeamState.data);

        // Optimistic: add to beginning
        TeamState.data.unshift(employeeData);
        TeamState._invalidateFiltered();

        // Close form and show card immediately
        const form = document.getElementById('employeeForm');
        form.classList.remove('visible');
        form.classList.add('hidden');
        TeamState.formChanged = false;
        TeamState.originalFormData = null;
        TeamRenderer.render();
        TeamRenderer.updateStats();
        TeamNavigation.openCard(tempId);

        const onRollback = (error) => {
            TeamState._invalidateFiltered();
            TeamRenderer.render();
            TeamRenderer.updateStats();
            const hintPanel = document.getElementById('hintPanel');
            if (hintPanel) {
                hintPanel.classList.remove('hidden');
                hintPanel.classList.add('visible-flex');
            }
            Toast.error('Ошибка сохранения: ' + error.message, 6000, {
                action: { label: 'Повторить', callback: () => TeamForms.saveFromForm() }
            });
        };

        const itemIndex = TeamState.data.findIndex(e => e.id === tempId);
        const opId = TeamState._optimistic.apply({
            stateRef: TeamState.data,
            index: -1,
            snapshot,
            operation: 'add',
            item: TeamState.data[itemIndex],
            onRollback
        });

        try {
            const result = await storage.saveEmployee(employeeData);
            if (result.success || result.id) {
                TeamState._optimistic.confirm(opId, { realId: result.id || tempId });
                TeamState.currentEmployeeId = result.id || tempId;
                await this._syncSystemRole(employeeData, null, employeeData.position);
                Toast.success('Сотрудник добавлен!');
            } else {
                TeamState._optimistic.rollback(opId, new Error(result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            TeamState._optimistic.rollback(opId, error);
        }
    },

    /**
     * Синхронизация системной роли пользователя через updateUser
     * @private
     */
    async _syncSystemRole(employee, oldRole, newRole) {
        if (!newRole || oldRole === newRole) return;

        const email = employee.email || employee.corpEmail;
        if (!email) return;

        try {
            const result = await CloudStorage.updateUser({
                targetEmail: email,
                role: newRole
            });
            if (result.error) {
                Toast.warning('Системная роль не обновлена: ' + result.error);
            }
        } catch (e) {
            Toast.warning('Роль в карточке обновлена, но системная роль не синхронизирована');
        }
    }
};
