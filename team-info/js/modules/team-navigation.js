/**
 * Team Navigation Module
 * Управление навигацией между представлениями (таблица, карточка, форма)
 */

const TeamNavigation = {
    /**
     * Добавление представления в стек навигации
     * @param {string} view - Тип представления ('stats', 'card', 'form')
     * @param {number|null} employeeId - ID сотрудника (для 'card' и 'form')
     */
    pushNavigation(view, employeeId = null) {
        TeamState.navigationStack.push({ view, employeeId });
    },

    /**
     * Извлечение последнего представления из стека
     * @returns {object|undefined} Объект представления или undefined
     */
    popNavigation() {
        return TeamState.navigationStack.pop();
    },

    /**
     * Получение текущего представления
     * @returns {string} Тип текущего представления
     */
    getCurrentView() {
        if (TeamState.navigationStack.length === 0) return 'stats';
        return TeamState.navigationStack[TeamState.navigationStack.length - 1].view;
    },

    /**
     * Открытие карточки сотрудника
     * @param {number} id - ID сотрудника
     */
    openCard(id) {
        // Проверка: если кликнули на уже открытую карточку - закрываем её
        const employeeCard = document.getElementById('employeeCard');
        if (TeamState.currentEmployeeId === id && employeeCard.classList.contains('visible-flex')) {
            this.closeCard();
            return;
        }

        // Проверка: если форма открыта и есть изменения
        const form = document.getElementById('employeeForm');
        if (form.classList.contains('visible') && TeamState.formChanged) {
            const confirmMsg = TeamState.currentEmployeeId
                ? 'У вас есть несохраненные изменения. Закрыть форму без сохранения?'
                : 'Вы не завершили добавление сотрудника. Закрыть форму без сохранения?';

            if (!confirm(confirmMsg)) {
                return;
            }

            form.classList.remove('visible');
            form.classList.add('hidden');
            TeamState.formChanged = false;
            TeamState.originalFormData = null;
        } else if (form.classList.contains('visible')) {
            form.classList.remove('visible');
            form.classList.add('hidden');
            TeamState.formChanged = false;
            TeamState.originalFormData = null;
        }

        TeamState.currentEmployeeId = id;
        const employee = TeamState.data.find(e => e.id === id);
        if (!employee) return;

        TeamRenderer.render();

        const hintPanel = document.getElementById('hintPanel');
        hintPanel.classList.remove('visible-flex');
        hintPanel.classList.add('hidden');
        employeeCard.classList.remove('hidden');
        employeeCard.classList.add('visible-flex');

        // Добавляем в стек навигации
        this.pushNavigation('card', id);

        // Заполнение карточки
        document.getElementById('cardFullName').textContent = employee.fullName || '';
        document.getElementById('cardPosition').textContent = (typeof RolesConfig !== 'undefined' && employee.position) ? RolesConfig.getName(employee.position) : (employee.position || '');

        const currentStatus = employee.status || 'Работает';
        const statusClass = TeamUtils.getStatusClass(currentStatus);
        const statusText = document.getElementById('cardStatusText');
        statusText.textContent = currentStatus;
        statusText.className = `status-badge ${statusClass}`;

        // Установка аватара с валидацией URL
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
    },

    /**
     * Закрытие карточки сотрудника
     */
    closeCard() {
        const employeeCard = document.getElementById('employeeCard');
        const hintPanel = document.getElementById('hintPanel');

        employeeCard.classList.remove('visible-flex');
        employeeCard.classList.add('hidden');

        // Удаляем текущую карточку из навигации
        this.popNavigation();

        // Показываем hint panel
        hintPanel.classList.remove('hidden');
        hintPanel.classList.add('visible-flex');

        TeamState.currentEmployeeId = null;
        TeamRenderer.render();
    },

    /**
     * Переход к редактированию из карточки
     */
    editFromCard() {
        if (TeamState.currentEmployeeId) {
            TeamForms.showEditForm(TeamState.currentEmployeeId);
        }
    }
};
