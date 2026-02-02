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

        // Очищаем tbody и строим строки с безопасными event listeners
        tbody.innerHTML = '';

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
            tr.className = TeamState.currentEmployeeId === employee.id ? 'selected' : '';
            tr.dataset.employeeId = employee.id;
            tr.addEventListener('click', () => TeamNavigation.openCard(employee.id));

            tr.innerHTML = `
                <td class="col-status">
                    <span class="status-badge ${TeamUtils.escapeHtml(statusClass)}">${TeamUtils.escapeHtml(statusText)}</span>
                </td>
                <td class="col-photo">
                    <div class="employee-avatar"></div>
                </td>
                <td class="col-name">${formattedName}</td>
                <td class="col-position">${TeamUtils.escapeHtml(typeof RolesConfig !== 'undefined' && employee.position ? RolesConfig.getName(employee.position) : (employee.position || ''))}</td>
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
                avatarDiv.appendChild(img);
            }

            tbody.appendChild(tr);
        });
    },

    /**
     * Обновление статистики
     */
    updateStats() {
        const total = TeamState.data.length;
        const working = TeamState.data.filter(e => (e.status || 'Работает') === 'Работает').length;
        const sick = TeamState.data.filter(e => e.status === 'Болеет').length;
        const leave = TeamState.data.filter(e => e.status === 'В отпуске').length;
        const trip = TeamState.data.filter(e => e.status === 'Командировка').length;
        const fired = TeamState.data.filter(e => e.status === 'Уволен').length;

        document.getElementById('totalCount').textContent = total;
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
