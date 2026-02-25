/**
 * Partner Onboarding - Main Controller
 * Объединяет все модули, event delegation, PageLifecycle
 */

const partnerOnboarding = {
    /** Ключ localStorage для хранения заявок */
    STORAGE_KEY: 'onboarding-requests',
    COUNTER_KEY: 'onboarding-id-counter',

    /** Инициализация модуля (вызывается из PageLifecycle.onInit) */
    async init() {
        // Получить данные пользователя
        const userRole = typeof RoleGuard !== 'undefined' ? RoleGuard.getCurrentRole() : 'admin';
        const userEmail = typeof AuthGuard !== 'undefined' && AuthGuard.getUserEmail
            ? AuthGuard.getUserEmail()
            : 'admin@company.com';

        OnboardingState.set('userRole', userRole);
        OnboardingState.set('userEmail', userEmail);

        // Скрыть tab "Новая заявка" для reviewer-only ролей
        this._setupRoleUI(userRole);

        // Настроить фильтры
        OnboardingList.setupDefaultFilters();

        // Подписки на изменения состояния
        this._setupSubscriptions();

        // Загрузить заявки
        await this._loadRequests();
    },

    /** Загрузка заявок из localStorage (TODO: заменить на API) */
    async _loadRequests() {
        OnboardingState.set('loading', true);

        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            const tasks = raw ? JSON.parse(raw) : [];

            // Миграция старых статусов (v2.22 → v2.23)
            let migrated = false;
            const statusMap = { draft: 'executor', pending_review: 'reviewer', rejected: 'revision' };
            const phaseFields = { account_status: 3, deposit_status: 4, af_result: 4, messenger_status: 5 };

            for (const task of tasks) {
                if (statusMap[task.status]) {
                    task.status = statusMap[task.status];
                    migrated = true;
                }
                // Миграция старых полей фаз → единое поле phase
                if (task.stageData) {
                    for (const [oldField, stageNum] of Object.entries(phaseFields)) {
                        const sd = task.stageData[stageNum];
                        if (sd && oldField in sd) {
                            if (!sd.phase) sd.phase = sd[oldField];
                            delete sd[oldField];
                            migrated = true;
                        }
                    }
                }
            }

            OnboardingState.set('requests', tasks);
            if (migrated) this._saveRequests();
            OnboardingList.applyFilters();
        } catch (error) {
            ErrorHandler.handle(error, { module: 'partner-onboarding', action: 'loadRequests' });
        } finally {
            OnboardingState.set('loading', false);
        }
    },

    /** Сохранить заявки в localStorage */
    _saveRequests() {
        const requests = OnboardingState.get('requests') || [];
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(requests));
    },

    /** Следующий ID заявки */
    _getNextId() {
        const counter = parseInt(localStorage.getItem(this.COUNTER_KEY) || '0', 10) + 1;
        localStorage.setItem(this.COUNTER_KEY, String(counter));
        return 'TSK' + String(counter).padStart(6, '0');
    },

    /** Настройка UI по роли */
    _setupRoleUI(role) {
        const subtabNewBtn = document.getElementById('subtabNewBtn');
        // Роли, которые могут создавать заявки
        const canCreate = ['sales', 'admin', 'leader', 'partners_mgr'];
        if (!canCreate.includes(role)) {
            subtabNewBtn?.classList.add('hidden');
        } else {
            subtabNewBtn?.classList.remove('hidden');
        }

        // DEV: Показать role switcher (только localhost)
        const isDev = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
        if (isDev) {
            const switcher = document.getElementById('roleSwitcher');
            switcher?.classList.remove('hidden');
            // Подсветить текущую роль
            switcher?.querySelectorAll('.role-pill').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.role === role);
            });
        }
    },

    /** DEV: Переключение роли для тестирования */
    switchRole(role) {
        // Сохраняем реальную роль при первом переключении
        if (!OnboardingState.get('realRole')) {
            OnboardingState.set('realRole', OnboardingState.get('userRole'));
        }

        OnboardingState.set('userRole', role);

        // Обновить active pill
        document.querySelectorAll('#roleSwitcherPills .role-pill').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === role);
        });

        // Обновить UI: фильтры, список, видимость табов
        this._setupRoleUI(role);
        OnboardingList.setupDefaultFilters();

        // Если открыта карточка — переоткрыть с новой ролью
        const currentRequest = OnboardingState.get('currentRequest');
        if (currentRequest) {
            this._autoSaveDraft();
            this.openDetail(currentRequest.id);
        } else {
            OnboardingList.applyFilters();
        }

    },

    /** Подписки на изменения состояния */
    _setupSubscriptions() {
        OnboardingState.subscribe('currentStep', (step) => {
            const request = OnboardingState.get('currentRequest');
            OnboardingSteps.render('stepsIndicator', step);
            OnboardingSteps.updateStepInfo(step);
            OnboardingSteps.updateActionButtons(step, request);
            OnboardingForm.renderStepForm(step);

            // Fill form with existing data if editing
            if (request?.stageData?.[step]) {
                OnboardingForm.fillFormData(step, request.stageData[step]);
            }

            // Scroll to top on step change
            const scrollEl = document.querySelector('.step-content-scroll');
            if (scrollEl) scrollEl.scrollTop = 0;
        });

        OnboardingState.subscribe('loading', (loading) => {
            const listLoading = document.getElementById('listLoadingState');
            if (listLoading) {
                listLoading.classList.toggle('hidden', !loading);
            }
        });
    },

    // ==================== Sub-tabs ====================

    switchSubtab(subtab) {
        // Автосохранение при уходе из редактирования
        if (OnboardingState.get('view') === 'edit' && subtab !== 'edit') {
            this._autoSaveDraft();
        }

        // Update buttons (only list/new visible in tabs)
        document.querySelectorAll('.sub-tabs .sub-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === subtab);
        });

        // Hide all sub-tab contents
        document.querySelectorAll('.sub-tab-content').forEach(el => {
            el.classList.remove('active');
        });

        // Show selected
        const target = document.getElementById('subtab-' + subtab);
        if (target) target.classList.add('active');

        OnboardingState.set('view', subtab);

        // "Новая заявка" — рендерим поля Шага 1 в форму создания
        if (subtab === 'new') {
            this._renderNewRequestForm();
        }

        // Refresh list when going back to list
        if (subtab === 'list') {
            OnboardingList.applyFilters();
        }
    },

    // ==================== Navigation ====================

    openDetail(requestId) {
        this._autoSaveDraft();

        const requests = OnboardingState.get('requests') || [];
        const request = requests.find(r => r.id === requestId);
        if (!request) return;

        // autoSubmit шаг: автопереход executor → reviewer (только начальная фаза)
        const currentStage = OnboardingConfig.getStage(request.currentStageNumber);
        if (currentStage?.autoSubmit && request.status === 'executor') {
            const phase = request.stageData?.[request.currentStageNumber]?.phase;
            if (!phase) {
                request.status = 'reviewer';
                request.currentRole = currentStage.reviewerRole;
                OnboardingState.set('requests', [...OnboardingState.get('requests')]);
                this._saveRequests();
            }
        }

        const userRole = OnboardingState.get('userRole');
        const userEmail = OnboardingState.get('userEmail');
        const isOwner = request.createdBy === userEmail || request.assigneeEmail === userEmail;
        const isRoleExecutor = OnboardingConfig.isExecutor(request.currentStageNumber, userRole);
        const isRoleReviewer = OnboardingConfig.isReviewer(request.currentStageNumber, userRole);
        let canEdit = isOwner && isRoleExecutor && (request.status === 'executor' || request.status === 'revision');

        // Step 3 Phase waiting: reviewer заполняет login/password → открыть в edit mode
        if (request.currentStageNumber === 3 && request.status === 'reviewer' &&
            request.stageData?.[3]?.phase === 'waiting' && isRoleReviewer) {
            canEdit = true;
        }

        // Step 5 Phase waiting: reviewer заполняет login/password мессенджера → открыть в edit mode
        if (request.currentStageNumber === 5 && request.status === 'reviewer' &&
            request.stageData?.[5]?.phase === 'waiting' && isRoleReviewer) {
            canEdit = true;
        }

        // Step 6: noApproval, executorRole=assistant (не является владельцем заявки)
        if (request.currentStageNumber === 6 && isRoleExecutor &&
            (request.status === 'executor' || request.status === 'revision')) {
            canEdit = true;
        }

        OnboardingState.set('currentRequest', request);

        if (canEdit) {
            // Executor: open in steps editor mode
            document.querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
            document.getElementById('subtab-edit')?.classList.add('active');
            document.querySelectorAll('.sub-tabs .sub-tab').forEach(btn => btn.classList.remove('active'));

            OnboardingState.set('view', 'edit');
            OnboardingState.set('currentStep', request.currentStageNumber);
            OnboardingSteps.render('stepsIndicator', request.currentStageNumber);
            OnboardingSteps.updateStepInfo(request.currentStageNumber);
            OnboardingSteps.updateActionButtons(request.currentStageNumber, request);
            OnboardingForm.renderStepForm(request.currentStageNumber);

            // Fill form with existing data
            if (request.stageData?.[request.currentStageNumber]) {
                OnboardingForm.fillFormData(request.currentStageNumber, request.stageData[request.currentStageNumber]);
            }
        } else {
            // Reviewer/readonly: open detail view
            document.querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
            document.getElementById('subtab-detail')?.classList.add('active');
            document.querySelectorAll('.sub-tabs .sub-tab').forEach(btn => btn.classList.remove('active'));

            OnboardingState.set('view', 'detail');
            OnboardingState.set('detailStep', request.currentStageNumber);
            OnboardingReview.renderDetail(request);
        }
    },

    backToList() {
        // _autoSaveDraft вызывается из switchSubtab при уходе из edit
        OnboardingState.set('detailStep', null);
        this.switchSubtab('list');
        OnboardingState.set('currentRequest', null);
        OnboardingList.applyFilters();
    },

    /** Автосохранение черновика при уходе из формы (без toast/redirect) */
    _autoSaveDraft() {
        const view = OnboardingState.get('view');
        if (view !== 'edit') return;

        const step = OnboardingState.get('currentStep');
        const request = OnboardingState.get('currentRequest');
        if (!request || !step) return;

        const stage = OnboardingConfig.getStage(step);
        if (!stage?.fields || stage.fields.length === 0) return;

        const formData = OnboardingForm.collectFormData(step);

        // Не сохранять пустую форму
        const hasData = Object.values(formData).some(v =>
            v !== '' && v !== false && v !== null && v !== undefined &&
            !(Array.isArray(v) && v.length === 0) &&
            !(typeof v === 'object' && Object.keys(v).length === 0)
        );
        if (!hasData) return;

        if (!request.stageData) request.stageData = {};
        // Merge чтобы сохранить internal поля (phase и др.)
        request.stageData[step] = { ...request.stageData[step], ...formData };

        // Обновить title из источника лида (Шаг 1)
        if (step === 1 && formData.lead_source) {
            request.title = OnboardingConfig.getLeadSourceLabel(formData.lead_source);
        }

        this._saveRequests();
    },

    // ==================== Steps ====================

    goToStep(stepNumber) {
        const view = OnboardingState.get('view');
        if (view === 'edit') {
            this._autoSaveDraft();
        }
        if (view === 'detail') {
            // Detail view: переключаем шаг для просмотра
            const num = parseInt(stepNumber, 10);
            OnboardingState.set('detailStep', num);
            const request = OnboardingState.get('currentRequest');
            if (request) {
                // Определить completedSteps
                const completedSteps = [];
                for (const stage of OnboardingConfig.stages) {
                    if (stage.number < request.currentStageNumber) {
                        completedSteps.push(stage.number);
                    }
                }
                if (request.status === 'completed') {
                    completedSteps.push(request.currentStageNumber);
                }
                OnboardingSteps.render('detailSteps', num, completedSteps);
                OnboardingReview.renderDetailStep(request, num);
                OnboardingReview._updateDetailActions(request);
            }
        } else {
            OnboardingSteps.goToStep(stepNumber);
        }
    },

    // ==================== Actions ====================

    /** Рендер полей Шага 1 в форму создания */
    _renderNewRequestForm() {
        const container = document.getElementById('newRequestFields');
        if (!container) return;

        const stage = OnboardingConfig.getStage(1);
        if (!stage || !stage.fields) return;

        // Рендерим поля Шага 1 (без step header / step indicator)
        const fieldsHtml = stage.fields
            .filter(f => f.type !== 'readonly')
            .map(field => OnboardingForm._renderField(field, 1, {}))
            .join('');

        container.innerHTML = `<div class="step-form-fields">${fieldsHtml}</div>`;

        // Привязка условных обработчиков (showWhen для reject_reason)
        OnboardingForm._bindConditionalHandlers(1);
    },

    /** Создать заявку из формы "Новая заявка" */
    createRequest() {
        // Собрать данные из формы создания (поля Шага 1 в #newRequestFields)
        const stage = OnboardingConfig.getStage(1);
        if (!stage || !stage.fields) return;

        const formData = {};
        for (const field of stage.fields) {
            if (field.type === 'readonly') continue;
            if (field.type === 'list') {
                formData[field.id] = OnboardingForm._collectListData(field.id);
                continue;
            }
            if (field.type === 'file') {
                formData[field.id] = OnboardingForm._fileDataUrls[field.id] || '';
                continue;
            }
            const el = document.getElementById(`field_${field.id}`);
            if (!el) continue;
            formData[field.id] = field.type === 'checkbox' ? el.checked : el.value;
        }

        // Валидация: источник лида обязателен
        if (!formData.lead_source) {
            Toast.error('Выберите источник лида');
            document.getElementById('field_lead_source')?.focus();
            return;
        }

        const userEmail = OnboardingState.get('userEmail');
        const userName = typeof AuthGuard !== 'undefined' && AuthGuard.user ? AuthGuard.user.name : userEmail;
        const id = this._getNextId();
        const sourceLabel = OnboardingConfig.getLeadSourceLabel(formData.lead_source);

        const request = {
            id,
            title: sourceLabel,
            templateId: OnboardingConfig.TEMPLATE_ID,
            currentStageNumber: 1,
            totalStages: OnboardingConfig.totalStages,
            currentAssignee: userEmail,
            currentRole: 'sales',
            status: 'executor',
            createdBy: userEmail,
            createdDate: new Date().toISOString(),
            assigneeEmail: userEmail,
            assigneeName: userName,
            assigneeAvatar: '',
            stageData: { 1: formData },
            history: []
        };

        const requests = OnboardingState.get('requests') || [];
        requests.push(request);
        OnboardingState.set('requests', [...requests]);
        this._saveRequests();

        // Очистить форму создания (предотвращает дублирование ID полей с формой редактирования)
        const newFields = document.getElementById('newRequestFields');
        if (newFields) newFields.innerHTML = '';

        Toast.success('Заявка создана: ' + id);
        this.backToList();
    },

    saveDraft() {
        const step = OnboardingState.get('currentStep');
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        // Steps 2+: cancel mode check (ignored/refused via lead status pills)
        if (step > 1) {
            const leadStatusInput = document.getElementById('field_lead_status');
            const leadStatus = leadStatusInput?.value;
            if (leadStatus === 'ignored' || leadStatus === 'refused') {
                this._executeCancelFromLeadStatus(leadStatus);
                return;
            }
        }

        // Step 3: фазовый обработчик
        if (step === 3) {
            this._handleStep3Action();
            return;
        }

        // Step 4: фазовый обработчик (антифрод + пополнение)
        if (step === 4) {
            this._handleStep4Action();
            return;
        }

        // Step 5: фазовый обработчик (мессенджер)
        if (step === 5) {
            this._handleStep5Action();
            return;
        }

        // Step 6: финализация карточки
        if (step === 6) {
            this._handleStep6Action();
            return;
        }

        const formData = OnboardingForm.collectFormData(step);

        // Сохранить данные шага в stageData (merge для сохранения internal полей)
        if (!request.stageData) request.stageData = {};
        request.stageData[step] = { ...request.stageData[step], ...formData };

        // Обновить title из источника лида (Шаг 1)
        if (step === 1 && formData.lead_source) {
            request.title = OnboardingConfig.getLeadSourceLabel(formData.lead_source);
        }

        // noApproval шаг: проверяем статус лида для перехода
        const stage = OnboardingConfig.getStage(step);
        if (stage?.noApproval && this._checkAutoTransition(request, step, formData)) {
            return; // Переход выполнен
        }

        this._saveRequests();
    },

    /** Проверка автоперехода для noApproval шагов (Шаг 1: "В переписке" → Шаг 2) */
    _checkAutoTransition(request, stageNumber, formData) {
        if (stageNumber !== 1) return false;

        const leadStatus = formData.lead_status;

        // "Игнор" или "Отказ" → закрытие заявки
        if (leadStatus === 'ignored' || leadStatus === 'refused') {
            // Для "Отказ" проверяем причину
            if (leadStatus === 'refused' && !formData.reject_reason?.trim()) {
                Toast.error('Укажите причину отказа');
                document.getElementById('field_reject_reason')?.focus();
                return false;
            }

            request.status = 'cancelled';
            request.stageData[stageNumber] = formData;

            // Обновить title из источника лида
            if (formData.lead_source) {
                request.title = OnboardingConfig.getLeadSourceLabel(formData.lead_source);
            }

            if (!request.history) request.history = [];
            request.history.push({
                stageNumber: 1,
                stageName: 'Входящий лид',
                action: leadStatus === 'refused' ? 'reject' : 'complete',
                actorEmail: OnboardingState.get('userEmail'),
                timestamp: new Date().toISOString(),
                comment: leadStatus === 'refused'
                    ? 'Отказ: ' + (formData.reject_reason || '')
                    : 'Игнор'
            });

            OnboardingState.set('requests', [...OnboardingState.get('requests')]);
            this._saveRequests();
            Toast.info(leadStatus === 'refused' ? 'Заявка отклонена' : 'Заявка закрыта (игнор)');
            this.backToList();
            return true;
        }

        // "В переписке" → автопереход к Шагу 2
        if (leadStatus === 'in_conversation') {
            // Валидация oneOf: tg_username или phone
            if (!formData.tg_username?.trim() && !formData.phone?.trim()) {
                Toast.error('Заполните хотя бы одно из полей: "Юзернейм ТГ" или "Номер телефона"');
                return false;
            }

            request.stageData[stageNumber] = formData;
            request.currentStageNumber = 2;
            request.status = 'executor';
            request.currentRole = 'sales';

            // Обновить title из источника лида
            if (formData.lead_source) {
                request.title = OnboardingConfig.getLeadSourceLabel(formData.lead_source);
            }

            if (!request.history) request.history = [];
            request.history.push({
                stageNumber: 1,
                stageName: 'Входящий лид',
                action: 'approve',
                actorEmail: OnboardingState.get('userEmail'),
                timestamp: new Date().toISOString(),
                comment: 'Статус "В переписке" — автопереход'
            });

            OnboardingState.set('requests', [...OnboardingState.get('requests')]);
            this._saveRequests();
            Toast.success('Лид в переписке — переход к Шагу 2: Полная информация');

            // Переключить на шаг 2
            OnboardingState.set('currentStep', 2);
            OnboardingSteps.render('stepsIndicator', 2);
            OnboardingSteps.updateStepInfo(2);
            OnboardingSteps.updateActionButtons(2, request);
            OnboardingForm.renderStepForm(2);
            return true;
        }

        return false;
    },

    // ==================== Step 3 Phases ====================

    /** Роутер по фазам Шага 3 */
    _handleStep3Action() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const formData = OnboardingForm.collectFormData(3);
        const phase = request.stageData?.[3]?.phase || '';
        const userRole = OnboardingState.get('userRole');
        const isReviewer = OnboardingConfig.isReviewer(3, userRole);
        const isExecutor = OnboardingConfig.isExecutor(3, userRole);

        if (!phase && formData.account_creator === 'reviewer' && isExecutor) {
            this._requestAccountCreation(request, formData);
        } else if (!phase && formData.account_creator === 'partner' && isExecutor) {
            this._partnerCreatesAccount(request, formData);
        } else if (phase === 'waiting' && isReviewer) {
            this._sendAccountData(request, formData);
        } else if (phase === 'created' && isExecutor) {
            this._confirmPartnerFilled(request, formData);
        }
    },

    /** Фаза 1: Sales запрашивает создание аккаунта → reviewer */
    _requestAccountCreation(request, formData) {
        if (!formData.account_creator) {
            Toast.error('Выберите, кто создаёт аккаунт');
            return;
        }

        if (!request.stageData) request.stageData = {};
        request.stageData[3] = {
            ...formData,
            phase: 'waiting'
        };
        request.status = 'reviewer';

        if (!request.history) request.history = [];
        request.history.push({
            stageNumber: 3,
            stageName: 'Аккаунт и ЛК',
            action: 'request_account',
            actorEmail: OnboardingState.get('userEmail'),
            timestamp: new Date().toISOString(),
            comment: 'Запрос на создание аккаунта'
        });

        OnboardingState.set('requests', [...OnboardingState.get('requests')]);
        this._saveRequests();
        Toast.success('Запрос на создание аккаунта отправлен');
        this._switchToDetailView(request);
    },

    /** Фаза 1b: Партнёр создаёт аккаунт сам → сразу phase: created */
    _partnerCreatesAccount(request, formData) {
        if (!request.stageData) request.stageData = {};
        request.stageData[3] = {
            ...formData,
            phase: 'created'
        };

        if (!request.history) request.history = [];
        request.history.push({
            stageNumber: 3,
            stageName: 'Аккаунт и ЛК',
            action: 'partner_creates_account',
            actorEmail: OnboardingState.get('userEmail'),
            timestamp: new Date().toISOString(),
            comment: 'Партнёр создаёт аккаунт самостоятельно'
        });

        OnboardingState.set('requests', [...OnboardingState.get('requests')]);
        this._saveRequests();
        Toast.success('Ожидаем заполнения профиля партнёром');

        // Перерисовать форму с обновлённой фазой
        OnboardingForm.renderStepForm(3);
        if (request.stageData[3]) {
            OnboardingForm.fillFormData(3, request.stageData[3]);
        }
    },

    /** Фаза 2: Reviewer заполнил login/password → отправить обратно sales */
    _sendAccountData(request, formData) {
        if (!formData.account_login?.trim()) {
            Toast.error('Заполните логин аккаунта');
            document.getElementById('field_account_login')?.focus();
            return;
        }
        if (!formData.account_password?.trim()) {
            Toast.error('Заполните пароль аккаунта');
            document.getElementById('field_account_password')?.focus();
            return;
        }

        if (!request.stageData) request.stageData = {};
        request.stageData[3] = {
            ...request.stageData[3],
            ...formData,
            phase: 'created'
        };
        request.status = 'executor';

        if (!request.history) request.history = [];
        request.history.push({
            stageNumber: 3,
            stageName: 'Аккаунт и ЛК',
            action: 'account_created',
            actorEmail: OnboardingState.get('userEmail'),
            timestamp: new Date().toISOString(),
            comment: 'Аккаунт создан'
        });

        OnboardingState.set('requests', [...OnboardingState.get('requests')]);
        this._saveRequests();
        Toast.success('Данные аккаунта отправлены');
        this._switchToDetailView(request);
    },

    /** Фаза 3: Sales подтверждает что партнёр заполнил профиль → reviewer */
    _confirmPartnerFilled(request, formData) {
        // Валидация: все чекбоксы должны быть отмечены
        const clData = formData.profile_checklist;
        if (clData) {
            const vals = clData.values || clData;
            const unchecked = Object.entries(vals).filter(([, v]) => v === false);
            if (unchecked.length > 0) {
                Toast.warning('Отметьте все пункты чеклиста перед отправкой на проверку');
                return;
            }
        }

        if (!request.stageData) request.stageData = {};

        // Скопировать существующие threads
        const existingChecklist = request.stageData[3]?.profile_checklist;
        const threads = existingChecklist?.threads ? JSON.parse(JSON.stringify(existingChecklist.threads)) : {};

        // Добавить ответы sales в threads
        const checklist = formData.profile_checklist;
        if (checklist) {
            const replies = checklist.replies || {};
            const values = checklist.values || checklist;

            for (const [idx, text] of Object.entries(replies)) {
                if (!text) continue;
                if (!threads[idx]) threads[idx] = [];
                threads[idx].push({ role: 'sales', text, date: new Date().toISOString() });
            }

            // Собрать чистый формат (values + threads)
            formData.profile_checklist = { values };
            if (Object.keys(threads).length > 0) {
                formData.profile_checklist.threads = threads;
            }
        }

        request.stageData[3] = {
            ...request.stageData[3],
            ...formData,
            phase: 'filled'
        };
        request.status = 'reviewer';

        if (!request.history) request.history = [];
        request.history.push({
            stageNumber: 3,
            stageName: 'Аккаунт и ЛК',
            action: 'partner_filled',
            actorEmail: OnboardingState.get('userEmail'),
            timestamp: new Date().toISOString(),
            comment: 'Партнёр заполнил профиль'
        });

        OnboardingState.set('requests', [...OnboardingState.get('requests')]);
        this._saveRequests();
        Toast.success('Отправлено на проверку чеклиста');
        this._switchToDetailView(request);
    },

    // ==================== Step 4 Phases ====================

    /** Роутер по фазам Шага 4 (пополнение) */
    _handleStep4Action() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const afData = request.stageData?.[4] || {};

        if (afData.phase === 'approved') {
            // Sales подтверждает пополнение партнёра
            if (!request.stageData) request.stageData = {};
            request.stageData[4] = { ...request.stageData[4], phase: 'deposit_ok' };
            request.status = 'reviewer';
            request.currentRole = OnboardingConfig.getStage(4)?.reviewerRole || 'assistant';

            if (!request.history) request.history = [];
            request.history.push({
                stageNumber: 4,
                stageName: 'Антифрод проверка',
                action: 'deposit_confirmed',
                actorEmail: OnboardingState.get('userEmail'),
                timestamp: new Date().toISOString(),
                comment: 'Партнёр пополнился'
            });

            OnboardingState.set('requests', [...OnboardingState.get('requests')]);
            this._saveRequests();
            Toast.success('Отправлено на проверку пополнения');
            this._switchToDetailView(request);
        }
    },

    // ==================== Step 5 Phases ====================

    /** Роутер по фазам Шага 5 (мессенджер) */
    _handleStep5Action() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const phase = request.stageData?.[5]?.phase || '';
        const userRole = OnboardingState.get('userRole');
        const isReviewer = OnboardingConfig.isReviewer(5, userRole);
        const isExecutor = OnboardingConfig.isExecutor(5, userRole);

        if (!phase && isExecutor) {
            this._requestMessengerCreation(request);
        } else if (phase === 'waiting' && isReviewer) {
            this._sendMessengerData(request);
        } else if (phase === 'created' && isExecutor) {
            this._confirmPartnerLoggedIn(request);
        }
    },

    /** Фаза 1: Sales запрашивает создание аккаунта мессенджера → reviewer */
    _requestMessengerCreation(request) {
        if (!request.stageData) request.stageData = {};
        request.stageData[5] = {
            ...request.stageData[5],
            phase: 'waiting'
        };
        request.status = 'reviewer';

        if (!request.history) request.history = [];
        request.history.push({
            stageNumber: 5,
            stageName: 'Корп. мессенджер',
            action: 'request_messenger',
            actorEmail: OnboardingState.get('userEmail'),
            timestamp: new Date().toISOString(),
            comment: 'Запрос на создание аккаунта'
        });

        OnboardingState.set('requests', [...OnboardingState.get('requests')]);
        this._saveRequests();
        Toast.success('Запрос на создание аккаунта отправлен');
        this._switchToDetailView(request);
    },

    /** Фаза 2: Reviewer заполнил login/password → отправить обратно sales */
    _sendMessengerData(request) {
        const formData = OnboardingForm.collectFormData(5);

        if (!formData.messenger_login?.trim()) {
            Toast.error('Заполните логин');
            document.getElementById('field_messenger_login')?.focus();
            return;
        }
        if (!formData.messenger_password?.trim()) {
            Toast.error('Заполните пароль');
            document.getElementById('field_messenger_password')?.focus();
            return;
        }

        if (!request.stageData) request.stageData = {};
        request.stageData[5] = {
            ...request.stageData[5],
            ...formData,
            phase: 'created'
        };
        request.status = 'executor';

        if (!request.history) request.history = [];
        request.history.push({
            stageNumber: 5,
            stageName: 'Корп. мессенджер',
            action: 'messenger_created',
            actorEmail: OnboardingState.get('userEmail'),
            timestamp: new Date().toISOString(),
            comment: 'Аккаунт создан'
        });

        OnboardingState.set('requests', [...OnboardingState.get('requests')]);
        this._saveRequests();
        Toast.success('Данные аккаунта отправлены');
        this._switchToDetailView(request);
    },

    /** Фаза 3: Sales подтверждает что партнёр зашёл в мессенджер → на проверку */
    _confirmPartnerLoggedIn(request) {
        if (!request.stageData) request.stageData = {};
        request.stageData[5] = {
            ...request.stageData[5],
            phase: 'logged'
        };
        request.status = 'reviewer';

        if (!request.history) request.history = [];
        request.history.push({
            stageNumber: 5,
            stageName: 'Корп. мессенджер',
            action: 'partner_logged_in',
            actorEmail: OnboardingState.get('userEmail'),
            timestamp: new Date().toISOString(),
            comment: 'Партнёр зашёл в мессенджер'
        });

        OnboardingState.set('requests', [...OnboardingState.get('requests')]);
        this._saveRequests();
        Toast.success('Подтверждение отправлено на проверку');
        this._switchToDetailView(request);
    },

    // ==================== Step 6 Phases ====================

    /** Шаг 6: Финализация карточки (ассистент заполняет и создаёт) */
    _handleStep6Action() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const formData = OnboardingForm.collectFormData(6);

        if (!formData.subagent?.trim()) {
            Toast.error('Заполните имя субагента');
            document.getElementById('field_subagent')?.focus();
            return;
        }
        if (!formData.subagentId?.trim()) {
            Toast.error('Заполните номер субагента');
            document.getElementById('field_subagentId')?.focus();
            return;
        }
        if (!formData.method?.trim()) {
            Toast.error('Заполните метод');
            document.getElementById('field_method')?.focus();
            return;
        }

        if (!request.stageData) request.stageData = {};
        request.stageData[6] = formData;

        // Advance to Step 7 (auto) → completed
        request.currentStageNumber = 7;
        request.status = 'completed';
        request.currentRole = 'system';

        if (!request.history) request.history = [];
        request.history.push({
            stageNumber: 6,
            stageName: 'Финализация карточки',
            action: 'finalize_card',
            actorEmail: OnboardingState.get('userEmail'),
            timestamp: new Date().toISOString(),
            comment: `Карточка: ${formData.subagent} (${formData.subagentId})`
        });

        OnboardingState.set('requests', [...OnboardingState.get('requests')]);
        this._saveRequests();
        Toast.success('Карточка партнёра создана!');
        this.backToList();
    },

    // ==================== Rollback ====================

    async onRollbackSelect() {
        const select = document.getElementById('rollbackStepSelect');
        const targetStep = parseInt(select?.value);
        if (!targetStep) return;

        const request = OnboardingState.get('currentRequest');
        if (!request || targetStep >= request.currentStageNumber) {
            if (select) select.value = '';
            return;
        }

        const targetStage = OnboardingConfig.getStage(targetStep);
        if (!targetStage) { select.value = ''; return; }

        const confirmed = await this._confirm(
            'Откат заявки',
            `Откатить заявку на Шаг ${targetStep}: ${targetStage.shortName || targetStage.name}?`
        );

        if (!confirmed) {
            select.value = '';
            return;
        }

        const comment = this._getReviewComment();
        const userEmail = OnboardingState.get('userEmail');
        const fromStep = request.currentStageNumber;

        // Для фазовых шагов: сбросить phase
        if (request.stageData?.[targetStep]) {
            delete request.stageData[targetStep].phase;
        }

        request.currentStageNumber = targetStep;
        request.status = targetStage.autoSubmit ? 'executor' : 'revision';
        request.currentRole = targetStage.executorRole;

        if (!request.history) request.history = [];
        request.history.push({
            stageNumber: fromStep,
            stageName: OnboardingConfig.getStage(fromStep)?.name || `Шаг ${fromStep}`,
            action: 'rollback',
            actorEmail: userEmail,
            timestamp: new Date().toISOString(),
            comment: comment,
            rollbackTo: targetStep
        });

        this._clearReviewComment();

        OnboardingState.set('requests', [...OnboardingState.get('requests')]);
        this._saveRequests();
        Toast.info(`Заявка откачена на Шаг ${targetStep}`);
        this.backToList();
    },

    submitForReview() {
        const step = OnboardingState.get('currentStep');
        if (!OnboardingForm.validate(step)) return;

        const request = OnboardingState.get('currentRequest');
        const formData = OnboardingForm.collectFormData(step);

        if (request) {
            if (!request.stageData) request.stageData = {};
            request.stageData[step] = { ...request.stageData[step], ...formData };
            request.status = 'reviewer';
            OnboardingState.set('requests', [...OnboardingState.get('requests')]);
            this._saveRequests();
        }

        Toast.success('Отправлено на проверку');

        // Остаёмся на карточке → переключаем в detail view
        this._switchToDetailView(request);
    },

    approveStep() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const userEmail = OnboardingState.get('userEmail');
        const stage = OnboardingConfig.getStage(request.currentStageNumber);

        // Step 3: собрать checklist перед approve
        if (request.currentStageNumber === 3 && request.stageData?.[3]?.phase === 'filled') {
            const view = OnboardingState.get('view');
            if (view === 'edit') {
                const formData = OnboardingForm.collectFormData(3);
                if (formData.profile_checklist) {
                    request.stageData[3].profile_checklist = formData.profile_checklist;
                }
            } else {
                const checklistData = this._collectDetailChecklist();
                if (checklistData) {
                    request.stageData[3].profile_checklist = checklistData;
                }
            }
        }

        // Шаг 4: фазовый workflow (антифрод + пополнение)
        if (request.currentStageNumber === 4) {
            if (!request.stageData) request.stageData = {};
            const afData = request.stageData[4] || {};

            if (afData.phase === 'deposit_ok') {
                // Пополнение подтверждено → продолжить к обычной логике перехода ниже
            } else {
                // Phase 1: Антифрод одобрен → ожидание пополнения партнёром
                request.stageData[4] = {
                    ...request.stageData[4],
                    phase: 'approved'
                };

                if (!request.history) request.history = [];
                request.history.push({
                    stageNumber: 4,
                    stageName: 'Антифрод проверка',
                    action: 'approve',
                    actorEmail: userEmail,
                    timestamp: new Date().toISOString(),
                    comment: this._getReviewComment() || 'Антифрод одобрен'
                });

                request.status = 'executor';
                request.currentRole = 'sales';

                this._clearReviewComment();

                OnboardingState.set('requests', [...OnboardingState.get('requests')]);
                this._saveRequests();
                Toast.success('Антифрод одобрен. Ожидание пополнения партнёра.');
                this.backToList();
                return;
            }
        }

        // Добавить в историю
        if (!request.history) request.history = [];
        request.history.push({
            stageNumber: request.currentStageNumber,
            stageName: stage?.name || `Шаг ${request.currentStageNumber}`,
            action: 'approve',
            actorEmail: userEmail,
            timestamp: new Date().toISOString(),
            comment: this._getReviewComment()
        });

        // Перейти к следующему шагу или завершить
        const nextStageNumber = request.currentStageNumber + 1;
        const nextStage = OnboardingConfig.getStage(nextStageNumber);

        if (nextStageNumber > OnboardingConfig.totalStages || !nextStage) {
            // Все шаги пройдены
            request.status = 'completed';
            request.completedDate = new Date().toISOString();
            Toast.success('Заявка завершена! Партнёр заведён.');
        } else if (nextStage.auto) {
            // Следующий шаг автоматический — выполняем и завершаем
            request.currentStageNumber = nextStageNumber;
            request.status = 'completed';
            request.completedDate = new Date().toISOString();
            request.history.push({
                stageNumber: nextStageNumber,
                stageName: nextStage.name,
                action: 'complete',
                actorEmail: 'system',
                timestamp: new Date().toISOString(),
                comment: 'Карточка партнёра создана автоматически'
            });
            Toast.success('Заявка завершена! Карточка партнёра создана.');
        } else if (nextStage.autoSubmit) {
            // autoSubmit шаг — сразу на ревью без заполнения формы
            request.currentStageNumber = nextStageNumber;
            request.status = 'reviewer';
            request.currentRole = nextStage.reviewerRole;
            Toast.success('Шаг одобрен. ' + nextStage.name + ' — ожидает проверки.');
        } else {
            request.currentStageNumber = nextStageNumber;
            request.status = 'executor';
            request.currentRole = nextStage.executorRole;
            Toast.success('Шаг одобрен. Переход к: ' + nextStage.name);
        }

        this._clearReviewComment();

        OnboardingState.set('requests', [...OnboardingState.get('requests')]);
        this._saveRequests();
        this.backToList();
    },

    rejectStep() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const comment = this._getReviewComment();
        const userEmail = OnboardingState.get('userEmail');
        const stage = OnboardingConfig.getStage(request.currentStageNumber);

        // Step 4: фазовый reject
        if (request.currentStageNumber === 4) {
            const afData = request.stageData?.[4] || {};

            // Phase 3: Пополнение не подтверждено → вернуть sales
            if (afData.phase === 'deposit_ok') {
                if (!request.stageData) request.stageData = {};
                request.stageData[4] = { ...request.stageData[4], phase: 'approved' };
                request.status = 'executor';

                if (!request.history) request.history = [];
                request.history.push({
                    stageNumber: 4,
                    stageName: 'Антифрод проверка',
                    action: 'reject',
                    actorEmail: userEmail,
                    timestamp: new Date().toISOString(),
                    comment: comment || 'Пополнение не подтверждено'
                });

                this._clearReviewComment();

                OnboardingState.set('requests', [...OnboardingState.get('requests')]);
                this._saveRequests();
                Toast.info('Пополнение не подтверждено');
                this.backToList();
                return;
            }

            // Phase 1: Антифрод — двойной reject (публичный + внутренний комментарий)
            const publicComment = this._getReviewComment();
            const internalComment = document.getElementById('reviewInternalComment')?.value?.trim() || '';

            if (!request.stageData) request.stageData = {};
            request.stageData[4] = {
                ...request.stageData[4],
                phase: 'check',
                af_public_reason: publicComment,
                af_internal_reason: internalComment
            };

            request.status = 'declined';

            if (!request.history) request.history = [];
            request.history.push({
                stageNumber: 4,
                stageName: 'Антифрод проверка',
                action: 'reject',
                actorEmail: userEmail,
                timestamp: new Date().toISOString(),
                comment: publicComment,
                internalComment: internalComment
            });

            this._clearReviewComment();
            const internalEl = document.getElementById('reviewInternalComment');
            if (internalEl) internalEl.value = '';

            OnboardingState.set('requests', [...OnboardingState.get('requests')]);
            this._saveRequests();
            Toast.info('Антифрод: партнёр отклонён');
            this.backToList();
            return;
        }

        // Step 3 Phase 4: reject → вернуть в phase: created (sales просит партнёра исправить)
        if (request.currentStageNumber === 3 && request.stageData?.[3]?.phase === 'filled') {
            // Валидация: хотя бы один чекбокс должен быть снят
            const checklistContainer = document.getElementById('detailEditableChecklist');
            if (checklistContainer) {
                const checks = checklistContainer.querySelectorAll('.checklist-check');
                const allChecked = Array.from(checks).every(c => c.checked);
                if (checks.length > 0 && allChecked) {
                    Toast.warning('Снимите чекбокс у проблемного пункта, чтобы Sales видел что исправить');
                    return;
                }
            }

            // Валидация: нужен комментарий (основной ИЛИ к снятому пункту чеклиста)
            let hasComment = !!comment;
            if (!hasComment && checklistContainer) {
                checklistContainer.querySelectorAll('.checklist-comment-input').forEach(input => {
                    const check = checklistContainer.querySelector(`.checklist-check[data-index="${input.dataset.index}"]`);
                    if (check && !check.checked && input.value.trim()) {
                        hasComment = true;
                    }
                });
            }
            if (!hasComment) {
                Toast.warning('Укажите комментарий — к проблемному пункту или в общем поле');
                const view = OnboardingState.get('view');
                const commentId = view === 'detail' ? 'detailReviewComment' : 'reviewComment';
                document.getElementById(commentId)?.focus();
                return;
            }

            // Собрать checklist с замечаниями (из edit или detail view)
            const view = OnboardingState.get('view');
            if (view === 'edit') {
                const formData = OnboardingForm.collectFormData(3);
                if (formData.profile_checklist) {
                    request.stageData[3].profile_checklist = formData.profile_checklist;
                }
            } else {
                const checklistData = this._collectDetailChecklist();
                if (checklistData) {
                    request.stageData[3].profile_checklist = checklistData;
                }
            }

            request.stageData[3].phase = 'created';
            request.status = 'revision';

            if (!request.history) request.history = [];
            request.history.push({
                stageNumber: 3,
                stageName: 'Аккаунт и ЛК',
                action: 'reject',
                actorEmail: userEmail,
                timestamp: new Date().toISOString(),
                comment: comment || 'Чеклист не пройден'
            });

            this._clearReviewComment();

            OnboardingState.set('requests', [...OnboardingState.get('requests')]);
            this._saveRequests();
            Toast.info('Отправлено на доработку' + (comment ? ': ' + comment : ''));
            this.backToList();
            return;
        }

        // Добавить в историю
        if (!request.history) request.history = [];
        request.history.push({
            stageNumber: request.currentStageNumber,
            stageName: stage?.name || `Шаг ${request.currentStageNumber}`,
            action: 'reject',
            actorEmail: userEmail,
            timestamp: new Date().toISOString(),
            comment
        });

        request.status = 'revision';

        this._clearReviewComment();

        OnboardingState.set('requests', [...OnboardingState.get('requests')]);
        this._saveRequests();
        Toast.info('Шаг отклонён' + (comment ? ': ' + comment : ''));
        this.backToList();
    },

    /** Отозвать заявку с проверки → вернуть в черновик для редактирования */
    withdrawReview() {
        const request = OnboardingState.get('currentRequest');
        if (!request || request.status !== 'reviewer') return;

        request.status = 'executor';

        // Step 3: откат фазы waiting (executor отзывает запрос на создание)
        if (request.currentStageNumber === 3 && request.stageData?.[3]?.phase === 'waiting') {
            delete request.stageData[3].phase;
        }

        // Step 3: откат фазы filled → created (sales возвращается в Phase 3)
        if (request.currentStageNumber === 3 && request.stageData?.[3]?.phase === 'filled') {
            request.stageData[3].phase = 'created';
        }

        // Step 5: откат фазы waiting (sales отзывает запрос)
        if (request.currentStageNumber === 5 && request.stageData?.[5]?.phase === 'waiting') {
            delete request.stageData[5].phase;
        }

        // Step 5: откат фазы logged → created
        if (request.currentStageNumber === 5 && request.stageData?.[5]?.phase === 'logged') {
            request.stageData[5].phase = 'created';
        }

        if (!request.history) request.history = [];
        request.history.push({
            stageNumber: request.currentStageNumber,
            stageName: OnboardingConfig.getStage(request.currentStageNumber)?.name || `Шаг ${request.currentStageNumber}`,
            action: 'withdraw',
            actorEmail: OnboardingState.get('userEmail'),
            timestamp: new Date().toISOString(),
            comment: 'Отозвано с проверки'
        });

        OnboardingState.set('requests', [...OnboardingState.get('requests')]);
        this._saveRequests();
        Toast.info('Заявка отозвана с проверки');

        // Остаёмся на карточке → переключаем в edit view
        this._switchToEditView(request);
    },

    /** Восстановить отменённую заявку → executor */
    reactivateRequest() {
        const request = OnboardingState.get('currentRequest');
        if (!request || request.status !== 'cancelled') return;

        request.status = 'executor';

        // Restore lead_status to in_conversation
        if (request.stageData?.[1]) {
            request.stageData[1].lead_status = 'in_conversation';
        }

        if (!request.history) request.history = [];
        request.history.push({
            stageNumber: request.currentStageNumber,
            stageName: OnboardingConfig.getStage(request.currentStageNumber)?.name || `Шаг ${request.currentStageNumber}`,
            action: 'reactivate',
            actorEmail: OnboardingState.get('userEmail'),
            timestamp: new Date().toISOString(),
            comment: 'Заявка восстановлена'
        });

        OnboardingState.set('requests', [...OnboardingState.get('requests')]);
        this._saveRequests();
        Toast.success('Заявка восстановлена');
        this.backToList();
    },

    /** Полная отмена заявки (admin/leader) */
    cancelRequest() {
        this._confirm('Отменить заявку?', 'Это действие нельзя отменить.').then(ok => {
            if (!ok) return;

            const request = OnboardingState.get('currentRequest');
            if (request) {
                request.status = 'cancelled';
                OnboardingState.set('requests', [...OnboardingState.get('requests')]);
                this._saveRequests();
            }
            Toast.info('Заявка отменена');
            this.backToList();
        });
    },

    // ==================== Lead Status Pills ====================

    /** Клик по pill-кнопке статуса лида (all steps — same flow, edit + detail views) */
    selectLeadStatus(value) {
        const view = OnboardingState.get('view');
        const input = view === 'detail'
            ? document.getElementById('detailLeadStatus')
            : document.getElementById('field_lead_status');
        if (input) {
            input.value = value;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    },

    /** Закрытие заявки через pills в detail view */
    cancelViaLeadStatus() {
        const input = document.getElementById('detailLeadStatus');
        const value = input?.value;
        if (value === 'ignored' || value === 'refused') {
            this._executeCancelFromLeadStatus(value);
        }
    },

    /** Закрытие заявки через кнопку «Закрыть заявку» (edit + detail views) */
    _executeCancelFromLeadStatus(value) {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const isRefused = value === 'refused';
        // Find reject reason input (edit view or detail view)
        const reasonEl = document.getElementById('field_reject_reason_cancel') || document.getElementById('detailRejectReason');

        // Для "Отказ" проверяем причину
        if (isRefused) {
            const reason = reasonEl?.value?.trim();
            if (!reason) {
                Toast.error('Укажите причину отказа');
                reasonEl?.focus();
                return;
            }
        }

        // Auto-save current form data
        this._autoSaveDraft();

        if (!request.stageData) request.stageData = {};

        // Update lead_status in Step 1 data (for lead status tracking)
        if (!request.stageData[1]) request.stageData[1] = {};
        request.stageData[1].lead_status = value;

        // Save cancel_reason on the CURRENT step (where cancel was triggered)
        const cancelStep = request.currentStageNumber;
        if (isRefused) {
            if (!request.stageData[cancelStep]) request.stageData[cancelStep] = {};
            request.stageData[cancelStep].cancel_reason = reasonEl?.value?.trim() || '';
        }

        // Cancel request
        request.status = 'cancelled';

        if (!request.history) request.history = [];
        request.history.push({
            stageNumber: request.currentStageNumber,
            stageName: OnboardingConfig.getStage(request.currentStageNumber)?.name || `Шаг ${request.currentStageNumber}`,
            action: isRefused ? 'reject' : 'complete',
            actorEmail: OnboardingState.get('userEmail'),
            timestamp: new Date().toISOString(),
            comment: isRefused
                ? 'Отказ лида: ' + (reasonEl?.value?.trim() || '')
                : 'Игнор лида'
        });

        OnboardingState.set('requests', [...OnboardingState.get('requests')]);
        this._saveRequests();
        Toast.info(isRefused ? 'Заявка отклонена — лид отказался' : 'Заявка закрыта — лид не отвечает');
        this.backToList();
    },

    // ==================== List field actions ====================

    addListItem(fieldId) {
        OnboardingForm.addListItem(fieldId);
    },

    removeListItem(fieldIdIndex) {
        OnboardingForm.removeListItem(fieldIdIndex);
    },

    removeFile(fieldId) {
        OnboardingForm.removeFile(fieldId);
    },

    // ==================== Reassign ====================

    showReassignModal() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const info = document.getElementById('reassignInfo');
        if (info) {
            info.innerHTML = `
                Заявка: <strong>${Utils.escapeHtml(request.title)}</strong><br>
                Текущий менеджер: <strong>${Utils.escapeHtml(request.assigneeName || request.assigneeEmail || '—')}</strong>
            `;
        }

        // TODO: загружать реальный список sales из CloudStorage.getEmployees()
        const select = document.getElementById('reassignTarget');
        if (select) {
            select.innerHTML = '<option value="">Выберите менеджера...</option>';
        }

        document.getElementById('reassignModal')?.classList.add('active');
    },

    closeReassignModal() {
        document.getElementById('reassignModal')?.classList.remove('active');
    },

    confirmReassign() {
        const request = OnboardingState.get('currentRequest');
        if (!request) return;

        const targetEmail = document.getElementById('reassignTarget')?.value;
        const reason = document.getElementById('reassignReason')?.value;
        const comment = document.getElementById('reassignComment')?.value?.trim();

        if (!targetEmail) { Toast.error('Выберите менеджера'); return; }
        if (!reason) { Toast.error('Укажите причину'); return; }

        const userEmail = OnboardingState.get('userEmail');

        // Обновить заявку (mock)
        const oldAssignee = request.assigneeEmail;
        const targetSelect = document.getElementById('reassignTarget');
        const targetName = targetSelect?.options[targetSelect.selectedIndex]?.text?.split(' (')[0] || targetEmail;

        request.assigneeEmail = targetEmail;
        request.assigneeName = targetName;
        request.currentAssignee = targetEmail;

        // Добавить в историю
        if (!request.history) request.history = [];
        const reasonLabel = OnboardingConfig.getReasonLabel(reason);
        request.history.push({
            stageNumber: request.currentStageNumber,
            stageName: OnboardingConfig.getStage(request.currentStageNumber)?.name || '',
            action: 'reassign',
            actorEmail: userEmail,
            timestamp: new Date().toISOString(),
            comment: `${reasonLabel}. ${oldAssignee} → ${targetEmail}` + (comment ? `. ${comment}` : '')
        });

        // TODO: заменить на API reassignTask()
        OnboardingState.set('requests', [...OnboardingState.get('requests')]);
        this._saveRequests();
        Toast.success('Заявка передана: ' + targetName);
        this.closeReassignModal();
        this.backToList();
    },

    // ==================== Photo Lightbox ====================

    openPhoto(value) {
        // value не используется — src берём из кликнутого img
        // Обработка в click handler через e.target
    },

    /** Открыть lightbox с фото */
    _openPhotoLightbox(src, label) {
        // Удалить существующий lightbox
        this._closePhotoLightbox();

        const overlay = document.createElement('div');
        overlay.className = 'photo-lightbox';
        overlay.id = 'photoLightbox';
        overlay.innerHTML = `
            <img src="${src}" alt="${Utils.escapeHtml(label || '')}">
            ${label ? `<div class="photo-lightbox-label">${Utils.escapeHtml(label)}</div>` : ''}
        `;
        overlay.addEventListener('click', () => this._closePhotoLightbox());
        document.body.appendChild(overlay);

        // Escape handler
        this._lightboxEscHandler = (e) => {
            if (e.key === 'Escape') this._closePhotoLightbox();
        };
        document.addEventListener('keydown', this._lightboxEscHandler);
    },

    /** Закрыть lightbox */
    _closePhotoLightbox() {
        const el = document.getElementById('photoLightbox');
        if (el) el.remove();
        if (this._lightboxEscHandler) {
            document.removeEventListener('keydown', this._lightboxEscHandler);
            this._lightboxEscHandler = null;
        }
    },

    // ==================== Filters ====================

    applyFilters() {
        OnboardingList.applyFilters();
    },

    /** Собрать данные editable checklist из detail view (Step 3 Phase 4) */
    _collectDetailChecklist() {
        const container = document.getElementById('detailEditableChecklist');
        if (!container) return null;

        const values = {};
        container.querySelectorAll('.checklist-check').forEach(check => {
            values[check.dataset.index] = check.checked;
        });

        // Скопировать существующие threads
        const request = OnboardingState.get('currentRequest');
        const existing = request?.stageData?.[3]?.profile_checklist;
        const threads = existing?.threads ? JSON.parse(JSON.stringify(existing.threads)) : {};

        // Добавить новые комментарии ревьюера в threads
        container.querySelectorAll('.checklist-comment-input').forEach(input => {
            const text = input.value.trim();
            if (!text) return;
            const idx = input.dataset.index;
            if (!threads[idx]) threads[idx] = [];
            threads[idx].push({ role: 'reviewer', text, date: new Date().toISOString() });
        });

        const result = { values };
        if (Object.keys(threads).length > 0) result.threads = threads;
        return result;
    },

    // ==================== View switching ====================

    /** Переключить на detail view (readonly) без ухода из карточки */
    _switchToDetailView(request) {
        document.querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
        document.getElementById('subtab-detail')?.classList.add('active');
        document.querySelectorAll('.sub-tabs .sub-tab').forEach(btn => btn.classList.remove('active'));

        OnboardingState.set('view', 'detail');
        OnboardingState.set('detailStep', request.currentStageNumber);
        OnboardingReview.renderDetail(request);
    },

    /** Переключить на edit view (executor) без ухода из карточки */
    _switchToEditView(request) {
        document.querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
        document.getElementById('subtab-edit')?.classList.add('active');
        document.querySelectorAll('.sub-tabs .sub-tab').forEach(btn => btn.classList.remove('active'));

        OnboardingState.set('view', 'edit');
        OnboardingState.set('currentStep', request.currentStageNumber);
        OnboardingSteps.render('stepsIndicator', request.currentStageNumber);
        OnboardingSteps.updateStepInfo(request.currentStageNumber);
        OnboardingSteps.updateActionButtons(request.currentStageNumber, request);
        OnboardingForm.renderStepForm(request.currentStageNumber);

        if (request.stageData?.[request.currentStageNumber]) {
            OnboardingForm.fillFormData(request.currentStageNumber, request.stageData[request.currentStageNumber]);
        }
    },

    // ==================== Helpers ====================

    /** Получить комментарий ревьюера из текущего view (edit или detail) */
    _getReviewComment() {
        const view = OnboardingState.get('view');
        const id = view === 'detail' ? 'detailReviewComment' : 'reviewComment';
        return document.getElementById(id)?.value?.trim() || '';
    },

    /** Очистить комментарий ревьюера в текущем view */
    _clearReviewComment() {
        const view = OnboardingState.get('view');
        const id = view === 'detail' ? 'detailReviewComment' : 'reviewComment';
        const el = document.getElementById(id);
        if (el) el.value = '';
    },

    /** Очистка ресурсов при уходе со страницы */
    destroy() {
        this._closePhotoLightbox();
        if (this._clickHandler) document.removeEventListener('click', this._clickHandler);
        if (this._inputHandler) document.removeEventListener('input', this._inputHandler);
        if (this._changeHandler) document.removeEventListener('change', this._changeHandler);
        OnboardingForm._fileDataUrls = {};
        OnboardingForm._fileRemovedFlags = {};
        OnboardingState.reset();
    },

    _confirm(title, message) {
        return new Promise(resolve => {
            const modal = document.getElementById('confirmModal');
            const titleEl = document.getElementById('confirmTitle');
            const msgEl = document.getElementById('confirmMessage');
            const okBtn = document.getElementById('confirmOkBtn');
            const cancelBtn = document.getElementById('confirmCancelBtn');

            if (titleEl) titleEl.textContent = title;
            if (msgEl) msgEl.textContent = message;

            const cleanup = () => {
                modal?.classList.remove('active');
                okBtn?.removeEventListener('click', onOk);
                cancelBtn?.removeEventListener('click', onCancel);
            };

            const onOk = () => { cleanup(); resolve(true); };
            const onCancel = () => { cleanup(); resolve(false); };

            okBtn?.addEventListener('click', onOk);
            cancelBtn?.addEventListener('click', onCancel);
            modal?.classList.add('active');
        });
    }
};

