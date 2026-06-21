// Partners Forms - form operations (add, edit, save, delete, data loading)
//
// Phase 25 LIT-06 (Plan 25-07) status:
// — <app-modal> consumed для E2E test selectors (см. partners/index.html mount node)
// — <app-form-dropdown> ready для status/method binding
// — Existing form/card right-panel UI preserved (legacy DOM с right-panel form #partnerForm)
// — Lit auto-escape via window.litHtml в shared/components/* renderers
// — Full migration partner card → <app-card> + add modal → <app-modal> deferred
//   к Phase 27 mass migration (Pitfall #6 atomic invariant maintained: partners pilot
//   validates Lit infrastructure без полной перезаписи 581 LOC working code)
// Reference: 25-07-PLAN.md §"Wave 3" + 25-CONTEXT.md §"LIT-06: Migration scope".
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

        PartnersNavigation._updateStatusBadge('formStatusText', 'Открыт');

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

        PartnersNavigation._updateStatusBadge('formStatusText', PartnersState.formStatus);

        if (partner.customFields) {
            Object.entries(partner.customFields).forEach(([label, value]) => {
                const fieldId = 'customField_' + Utils.generateId();
                const fieldHtml = `
                    <div class="form-group-inline" data-custom-field="true">
                        <label>${PartnersUtils.escapeHtml(label)}:</label>
                        <input type="text" class="form-input" id="${fieldId}" value="${PartnersUtils.escapeHtml(value)}" data-field-label="${PartnersUtils.escapeHtml(label)}">
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

        // OPTIMISTIC UPDATE: Take snapshot BEFORE mutation
        const snapshot = structuredClone(PartnersState.cachedPartners);
        const isEditing = !!PartnersState.editingPartnerId;
        const tempId = isEditing ? PartnersState.editingPartnerId : `temp_${Date.now()}`;

        // OPTIMISTIC UPDATE: Mutate state in-place immediately
        if (isEditing) {
            partnerData.id = PartnersState.editingPartnerId;
            const index = PartnersState.cachedPartners.findIndex(p => p.id === PartnersState.editingPartnerId);
            if (index !== -1) {
                PartnersState.cachedPartners[index] = { ...PartnersState.cachedPartners[index], ...partnerData, _pending: true };
            }
            PartnersState.selectedPartnerId = PartnersState.editingPartnerId;
        } else {
            partnerData.id = tempId;
            partnerData._pending = true;
            PartnersState.cachedPartners.push(partnerData);
            PartnersState.selectedPartnerId = tempId;
        }

        PartnersState.editingPartnerId = null;
        PartnersForms.syncPartnersToLocalStorage();
        PartnersColumns.invalidateColumnsCache();
        PartnersColumns.renderColumnsMenu();
        PartnersRenderer.render();
        PartnersNavigation.showPartnerCard(PartnersState.selectedPartnerId);

        // Find item reference for OptimisticManager
        const itemIndex = PartnersState.cachedPartners.findIndex(p => p.id === tempId);
        const itemRef = PartnersState.cachedPartners[itemIndex];

        // Rollback callback: re-render and show Toast.error with Retry
        const onRollback = (error) => {
            PartnersState.selectedPartnerId = isEditing ? tempId : null;
            PartnersForms.syncPartnersToLocalStorage();
            PartnersColumns.invalidateColumnsCache();
            PartnersColumns.renderColumnsMenu();
            PartnersRenderer.render();
            if (PartnersState.selectedPartnerId) {
                PartnersNavigation.showPartnerCard(PartnersState.selectedPartnerId);
            } else {
                PartnersNavigation.showHintPanel();
            }
            Toast.error('Ошибка сохранения: ' + error.message, 6000, {
                action: { label: 'Повторить', callback: () => PartnersForms.saveFromForm() }
            });
        };

        const opId = PartnersState._optimistic.apply({
            stateRef: PartnersState.cachedPartners,
            index: isEditing ? itemIndex : -1,
            snapshot,
            operation: isEditing ? 'update' : 'add',
            item: itemRef,
            onRollback
        });

        try {
            // Если есть новый avatar, загружаем в Google Drive
            if (isNewAvatar) {
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
            }

            // Отправляем на сервер
            if (isEditing) {
                await CloudStorage.updatePartner(tempId, partnerData);

                // Обновляем avatarFileId в cachedPartners после загрузки аватара
                const idx = PartnersState.cachedPartners.findIndex(p => p.id === tempId);
                if (idx !== -1) PartnersState.cachedPartners[idx].avatarFileId = partnerData.avatarFileId;
                PartnersState._optimistic.confirm(opId);
            } else {
                const result = await CloudStorage.addPartner(partnerData);
                PartnersState._optimistic.confirm(opId, { realId: result.id });
                PartnersState.selectedPartnerId = result.id;
                PartnersForms.syncPartnersToLocalStorage();
            }

            // Обновляем UI после успешного сохранения
            PartnersForms.syncPartnersToLocalStorage();
            PartnersRenderer.render();
            if (PartnersState.selectedPartnerId) {
                PartnersNavigation.showPartnerCard(PartnersState.selectedPartnerId);
            }

            Toast.success(isEditing ? 'Партнёр обновлён' : 'Партнёр добавлен');
        } catch (error) {
            PartnersState._optimistic.rollback(opId, error);
        }
    },

    async deleteFromCard() {
        if (!PartnersState.selectedPartnerId) return;

        const confirmed = await PartnersUtils.showConfirm('Вы уверены, что хотите удалить этого партнера?', 'Удаление партнера');
        if (!confirmed) return;

        // OPTIMISTIC UPDATE: Take snapshot BEFORE mutation
        const snapshot = structuredClone(PartnersState.cachedPartners);
        const deletedId = PartnersState.selectedPartnerId;
        const partnerToDelete = PartnersState.cachedPartners.find(p => p.id === deletedId);
        const deletedIndex = PartnersState.cachedPartners.findIndex(p => p.id === deletedId);

        // OPTIMISTIC UPDATE: Remove from array in-place (splice preserves reference for rollback)
        if (deletedIndex !== -1) PartnersState.cachedPartners.splice(deletedIndex, 1);
        PartnersForms.syncPartnersToLocalStorage();
        PartnersState.selectedPartnerId = null;
        PartnersColumns.cleanupUnusedColumns();
        PartnersRenderer.render();
        PartnersNavigation.showHintPanel();

        const onRollback = (error) => {
            PartnersState.selectedPartnerId = deletedId;
            PartnersForms.syncPartnersToLocalStorage();
            PartnersColumns.cleanupUnusedColumns();
            PartnersRenderer.render();
            PartnersNavigation.showPartnerCard(deletedId);
            Toast.error('Ошибка удаления: ' + error.message, 6000, {
                action: { label: 'Повторить', callback: () => PartnersForms.deleteFromCard() }
            });
        };

        const opId = PartnersState._optimistic.apply({
            stateRef: PartnersState.cachedPartners,
            index: deletedIndex,
            snapshot,
            operation: 'delete',
            item: partnerToDelete || { id: deletedId },
            onRollback
        });

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

            PartnersState._optimistic.confirm(opId);
            Toast.success('Партнёр удалён');
        } catch (error) {
            PartnersState._optimistic.rollback(opId, error);
        }
    },

    async deleteFromForm() {
        if (!PartnersState.editingPartnerId) return;

        const confirmed = await PartnersUtils.showConfirm('Вы уверены, что хотите удалить этого партнера?', 'Удаление партнера');
        if (!confirmed) return;

        // OPTIMISTIC UPDATE: Take snapshot BEFORE mutation
        const snapshot = structuredClone(PartnersState.cachedPartners);
        const deletedId = PartnersState.editingPartnerId;
        const partnerToDelete = PartnersState.cachedPartners.find(p => p.id === deletedId);
        const deletedIndex = PartnersState.cachedPartners.findIndex(p => p.id === deletedId);

        // OPTIMISTIC UPDATE: Remove from array in-place (splice preserves reference for rollback)
        if (deletedIndex !== -1) PartnersState.cachedPartners.splice(deletedIndex, 1);
        PartnersForms.syncPartnersToLocalStorage();
        PartnersState.editingPartnerId = null;
        PartnersState.selectedPartnerId = null;
        PartnersColumns.cleanupUnusedColumns();
        PartnersRenderer.render();
        PartnersNavigation.showHintPanel();

        const onRollback = (error) => {
            PartnersState.editingPartnerId = deletedId;
            PartnersState.selectedPartnerId = null;
            PartnersForms.syncPartnersToLocalStorage();
            PartnersColumns.cleanupUnusedColumns();
            PartnersRenderer.render();
            Toast.error('Ошибка удаления: ' + error.message, 6000, {
                action: { label: 'Повторить', callback: () => PartnersForms.deleteFromForm() }
            });
        };

        const opId = PartnersState._optimistic.apply({
            stateRef: PartnersState.cachedPartners,
            index: deletedIndex,
            snapshot,
            operation: 'delete',
            item: partnerToDelete || { id: deletedId },
            onRollback
        });

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

            PartnersState._optimistic.confirm(opId);
            Toast.success('Партнёр удалён');
        } catch (error) {
            PartnersState._optimistic.rollback(opId, error);
        }
    },

    async loadAllData() {
        const [result, methods, templates] = await Promise.all([
            CloudStorage.getPartners({ page: 1, pageSize: PartnersState.pageSize }),
            CloudStorage.getMethods(),
            CloudStorage.getTemplates()
        ]);

        // Pending guard: don't overwrite in-flight optimistic mutations
        if (PartnersState._optimistic && PartnersState._optimistic.hasPending && PartnersState._optimistic.hasPending()) return;

        PartnersState.cachedPartners = result.partners || [];
        PartnersColumns.invalidateColumnsCache();
        PartnersState.totalCount = result.totalCount || 0;
        PartnersState.currentPage = result.page || 1;
        PartnersState.cachedMethods = methods || [];

        // Convert templates array to object
        PartnersState.cachedTemplates = {};
        if (templates) {
            templates.forEach(t => {
                PartnersState.cachedTemplates[t.id] = t;
            });
        }
    },

    async goToPage(page) {
        const reqId = ++PartnersState._currentRequestId;
        PartnersRenderer.renderSkeletonRows();
        try {
            const result = await CloudStorage.getPartners({
                page,
                pageSize: PartnersState.pageSize,
                filter: PartnersState.serverFilter || undefined,
                sortBy: PartnersState.sortField || undefined,
                order: PartnersState.sortField ? PartnersState.sortDirection : undefined
            });
            // Stale response discard
            if (reqId !== PartnersState._currentRequestId) return;
            PartnersState.cachedPartners = result.partners || [];
            PartnersColumns.invalidateColumnsCache();
            PartnersState.totalCount = result.totalCount || 0;
            PartnersState.currentPage = result.page || page;
            PartnersRenderer.render();
        } catch (error) {
            if (reqId !== PartnersState._currentRequestId) return;
            console.error('Ошибка загрузки страницы:', error);
            Toast.error('Ошибка загрузки данных: ' + error.message);
            PartnersRenderer.render();
        }
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
            CloudStorage.clearCacheNamespace('partners');
            CloudStorage.clearCache('methods');
            CloudStorage.clearCache('templates');
            PartnersColumns.renderColumnsMenu();
            PartnersColumns.renderTableHeader();
            await PartnersForms.goToPage(PartnersState.currentPage);
        } catch (e) {
            console.error('Ошибка обновления данных с сервера:', e);
        }
    }
};
