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
        const position = document.getElementById('formPosition').value.trim();
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

        const saveBtn = document.getElementById('formSaveBtn');
        if (saveBtn) { saveBtn.classList.add('btn-loading'); saveBtn.disabled = true; }

        try {
            if (TeamState.currentEmployeeId) {
                // Редактирование существующего
                await this._updateEmployee(employeeData);
            } else {
                // Добавление нового
                await this._addEmployee(employeeData);
            }
        } finally {
            if (saveBtn) { saveBtn.classList.remove('btn-loading'); saveBtn.disabled = false; }
        }
    },

    /**
     * Удалить сотрудника из формы
     */
    async deleteFromForm() {
        if (!TeamState.currentEmployeeId) return;

        const employee = TeamState.data.find(e => e.id === TeamState.currentEmployeeId);
        if (employee && await ConfirmModal.show('Удалить "' + employee.fullName + '"?', { danger: true })) {
            const btn = document.getElementById('formDeleteBtn');
            if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }

            try {
                const result = await storage.deleteEmployee(TeamState.currentEmployeeId);

                if (result.success) {
                    TeamState.data = TeamState.data.filter(e => e.id !== TeamState.currentEmployeeId);
                    this.closeForm();
                    TeamRenderer.render();
                    TeamRenderer.updateStats();
                    Toast.success('Сотрудник удален!');
                } else {
                    Toast.error('Ошибка удаления: ' + (result.error || 'Неизвестная ошибка'));
                }
            } finally {
                if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
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
            const btn = document.querySelector('[data-action="team-deleteFromCard"]');
            if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }

            try {
                const result = await storage.deleteEmployee(TeamState.currentEmployeeId);

                if (result.success) {
                    TeamState.data = TeamState.data.filter(e => e.id !== TeamState.currentEmployeeId);
                    TeamNavigation.closeCard();
                    TeamRenderer.render();
                    TeamRenderer.updateStats();
                    Toast.success('Сотрудник удален!');
                } else {
                    Toast.error('Ошибка удаления: ' + (result.error || 'Неизвестная ошибка'));
                }
            } finally {
                if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
            }
        }
    },

    /**
     * Изменить статус сотрудника в форме
     * @param {string} newStatus - Новый статус
     */
    changeFormStatus(newStatus) {
        TeamState.currentFormStatus = newStatus;
        const statusClass = TeamUtils.getStatusClass(newStatus);
        const statusText = document.getElementById('formStatusText');
        statusText.textContent = newStatus;
        statusText.className = `status-badge ${statusClass}`;

        // Скрыть dropdown
        const dropdown = document.getElementById('formStatusDropdown');
        dropdown.classList.remove('visible');
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

        const oldStatus = employee.status;
        employee.status = newStatus;
        employee.updatedAt = new Date().toISOString();

        // Скрыть dropdown и показать новый статус сразу (optimistic)
        const dropdown = document.getElementById('cardStatusDropdown');
        dropdown.classList.remove('visible');
        dropdown.classList.add('hidden');

        const statusText = document.getElementById('cardStatusText');
        const statusBadge = statusText?.closest('.status-badge-wrapper') || statusText?.parentElement;
        if (statusBadge) statusBadge.style.opacity = '0.5';

        try {
            const result = await storage.saveEmployee(employee);

            if (result.success || result.id) {
                // Обновить badge
                const statusClass = TeamUtils.getStatusClass(newStatus);
                statusText.textContent = newStatus;
                statusText.className = `status-badge ${statusClass}`;

                TeamRenderer.render();
                TeamRenderer.updateStats();

                // Синхронизация с профилем
                this.syncToProfile(employee);
            } else {
                employee.status = oldStatus;
                Toast.error('Ошибка сохранения статуса');
            }
        } catch (error) {
            employee.status = oldStatus;
            console.error('[TeamForms] Error changing status:', error);
            Toast.error('Ошибка сохранения статуса');
        } finally {
            if (statusBadge) statusBadge.style.opacity = '';
        }
    },

    /**
     * Переключить dropdown статуса в карточке
     */
    toggleStatusDropdown() {
        const dropdown = document.getElementById('cardStatusDropdown');
        const isVisible = dropdown.classList.contains('visible');
        if (isVisible) {
            dropdown.classList.remove('visible');
            dropdown.classList.add('hidden');
        } else {
            dropdown.classList.remove('hidden');
            dropdown.classList.add('visible');
        }
    },

    /**
     * Переключить dropdown статуса в форме
     */
    toggleFormStatusDropdown() {
        const dropdown = document.getElementById('formStatusDropdown');
        const isVisible = dropdown.classList.contains('visible');
        if (isVisible) {
            dropdown.classList.remove('visible');
            dropdown.classList.add('hidden');
        } else {
            dropdown.classList.remove('hidden');
            dropdown.classList.add('visible');
        }
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
            position: document.getElementById('formPosition').value,
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
            'formFullName', 'formPosition', 'formReddyId',
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
            const authData = localStorage.getItem('cloud-auth');
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
    _populateRoleDropdown() {
        const select = document.getElementById('formPosition');
        if (!select || typeof RolesConfig === 'undefined') return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">Выберите роль</option>';
        RolesConfig.ALL_ROLES.forEach(role => {
            if (role === 'guest') return;
            const option = document.createElement('option');
            option.value = role;
            option.textContent = RolesConfig.getName(role);
            select.appendChild(option);
        });
        if (currentValue) select.value = currentValue;
    },

    /**
     * Очистка полей формы
     * @private
     */
    _clearFormFields() {
        document.getElementById('formFullName').value = '';
        this._populateRoleDropdown();
        document.getElementById('formPosition').value = '';
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
        this._populateRoleDropdown();
        document.getElementById('formPosition').value = employee.position || '';

        // Установка status badge
        TeamState.currentFormStatus = employee.status || 'Работает';
        const statusClass = TeamUtils.getStatusClass(TeamState.currentFormStatus);
        const statusText = document.getElementById('formStatusText');
        statusText.textContent = TeamState.currentFormStatus;
        statusText.className = `status-badge ${statusClass}`;

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
        const statusText = document.getElementById('formStatusText');
        statusText.textContent = 'Работает';
        statusText.className = 'status-badge green';
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
            document.getElementById('cardPosition').textContent = (typeof RolesConfig !== 'undefined' && employee.position) ? RolesConfig.getName(employee.position) : (employee.position || '');

            const currentStatus = employee.status || 'Работает';
            const statusClass = TeamUtils.getStatusClass(currentStatus);
            const statusText = document.getElementById('cardStatusText');
            statusText.textContent = currentStatus;
            statusText.className = `status-badge ${statusClass}`;

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

        // Копируем данные
        Object.assign(employee, employeeData);
        employee.id = TeamState.currentEmployeeId;
        employee.updatedAt = new Date().toISOString();

        try {
            const result = await storage.saveEmployee(employee);

            if (result.success || result.id) {
                const employeeId = TeamState.currentEmployeeId;
                const form = document.getElementById('employeeForm');
                form.classList.remove('visible');
                form.classList.add('hidden');
                TeamState.formChanged = false;
                TeamState.originalFormData = null;
                TeamRenderer.render();
                TeamRenderer.updateStats();
                TeamNavigation.openCard(employeeId);

                // Синхронизация с профилем (если это карточка текущего пользователя)
                this.syncToProfile(employee);

                // Синхронизация системной роли если роль изменилась
                await this._syncSystemRole(employee, oldPosition, employeeData.position);

                Toast.success('Сотрудник обновлен!');
            } else {
                Toast.error('Ошибка сохранения: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('[TeamForms] Error updating employee:', error);
            Toast.error('Ошибка сохранения');
        }
    },

    /**
     * Добавление нового сотрудника
     * @private
     */
    async _addEmployee(employeeData) {
        employeeData.createdAt = new Date().toISOString();

        try {
            const result = await storage.saveEmployee(employeeData);

            if (result.success || result.id) {
                // Получаем id от сервера или генерируем локальный
                employeeData.id = result.id || ('emp-' + Date.now());
                TeamState.data.unshift(employeeData);

                const form = document.getElementById('employeeForm');
                form.classList.remove('visible');
                form.classList.add('hidden');
                TeamState.formChanged = false;
                TeamState.originalFormData = null;
                TeamRenderer.render();
                TeamRenderer.updateStats();
                TeamNavigation.openCard(employeeData.id);

                // Синхронизация системной роли при создании
                await this._syncSystemRole(employeeData, null, employeeData.position);

                Toast.success('Сотрудник добавлен!');
            } else {
                Toast.error('Ошибка сохранения: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('[TeamForms] Error adding employee:', error);
            Toast.error('Ошибка сохранения');
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
            const result = await CloudStorage.callApi('updateUser', {
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
