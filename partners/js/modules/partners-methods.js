// Partners Methods - inline dropdown method management
const PartnersMethods = {
    async loadMethods() {
        PartnersState.cachedMethods = await CloudStorage.getMethods();
        return PartnersState.cachedMethods;
    },

    /**
     * Populate methods dropdown with inline add/edit/delete controls.
     * Each method item has hover icons for edit/delete.
     * Bottom has "+ Добавить метод" action row.
     */
    populateMethodsSelect(selectedValue = '') {
        const menu = document.getElementById('formMethodMenu');
        const input = document.getElementById('formMethodValue');
        const label = document.getElementById('formMethodLabel');
        const trigger = document.getElementById('formMethodTrigger');
        if (!menu) return;

        const methods = PartnersState.getMethods();
        let html = '';

        // "Выберите метод" placeholder item
        html += '<div class="dropdown-item' + (!selectedValue ? ' active' : '') + '" data-action="partners-selectFormDropdown" data-value="">Выберите метод</div>';

        // Method items with inline actions
        methods.forEach(method => {
            const isActive = method.name === selectedValue ? ' active' : '';
            const escapedName = Utils.escapeHtml(method.name);
            html += '<div class="dropdown-item dropdown-item--method' + isActive + '" data-action="partners-selectFormDropdown" data-value="' + escapedName + '">'
                + '<span class="method-item-name">' + escapedName + '</span>'
                + '<div class="method-inline-actions">'
                + '<button class="method-inline-edit" data-action="partners-startEditMethodInline" data-method-id="' + method.id + '" title="Редактировать">'
                + '<img src="../shared/icons/pen.svg" width="14" height="14" alt="Ред.">'
                + '</button>'
                + '<button class="method-inline-delete" data-action="partners-deleteMethodInline" data-method-id="' + method.id + '" title="Удалить">'
                + '<img src="../shared/icons/cross.svg" width="14" height="14" alt="Уд.">'
                + '</button>'
                + '</div>'
                + '</div>';
        });

        // Divider + add row
        html += '<div class="dropdown-divider"></div>';
        html += '<div class="dropdown-item dropdown-item--action" id="methodAddRow" data-action="partners-showAddMethodInput">+ Добавить метод</div>';

        menu.innerHTML = html;
        if (input) input.value = selectedValue;
        if (label) label.textContent = selectedValue || 'Выберите метод';
        if (trigger) trigger.classList.toggle('placeholder', !selectedValue);
    },

    /** Get current selected method value */
    _getSelectedValue() {
        const input = document.getElementById('formMethodValue');
        return input ? input.value : '';
    },

    /** Keep dropdown open after inline operations */
    _keepDropdownOpen() {
        const menu = document.getElementById('formMethodMenu');
        if (menu) menu.classList.remove('hidden');
    },

    /**
     * Replace "+ Добавить метод" row with inline input form.
     */
    showAddMethodInput() {
        const addRow = document.getElementById('methodAddRow');
        if (!addRow) return;

        addRow.removeAttribute('data-action');
        addRow.className = 'dropdown-item--add-form';
        addRow.innerHTML = '<input type="text" class="form-input method-inline-input" id="inlineMethodInput" placeholder="Новый метод...">'
            + '<button class="method-inline-add-btn" data-action="partners-addMethodInline">'
            + '<img src="../shared/icons/add.svg" width="14" height="14" alt="+">'
            + '</button>';

        const inp = document.getElementById('inlineMethodInput');
        if (inp) {
            inp.focus();
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    PartnersMethods.addMethodInline();
                } else if (e.key === 'Escape') {
                    e.stopPropagation();
                    PartnersMethods.populateMethodsSelect(PartnersMethods._getSelectedValue());
                    PartnersMethods._keepDropdownOpen();
                }
            });
        }
    },

    /**
     * Add method from inline input inside dropdown.
     */
    async addMethodInline() {
        const inp = document.getElementById('inlineMethodInput');
        if (!inp) return;
        const name = inp.value.trim();

        if (!name) {
            Toast.warning('Введите название метода');
            return;
        }

        const methods = PartnersState.getMethods();
        if (methods.some(m => String(m.name || '').toLowerCase() === name.toLowerCase())) {
            Toast.warning('Метод с таким названием уже существует');
            return;
        }

        inp.disabled = true;
        try {
            const result = await CloudStorage.addMethod({ name: name });
            PartnersState.cachedMethods.push({ id: result.id, name: name });
            // Re-render dropdown keeping it open, then show add input again
            PartnersMethods.populateMethodsSelect(PartnersMethods._getSelectedValue());
            PartnersMethods._keepDropdownOpen();
            PartnersMethods.showAddMethodInput();
        } catch (error) {
            PartnersUtils.showError('Ошибка добавления метода: ' + error.message);
            if (inp) inp.disabled = false;
        }
    },

    /**
     * Delete method from inline dropdown icon click.
     */
    async deleteMethodInline(methodId) {
        const menu = document.getElementById('formMethodMenu');
        if (menu) {
            const items = menu.querySelectorAll('.dropdown-item--method');
            items.forEach(item => {
                const btn = item.querySelector('[data-method-id="' + methodId + '"].method-inline-delete');
                if (btn) {
                    const actions = item.querySelector('.method-inline-actions');
                    if (actions) { actions.innerHTML = '<span class="spinner spinner--sm"></span>'; }
                }
            });
        }

        try {
            await CloudStorage.deleteMethod(methodId);
            PartnersState.cachedMethods = PartnersState.cachedMethods.filter(m => m.id !== methodId);

            // If deleted method was currently selected, clear selection
            const currentValue = PartnersMethods._getSelectedValue();
            const deletedMethod = !PartnersState.getMethods().some(m => m.name === currentValue);
            const selectedValue = deletedMethod ? '' : currentValue;

            PartnersMethods.populateMethodsSelect(selectedValue);
            PartnersMethods._keepDropdownOpen();
            Toast.success('Метод удален');
        } catch (error) {
            if (error.message.includes('not found')) {
                try {
                    PartnersState.cachedMethods = await CloudStorage.getMethods(false);
                    PartnersMethods.populateMethodsSelect(PartnersMethods._getSelectedValue());
                    PartnersMethods._keepDropdownOpen();
                    Toast.warning('Метод уже был удален. Список обновлен.');
                } catch (refreshError) {
                    PartnersUtils.showError('Ошибка обновления списка методов: ' + refreshError.message);
                }
            } else {
                PartnersUtils.showError('Ошибка удаления метода: ' + error.message);
            }
        }
    },

    /**
     * Start inline edit of a method inside dropdown.
     */
    startEditMethodInline(methodId) {
        const methods = PartnersState.getMethods();
        const method = methods.find(m => m.id === methodId);
        if (!method) return;

        // Find the dropdown item for this method
        const menu = document.getElementById('formMethodMenu');
        if (!menu) return;
        const items = menu.querySelectorAll('.dropdown-item--method');
        let targetItem = null;
        items.forEach(item => {
            const editBtn = item.querySelector('[data-method-id="' + methodId + '"]');
            if (editBtn) targetItem = item;
        });
        if (!targetItem) return;

        targetItem.classList.add('editing');
        targetItem.removeAttribute('data-action');
        // Phase 25 LIT-06: безопасный DOM construct (Pitfall #6 — XSS-proof)
        // createElement + value property setter (auto-safe replacement)
        targetItem.textContent = '';
        const editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.className = 'form-input method-inline-input';
        editInput.id = 'editMethodInlineInput_' + methodId;
        editInput.value = method.name; // value property setter — XSS-safe (browser sanitizes)
        targetItem.appendChild(editInput);

        const saveBtn = document.createElement('button');
        saveBtn.dataset.action = 'partners-saveEditMethodInline';
        saveBtn.dataset.methodId = methodId;
        const saveImg = document.createElement('img');
        saveImg.src = '../shared/icons/done.svg';
        saveImg.width = 14;
        saveImg.height = 14;
        saveImg.alt = 'OK';
        saveBtn.appendChild(saveImg);
        targetItem.appendChild(saveBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.dataset.action = 'partners-cancelEditMethodInline';
        const cancelImg = document.createElement('img');
        cancelImg.src = '../shared/icons/cross.svg';
        cancelImg.width = 14;
        cancelImg.height = 14;
        cancelImg.alt = 'X';
        cancelBtn.appendChild(cancelImg);
        targetItem.appendChild(cancelBtn);

        const inp = document.getElementById('editMethodInlineInput_' + methodId);
        if (inp) {
            inp.focus();
            inp.select();
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    PartnersMethods.saveEditMethodInline(methodId);
                } else if (e.key === 'Escape') {
                    e.stopPropagation();
                    PartnersMethods.cancelEditMethodInline();
                }
            });
        }
    },

    /**
     * Save inline edit of a method.
     */
    async saveEditMethodInline(methodId) {
        const inp = document.getElementById('editMethodInlineInput_' + methodId);
        if (!inp) return;
        const newName = inp.value.trim();

        if (!newName) {
            Toast.warning('Название не может быть пустым');
            return;
        }

        const methods = PartnersState.getMethods();
        const methodIndex = methods.findIndex(m => m.id === methodId);
        if (methodIndex === -1) return;

        if (methods.some((m, i) => i !== methodIndex && String(m.name || '').toLowerCase() === newName.toLowerCase())) {
            Toast.warning('Метод с таким названием уже существует');
            return;
        }

        inp.disabled = true;
        const editItem = inp.closest('.dropdown-item--method');
        const btns = editItem ? editItem.querySelectorAll('button') : [];
        btns.forEach(b => { b.style.display = 'none'; });
        if (editItem) editItem.insertAdjacentHTML('beforeend', '<span class="spinner spinner--sm"></span>');

        try {
            const oldName = methods[methodIndex].name;
            await CloudStorage.updateMethod(methodId, { id: methodId, name: newName });
            PartnersState.cachedMethods[methodIndex].name = newName;

            // Update partners with this method
            const partners = PartnersState.getPartners();
            const updatePromises = partners
                .filter(p => p.method === oldName)
                .map(partner => {
                    partner.method = newName;
                    return CloudStorage.updatePartner(partner.id, partner);
                });
            await Promise.all(updatePromises);

            // Refresh partners cache
            PartnersState.cachedPartners = await CloudStorage.getPartners(false);
            PartnersColumns.invalidateColumnsCache();
            PartnersForms.syncPartnersToLocalStorage();

            // If renamed method was selected, update selection
            const currentValue = PartnersMethods._getSelectedValue();
            const selectedValue = (currentValue === oldName) ? newName : currentValue;

            PartnersMethods.populateMethodsSelect(selectedValue);
            PartnersMethods._keepDropdownOpen();
            PartnersRenderer.render();
            Toast.success('Метод обновлен');
        } catch (error) {
            if (error.message.includes('not found')) {
                try {
                    PartnersState.cachedMethods = await CloudStorage.getMethods(false);
                    PartnersMethods.populateMethodsSelect(PartnersMethods._getSelectedValue());
                    PartnersMethods._keepDropdownOpen();
                    Toast.warning('Метод не найден. Список обновлен.');
                } catch (refreshError) {
                    PartnersUtils.showError('Ошибка обновления списка методов: ' + refreshError.message);
                }
            } else {
                PartnersUtils.showError('Ошибка сохранения метода: ' + error.message);
            }
        }
    },

    /**
     * Cancel inline edit — re-render dropdown.
     */
    cancelEditMethodInline() {
        PartnersMethods.populateMethodsSelect(PartnersMethods._getSelectedValue());
        PartnersMethods._keepDropdownOpen();
    }
};
