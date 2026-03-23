// Partners Forms - form operations (add, edit, save, delete, data loading)
const PartnersForms = {
    showAddModal() {
        PartnersState.editingPartnerId = null;
        PartnersState.selectedPartnerId = null;
        PartnersState.isTemplateMode = false;
        PartnersState.formStatus = 'Открыт';
        PartnersRenderer.render();

        document.getElementById('hintPanel').classList.add('hidden');
        document.getElementById('partnerCard').classList.add('hidden');
        document.getElementById('partnerForm').classList.remove('hidden');

        document.getElementById('formTitle').textContent = 'Добавить партнера';
        document.getElementById('formSaveBtnText').textContent = 'Добавить партнера';
        document.getElementById('formDeleteBtn').classList.add('hidden');

        document.getElementById('formTemplateSelector').classList.remove('hidden');
        document.getElementById('templateFieldsContainer').classList.add('hidden');
        document.getElementById('formBody').classList.remove('hidden');
        document.getElementById('formCounters').classList.remove('hidden');
        document.getElementById('formCounters').classList.remove('disabled');
        document.querySelector('.form-partner-info').classList.remove('hidden');

        const subagentInput = document.getElementById('formSubagent');
        const subagentIdInput = document.getElementById('formSubagentId');
        const methodWrap = document.getElementById('formMethodWrap');
        const methodWrapper = document.querySelector('.form-method-wrapper');
        const formAvatar = document.querySelector('.form-avatar');

        subagentInput.classList.remove('disabled');
        subagentIdInput.classList.remove('disabled');
        if (methodWrap) methodWrap.classList.remove('disabled');
        subagentInput.readOnly = false;
        subagentIdInput.readOnly = false;

        if (methodWrapper) {
            methodWrapper.classList.remove('disabled', 'pointer-events-none');
        }
        if (formAvatar) {
            formAvatar.classList.remove('disabled', 'pointer-events-none');
        }

        PartnersForms.removeDynamicFields();

        document.getElementById('formSubagent').value = '';
        document.getElementById('formSubagentId').value = '';

        PartnersMethods.populateMethodsSelect('');

        document.getElementById('formDep').value = '';
        document.getElementById('formWith').value = '';
        document.getElementById('formComp').value = '';

        const formAvatarImg = document.getElementById('formAvatar');
        formAvatarImg.src = '';
        formAvatarImg.classList.add('hidden');
        document.querySelector('.form-avatar-placeholder').classList.remove('hidden');

        const statusText = document.getElementById('formStatusText');
        statusText.textContent = 'Открыт';
        statusText.className = 'status-badge green';

        PartnersTemplates.updateTemplateList();
    },

    editFromCard() {
        if (!PartnersState.selectedPartnerId) return;

        const partners = PartnersState.getPartners();
        const partner = partners.find(p => p.id === PartnersState.selectedPartnerId);
        if (!partner) return;

        PartnersState.editingPartnerId = PartnersState.selectedPartnerId;
        PartnersState.isTemplateMode = false;
        PartnersState.formStatus = partner.status || 'Открыт';

        document.getElementById('hintPanel').classList.add('hidden');
        document.getElementById('partnerCard').classList.add('hidden');
        document.getElementById('partnerForm').classList.remove('hidden');

        document.getElementById('formTitle').textContent = 'Редактировать партнера';
        document.getElementById('formSaveBtnText').textContent = 'Сохранить изменения';
        document.getElementById('formDeleteBtn').classList.remove('hidden');

        document.getElementById('formTemplateSelector').classList.add('hidden');
        document.getElementById('templateFieldsContainer').classList.add('hidden');
        document.getElementById('formBody').classList.remove('hidden');
        document.getElementById('formCounters').classList.remove('hidden');
        document.getElementById('formCounters').classList.remove('disabled');
        document.querySelector('.form-partner-info').classList.remove('hidden');

        const subagentInput = document.getElementById('formSubagent');
        const subagentIdInput = document.getElementById('formSubagentId');
        const methodWrap = document.getElementById('formMethodWrap');
        const methodWrapper = document.querySelector('.form-method-wrapper');
        const formAvatarWrapper = document.querySelector('.form-avatar');

        subagentInput.classList.remove('disabled');
        subagentIdInput.classList.remove('disabled');
        if (methodWrap) methodWrap.classList.remove('disabled');
        subagentInput.readOnly = false;
        subagentIdInput.readOnly = false;

        if (methodWrapper) {
            methodWrapper.classList.remove('disabled', 'pointer-events-none');
        }
        if (formAvatarWrapper) {
            formAvatarWrapper.classList.remove('disabled', 'pointer-events-none');
        }

        PartnersForms.removeDynamicFields();

        subagentInput.value = partner.subagent || '';
        subagentIdInput.value = partner.subagentId || '';

        PartnersMethods.populateMethodsSelect(partner.method || '');

        document.getElementById('formDep').value = partner.dep || '';
        document.getElementById('formWith').value = partner.with || '';
        document.getElementById('formComp').value = partner.comp || '';

        const formAvatar = document.getElementById('formAvatar');
        const placeholder = document.querySelector('.form-avatar-placeholder');
        // Используем avatarFileId для получения URL из Google Drive
        const avatarUrl = partner.avatarFileId ? CloudStorage.getImageUrl(partner.avatarFileId) : '';
        if (avatarUrl) {
            formAvatar.src = avatarUrl;
            formAvatar.classList.remove('hidden');
            placeholder.classList.add('hidden');
        } else {
            formAvatar.src = '';
            formAvatar.classList.add('hidden');
            placeholder.classList.remove('hidden');
        }

        const statusText = document.getElementById('formStatusText');
        statusText.textContent = PartnersState.formStatus;
        statusText.className = 'status-badge ' + PartnersUtils.getStatusColor(PartnersState.formStatus);

        if (partner.customFields) {
            Object.entries(partner.customFields).forEach(([label, value]) => {
                const fieldId = 'customField_' + Utils.generateId();
                const fieldHtml = `
                    <div class="form-group-inline" data-custom-field="true">
                        <label>${PartnersUtils.escapeHtml(label)}:</label>
                        <input type="text" id="${fieldId}" value="${PartnersUtils.escapeHtml(value)}" data-field-label="${PartnersUtils.escapeHtml(label)}">
                    </div>
                `;
                document.getElementById('formBody').insertAdjacentHTML('beforeend', fieldHtml);
            });
        }
    },

    closeForm() {
        PartnersState.editingPartnerId = null;
        PartnersState.isTemplateMode = false;
        PartnersState.editingTemplateId = null;

        document.getElementById('templateFieldsSection').classList.add('hidden');
        document.getElementById('templateFieldsContainer').classList.add('hidden');

        document.getElementById('formBody').classList.remove('hidden');
        const formCounters = document.getElementById('formCounters');
        formCounters.classList.remove('hidden');
        formCounters.classList.remove('disabled');

        document.querySelector('.form-partner-info').classList.remove('hidden');

        PartnersForms.removeDynamicFields();

        const formAvatar = document.querySelector('.form-avatar');
        const subagentInput = document.getElementById('formSubagent');
        const subagentIdInput = document.getElementById('formSubagentId');
        const methodWrap = document.getElementById('formMethodWrap');
        const formStatusBadge = document.getElementById('formStatusBadge');

        if (formAvatar) {
            formAvatar.classList.remove('hidden', 'disabled', 'pointer-events-none');
            formAvatar.classList.add('pointer-events-auto');
        }
        if (subagentInput) {
            subagentInput.classList.remove('disabled');
            subagentInput.readOnly = false;
        }
        if (subagentIdInput) {
            subagentIdInput.classList.remove('disabled');
            subagentIdInput.readOnly = false;
        }
        if (methodWrap) {
            methodWrap.classList.remove('disabled');
        }
        if (formStatusBadge) {
            formStatusBadge.classList.remove('hidden');
            formStatusBadge.classList.remove('disabled');
        }

        if (PartnersState.selectedPartnerId) {
            PartnersNavigation.showPartnerCard(PartnersState.selectedPartnerId);
        } else {
            PartnersNavigation.showHintPanel();
        }
    },

    removeDynamicFields() {
        // Remove dynamic custom fields and template fields
        const dynamicFields = document.querySelectorAll('[data-custom-field="true"], [data-template-field="true"]');
        dynamicFields.forEach(field => field.remove());
    },

    /**
     * Сохранить партнера из формы (добавление или редактирование)
     *
     * @description
     * Использует Optimistic Update паттерн:
     * 1. Сохраняет текущее состояние для возможного отката
     * 2. Немедленно обновляет UI (создает temp_id для новых партнеров)
     * 3. Отправляет данные на сервер
     * 4. При успехе - обновляет temp_id на реальный
     * 5. При ошибке - откатывает изменения (rollback)
     *
     * Преимущества: UI отзывчивый, пользователь видит изменения сразу
     */
    async saveFromForm() {
        if (PartnersState.isTemplateMode) {
            PartnersTemplates.saveTemplate();
            return;
        }

        const subagent = document.getElementById('formSubagent').value.trim();
        const subagentId = document.getElementById('formSubagentId').value.trim();
        const method = (document.getElementById('formMethodValue')?.value || '').trim();

        // Берём оригинал из dataset (для отправки в Drive), или сжатый предпросмотр
        const formAvatarEl = document.getElementById('formAvatar');
        const avatar = formAvatarEl.dataset.originalSrc || formAvatarEl.src || '';

        const dep = parseInt(document.getElementById('formDep').value) || 0;
        const withVal = parseInt(document.getElementById('formWith').value) || 0;
        const comp = parseInt(document.getElementById('formComp').value) || 0;

        if (!subagent || !subagentId || !method) {
            Toast.warning('Пожалуйста, заполните все обязательные поля (Субагент, ID Субагента, Метод)');
            return;
        }

        const customFields = {};
        const templateFieldInputs = document.querySelectorAll('#formBody .form-group-inline');
        templateFieldInputs.forEach(group => {
            const input = group.querySelector('input, textarea');
            const label = group.querySelector('label');
            if (input && label) {
                const value = input.value.trim();
                const labelText = label.textContent.replace(':', '').trim();
                if (labelText && value) {
                    customFields[labelText] = value;
                }
            }
        });

        // Проверяем, есть ли новый avatar (base64)
        const isNewAvatar = avatar && avatar.startsWith('data:image/');

        // Получаем текущий avatarFileId если редактируем
        let currentAvatarFileId = '';
        if (PartnersState.editingPartnerId) {
            const existingPartner = PartnersState.cachedPartners.find(p => p.id === PartnersState.editingPartnerId);
            currentAvatarFileId = existingPartner?.avatarFileId || '';
        }

        const partnerData = {
            subagent,
            subagentId,
            method,
            deposits: dep,
            withdrawals: withVal,
            compensation: comp,
            status: PartnersState.formStatus,
            avatarFileId: currentAvatarFileId,
            customFields,
            // Локальные поля для UI
            dep: dep,
            with: withVal,
            comp: comp
        };

        // OPTIMISTIC UPDATE: Сохраняем состояние для отката
        const previousPartners = [...PartnersState.cachedPartners];
        const isEditing = !!PartnersState.editingPartnerId;
        const tempId = isEditing ? PartnersState.editingPartnerId : `temp_${Date.now()}`;

        // OPTIMISTIC UPDATE: Обновляем UI сразу
        if (isEditing) {
            partnerData.id = PartnersState.editingPartnerId;
            const index = PartnersState.cachedPartners.findIndex(p => p.id === PartnersState.editingPartnerId);
            if (index !== -1) {
                PartnersState.cachedPartners[index] = { ...PartnersState.cachedPartners[index], ...partnerData };
            }
            PartnersState.selectedPartnerId = PartnersState.editingPartnerId;
        } else {
            partnerData.id = tempId;
            PartnersState.cachedPartners.push(partnerData);
            PartnersState.selectedPartnerId = tempId;
        }

        PartnersState.editingPartnerId = null;
        PartnersForms.syncPartnersToLocalStorage();
        PartnersColumns.renderColumnsMenu();
        PartnersRenderer.render();
        PartnersNavigation.showPartnerCard(PartnersState.selectedPartnerId);

        PartnersUtils.showLoading(true);

        // Индикатор загрузки аватара
        const saveBtnText = document.getElementById('formSaveBtnText');
        const originalBtnText = saveBtnText.textContent;

        try {
            // Если есть новый avatar, загружаем в Google Drive
            if (isNewAvatar) {
                // Показываем индикатор загрузки аватара
                saveBtnText.textContent = 'Загрузка аватара...';

                // Удаляем старый аватар, чтобы не было дубликатов
                if (currentAvatarFileId) {
                    try {
                        await CloudStorage.deleteImage(currentAvatarFileId);
                    } catch (e) {
                        console.error('Failed to delete old avatar:', e);
                    }
                }

                // Загружаем новый аватар (оригинал в полном качестве)
                const fileName = `partner_avatar_${tempId}_${Date.now()}.jpg`;
                const uploadResult = await CloudStorage.uploadImage('partners', fileName, avatar);
                if (uploadResult && uploadResult.fileId) {
                    partnerData.avatarFileId = uploadResult.fileId;
                }

                // Возвращаем текст кнопки
                saveBtnText.textContent = 'Сохранение...';
            }

            // Отправляем на сервер
            if (isEditing) {
                await CloudStorage.updatePartner(tempId, partnerData);

                // Обновляем avatarFileId в cachedPartners после загрузки аватара
                const index = PartnersState.cachedPartners.findIndex(p => p.id === tempId);
                if (index !== -1) {
                    PartnersState.cachedPartners[index].avatarFileId = partnerData.avatarFileId;
                }
            } else {
                const result = await CloudStorage.addPartner(partnerData);
                // Обновляем временный ID на реальный
                const index = PartnersState.cachedPartners.findIndex(p => p.id === tempId);
                if (index !== -1) {
                    PartnersState.cachedPartners[index].id = result.id;
                    PartnersState.cachedPartners[index].avatarFileId = partnerData.avatarFileId;
                }
                PartnersState.selectedPartnerId = result.id;
                PartnersForms.syncPartnersToLocalStorage();
            }

            // Обновляем UI после успешного сохранения (включая новый аватар)
            PartnersForms.syncPartnersToLocalStorage();
            PartnersRenderer.render();
            if (PartnersState.selectedPartnerId) {
                PartnersNavigation.showPartnerCard(PartnersState.selectedPartnerId);
            }

            Toast.success(isEditing ? 'Партнёр обновлён' : 'Партнёр добавлен');
        } catch (error) {
            // ROLLBACK: Откатываем изменения при ошибке
            PartnersState.cachedPartners = previousPartners;
            PartnersState.selectedPartnerId = isEditing ? tempId : null;
            PartnersForms.syncPartnersToLocalStorage();
            PartnersColumns.renderColumnsMenu();
            PartnersRenderer.render();
            if (PartnersState.selectedPartnerId) {
                PartnersNavigation.showPartnerCard(PartnersState.selectedPartnerId);
            } else {
                PartnersNavigation.showHintPanel();
            }

            PartnersUtils.showError('Ошибка сохранения: ' + error.message);
        } finally {
            PartnersUtils.showLoading(false);
            // Восстанавливаем текст кнопки
            saveBtnText.textContent = originalBtnText;
        }
    },

    async deleteFromCard() {
        if (!PartnersState.selectedPartnerId) return;

        const confirmed = await PartnersUtils.showConfirm('Вы уверены, что хотите удалить этого партнера?', 'Удаление партнера');
        if (!confirmed) return;

        // OPTIMISTIC UPDATE: Сохраняем состояние для отката
        const previousPartners = [...PartnersState.cachedPartners];
        const deletedId = PartnersState.selectedPartnerId;
        const partnerToDelete = PartnersState.cachedPartners.find(p => p.id === deletedId);

        // OPTIMISTIC UPDATE: Удаляем из UI сразу
        PartnersState.cachedPartners = PartnersState.cachedPartners.filter(p => p.id !== deletedId);
        PartnersForms.syncPartnersToLocalStorage();
        PartnersState.selectedPartnerId = null;
        PartnersColumns.cleanupUnusedColumns();
        PartnersRenderer.render();
        PartnersNavigation.showHintPanel();

        PartnersUtils.showLoading(true);

        try {
            await CloudStorage.deletePartner(deletedId);

            // Удаляем аватар из Google Drive если есть
            if (partnerToDelete?.avatarFileId) {
                try {
                    await CloudStorage.deleteImage(partnerToDelete.avatarFileId);
                } catch (e) {
                    console.error('Failed to delete avatar from Drive:', e);
                }
            }

            Toast.success('Партнёр удалён');
        } catch (error) {
            // ROLLBACK: Откатываем удаление при ошибке
            PartnersState.cachedPartners = previousPartners;
            PartnersForms.syncPartnersToLocalStorage();
            PartnersState.selectedPartnerId = deletedId;
            PartnersColumns.cleanupUnusedColumns();
            PartnersRenderer.render();
            PartnersNavigation.showPartnerCard(deletedId);

            PartnersUtils.showError('Ошибка удаления: ' + error.message);
        } finally {
            PartnersUtils.showLoading(false);
        }
    },

    async deleteFromForm() {
        if (!PartnersState.editingPartnerId) return;

        const confirmed = await PartnersUtils.showConfirm('Вы уверены, что хотите удалить этого партнера?', 'Удаление партнера');
        if (!confirmed) return;

        // OPTIMISTIC UPDATE: Сохраняем состояние для отката
        const previousPartners = [...PartnersState.cachedPartners];
        const deletedId = PartnersState.editingPartnerId;
        const partnerToDelete = PartnersState.cachedPartners.find(p => p.id === deletedId);

        // OPTIMISTIC UPDATE: Удаляем из UI сразу
        PartnersState.cachedPartners = PartnersState.cachedPartners.filter(p => p.id !== deletedId);
        PartnersForms.syncPartnersToLocalStorage();
        PartnersState.editingPartnerId = null;
        PartnersState.selectedPartnerId = null;
        PartnersColumns.cleanupUnusedColumns();
        PartnersRenderer.render();
        PartnersNavigation.showHintPanel();

        PartnersUtils.showLoading(true);

        try {
            await CloudStorage.deletePartner(deletedId);

            // Удаляем аватар из Google Drive если есть
            if (partnerToDelete?.avatarFileId) {
                try {
                    await CloudStorage.deleteImage(partnerToDelete.avatarFileId);
                } catch (e) {
                    console.error('Failed to delete avatar from Drive:', e);
                }
            }

            Toast.success('Партнёр удалён');
        } catch (error) {
            // ROLLBACK: Откатываем удаление при ошибке
            PartnersState.cachedPartners = previousPartners;
            PartnersForms.syncPartnersToLocalStorage();
            PartnersState.editingPartnerId = deletedId;
            PartnersState.selectedPartnerId = null;
            PartnersColumns.cleanupUnusedColumns();
            PartnersRenderer.render();

            PartnersUtils.showError('Ошибка удаления: ' + error.message);
        } finally {
            PartnersUtils.showLoading(false);
        }
    },

    async loadAllData() {
        // Load all data in parallel
        const [partners, methods, templates] = await Promise.all([
            CloudStorage.getPartners(),
            CloudStorage.getMethods(),
            CloudStorage.getTemplates()
        ]);

        PartnersState.cachedPartners = partners;
        PartnersState.cachedMethods = methods;

        // Cache partners to localStorage for other modules (traffic-calculation)
        PartnersForms.syncPartnersToLocalStorage();

        // Convert templates array to object
        PartnersState.cachedTemplates = {};
        templates.forEach(t => {
            PartnersState.cachedTemplates[t.id] = t;
        });
    },

    // Sync partners to localStorage for other modules
    // ВАЖНО: сохраняем ТОЛЬКО несинхронизированных партнёров
    // Облачные данные всегда доступны из облака, не нужно их дублировать
    syncPartnersToLocalStorage() {
        try {
            // Фильтруем только несинхронизированных
            const unsyncedPartners = PartnersState.cachedPartners.filter(p => p._synced === false);
            localStorage.setItem('partners-data', JSON.stringify(unsyncedPartners));
        } catch (e) {
            console.error('Failed to sync partners to localStorage:', e);
        }
    },

    // Перезагрузить данные с сервера (после фоновой синхронизации)
    async loadDataFromCloud() {
        try {
            // Очищаем только кэш данных партнёров (не трогаем employees, onboarding и т.д.)
            CloudStorage.clearCache('partners');
            CloudStorage.clearCache('methods');
            CloudStorage.clearCache('templates');
            await PartnersForms.loadAllData();
            PartnersColumns.renderColumnsMenu();
            PartnersColumns.renderTableHeader();
            PartnersRenderer.render();
        } catch (e) {
            console.error('Ошибка обновления данных с сервера:', e);
        }
    }
};
