// Модуль отрисовки (рендеринг UI)
const TrafficRenderer = {
    // Аналитика
    renderAnalytics() {
        TrafficRenderer.updateSelectedPartnersView();
    },

    // Обновление предпросмотра выбранных партнеров
    updateSelectedPartnersView() {
        const tbody = document.getElementById('selectedPartnersTableBody');
        if (!tbody) return;

        const allPartners = storage.getPartners();
        const selected = allPartners.filter(p => TrafficState.selectedPartners.includes(p.id));

        // Элементы UI
        const noPartnersHint = document.getElementById('noPartnersHint');
        const selectionToolbar = document.getElementById('selectionToolbar');
        const partnersPreview = document.querySelector('.partners-preview');

        if (allPartners.length === 0) {
            // Нет партнёров вообще - показываем подсказку, скрываем остальное
            if (noPartnersHint) noPartnersHint.classList.remove('hidden');
            if (selectionToolbar) selectionToolbar.classList.add('hidden');
            if (partnersPreview) partnersPreview.classList.add('hidden');
            const nextBtn = document.getElementById('step1NextBtn');
            if (nextBtn) nextBtn.disabled = true;
            return;
        } else {
            // Есть партнёры - скрываем подсказку, показываем элементы
            if (noPartnersHint) noPartnersHint.classList.add('hidden');
            if (selectionToolbar) selectionToolbar.classList.remove('hidden');
            if (partnersPreview) partnersPreview.classList.remove('hidden');
        }

        document.getElementById('selectedCount').textContent = selected.length;

        if (selected.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Партнеры не выбраны</td></tr>';
            // Отключаем кнопку "Далее" на шаге 1
            const nextBtn = document.getElementById('step1NextBtn');
            if (nextBtn) nextBtn.disabled = true;
            // Убираем шаг 1 из завершенных
            TrafficState.completedSteps = TrafficState.completedSteps.filter(s => s !== 1);
            TrafficNavigation.updateStepsIndicator(TrafficState.currentStep);
            return;
        }

        tbody.innerHTML = selected.map(partner => {
            const statusClass = partner.status === 'новый' ? 'new' : partner.status === 'старый' ? 'old' : 'closed';
            const statusText = partner.status === 'новый' ? 'Новый' : partner.status === 'старый' ? 'Старый' : 'Закрыт';

            return `
                <tr>
                    <td>${TrafficRenderer.escapeHtml(partner.method)}</td>
                    <td>${TrafficRenderer.escapeHtml(partner.subagent)}</td>
                    <td>${TrafficRenderer.escapeHtml(partner.subagentId)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                </tr>
            `;
        }).join('');

        // Включаем кнопку "Далее" на шаге 1
        const nextBtn = document.getElementById('step1NextBtn');
        if (nextBtn) nextBtn.disabled = false;
        // Отмечаем шаг 1 как завершенный
        if (!TrafficState.completedSteps.includes(1)) {
            TrafficState.completedSteps.push(1);
        }
        TrafficNavigation.updateStepsIndicator(TrafficState.currentStep);
    },

    // Выбор всех партнеров
    selectAll() {
        const partners = storage.getPartners();
        TrafficState.selectedPartners = partners.map(p => p.id);
        TrafficRenderer.updateSelectedPartnersView();
        TrafficRenderer.hideAllPanels();
    },

    // Очистка выбора
    clearSelection() {
        TrafficState.selectedPartners = [];
        TrafficRenderer.updateSelectedPartnersView();
    },

    // Показать выбор по методу
    showMethodSelection() {
        TrafficRenderer.hideAllPanels();
        const panel = document.getElementById('methodSelectionPanel');
        panel.classList.remove('hidden');

        TrafficState.availableMethods = storage.getMethods();
        const container = document.getElementById('methodCheckboxes');

        container.innerHTML = TrafficState.availableMethods.map((method, index) => `
            <label>
                <input type="checkbox" value="${index}" class="method-checkbox">
                ${TrafficRenderer.escapeHtml(method)}
            </label>
        `).join('');
    },

    // Применить выбор по методу
    applyMethodSelection() {
        const checkboxes = document.querySelectorAll('.method-checkbox:checked');
        const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.value));
        const selectedMethods = selectedIndices.map(i => TrafficState.availableMethods[i]);

        if (selectedMethods.length === 0) {
            Toast.warning('Выберите хотя бы один метод');
            return;
        }

        const partners = storage.getPartners();
        TrafficState.selectedPartners = partners
            .filter(p => selectedMethods.includes(p.method))
            .map(p => p.id);

        TrafficRenderer.updateSelectedPartnersView();
        TrafficRenderer.hideAllPanels();
    },

    // Показать ручной выбор
    showManualSelection() {
        TrafficRenderer.hideAllPanels();
        const panel = document.getElementById('manualSelectionPanel');
        panel.classList.remove('hidden');

        const partners = storage.getPartners();
        const container = document.getElementById('partnerCheckboxes');

        container.innerHTML = partners.map(partner => `
            <label>
                <input type="checkbox" value="${partner.id}" class="partner-checkbox"
                    ${TrafficState.selectedPartners.includes(partner.id) ? 'checked' : ''}>
                ${TrafficRenderer.escapeHtml(partner.subagent)} (${TrafficRenderer.escapeHtml(partner.method)})
            </label>
        `).join('');
    },

    // Применить ручной выбор
    applyManualSelection() {
        const checkboxes = document.querySelectorAll('.partner-checkbox:checked');
        TrafficState.selectedPartners = Array.from(checkboxes).map(cb => cb.value);

        if (TrafficState.selectedPartners.length === 0) {
            Toast.warning('Выберите хотя бы одного партнера');
            return;
        }

        TrafficRenderer.updateSelectedPartnersView();
        TrafficRenderer.hideAllPanels();
    },

    // Скрыть все панели выбора
    hideAllPanels() {
        document.getElementById('methodSelectionPanel').classList.add('hidden');
        document.getElementById('manualSelectionPanel').classList.add('hidden');
    },

    // Отображение партнеров
    renderPartners() {
        const tbody = document.getElementById('partnersTableBody');
        if (!tbody) return;

        const partners = storage.getPartners();
        const filterMethod = document.getElementById('methodFilter')?.value || '';

        // Фильтруем партнеров
        const filteredPartners = filterMethod
            ? partners.filter(p => p.method === filterMethod)
            : partners;

        if (filteredPartners.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Партнеры не найдены</td></tr>';
            return;
        }

        tbody.innerHTML = filteredPartners.map(partner => {
            const date = new Date(partner.dateAdded).toLocaleDateString('ru-RU');
            const statusClass = partner.status === 'новый' ? 'new' : partner.status === 'старый' ? 'old' : 'closed';
            const statusText = partner.status === 'новый' ? 'Новый' : partner.status === 'старый' ? 'Старый' : 'Закрыт';

            return `
                <tr>
                    <td>${TrafficRenderer.escapeHtml(partner.method)}</td>
                    <td>${TrafficRenderer.escapeHtml(partner.subagent)}</td>
                    <td>${TrafficRenderer.escapeHtml(partner.subagentId)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${date}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn" data-action="edit" data-partner-id="${partner.id}" title="Редактировать">Изменить</button>
                            <button class="action-btn delete" data-action="delete" data-partner-id="${partner.id}" title="Удалить">Удалить</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Event delegation — используем один обработчик (не добавлять повторно)
        if (!tbody._hasActionListener) {
            tbody.addEventListener('click', (e) => {
                const button = e.target.closest('[data-action]');
                if (!button) return;

                const action = button.dataset.action;
                const partnerId = button.dataset.partnerId;

                if (action === 'edit') {
                    TrafficRenderer.editPartner(partnerId);
                } else if (action === 'delete') {
                    TrafficImportExport.deletePartner(partnerId);
                }
            });
            tbody._hasActionListener = true;
        }
    },

    // Загрузка методов
    loadMethods() {
        const methods = storage.getMethods();
        const selects = ['methodSelect', 'editMethodSelect', 'methodFilter'];

        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;

            const currentValue = select.value;
            select.innerHTML = selectId === 'methodFilter' ? '<option value="">Все методы</option>' : '<option value="">Выберите метод</option>';

            methods.forEach(method => {
                const option = document.createElement('option');
                option.value = method;
                option.textContent = method;
                select.appendChild(option);
            });

            if (currentValue) {
                select.value = currentValue;
            }
        });
    },

    // Обновление счётчиков
    updateCounts() {
        const partners = storage.getPartners();
        const filterMethod = document.getElementById('methodFilter')?.value || '';

        const filteredPartners = filterMethod
            ? partners.filter(p => p.method === filterMethod)
            : partners;

        const countElement = document.getElementById('partnerCount');
        if (countElement) {
            countElement.textContent = filteredPartners.length;
        }
    },

    // Управление методами
    showMethodModal() {
        TrafficRenderer.renderMethodsList();
        document.getElementById('methodModal').classList.add('show');
    },

    closeMethodModal() {
        document.getElementById('methodModal').classList.remove('show');
        document.getElementById('newMethodInput').value = '';
    },

    renderMethodsList() {
        const methods = storage.getMethods();
        const container = document.getElementById('methodsList');
        if (!container) return;

        if (methods.length === 0) {
            container.innerHTML = '<p class="empty-state">Методы не добавлены</p>';
            return;
        }

        container.innerHTML = methods.map(method => `
            <div class="method-item">
                <span>${TrafficRenderer.escapeHtml(method)}</span>
                <button data-method="${TrafficRenderer.escapeHtml(method)}">Удалить</button>
            </div>
        `).join('');

        // Event delegation — используем один обработчик (не добавлять повторно)
        if (!container._hasMethodListener) {
            container.addEventListener('click', (e) => {
                const button = e.target.closest('[data-method]');
                if (!button) return;

                TrafficImportExport.deleteMethod(button.dataset.method);
            });
            container._hasMethodListener = true;
        }
    },

    // Генерация отчета
    generateReport() {
        if (TrafficState.selectedPartners.length === 0) {
            Toast.warning('Сначала выберите партнеров');
            return;
        }

        const allPartners = storage.getPartners();
        const reportData = allPartners.filter(p => TrafficState.selectedPartners.includes(p.id));

        // Отображаем детальную таблицу
        const tbody = document.getElementById('reportTableBody');
        tbody.innerHTML = reportData.map(partner => {
            const date = new Date(partner.dateAdded).toLocaleDateString('ru-RU');
            const statusClass = partner.status === 'новый' ? 'new' : partner.status === 'старый' ? 'old' : 'closed';
            const statusText = partner.status === 'новый' ? 'Новый' : partner.status === 'старый' ? 'Старый' : 'Закрыт';

            return `
                <tr>
                    <td>${TrafficRenderer.escapeHtml(partner.method)}</td>
                    <td>${TrafficRenderer.escapeHtml(partner.subagent)}</td>
                    <td>${TrafficRenderer.escapeHtml(partner.subagentId)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${date}</td>
                    <td>${Number(partner.backCount) || 0}</td>
                    <td>${Number(partner.cringeCount) || 0}</td>
                    <td>${Number(partner.autoDisableCount) || 0}</td>
                    <td>${Number(partner.depositTransactionsCount) || 0}</td>
                    <td>${Number(partner.withdrawalTransactionsCount) || 0}</td>
                    <td>${Number(partner.depositAppealsCount) || 0}</td>
                    <td>${Number(partner.delayedAppealsCount) || 0}</td>
                    <td>${Number(partner.depositSuccessPercent) || 0}%</td>
                    <td>${Number(partner.withdrawalSuccessPercent) || 0}%</td>
                    <td>${Number(partner.depositWorkTimePercent) || 0}%</td>
                    <td>${Number(partner.withdrawalWorkTimePercent) || 0}%</td>
                    <td>${Number(partner.chatIgnoring) || 0}</td>
                    <td>${Number(partner.webmanagementIgnore) || 0}</td>
                    <td>${Number(partner.depositQueues) || 0}</td>
                    <td>${Number(partner.withdrawalQueues) || 0}</td>
                    <td>${Number(partner.creditsOutsideLimits) || 0}</td>
                    <td>${Number(partner.wrongAmountApproval) || 0}</td>
                    <td class="violations-cell" ${partner.otherViolationsDescription ? `data-tooltip="${TrafficRenderer.escapeHtml(partner.otherViolationsDescription)}"` : ''}>
                        <span>${Number(partner.otherViolations) || 0}</span>${partner.otherViolationsDescription ? ' <span class="violation-info-icon"><img src="../shared/icons/filter.svg" alt="info" class="tooltip-icon"></span>' : ''}
                    </td>
                </tr>
            `;
        }).join('');

        // Сохраняем данные отчета для детального просмотра
        TrafficState.currentReportData = reportData;

        // Показываем отчет, скрываем плейсхолдер
        document.getElementById('reportNotGenerated').classList.add('hidden');
        document.getElementById('reportGenerated').classList.remove('hidden');

    },

    // Общий рендеринг результатов (используется в модалке и на шаге 9)
    _renderResultsHtml(results) {
        // Группируем по методу и сортируем
        const methodGroups = {};
        results.forEach(result => {
            if (!methodGroups[result.method]) methodGroups[result.method] = [];
            methodGroups[result.method].push(result);
        });

        Object.values(methodGroups).forEach(group => {
            group.sort((a, b) => b.trafficPercent - a.trafficPercent);
        });

        const esc = TrafficRenderer.escapeHtml;
        let html = '';

        Object.keys(methodGroups).sort().forEach(method => {
            const groupResults = methodGroups[method];
            const totalPercent = groupResults.reduce((sum, r) => sum + r.trafficPercent, 0);

            html += `<tr class="method-header-row"><td colspan="9"><strong>${esc(method)}</strong> <span class="method-summary">(${groupResults.length} субагентов, всего ${totalPercent}%)</span></td></tr>`;

            groupResults.forEach(result => {
                html += `<tr>
                    <td>${esc(result.method)}</td>
                    <td>${esc(result.subagent)}</td>
                    <td>${esc(result.subagentId)}</td>
                    <td class="score-cell score-good">${result.scores.good}</td>
                    <td class="score-cell score-normal">${result.scores.normal}</td>
                    <td class="score-cell score-bad">${result.scores.bad}</td>
                    <td class="score-cell score-terrible">${result.scores.terrible}</td>
                    <td class="score-cell score-total"><strong>${result.scores.total}</strong></td>
                    <td class="traffic-percent"><strong>${result.trafficPercent}%</strong></td>
                </tr>`;
            });
        });

        return html;
    },

    // Показать результаты расчета (модальное окно)
    showTrafficResults() {
        const tbody = document.getElementById('trafficResultsTableBody');
        if (!tbody || !TrafficState.trafficResults) return;

        tbody.innerHTML = TrafficRenderer._renderResultsHtml(TrafficState.trafficResults);
        document.getElementById('trafficResultsModal').classList.add('show');
    },

    // Показать результаты расчёта на шаге 9
    showTrafficResultsInStep() {
        if (!TrafficState.trafficResults || TrafficState.trafficResults.length === 0) {
            document.getElementById('resultsNotCalculated').classList.remove('hidden');
            document.getElementById('resultsCalculated').classList.add('hidden');
            return;
        }

        document.getElementById('resultsNotCalculated').classList.add('hidden');
        document.getElementById('resultsCalculated').classList.remove('hidden');

        const tbody = document.getElementById('trafficResultsTableBody');
        tbody.innerHTML = TrafficRenderer._renderResultsHtml(TrafficState.trafficResults);

        if (!TrafficState.completedSteps.includes(9)) {
            TrafficState.completedSteps.push(9);
        }
        TrafficNavigation.updateStepsIndicator(9);
    },

    // Закрыть результаты
    closeTrafficResults() {
        document.getElementById('trafficResultsModal').classList.remove('show');
    },

    // Открыть калькулятор трафика
    openTrafficCalculator() {
        if (!TrafficState.currentReportData || TrafficState.currentReportData.length === 0) {
            Toast.warning('Нет данных для расчета');
            return;
        }

        // Загружаем или создаем настройки
        TrafficState.trafficSettings = TrafficCalculator.loadTrafficSettings();

        // Отображаем форму настроек
        TrafficCalculator.renderTrafficSettings();

        // Открываем модальное окно
        document.getElementById('trafficCalculatorModal').classList.add('show');
    },

    // Закрыть калькулятор трафика
    closeTrafficCalculator() {
        document.getElementById('trafficCalculatorModal').classList.remove('show');
        // Скрываем подсказку при закрытии
        const helpContent = document.getElementById('trafficHelpContent');
        const helpBtn = document.querySelector('.help-toggle-btn');
        if (helpContent) helpContent.classList.add('hidden');
        if (helpBtn) helpBtn.classList.remove('active');
    },

    // Редактирование партнера
    editPartner(id) {
        const partners = storage.getPartners();
        const partner = partners.find(p => p.id === id);
        if (!partner) return;

        TrafficState.editingPartnerId = id;

        document.getElementById('editPartnerId').value = id;
        document.getElementById('editMethodSelect').value = partner.method;
        document.getElementById('editSubagentInput').value = partner.subagent;
        document.getElementById('editSubagentIdInput').value = partner.subagentId;
        document.getElementById('editStatusSelect').value = partner.status;

        document.getElementById('editModal').classList.add('show');
    },

    // Сохранение изменений
    saveEdit() {
        const id = document.getElementById('editPartnerId').value;
        const method = document.getElementById('editMethodSelect').value;
        const subagent = document.getElementById('editSubagentInput').value.trim();
        const subagentId = document.getElementById('editSubagentIdInput').value.trim();
        const status = document.getElementById('editStatusSelect').value;

        if (!method || !subagent || !subagentId) {
            Toast.warning('Пожалуйста, заполните все поля');
            return;
        }

        storage.updatePartner(id, {
            method,
            subagent,
            subagentId,
            status
        });

        TrafficRenderer.closeEditModal();
        TrafficRenderer.renderPartners();
        TrafficRenderer.updateCounts();

        Toast.success('Изменения сохранены!');
    },

    // Закрытие модального окна редактирования
    closeEditModal() {
        document.getElementById('editModal').classList.remove('show');
        TrafficState.editingPartnerId = null;
    },

    // Экранирование HTML (string-based, без создания DOM элементов)
    escapeHtml(text) {
        if (typeof text !== 'string') return String(text ?? '');
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
};
