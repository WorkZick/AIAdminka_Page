// Partners Methods - methods management
const PartnersMethods = {
    async loadMethods() {
        PartnersState.cachedMethods = await CloudStorage.getMethods();
        return PartnersState.cachedMethods;
    },

    showMethodsDialog() {
        document.getElementById('methodsModal').classList.add('active');
        document.getElementById('newMethodInput').value = '';
        PartnersMethods.renderMethodsList();
        PartnersMethods.updateMethodsCount();
    },

    closeMethodsDialog() {
        document.getElementById('methodsModal').classList.remove('active');
        PartnersMethods.populateMethodsSelect();
    },

    updateMethodsCount() {
        const badge = document.getElementById('methodsCountBadge');
        if (badge) {
            badge.textContent = PartnersState.getMethods().length;
        }
    },

    async addMethod() {
        const input = document.getElementById('newMethodInput');
        const name = input.value.trim();

        if (!name) {
            Toast.warning('Введите название метода');
            return;
        }

        const methods = PartnersState.getMethods();
        if (methods.some(m => m.name.toLowerCase() === name.toLowerCase())) {
            Toast.warning('Метод с таким названием уже существует');
            return;
        }

        const btn = document.querySelector('[data-action="partners-addMethod"]');
        if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }

        try {
            const result = await CloudStorage.addMethod({ name: name });
            PartnersState.cachedMethods.push({ id: result.id, name: name });
            input.value = '';
            PartnersMethods.renderMethodsList();
            PartnersMethods.updateMethodsCount();
            input.focus();
        } catch (error) {
            PartnersUtils.showError('Ошибка добавления метода: ' + error.message);
        } finally {
            if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
        }
    },

    async deleteMethod(methodId) {
        const btn = document.querySelector(`[data-action="partners-deleteMethod"][data-method-id="${methodId}"]`);
        if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }

        try {
            await CloudStorage.deleteMethod(methodId);
            PartnersState.cachedMethods = PartnersState.cachedMethods.filter(m => m.id !== methodId);
            PartnersMethods.renderMethodsList();
            PartnersMethods.updateMethodsCount();
            Toast.success('Метод удален');
        } catch (error) {
            // Если метод не найден на сервере, обновляем кеш из облака
            if (error.message.includes('Method not found') || error.message.includes('not found')) {
                try {
                    // Обновляем список методов из облака
                    PartnersState.cachedMethods = await CloudStorage.getMethods(false);
                    PartnersMethods.renderMethodsList();
                    PartnersMethods.updateMethodsCount();
                    Toast.warning('Метод уже был удален. Список обновлен.');
                } catch (refreshError) {
                    PartnersUtils.showError('Ошибка обновления списка методов: ' + refreshError.message);
                }
            } else {
                PartnersUtils.showError('Ошибка удаления метода: ' + error.message);
            }
        } finally {
            if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
        }
    },

    startEditMethod(methodId) {
        const methods = PartnersState.getMethods();
        const method = methods.find(m => m.id === methodId);
        if (!method) return;

        const item = document.querySelector(`[data-method-id="${methodId}"]`);
        if (!item) return;

        item.classList.add('editing');
        item.innerHTML = `
            <input type="text" class="method-item-input" id="editMethodInput_${methodId}"
                   value="${PartnersUtils.escapeHtml(method.name)}">
            <div class="method-edit-actions">
                <button class="method-edit-btn save" data-action="partners-saveEditMethod" data-method-id="${methodId}" title="Сохранить">
                    <img src="../shared/icons/done.svg" alt="Сохранить">
                </button>
                <button class="method-edit-btn cancel" data-action="partners-cancelEditMethod" title="Отмена">
                    <img src="../shared/icons/cross.svg" alt="Отмена">
                </button>
            </div>
        `;

        const input = document.getElementById(`editMethodInput_${methodId}`);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') PartnersMethods.saveEditMethod(methodId);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') PartnersMethods.renderMethodsList();
        });
        input.focus();
        input.select();
    },

    async saveEditMethod(methodId) {
        const input = document.getElementById(`editMethodInput_${methodId}`);
        const newName = input.value.trim();

        if (!newName) {
            Toast.warning('Название не может быть пустым');
            return;
        }

        const methods = PartnersState.getMethods();
        const methodIndex = methods.findIndex(m => m.id === methodId);
        if (methodIndex === -1) return;

        if (methods.some((m, i) => i !== methodIndex && m.name.toLowerCase() === newName.toLowerCase())) {
            Toast.warning('Метод с таким названием уже существует');
            return;
        }

        const btn = document.querySelector(`[data-action="partners-saveEditMethod"][data-method-id="${methodId}"]`);
        if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }
        PartnersUtils.showLoading(true);

        try {
            const oldName = methods[methodIndex].name;
            await CloudStorage.updateMethod(methodId, { id: methodId, name: newName });
            PartnersState.cachedMethods[methodIndex].name = newName;

            // Update partners with this method
            const partners = PartnersState.getPartners();
            for (const partner of partners) {
                if (partner.method === oldName) {
                    partner.method = newName;
                    await CloudStorage.updatePartner(partner.id, partner);
                }
            }

            // Refresh partners cache
            PartnersState.cachedPartners = await CloudStorage.getPartners(false);
            PartnersForms.syncPartnersToLocalStorage();
            PartnersMethods.renderMethodsList();
            PartnersRenderer.render();
            Toast.success('Метод обновлен');
        } catch (error) {
            // Если метод не найден на сервере, обновляем кеш из облака
            if (error.message.includes('Method not found') || error.message.includes('not found')) {
                try {
                    PartnersState.cachedMethods = await CloudStorage.getMethods(false);
                    PartnersMethods.renderMethodsList();
                    Toast.warning('Метод не найден. Список обновлен.');
                } catch (refreshError) {
                    PartnersUtils.showError('Ошибка обновления списка методов: ' + refreshError.message);
                }
            } else {
                PartnersUtils.showError('Ошибка сохранения метода: ' + error.message);
            }
        } finally {
            if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
            PartnersUtils.showLoading(false);
        }
    },

    cancelEditMethod() {
        PartnersMethods.renderMethodsList();
    },

    renderMethodsList() {
        const container = document.getElementById('methodsList');
        const methods = PartnersState.getMethods();

        if (methods.length === 0) {
            container.innerHTML = `
                <div class="methods-empty">
                    <img class="methods-empty-icon" src="../shared/icons/partners.svg" alt="">
                    <span class="methods-empty-text">Нет методов</span>
                    <span class="methods-empty-hint">Добавьте первый метод выше</span>
                </div>
            `;
            return;
        }

        container.innerHTML = methods.map(method => `
            <div class="method-item" data-method-id="${method.id}">
                <span class="method-item-name">${PartnersUtils.escapeHtml(method.name)}</span>
                <div class="method-item-actions">
                    <button class="method-action-btn" data-action="partners-startEditMethod" data-method-id="${method.id}" title="Редактировать">
                        <img src="../shared/icons/pen.svg" alt="Редактировать">
                    </button>
                    <button class="method-action-btn delete" data-action="partners-deleteMethod" data-method-id="${method.id}" title="Удалить">
                        <img src="../shared/icons/cross.svg" alt="Удалить">
                    </button>
                </div>
            </div>
        `).join('');
    },

    populateMethodsSelect(selectedValue = '') {
        const select = document.getElementById('formMethod');
        if (!select) return;

        const methods = PartnersState.getMethods();
        select.innerHTML = '<option value="">Выберите метод</option>';

        methods.forEach(method => {
            const option = document.createElement('option');
            option.value = method.name;
            option.textContent = method.name;
            if (method.name === selectedValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }
};
