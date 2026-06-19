/**
 * Team Renderer Module
 * Рендеринг UI элементов (таблица, карточки, статистика)
 *
 * Phase 50 LIT-CONT-04 (2026-05-09): renderEmployees migration на signal-driven
 * <app-table> mount + Lit cell renderers (XSS-proof через автоэскейп).
 * Pattern Phase 40 LIT-MIG-01 admin pilot extended на team-info module.
 *
 * Атомарность (Pitfall #12): мигрирована ТОЛЬКО render() (employees table).
 * Invite forms, sub-tabs, avatars — отложены к будущим phases.
 */

const TeamRenderer = {
    // Phase 50 LIT-CONT-04: signal-driven <app-table> state
    _employeesSignal: null,        // window.signal([{id, ...employee fields}, ...])
    _employeesDisposers: [],       // dispose handles для effect() — cleanup в destroy()
    _employeesTableMounted: false, // flag — columns + effect bound only once
    _employeesPendingMount: false, // flag для отложенного mount при отсутствии lit-ready

    /**
     * Скелетон карточки/строки во время загрузки страницы
     */
    renderSkeletonCards() {
        const table = document.getElementById('employeesTable');
        if (table) table.classList.add('hidden');
        const emptyState = document.getElementById('emptyState');
        if (emptyState) { emptyState.classList.add('hidden'); emptyState.classList.remove('visible-flex'); }
        const loadingState = document.getElementById('loadingState');
        if (loadingState) loadingState.classList.remove('hidden');
    },

    /**
     * Phase 50 LIT-CONT-04 — однократная настройка <app-table id="employeesTable">:
     * — columns с Lit cell renderers (8 columns: status / photo / name / position / crm / id / birthday / arrow)
     * — effect-binding signal → tableEl.items (reactive)
     * — selectedId binding для выделения строк
     * — row-click event listener для openCard()
     * — disposers tracked в _employeesDisposers (cleanup в destroy)
     */
    _mountEmployeesTable() {
        if (TeamRenderer._employeesTableMounted) return;

        const tableEl = document.getElementById('employeesTable');
        if (!tableEl) return;

        // Lit globals + signals required (cdn-deps.js loaded asynchronously)
        if (typeof window.signal !== 'function' || typeof window.effect !== 'function' || !window.litHtml) {
            // Lit ещё не готов — попытаемся отложить mount до lit-ready event
            if (!TeamRenderer._employeesPendingMount) {
                TeamRenderer._employeesPendingMount = true;
                window.addEventListener('lit-ready', () => {
                    TeamRenderer._employeesPendingMount = false;
                    TeamRenderer._mountEmployeesTable();
                    // re-trigger render для записи в signal
                    if (typeof TeamRenderer.render === 'function') {
                        TeamRenderer.render();
                    }
                }, { once: true });
            }
            return;
        }

        const html = window.litHtml;

        try {
            TeamRenderer._employeesSignal = window.signal([]);

            // Cell renderers — Lit html`` автоматически экранирует interpolated values (XSS-proof)
            tableEl.columns = [
                {
                    key: 'status',
                    label: html`<div class="sort-header" data-action="team-sortBy" data-value="status">Статус<img src="../shared/icons/filter.svg" width="12" height="12" alt="Сортировка"></div>`,
                    render: (item) => html`<span class="status-badge ${item.statusClass}">${item.statusText}</span>`
                },
                {
                    key: 'photo',
                    label: 'Фото',
                    render: (item) => item.isValidAvatar
                        ? html`<div class="employee-avatar"><img src="${item.avatar}" alt="" loading="lazy"></div>`
                        : html`<div class="employee-avatar"><img class="avatar-placeholder" src="../shared/icons/team_info.svg" width="16" height="16" alt=""></div>`
                },
                {
                    key: 'name',
                    label: html`<div class="sort-header" data-action="team-sortBy" data-value="name">Ф.И.О.<img src="../shared/icons/filter.svg" width="12" height="12" alt="Сортировка"></div>`,
                    // Lit html`` автоэскейпает значения; <br> вставляется как часть template (контролируемый markup, не user-injected).
                    // nameLine2 пустой для случаев <3 частей ФИО — отдельный <br> не показывается.
                    render: (item) => item.nameLine2
                        ? html`${item.nameLine1}<br>${item.nameLine2}`
                        : html`${item.nameLine1}`
                },
                {
                    key: 'position',
                    label: 'Роль',
                    render: (item) => html`${item.positionText}`
                },
                {
                    key: 'crm',
                    label: 'Логин CRM',
                    render: (item) => item.crmLogin
                        ? html`${item.crmLogin}`
                        : html`<span class="cell-empty">—</span>`
                },
                {
                    key: 'reddyId',
                    label: 'Reddy ID',
                    render: (item) => item.reddyId
                        ? html`${item.reddyId}`
                        : html`<span class="cell-empty">—</span>`
                },
                {
                    key: 'birthday',
                    label: 'День рождения',
                    render: (item) => item.birthday
                        ? html`${item.birthday}`
                        : html`<span class="cell-empty">—</span>`
                },
                {
                    key: 'arrow',
                    label: '',
                    render: () => html`<img class="row-arrow" src="../shared/icons/arrow.svg" alt="">`
                }
            ];

            // Reactive prop binding (Option A — direct prop assignment via effect)
            const dispose = window.effect(() => {
                tableEl.items = TeamRenderer._employeesSignal.value || [];
            });
            TeamRenderer._employeesDisposers.push(dispose);

            // row-click handler (replaces tbody event delegation в legacy)
            tableEl.addEventListener('row-click', (e) => {
                const id = e.detail?.id;
                if (id !== undefined && id !== null) {
                    TeamNavigation.openCard(id);
                }
            });

            TeamRenderer._employeesTableMounted = true;
        } catch (e) {
            console.warn('[team-info] _mountEmployeesTable failed (non-fatal):', e?.message);
            TeamRenderer._employeesTableMounted = false;
        }
    },

    /**
     * Phase 50 LIT-CONT-04 — основной рендеринг таблицы сотрудников
     * (signal-driven; Lit реактивно перерисовывает rows через _employeesSignal)
     */
    render() {
        TeamState._invalidateFiltered();
        const emptyState = document.getElementById('emptyState');
        const loadingState = document.getElementById('loadingState');
        const table = document.getElementById('employeesTable');

        // Всегда скрываем loading state после первого рендера
        if (loadingState) {
            loadingState.classList.add('hidden');
        }

        if (TeamState.data.length === 0) {
            if (table) table.classList.add('hidden');
            if (emptyState) {
                emptyState.classList.remove('hidden');
                emptyState.classList.add('visible-flex');
            }
            // Очищаем signal при пустых данных (Lit покажет empty-message slot)
            TeamRenderer._mountEmployeesTable();
            if (TeamRenderer._employeesSignal) {
                TeamRenderer._employeesSignal.value = [];
            }
            TeamRenderer.renderPagination();
            return;
        }

        if (table) table.classList.remove('hidden');
        if (emptyState) {
            emptyState.classList.remove('visible-flex');
            emptyState.classList.add('hidden');
        }

        let pagedData;
        if (TeamState.serverPaginationEnabled) {
            // Server pagination: data is already page-scoped (preserved per Phase 33 PERF-02 — pageSize: 20)
            pagedData = TeamState.data;
        } else {
            // Client pagination: clamp page and slice
            const totalPages = TeamState.getTotalPages();
            if (TeamState.currentPage > totalPages) TeamState.currentPage = totalPages;
            pagedData = TeamState.getPagedData();
        }

        // Build rows from data (data layer — без DOM)
        const rows = pagedData.map(employee => {
            const statusText = employee.status || 'Работает';
            const statusClass = TeamUtils.getStatusClass(statusText);
            const reddyId = employee.reddyId || employee.predefinedFields?.['Reddy'] || '';
            const birthday = employee.birthday ? new Date(employee.birthday).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
            const crmLogin = employee.crmLogin || '';
            const avatar = employee.avatar || '';
            const isValidAvatar = TeamUtils.isValidImageUrl(avatar);
            // Phase 50 LIT-CONT-04: разбираем ФИО на 2 строки для Lit-friendly рендеринга
            // (legacy formatFullNameForTable возвращал HTML строку с <br>; теперь данные, не HTML)
            const fullName = employee.fullName || '';
            const parts = fullName.trim().split(/\s+/);
            let nameLine1 = '', nameLine2 = '';
            if (parts.length === 1) {
                nameLine1 = parts[0];
            } else if (parts.length === 2) {
                nameLine1 = parts.join(' ');
            } else if (parts.length >= 3) {
                nameLine1 = `${parts[0]} ${parts[1]}`;
                nameLine2 = parts.slice(2).join(' ');
            }
            const positionText = (typeof RolesConfig !== 'undefined' && employee.position)
                ? RolesConfig.getName(RolesConfig.resolveRoleKey(employee.position))
                : (employee.position || '');

            return {
                id: employee.id,
                statusText,
                statusClass,
                fullName,
                nameLine1,
                nameLine2,
                positionText,
                crmLogin,
                reddyId,
                birthday,
                avatar,
                isValidAvatar,
                _pending: employee._pending,
                _error: employee._error
            };
        });

        // Mount once (idempotent), затем записываем в signal — Lit реактивно перерисует rows
        TeamRenderer._mountEmployeesTable();

        // Обновление selectedId (для .selected class на <tr>)
        const tableEl = document.getElementById('employeesTable');
        if (tableEl) {
            const selectedId = TeamState.currentEmployeeId;
            tableEl.selectedId = (selectedId !== null && selectedId !== undefined) ? String(selectedId) : null;
        }

        if (TeamRenderer._employeesSignal) {
            TeamRenderer._employeesSignal.value = rows;
        } else if (TeamRenderer._employeesPendingMount) {
            // Phase 67 SYNC-FIX-04: Lit ещё инициализируется (lit-ready deferred mount запланирован в _mountEmployeesTable).
            // Silent skip — re-render автоматически произойдёт после lit-ready event (см. _mountEmployeesTable строки 49-58).
            // Никакой warning не нужен — это ожидаемое состояние холодной загрузки.
        } else {
            // Truly broken: signals/Lit недоступны И mount не отложен — degraded graceful (пустая таблица)
            console.warn('[team-info] _employeesSignal not initialized — Lit/signals unavailable, employees table degraded');
        }

        TeamRenderer.updateStats();
        TeamRenderer.renderPagination();
    },

    /**
     * Phase 50 LIT-CONT-04 — обновить только выделение строк без перезаписи signal
     * (через .selectedId reactive prop на <app-table>)
     */
    updateSelection(newId, oldId) {
        const tableEl = document.getElementById('employeesTable');
        if (!tableEl) return;
        tableEl.selectedId = (newId !== null && newId !== undefined) ? String(newId) : null;
    },

    /**
     * Phase 50 LIT-CONT-04 — cleanup Lit effects (вызывается из team-info.js onDestroy)
     */
    destroy() {
        if (Array.isArray(TeamRenderer._employeesDisposers)) {
            TeamRenderer._employeesDisposers.forEach(d => {
                try { d(); } catch (e) { /* swallow dispose errors */ }
            });
            TeamRenderer._employeesDisposers.length = 0;
        }
        TeamRenderer._employeesSignal = null;
        TeamRenderer._employeesTableMounted = false;
        TeamRenderer._employeesPendingMount = false;
    },

    /**
     * Обновление статистики (single-pass, по ВСЕМ данным)
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

        const statIds = [
            { id: 'workingCount', val: working },
            { id: 'sickCount', val: sick },
            { id: 'leaveCount', val: leave },
            { id: 'tripCount', val: trip },
            { id: 'firedCount', val: fired }
        ];
        statIds.forEach(({ id, val }) => {
            const el = document.getElementById(id);
            if (el && el.parentElement) {
                el.parentElement.classList.toggle('dimmed', val === 0);
            }
        });
    },

    /**
     * Пагинация
     */
    renderPagination() {
        const container = document.getElementById('teamPagination');
        if (!container) return;

        if (TeamState.serverPaginationEnabled) {
            // Server pagination — use PaginationHelper
            if (TeamState.totalCount <= TeamState.pageSize) {
                container.innerHTML = '';
                return;
            }
            PaginationHelper.render(container, {
                page: TeamState.currentPage,
                pageSize: TeamState.pageSize,
                totalCount: TeamState.totalCount,
                onPageChange: (p) => TeamRenderer.goToPage(p)
            });
            return;
        }

        // Client pagination (legacy for < 50 employees)
        const totalPages = TeamState.getTotalPages();
        const currentPage = TeamState.currentPage;

        container.innerHTML = '';
        if (totalPages <= 1) return;

        // Prev
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.textContent = '\u2190';
        prevBtn.disabled = currentPage === 1;
        prevBtn.dataset.action = 'team-goToPage';
        prevBtn.dataset.value = currentPage - 1;
        container.appendChild(prevBtn);

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                const pageBtn = document.createElement('button');
                pageBtn.className = 'page-btn' + (i === currentPage ? ' active' : '');
                pageBtn.textContent = i;
                pageBtn.dataset.action = 'team-goToPage';
                pageBtn.dataset.value = i;
                container.appendChild(pageBtn);
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                const dots = document.createElement('span');
                dots.className = 'pagination-dots';
                dots.textContent = '...';
                container.appendChild(dots);
            }
        }

        // Next
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.textContent = '\u2192';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.dataset.action = 'team-goToPage';
        nextBtn.dataset.value = currentPage + 1;
        container.appendChild(nextBtn);
    },

    async goToPage(page) {
        const p = parseInt(page);
        if (isNaN(p) || p < 1) return;
        if (TeamState.serverPaginationEnabled) {
            await goToTeamPage(p);
        } else {
            TeamState.currentPage = p;
            TeamRenderer.render();
        }
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
            { label: 'День рождения', value: employee.birthday ? new Date(employee.birthday).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '' },
            { label: 'Рабочая почта', value: employee.corpEmail || employee.predefinedFields?.['Корп. e-mail'] || '' },
            { label: 'Личная почта', value: employee.personalEmail || '' },
            { label: 'Рабочий телефон', value: employee.corpPhone || employee.predefinedFields?.['Корп. телефон'] || '' },
            { label: 'Личный телефон', value: employee.personalPhone || '' },
            { label: 'Офис', value: employee.office || '' },
            { label: 'Начало работы', value: employee.startDate ? new Date(employee.startDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '' },
            { label: 'Компания', value: employee.company || '' },
            { label: 'Логин CRM', value: employee.crmLogin || '' },
            { label: 'Примечание', value: employee.comment || '' }
        ];

        let html = '';

        fields.forEach(field => {
            if (field.value || field.label === 'Примечание') {
                const isComment = field.label === 'Примечание';

                if (isComment) {
                    const valueText = field.value ? TeamUtils.escapeHtml(field.value) : '\u2014';
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
