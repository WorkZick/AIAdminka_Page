// Простой менеджер команды с модальными окнами и drag & drop
const teamInfo = {
    data: [],
    fieldCounter: 0,
    currentEditId: null,
    currentCopyId: null,
    draggedItem: null,
    draggedIndex: null,
    
    async init() {
        try {
            this.data = await storage.loadData();
            this.setupEvents();
            this.render();
            console.log('✅ Team Info loaded');
        } catch (error) {
            console.error('Init error:', error);
        }
    },
    
    setupEvents() {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.export-dropdown')) {
                this.closeExportMenu();
            }
        });
        
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                if (e.target.id === 'copyModal') {
                    this.closeCopyDialog();
                } else {
                    this.closeEmployeeModal();
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const copyModal = document.getElementById('copyModal');
                if (copyModal && copyModal.classList.contains('active')) {
                    this.closeCopyDialog();
                } else {
                    this.closeEmployeeModal();
                }
            }
        });
        
        this.setupDragAndDrop();
    },
    
    setupDragAndDrop() {
        document.addEventListener('dragstart', (e) => {
            if (e.target.closest('.drag-handle')) {
                const card = e.target.closest('.employee-card');
                const id = parseInt(card.dataset.id);
                const index = this.data.findIndex(item => item.id === id);
                
                this.draggedItem = this.data[index];
                this.draggedIndex = index;
                
                card.classList.add('dragging');
                document.getElementById('teamGrid').classList.add('dragging');
                
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', card.outerHTML);
            }
        });
        
        document.addEventListener('dragend', (e) => {
            if (e.target.closest('.drag-handle')) {
                const card = e.target.closest('.employee-card');
                card.classList.remove('dragging');
                document.getElementById('teamGrid').classList.remove('dragging');
                
                document.querySelectorAll('.employee-card').forEach(c => {
                    c.classList.remove('drag-over');
                });
                
                this.draggedItem = null;
                this.draggedIndex = null;
            }
        });
        
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        document.addEventListener('dragenter', (e) => {
            e.preventDefault();
            
            if (e.target.closest('.employee-card') && this.draggedItem) {
                const card = e.target.closest('.employee-card');
                const id = parseInt(card.dataset.id);
                
                if (id !== this.draggedItem.id) {
                    document.querySelectorAll('.employee-card').forEach(c => {
                        c.classList.remove('drag-over');
                    });
                    
                    card.classList.add('drag-over');
                }
            }
        });
        
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            
            if (e.target.closest('.employee-card') && this.draggedItem) {
                const targetCard = e.target.closest('.employee-card');
                const targetId = parseInt(targetCard.dataset.id);
                const targetIndex = this.data.findIndex(item => item.id === targetId);
                
                if (targetId !== this.draggedItem.id) {
                    this.moveItem(this.draggedIndex, targetIndex);
                }
                
                targetCard.classList.remove('drag-over');
            }
        });
    },
    
    async moveItem(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        
        const [movedItem] = this.data.splice(fromIndex, 1);
        this.data.splice(toIndex, 0, movedItem);
        
        await storage.saveData(this.data);
        this.render();
    },
    
    render() {
        this.renderTeamGrid();
    },
    
    renderTeamGrid() {
        const container = document.getElementById('teamGrid');
        
        if (this.data.length === 0) {
            container.innerHTML = `
                <div class="empty-team">
                    <h3>👥 Команда пока пуста</h3>
                    <p>Добавьте первого сотрудника</p>
                    <button class="btn btn-primary" onclick="teamInfo.showAddModal()">
                        👤 Добавить сотрудника
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.data.map((item, index) => {
            const initials = this.getInitials(item.fullName || item.title || '??');
            const isExpanded = item.cardExpanded || false;
            const needsExpansion = this.needsExpansion(item);
            
            const predefinedFieldsHtml = this.renderPredefinedFields(item.predefinedFields || {});
            const customFieldsHtml = isExpanded ? this.renderFields(item.customFields || {}) : '';
            const commentHtml = isExpanded ? this.renderComment(item.comment) : '';
            const buttonText = isExpanded ? 'СВЕРНУТЬ' : 'ПОДРОБНЕЕ';
            
            return `
                <div class="employee-card ${isExpanded ? 'expanded' : ''} ${needsExpansion ? '' : 'short'}" 
                     data-id="${item.id}" data-index="${index}">
                    <div class="drag-handle" draggable="true" title="Перетащить для изменения порядка">⋮⋮</div>
                    <div class="card-actions">
                        <button class="card-action-btn copy" onclick="teamInfo.showCopyDialog(${item.id})" title="Копировать">📋</button>
                        <button class="card-action-btn edit" onclick="teamInfo.showEditModal(${item.id})" title="Редактировать">✏️</button>
                        <button class="card-action-btn delete" onclick="teamInfo.deleteInfo(${item.id})" title="Удалить">🗑️</button>
                    </div>
                    <div class="employee-avatar">${initials}</div>
                    <div class="employee-name">${this.escapeHtml(item.fullName || item.title || '')}</div>
                    <div class="employee-position">${this.escapeHtml(item.position || '')} <span class="employee-grade">${this.escapeHtml(item.grade || '')}</span></div>
                    ${predefinedFieldsHtml}
                    ${customFieldsHtml}
                    ${commentHtml}
                    <div class="employee-dates">
                        <span>Добавлен: ${this.formatDate(item.createdAt)}</span>
                        ${needsExpansion ? `<button class="btn btn-primary btn-details" onclick="teamInfo.toggleCard(${item.id}, event)">${buttonText}</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },
    
    needsExpansion(item) {
        const fieldsCount = item.customFields ? Object.keys(item.customFields).length : 0;
        const hasComment = item.comment && item.comment.trim().length > 0;
        return hasComment || fieldsCount > 0;
    },
    
    showAddModal() {
        this.currentEditId = null;
        document.getElementById('modalTitle').textContent = 'Добавить нового сотрудника';
        document.getElementById('saveEmployeeBtn').textContent = 'Добавить сотрудника';
        
        document.getElementById('fullNameInput').value = '';
        document.getElementById('positionInput').value = '';
        document.getElementById('gradeSelect').value = 'Middle';
        document.getElementById('loginUrsInput').value = '';
        document.getElementById('reddyInput').value = '';
        document.getElementById('corpEmailInput').value = '';
        document.getElementById('corpTelegramInput').value = '';
        document.getElementById('corpPhoneInput').value = '';
        document.getElementById('commentInput').value = '';
        this.clearFields();
        
        document.getElementById('employeeModal').classList.add('active');
        document.getElementById('fullNameInput').focus();
    },
    
    showEditModal(id) {
        const item = this.data.find(i => i.id === id);
        if (!item) return;
        
        this.currentEditId = id;
        document.getElementById('modalTitle').textContent = 'Редактировать сотрудника';
        document.getElementById('saveEmployeeBtn').textContent = 'Сохранить изменения';
        
        document.getElementById('fullNameInput').value = item.fullName || '';
        document.getElementById('positionInput').value = item.position || '';
        document.getElementById('gradeSelect').value = item.grade || 'Middle';
        
        const predefined = item.predefinedFields || {};
        document.getElementById('loginUrsInput').value = predefined['Логин УРС'] || '';
        document.getElementById('reddyInput').value = predefined['Reddy'] || '';
        document.getElementById('corpEmailInput').value = predefined['Корп. e-mail'] || '';
        document.getElementById('corpTelegramInput').value = predefined['Корп. Telegram'] || '';
        document.getElementById('corpPhoneInput').value = predefined['Корп. телефон'] || '';
        
        document.getElementById('commentInput').value = item.comment || '';
        
        this.clearFields();
        if (item.customFields) {
            Object.entries(item.customFields).forEach(([name, fieldData]) => {
                this.addCustomFieldWithData(name, fieldData);
            });
        }
        
        document.getElementById('employeeModal').classList.add('active');
        document.getElementById('fullNameInput').focus();
    },
    
    closeEmployeeModal() {
        document.getElementById('employeeModal').classList.remove('active');
        this.currentEditId = null;
    },

    showCopyDialog(id) {
        this.currentCopyId = id;
        document.getElementById('copyModal').classList.add('active');
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    closeCopyDialog() {
        document.getElementById('copyModal').classList.remove('active');
        this.currentCopyId = null;
    },

    async copyEmployee(withData) {
        const item = this.data.find(i => i.id === this.currentCopyId);
        if (!item) return;

        this.closeCopyDialog();

        const newItem = {
            id: Date.now(),
            fullName: withData ? item.fullName : '',
            position: withData ? item.position : '',
            grade: withData ? item.grade : 'Middle',
            predefinedFields: withData ? { ...item.predefinedFields } : {},
            customFields: {},
            comment: withData ? item.comment : '',
            createdAt: new Date().toISOString()
        };

        if (item.customFields && Object.keys(item.customFields).length > 0) {
            if (withData) {
                newItem.customFields = JSON.parse(JSON.stringify(item.customFields));
            } else {
                Object.entries(item.customFields).forEach(([name, fieldData]) => {
                    newItem.customFields[name] = {
                        type: fieldData.type || 'text',
                        visible: fieldData.visible !== undefined ? fieldData.visible : true,
                        values: [{ value: '' }]
                    };
                });
            }
        }

        this.data.unshift(newItem);

        if (await storage.saveData(this.data)) {
            this.render();
            alert(withData ? 'Сотрудник скопирован с данными!' : 'Скопирована структура карточки!');
            this.showEditModal(newItem.id);
        } else {
            alert('Ошибка копирования');
        }
    },
    
    async saveEmployee() {
        const fullName = document.getElementById('fullNameInput').value.trim();
        const position = document.getElementById('positionInput').value.trim();
        const grade = document.getElementById('gradeSelect').value;
        const comment = document.getElementById('commentInput').value.trim();
        
        const predefinedFields = {};
        const loginUrs = document.getElementById('loginUrsInput').value.trim();
        const reddy = document.getElementById('reddyInput').value.trim();
        const corpEmail = document.getElementById('corpEmailInput').value.trim();
        const corpTelegram = document.getElementById('corpTelegramInput').value.trim();
        const corpPhone = document.getElementById('corpPhoneInput').value.trim();
        
        if (loginUrs) predefinedFields['Логин УРС'] = loginUrs;
        if (reddy) predefinedFields['Reddy'] = reddy;
        if (corpEmail) predefinedFields['Корп. e-mail'] = corpEmail;
        if (corpTelegram) predefinedFields['Корп. Telegram'] = corpTelegram;
        if (corpPhone) predefinedFields['Корп. телефон'] = corpPhone;
        
        const customFields = this.getFieldsData();
        
        if (!fullName) {
            alert('Введите ФИО');
            document.getElementById('fullNameInput').focus();
            return;
        }
        
        if (!position) {
            alert('Введите должность');
            document.getElementById('positionInput').focus();
            return;
        }
        
        if (this.currentEditId) {
            const item = this.data.find(i => i.id === this.currentEditId);
            if (item) {
                item.fullName = fullName;
                item.position = position;
                item.grade = grade;
                item.predefinedFields = predefinedFields;
                item.customFields = customFields;
                item.comment = comment;
                item.updatedAt = new Date().toISOString();
                
                if (await storage.saveData(this.data)) {
                    this.closeEmployeeModal();
                    this.render();
                    alert('Сотрудник обновлен!');
                } else {
                    alert('Ошибка сохранения');
                }
            }
        } else {
            const item = {
                id: Date.now(),
                fullName,
                position,
                grade,
                predefinedFields,
                customFields,
                comment,
                createdAt: new Date().toISOString()
            };
            
            this.data.unshift(item);
            
            if (await storage.saveData(this.data)) {
                this.closeEmployeeModal();
                this.render();
                alert('Сотрудник добавлен!');
            } else {
                alert('Ошибка сохранения');
            }
        }
    },
    
    renderComment(comment) {
        if (!comment || !comment.trim()) return '';
        return `<div class="employee-comment">${this.escapeHtml(comment)}</div>`;
    },
    
    getInitials(name) {
        return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    },
    
    renderPredefinedFields(fields) {
        if (!fields || Object.keys(fields).length === 0) return '';
        
        const html = Object.entries(fields).map(([name, value]) => {
            return `<div class="employee-field"><span class="field-label">${this.escapeHtml(name)}</span><span class="field-value" onclick="teamInfo.copyToClipboard(this, '${this.escapeHtml(value)}')" title="Нажмите чтобы скопировать">${this.escapeHtml(value)}</span></div>`;
        }).join('');
        
        return `<div class="employee-info">${html}</div>`;
    },
    
    renderFields(fields) {
        if (!fields || Object.keys(fields).length === 0) return '';
        
        const html = Object.entries(fields).map(([name, data]) => {
            const fieldType = data.type || 'text';
            const visible = data.visible !== undefined ? data.visible : true;
            const values = data.values || [{ value: data.value || data }];
            
            const displayValues = values.map(val => this.formatFieldValue(val, fieldType)).join(', ');
            const fullValue = values.map(val => this.formatFieldValue(val, fieldType)).join(', ');
            
            const isEmail = fieldType === 'email';
            const dataType = isEmail ? 'email' : 'text';
            
            const fieldHtml = `<div class="employee-field"><span class="field-label">${this.escapeHtml(name)}</span><span class="field-value ${!visible ? 'field-concealed' : ''}" data-type="${dataType}" ${!visible ? `onclick="teamInfo.revealField(this, event)" data-value="${this.escapeHtml(fullValue)}"` : `onclick="teamInfo.copyToClipboard(this, '${this.escapeHtml(fullValue)}')" title="Нажмите чтобы скопировать"`}>${visible ? this.escapeHtml(displayValues) : 'скрыто'}</span></div>`;
            
            return fieldHtml;
        }).join('');
        
        return `<div class="employee-info">${html}</div>`;
    },
    
    formatFieldValue(valueObj, fieldType) {
        if (typeof valueObj === 'string') {
            return valueObj;
        }
        
        const value = valueObj.value || '';
        
        switch(fieldType) {
            case 'date':
                return value;
            case 'money':
                return `${value} ${valueObj.currency || 'RUB'}`;
            case 'number':
                return value;
            case 'email':
                return value;
            default:
                return value;
        }
    },
    
    async copyToClipboard(element, text) {
        try {
            await navigator.clipboard.writeText(text);
            element.classList.add('copied');
            setTimeout(() => {
                element.classList.remove('copied');
            }, 500);
        } catch (err) {
            console.error('Ошибка копирования:', err);
            alert('Ошибка копирования в буфер');
        }
    },
    
    revealField(element, event) {
        if (event) {
            event.stopPropagation();
        }
        
        const value = element.getAttribute('data-value');
        if (element.classList.contains('revealed')) {
            element.textContent = 'скрыто';
            element.classList.remove('revealed');
        } else {
            element.textContent = value;
            element.classList.add('revealed');
        }
    },
    
    toggleCard(id, event) {
        if (event) {
            event.stopPropagation();
        }
        
        const item = this.data.find(i => i.id === id);
        if (item) {
            item.cardExpanded = !item.cardExpanded;
            storage.saveData(this.data);
            this.render();
        }
    },
    
    renderValueInput(fieldType, value, currency = 'RUB', index = 0) {
        const valueStr = typeof value === 'object' ? (value.value || '') : value;
        const currencyStr = typeof value === 'object' ? (value.currency || currency) : currency;
        
        switch(fieldType) {
            case 'date':
                return `<input type="date" class="field-value-input" data-value-index="${index}" value="${this.escapeHtml(valueStr)}">`;
            case 'number':
                return `<input type="number" class="field-value-input" data-value-index="${index}" placeholder="Число" value="${this.escapeHtml(valueStr)}" oninput="this.value = this.value.replace(/[^0-9.-]/g, '')" pattern="[0-9.-]+" inputmode="numeric">`;
            case 'money':
                return `<div class="money-input-group"><input type="number" class="field-value-input money-value" data-value-index="${index}" placeholder="Сумма" value="${this.escapeHtml(valueStr)}" oninput="this.value = this.value.replace(/[^0-9.-]/g, '')" pattern="[0-9.-]+" inputmode="numeric"><select class="field-currency-select" data-value-index="${index}"><option value="RUB" ${currencyStr === 'RUB' ? 'selected' : ''}>RUB</option><option value="EUR" ${currencyStr === 'EUR' ? 'selected' : ''}>EUR</option></select></div>`;
            case 'email':
                return `<input type="email" class="field-value-input" data-value-index="${index}" placeholder="email@example.com" value="${this.escapeHtml(valueStr)}">`;
            default:
                return `<input type="text" class="field-value-input" data-value-index="${index}" placeholder="Значение" value="${this.escapeHtml(valueStr)}">`;
        }
    },
    
    updateFieldInputs(fieldDiv, newType) {
        const valuesContainer = fieldDiv.querySelector('.custom-field-values');
        const valueItems = valuesContainer.querySelectorAll('.field-value-item');
        
        valueItems.forEach((item, index) => {
            const oldInput = item.querySelector('.field-value-input');
            const oldValue = oldInput ? oldInput.value : '';
            const oldCurrency = item.querySelector('.field-currency-select');
            const currency = oldCurrency ? oldCurrency.value : 'RUB';
            
            item.innerHTML = this.renderValueInput(newType, oldValue, currency, index);
        });
    },
    
    addFieldValue(button) {
        const fieldDiv = button.closest('.custom-field');
        const valuesContainer = fieldDiv.querySelector('.custom-field-values');
        const currentCount = valuesContainer.querySelectorAll('.field-value-item').length;
        
        if (currentCount >= 3) {
            alert('Максимум 3 значения на поле');
            return;
        }
        
        const fieldType = fieldDiv.querySelector('.custom-field-type').value;
        const newIndex = currentCount;
        
        const valueItem = document.createElement('div');
        valueItem.className = 'field-value-item';
        valueItem.dataset.valueIndex = newIndex;
        valueItem.innerHTML = `
            ${this.renderValueInput(fieldType, '', 'RUB', newIndex)}
            <button type="button" class="btn-remove-value" onclick="this.parentElement.remove()" title="Удалить значение">×</button>
        `;
        
        valuesContainer.appendChild(valueItem);
    },
    
    addCustomField() {
        const container = document.getElementById('customFields');
        const id = ++this.fieldCounter;
        
        const div = document.createElement('div');
        div.className = 'custom-field';
        div.innerHTML = `
            <div class="custom-field-header">
                <input type="text" class="custom-field-name" placeholder="Название" maxlength="20">
                <select class="custom-field-type">
                    <option value="text">Общее</option>
                    <option value="date">Дата</option>
                    <option value="number">Числовой</option>
                    <option value="money">Денежный</option>
                    <option value="email">E-mail</option>
                </select>
            </div>
            <div class="custom-field-values">
                <div class="field-value-item" data-value-index="0">
                    ${this.renderValueInput('text', '', 'RUB', 0)}
                </div>
            </div>
            <div class="custom-field-controls">
                <button type="button" class="btn-add-value" onclick="teamInfo.addFieldValue(this)" title="Добавить значение (макс. 3)">+ Значение</button>
                <label class="visibility-checkbox">
                    <input type="checkbox" checked> Видно
                </label>
                <button type="button" class="remove-field-btn" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        container.appendChild(div);
        
        const typeSelect = div.querySelector('.custom-field-type');
        typeSelect.addEventListener('change', (e) => {
            this.updateFieldInputs(div, e.target.value);
        });
        
        div.querySelector('.custom-field-name').focus();
    },
    
    addCustomFieldWithData(name, fieldData) {
        const container = document.getElementById('customFields');
        const id = ++this.fieldCounter;
        
        const fieldType = fieldData.type || 'text';
        const visible = fieldData.visible !== undefined ? fieldData.visible : true;
        const values = fieldData.values || [{ value: fieldData.value || fieldData }];
        
        const div = document.createElement('div');
        div.className = 'custom-field';
        div.innerHTML = `
            <div class="custom-field-header">
                <input type="text" class="custom-field-name" placeholder="Название" maxlength="20" value="${this.escapeHtml(name)}">
                <select class="custom-field-type">
                    <option value="text" ${fieldType === 'text' ? 'selected' : ''}>Общее</option>
                    <option value="date" ${fieldType === 'date' ? 'selected' : ''}>Дата</option>
                    <option value="number" ${fieldType === 'number' ? 'selected' : ''}>Числовой</option>
                    <option value="money" ${fieldType === 'money' ? 'selected' : ''}>Денежный</option>
                    <option value="email" ${fieldType === 'email' ? 'selected' : ''}>E-mail</option>
                </select>
            </div>
            <div class="custom-field-values">
                ${values.map((val, index) => {
                    const valueStr = typeof val === 'object' ? val.value : val;
                    const currency = typeof val === 'object' ? (val.currency || 'RUB') : 'RUB';
                    return `<div class="field-value-item" data-value-index="${index}">${this.renderValueInput(fieldType, valueStr, currency, index)}${index > 0 ? '<button type="button" class="btn-remove-value" onclick="this.parentElement.remove()" title="Удалить значение">×</button>' : ''}</div>`;
                }).join('')}
            </div>
            <div class="custom-field-controls">
                <button type="button" class="btn-add-value" onclick="teamInfo.addFieldValue(this)" title="Добавить значение (макс. 3)">+ Значение</button>
                <label class="visibility-checkbox">
                    <input type="checkbox" ${visible ? 'checked' : ''}> Видно
                </label>
                <button type="button" class="remove-field-btn" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        container.appendChild(div);
        
        const typeSelect = div.querySelector('.custom-field-type');
        typeSelect.addEventListener('change', (e) => {
            this.updateFieldInputs(div, e.target.value);
        });
    },
    
    getFieldsData() {
        const fields = {};
        const container = document.getElementById('customFields');
        
        container.querySelectorAll('.custom-field').forEach(field => {
            const name = field.querySelector('.custom-field-name').value.trim();
            const fieldType = field.querySelector('.custom-field-type').value;
            const visible = field.querySelector('.visibility-checkbox input').checked;
            const valueItems = field.querySelectorAll('.field-value-item');
            
            if (!name) return;
            
            const values = [];
            let hasValidValue = false;
            
            valueItems.forEach(item => {
                const input = item.querySelector('.field-value-input');
                if (!input) return;
                
                const value = input.value.trim();
                if (!value) return;
                
                if (fieldType === 'email' && value) {
                    if (!value.includes('@')) {
                        alert(`Поле "${name}": неверный формат email`);
                        return;
                    }
                }
                
                if (fieldType === 'money') {
                    const currencySelect = item.querySelector('.field-currency-select');
                    const currency = currencySelect ? currencySelect.value : 'RUB';
                    values.push({ value, currency });
                    hasValidValue = true;
                } else if (fieldType === 'date') {
                    const date = new Date(value);
                    if (!isNaN(date)) {
                        const day = String(date.getDate()).padStart(2, '0');
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const year = date.getFullYear();
                        values.push({ value: `${day}/${month}/${year}` });
                        hasValidValue = true;
                    }
                } else {
                    values.push({ value });
                    hasValidValue = true;
                }
            });
            
            if (hasValidValue) {
                fields[name] = {
                    type: fieldType,
                    visible,
                    values
                };
            }
        });
        
        return fields;
    },
    
    clearFields() {
        document.getElementById('customFields').innerHTML = '';
        this.fieldCounter = 0;
    },
    
    async deleteInfo(id) {
        const item = this.data.find(i => i.id === id);
        if (item && confirm(`Удалить "${item.fullName || item.title}"?`)) {
            this.data = this.data.filter(i => i.id !== id);
            
            if (await storage.saveData(this.data)) {
                this.render();
                alert('Сотрудник удален!');
            } else {
                alert('Ошибка удаления');
            }
        }
    },
    
    async exportData() {
        if (this.data.length === 0) {
            alert('Нет данных для экспорта');
            return;
        }
        
        if (await storage.exportToFile(this.data)) {
            alert(`Экспортировано ${this.data.length} сотрудников!`);
        } else {
            alert('Ошибка экспорта');
        }
    },
    
    showImportDialog() {
        document.getElementById('importModal').classList.add('active');
        
        const fileInput = document.getElementById('importFileInput');
        const preview = document.getElementById('importPreview');
        const importBtn = document.getElementById('importBtn');
        
        fileInput.value = '';
        preview.style.display = 'none';
        importBtn.disabled = true;
        
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file && file.type === 'application/json') {
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    const count = (data.data && data.data.length) || (Array.isArray(data) ? data.length : 0);
                    
                    if (count > 0) {
                        preview.innerHTML = `✅ Готов к импорту: ${count} записей`;
                        preview.style.display = 'block';
                        importBtn.disabled = false;
                    } else {
                        preview.innerHTML = '⚠️ Нет данных';
                        preview.style.display = 'block';
                    }
                } catch (error) {
                    preview.innerHTML = '❌ Неверный формат';
                    preview.style.display = 'block';
                }
            }
        };
    },
    
    closeImportDialog() {
        document.getElementById('importModal').classList.remove('active');
    },
    
    async importData() {
        const file = document.getElementById('importFileInput').files[0];
        if (!file) return;
        
        if (confirm('Заменить всех сотрудников?')) {
            try {
                this.data = await storage.importFromFile(file);
                await storage.saveData(this.data);
                this.render();
                this.closeImportDialog();
                alert(`Импортировано ${this.data.length} сотрудников!`);
            } catch (error) {
                alert('Ошибка импорта: ' + error.message);
            }
        }
    },
    
    toggleExportMenu() {
        const menu = document.getElementById('exportMenu');
        const btn = document.getElementById('exportMenuBtn');
        
        const isActive = menu.classList.contains('active');
        menu.classList.toggle('active');
        
        const chevron = btn.querySelector('i[data-lucide="chevron-down"], i[data-lucide="chevron-up"]');
        if (chevron) {
            chevron.setAttribute('data-lucide', isActive ? 'chevron-down' : 'chevron-up');
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    },
    
    closeExportMenu() {
        const menu = document.getElementById('exportMenu');
        const btn = document.getElementById('exportMenuBtn');
        
        menu.classList.remove('active');
        
        const chevron = btn.querySelector('i[data-lucide="chevron-down"], i[data-lucide="chevron-up"]');
        if (chevron) {
            chevron.setAttribute('data-lucide', 'chevron-down');
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    },
    
    async exportJSON() {
        this.closeExportMenu();
        await this.exportData();
    },
    
    async exportAllText() {
        this.closeExportMenu();
        await exportManager.exportAll();
    },
    
    async showSelectiveExport() {
        this.closeExportMenu();
        await exportManager.showModal();
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    },
    
    formatDate(isoString) {
        if (!isoString) return '';
        return new Date(isoString).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit'
        });
    },
    
    addInfo() { this.saveEmployee(); },
    addInfoAsync() { this.saveEmployee(); },
    editInfo(id) { this.showEditModal(id); },
    editInfoAsync(id) { this.showEditModal(id); },
    deleteInfoAsync(id) { this.deleteInfo(id); },
    removeCustomField(btn) { btn.parentElement.remove(); },
    
    switchTab(tab) { 
        console.log('Tab system removed, showing team grid only');
        this.render(); 
    },
    renderEditList() { 
        console.log('Edit list removed, using modal windows instead'); 
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        exportManager.init();
        await teamInfo.init();
        console.log('✅ All modules loaded successfully');
    } catch (error) {
        console.error('❌ Loading error:', error);
    }
});

console.log('✅ Team Info loaded');