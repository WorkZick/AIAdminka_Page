/**
 * Team Renderer Module
 * Рендеринг UI элементов (таблица, карточки, статистика)
 */

const TeamRenderer = {
    /**
     * Основной рендеринг таблицы сотрудников
     */
    render() {
        const tbody = document.getElementById('employeesTableBody');
        const emptyState = document.getElementById('emptyState');
        const loadingState = document.getElementById('loadingState');
        const table = document.querySelector('.employees-table');

        // Всегда скрываем loading state после первого рендера
        if (loadingState) {
            loadingState.classList.add('hidden');
        }

        if (TeamState.data.length === 0) {
            table.classList.add('hidden');
            emptyState.classList.remove('hidden');
            emptyState.classList.add('visible-flex');
            return;
        }

        table.classList.remove('hidden');
        emptyState.classList.remove('visible-flex');
        emptyState.classList.add('hidden');

        const selectedId = TeamState.currentEmployeeId;
        const fragment = document.createDocumentFragment();

        TeamState.data.forEach(employee => {
            const statusClass = TeamUtils.getStatusClass(employee.status || 'Работает');
            const statusText = employee.status || 'Работает';
            const reddyId = employee.reddyId || employee.predefinedFields?.['Reddy'] || '';
            const birthday = employee.birthday ? TeamUtils.formatDate(employee.birthday) : '';
            const crmLogin = employee.crmLogin || '';
            const avatar = employee.avatar || '';
            const isValidAvatar = TeamUtils.isValidImageUrl(avatar);
            const formattedName = TeamUtils.formatFullNameForTable(employee.fullName || '');

            const tr = document.createElement('tr');
            tr.className = selectedId === employee.id ? 'selected' : '';
            tr.dataset.employeeId = employee.id;

            tr.innerHTML = `
                <td class="col-status">
                    <span class="status-badge ${TeamUtils.escapeHtml(statusClass)}">${TeamUtils.escapeHtml(statusText)}</span>
                </td>
                <td class="col-photo">
                    <div class="employee-avatar"></div>
                </td>
                <td class="col-name">${formattedName}</td>
                <td class="col-position">${TeamUtils.escapeHtml(typeof RolesConfig !== 'undefined' && employee.position ? RolesConfig.getName(RolesConfig.resolveRoleKey(employee.position)) : (employee.position || ''))}</td>
                <td class="col-crm">${TeamUtils.escapeHtml(crmLogin)}</td>
                <td class="col-id">${TeamUtils.escapeHtml(reddyId)}</td>
                <td class="col-birthday">${birthday}</td>
                <td class="col-arrow">
                    <img class="row-arrow" src="../shared/icons/arrow.svg" alt="">
                </td>
            `;

            // Безопасно устанавливаем аватар
            if (isValidAvatar) {
                const avatarDiv = tr.querySelector('.employee-avatar');
                const img = document.createElement('img');
                img.src = avatar;
                img.alt = '';
                img.loading = 'lazy';
                avatarDiv.appendChild(img);
            }

            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);

        // Event delegation — один обработчик на tbody (не добавлять повторно)
        if (!tbody._hasClickListener) {
            tbody.addEventListener('click', (e) => {
                const row = e.target.closest('tr[data-employee-id]');
                if (row) {
                    TeamNavigation.openCard(row.dataset.employeeId);
                }
            });
            tbody._hasClickListener = true;
        }
    },

    /**
     * Обновить только выделение строк без полной перерисовки
     */
    updateSelection(newId, oldId) {
        const tbody = document.getElementById('employeesTableBody');
        if (oldId) {
            const oldRow = tbody.querySelector(`tr[data-employee-id="${oldId}"]`);
            if (oldRow) oldRow.classList.remove('selected');
        }
        if (newId) {
            const newRow = tbody.querySelector(`tr[data-employee-id="${newId}"]`);
            if (newRow) newRow.classList.add('selected');
        }
    },

    /**
     * Обновление статистики (single-pass)
     */
    updateStats() {
        const data = TeamState.data;
        let working = 0, sick = 0, leave = 0, trip = 0, fired = 0;

        for (let i = 0; i < data.length; i++) {
            const status = data[i].status || 'Работает';
            if (status === 'Работает') working++;
            else if (status === 'Болеет') sick++;
            else if (status === 'В отпуске') leave++;
            else if (status === 'Командировка') trip++;
            else if (status === 'Уволен') fired++;
        }

        document.getElementById('totalCount').textContent = data.length;
        document.getElementById('workingCount').textContent = working;
        document.getElementById('sickCount').textContent = sick;
        document.getElementById('leaveCount').textContent = leave;
        document.getElementById('tripCount').textContent = trip;
        document.getElementById('firedCount').textContent = fired;
    },

    /**
     * Генерация HTML для информации в карточке сотрудника
     * @param {object} employee - Объект сотрудника
     * @returns {string} HTML строка
     */
    generateCardInfo(employee) {
        const fields = [
            { label: 'Reddy ID', value: employee.reddyId || employee.predefinedFields?.['Reddy'] || '' },
            { label: 'Рабочий Telegram', value: employee.corpTelegram || employee.predefinedFields?.['Корп. Telegram'] || '' },
            { label: 'Личный Telegram', value: employee.personalTelegram || '' },
            { label: 'День рождения', value: employee.birthday ? TeamUtils.formatDate(employee.birthday) : '' },
            { label: 'Рабочая почта', value: employee.corpEmail || employee.predefinedFields?.['Корп. e-mail'] || '' },
            { label: 'Личная почта', value: employee.personalEmail || '' },
            { label: 'Рабочий телефон', value: employee.corpPhone || employee.predefinedFields?.['Корп. телефон'] || '' },
            { label: 'Личный телефон', value: employee.personalPhone || '' },
            { label: 'Офис', value: employee.office || '' },
            { label: 'Начало работы', value: employee.startDate ? TeamUtils.formatDate(employee.startDate) : '' },
            { label: 'Компания', value: employee.company || '' },
            { label: 'Логин CRM', value: employee.crmLogin || '' },
            { label: 'Примечание', value: employee.comment || '' }
        ];

        let html = '';

        fields.forEach(field => {
            if (field.value || field.label === 'Примечание') {
                const isComment = field.label === 'Примечание';

                if (isComment) {
                    const valueText = field.value ? TeamUtils.escapeHtml(field.value) : '—';
                    const valueClass = field.value ? 'info-value textarea-style' : 'info-value textarea-style placeholder';

                    html += `
                        <div class="info-group vertical">
                            <div class="info-label">${field.label}:</div>
                            <div class="${valueClass}">${valueText}</div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="info-group">
                            <div class="info-label">${field.label}:</div>
                            <div class="info-value">${TeamUtils.escapeHtml(field.value)}</div>
                        </div>
                    `;
                }
            }
        });

        return html;
    }
};