// ==================== PageLifecycle ====================

PageLifecycle.init({
    module: 'partner-onboarding',
    basePath: '..',
    async onInit() {
        await partnerOnboarding.init();
    },
    onDestroy() {
        partnerOnboarding.destroy();
    },
    modals: {
        '#reassignModal': () => partnerOnboarding.closeReassignModal(),
        '#confirmModal': () => {}
    }
});

// ==================== Event Delegation ====================

partnerOnboarding._clickHandler = (e) => {
    // DEV: Role switcher pills
    const pill = e.target.closest('.role-pill');
    if (pill && pill.dataset.role) {
        partnerOnboarding.switchRole(pill.dataset.role);
        return;
    }

    // Photo thumbnail → open lightbox (review + form preview)
    const thumb = e.target.closest('.review-photo-thumb') || e.target.closest('.file-preview-img');
    if (thumb) {
        const label = thumb.alt || '';
        partnerOnboarding._openPhotoLightbox(thumb.src, label);
        return;
    }

    const target = e.target.closest('[data-action^="onboarding-"]');
    if (!target) return;

    const action = target.dataset.action.replace('onboarding-', '');
    const value = target.dataset.value;

    if (typeof partnerOnboarding[action] === 'function') {
        if (value !== undefined) {
            partnerOnboarding[action](value);
        } else {
            partnerOnboarding[action]();
        }
    }
};

partnerOnboarding._inputHandler = (e) => {
    const target = e.target.closest('[data-action^="onboarding-"]');
    if (!target) return;

    const action = target.dataset.action.replace('onboarding-', '');
    if (typeof partnerOnboarding[action] === 'function') {
        partnerOnboarding[action]();
    }
};

partnerOnboarding._changeHandler = (e) => {
    const target = e.target.closest('[data-action^="onboarding-"]');
    if (!target) return;

    const action = target.dataset.action.replace('onboarding-', '');
    if (typeof partnerOnboarding[action] === 'function') {
        partnerOnboarding[action]();
    }
};

document.addEventListener('click', partnerOnboarding._clickHandler);
document.addEventListener('input', partnerOnboarding._inputHandler);
document.addEventListener('change', partnerOnboarding._changeHandler);
