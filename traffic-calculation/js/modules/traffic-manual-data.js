// Модуль ручного ввода данных (шаг 4 и шаг 6)
const TrafficManualData = {
    // ========== Шаг 4: % Времени работы ==========

    // Подготовка списка партнеров для шага 4 (ручные данные)
    prepareStep5PartnersList() {
        const allPartners = storage.getPartners();
        TrafficState.allPartnersListForStep5 = allPartners.filter(p => TrafficState.selectedPartners.includes(p.id));
        TrafficManualData.renderStep5PartnersList();
    },

    // Отображение списка партнеров
    renderStep5PartnersList(filterText = '') {
        const select = document.getElementById('partnerSelectList');
        if (!select) return;

        if (TrafficState.allPartnersListForStep5.length === 0) {
            select.innerHTML = '<option value="">Выберите на шаге 1</option>';
            return;
        }

        // Фильтруем по подстроке
        const filtered = filterText
            ? TrafficState.allPartnersListForStep5.filter(p =>
                p.subagent.toLowerCase().includes(filterText.toLowerCase()))
            : TrafficState.allPartnersListForStep5;

        if (filtered.length === 0) {
            select.innerHTML = '<option value="">Ничего не найдено</option>';
            return;
        }

        select.innerHTML = filtered.map(partner =>
            `<option value="${partner.id}">${TrafficRenderer.escapeHtml(partner.subagent)} (${TrafficRenderer.escapeHtml(partner.method)})</option>`
        ).join('');
    },

    // Фильтрация списка партнеров при вводе
    filterPartnersList() {
        const searchInput = document.getElementById('partnerSearchInput');
        if (!searchInput) return;

        const filterText = searchInput.value.trim();
        TrafficManualData.renderStep5PartnersList(filterText);
    },

    // Загрузка ручных данных для выбранного партнера (шаг 4 - только % времени работы)
    loadPartnerManualData() {
        const select = document.getElementById('partnerSelectList');
        if (!select || !select.value) {
            document.getElementById('manualDataForm').classList.add('hidden');
            return;
        }

        // Сначала сохраняем данные предыдущего партнера, если он был выбран
        if (TrafficState.currentSelectedPartnerId) {
            TrafficManualData.saveCurrentManualData();
        }

        const partnerId = select.value;
        TrafficState.currentSelectedPartnerId = partnerId;

        // Получаем актуальные данные из storage
        const allPartners = storage.getPartners();
        const partner = allPartners.find(p => p.id === partnerId);
        if (!partner) return;

        // Отображаем форму
        document.getElementById('selectedPartnerName').textContent = partner.subagent;
        document.getElementById('manualDataForm').classList.remove('hidden');

        // Загружаем сохраненные значения только для процентов времени работы
        document.getElementById('depositWorkTimePercent').value = partner.depositWorkTimePercent || 0;
        document.getElementById('withdrawalWorkTimePercent').value = partner.withdrawalWorkTimePercent || 0;

    },

    // Сохранение текущих ручных данных (шаг 4 - только % времени работы)
    saveCurrentManualData() {
        if (!TrafficState.currentSelectedPartnerId) return;

        const allPartners = storage.getPartners();
        const partner = allPartners.find(p => p.id === TrafficState.currentSelectedPartnerId);
        if (!partner) return;

        // Сохраняем только процент времени работы
        partner.depositWorkTimePercent = parseInt(document.getElementById('depositWorkTimePercent').value || 0);
        partner.withdrawalWorkTimePercent = parseInt(document.getElementById('withdrawalWorkTimePercent').value || 0);

        storage.savePartners(allPartners);

        // Проверяем, заполнены ли данные хотя бы для одного партнера
        TrafficManualData.checkManualDataCompletion();
    },

    // Проверка заполнения ручных данных (шаг 4 - только % времени работы)
    checkManualDataCompletion() {
        const allPartners = storage.getPartners();
        const selectedPartnersData = allPartners.filter(p => TrafficState.selectedPartners.includes(p.id));

        // Проверяем, есть ли хотя бы один партнер с заполненными данными по времени работы
        const hasFilledData = selectedPartnersData.some(partner => {
            return (partner.depositWorkTimePercent || 0) > 0 ||
                   (partner.withdrawalWorkTimePercent || 0) > 0;
        });

        // Активируем кнопку, если есть данные
        const nextBtn = document.getElementById('step4NextBtn');
        if (nextBtn) {
            nextBtn.disabled = !hasFilledData;
        }

        // Отмечаем шаг 4 как завершенный, если есть данные
        if (hasFilledData) {
            if (!TrafficState.completedSteps.includes(4)) {
                TrafficState.completedSteps.push(4);
            }
        } else {
            TrafficState.completedSteps = TrafficState.completedSteps.filter(s => s !== 4);
        }
        TrafficNavigation.updateStepsIndicator(TrafficState.currentStep);
    },

    // Сброс данных по времени работы для текущего партнера (шаг 4)
    async resetWorkTimeData() {
        if (!TrafficState.currentSelectedPartnerId) return;

        if (!await ConfirmModal.show('Сбросить данные по времени работы для этого субагента?', { confirmText: 'Сбросить', danger: true })) {
            return;
        }

        // Сбрасываем поля ввода
        document.getElementById('depositWorkTimePercent').value = 0;
        document.getElementById('withdrawalWorkTimePercent').value = 0;

        // Сохраняем изменения
        TrafficManualData.saveCurrentManualData();
    },

    // Сброс данных по времени работы для всех субагентов (шаг 4)
    async resetAllWorkTimeData() {
        if (!await ConfirmModal.show('Сбросить данные по времени работы для ВСЕХ субагентов?', { confirmText: 'Сбросить все', danger: true })) {
            return;
        }

        const allPartners = storage.getPartners();
        const selectedPartnersData = allPartners.filter(p => TrafficState.selectedPartners.includes(p.id));

        if (selectedPartnersData.length === 0) {
            Toast.warning('Нет выбранных субагентов для сброса');
            return;
        }

        // Сбрасываем данные для всех выбранных партнеров
        selectedPartnersData.forEach(partner => {
            partner.depositWorkTimePercent = 0;
            partner.withdrawalWorkTimePercent = 0;
        });

        storage.savePartners(allPartners);

        // Обновляем отображение, если текущий партнер выбран
        if (TrafficState.currentSelectedPartnerId) {
            document.getElementById('depositWorkTimePercent').value = 0;
            document.getElementById('withdrawalWorkTimePercent').value = 0;
        }

        // Проверяем заполнение данных
        TrafficManualData.checkManualDataCompletion();

        Toast.success(`Данные по времени работы сброшены для ${selectedPartnersData.length} субагентов`);
    },

    // ========== Шаг 6: Нарушения ==========

    // Подготовка списка партнеров для шага 6 (нарушения)
    prepareStep6PartnersList() {
        const allPartners = storage.getPartners();
        TrafficState.allPartnersListForStep6 = allPartners.filter(p => TrafficState.selectedPartners.includes(p.id));
        TrafficManualData.renderStep6PartnersList();
    },

    // Отображение списка партнеров для шага 6
    renderStep6PartnersList(filterText = '') {
        const select = document.getElementById('partnerSelectList6');
        if (!select) return;

        if (TrafficState.allPartnersListForStep6.length === 0) {
            select.innerHTML = '<option value="">Выберите на шаге 1</option>';
            return;
        }

        // Фильтруем по подстроке
        const filtered = filterText
            ? TrafficState.allPartnersListForStep6.filter(p =>
                p.subagent.toLowerCase().includes(filterText.toLowerCase()))
            : TrafficState.allPartnersListForStep6;

        if (filtered.length === 0) {
            select.innerHTML = '<option value="">Ничего не найдено</option>';
            return;
        }

        select.innerHTML = filtered.map(partner =>
            `<option value="${partner.id}">${TrafficRenderer.escapeHtml(partner.subagent)} (${TrafficRenderer.escapeHtml(partner.method)})</option>`
        ).join('');
    },

    // Фильтрация списка партнеров при вводе (шаг 6)
    filterPartnersListStep6() {
        const searchInput = document.getElementById('partnerSearchInput6');
        if (!searchInput) return;

        const filterText = searchInput.value.trim();
        TrafficManualData.renderStep6PartnersList(filterText);
    },

    // Загрузка данных по нарушениям для выбранного партнера (шаг 6)
    loadPartnerManualDataStep6() {
        const select = document.getElementById('partnerSelectList6');
        if (!select || !select.value) {
            document.getElementById('manualDataForm6').classList.add('hidden');
            return;
        }

        // Сначала сохраняем данные предыдущего партнера, если он был выбран
        if (TrafficState.currentSelectedPartnerId6) {
            TrafficManualData.saveCurrentManualDataStep6();
        }

        const partnerId = select.value;
        TrafficState.currentSelectedPartnerId6 = partnerId;

        // Получаем актуальные данные из storage
        const allPartners = storage.getPartners();
        const partner = allPartners.find(p => p.id === partnerId);
        if (!partner) return;

        // Отображаем форму
        document.getElementById('selectedPartnerName6').textContent = partner.subagent;
        document.getElementById('manualDataForm6').classList.remove('hidden');

        // Загружаем сохраненные значения нарушений
        document.getElementById('chatIgnoring').value = partner.chatIgnoring || 0;
        document.getElementById('webmanagementIgnore').value = partner.webmanagementIgnore || 0;
        document.getElementById('depositQueues').value = partner.depositQueues || 0;
        document.getElementById('withdrawalQueues').value = partner.withdrawalQueues || 0;
        document.getElementById('creditsOutsideLimits').value = partner.creditsOutsideLimits || 0;
        document.getElementById('wrongAmountApproval').value = partner.wrongAmountApproval || 0;
        document.getElementById('otherViolations').value = partner.otherViolations || 0;
        document.getElementById('otherViolationsDescription').value = partner.otherViolationsDescription || '';

    },

    // Сохранение данных по нарушениям (шаг 6)
    saveCurrentManualDataStep6() {
        if (!TrafficState.currentSelectedPartnerId6) return;

        const allPartners = storage.getPartners();
        const partner = allPartners.find(p => p.id === TrafficState.currentSelectedPartnerId6);
        if (!partner) return;

        // Сохраняем значения нарушений
        partner.chatIgnoring = parseInt(document.getElementById('chatIgnoring').value || 0);
        partner.webmanagementIgnore = parseInt(document.getElementById('webmanagementIgnore').value || 0);
        partner.depositQueues = parseInt(document.getElementById('depositQueues').value || 0);
        partner.withdrawalQueues = parseInt(document.getElementById('withdrawalQueues').value || 0);
        partner.creditsOutsideLimits = parseInt(document.getElementById('creditsOutsideLimits').value || 0);
        partner.wrongAmountApproval = parseInt(document.getElementById('wrongAmountApproval').value || 0);
        partner.otherViolations = parseInt(document.getElementById('otherViolations').value || 0);
        partner.otherViolationsDescription = document.getElementById('otherViolationsDescription').value || '';

        storage.savePartners(allPartners);

        // Проверяем, заполнены ли данные хотя бы для одного партнера
        TrafficManualData.checkManualDataCompletionStep6();
    },

    // Проверка заполнения данных по нарушениям (шаг 6)
    checkManualDataCompletionStep6() {
        const allPartners = storage.getPartners();
        const selectedPartnersData = allPartners.filter(p => TrafficState.selectedPartners.includes(p.id));

        // Проверяем, есть ли хотя бы один партнер с заполненными данными по нарушениям
        const hasFilledData = selectedPartnersData.some(partner => {
            return (partner.chatIgnoring || 0) > 0 ||
                   (partner.webmanagementIgnore || 0) > 0 ||
                   (partner.depositQueues || 0) > 0 ||
                   (partner.withdrawalQueues || 0) > 0 ||
                   (partner.creditsOutsideLimits || 0) > 0 ||
                   (partner.wrongAmountApproval || 0) > 0 ||
                   (partner.otherViolations || 0) > 0;
        });

        // Кнопка "Завершить" всегда активна (шаг 6 опционален)
        const nextBtn = document.getElementById('step6NextBtn');
        if (nextBtn) {
            nextBtn.disabled = false;
        }

        // Отмечаем шаг 6 как завершенный, если есть данные
        if (hasFilledData) {
            if (!TrafficState.completedSteps.includes(6)) {
                TrafficState.completedSteps.push(6);
            }
        } else {
            TrafficState.completedSteps = TrafficState.completedSteps.filter(s => s !== 6);
        }
        TrafficNavigation.updateStepsIndicator(TrafficState.currentStep);
    },

    // Сброс данных по нарушениям для текущего партнера (шаг 6)
    async resetViolationsData() {
        if (!TrafficState.currentSelectedPartnerId6) return;

        if (!await ConfirmModal.show('Сбросить данные по нарушениям для этого субагента?', { confirmText: 'Сбросить', danger: true })) {
            return;
        }

        // Сбрасываем все поля нарушений
        document.getElementById('chatIgnoring').value = 0;
        document.getElementById('webmanagementIgnore').value = 0;
        document.getElementById('depositQueues').value = 0;
        document.getElementById('withdrawalQueues').value = 0;
        document.getElementById('creditsOutsideLimits').value = 0;
        document.getElementById('wrongAmountApproval').value = 0;
        document.getElementById('otherViolations').value = 0;
        document.getElementById('otherViolationsDescription').value = '';

        // Сохраняем изменения
        TrafficManualData.saveCurrentManualDataStep6();
    },

    // Сброс данных по нарушениям для всех субагентов (шаг 6)
    async resetAllViolationsData() {
        if (!await ConfirmModal.show('Сбросить данные по нарушениям для ВСЕХ субагентов?', { confirmText: 'Сбросить все', danger: true })) {
            return;
        }

        const allPartners = storage.getPartners();
        const selectedPartnersData = allPartners.filter(p => TrafficState.selectedPartners.includes(p.id));

        if (selectedPartnersData.length === 0) {
            Toast.warning('Нет выбранных субагентов для сброса');
            return;
        }

        // Сбрасываем данные для всех выбранных партнеров
        selectedPartnersData.forEach(partner => {
            partner.chatIgnoring = 0;
            partner.webmanagementIgnore = 0;
            partner.depositQueues = 0;
            partner.withdrawalQueues = 0;
            partner.creditsOutsideLimits = 0;
            partner.wrongAmountApproval = 0;
            partner.otherViolations = 0;
            partner.otherViolationsDescription = '';
        });

        storage.savePartners(allPartners);

        // Обновляем отображение, если текущий партнер выбран
        if (TrafficState.currentSelectedPartnerId6) {
            document.getElementById('chatIgnoring').value = 0;
            document.getElementById('webmanagementIgnore').value = 0;
            document.getElementById('depositQueues').value = 0;
            document.getElementById('withdrawalQueues').value = 0;
            document.getElementById('creditsOutsideLimits').value = 0;
            document.getElementById('wrongAmountApproval').value = 0;
            document.getElementById('otherViolations').value = 0;
            document.getElementById('otherViolationsDescription').value = '';
        }

        // Проверяем заполнение данных
        TrafficManualData.checkManualDataCompletionStep6();

        Toast.success(`Данные по нарушениям сброшены для ${selectedPartnersData.length} субагентов`);
    },

    // Увеличение значения
    incrementManualValue(fieldId) {
        const input = document.getElementById(fieldId);
        if (!input) return;

        input.value = parseInt(input.value || 0) + 1;
        // Сохраняем в зависимости от того, на каком шаге мы находимся
        if (TrafficState.currentStep === 6) {
            TrafficManualData.saveCurrentManualDataStep6();
        } else {
            TrafficManualData.saveCurrentManualData();
        }
    },

    // Уменьшение значения
    decrementManualValue(fieldId) {
        const input = document.getElementById(fieldId);
        if (!input) return;

        const currentValue = parseInt(input.value || 0);
        if (currentValue > 0) {
            input.value = currentValue - 1;
            // Сохраняем в зависимости от того, на каком шаге мы находимся
            if (TrafficState.currentStep === 6) {
                TrafficManualData.saveCurrentManualDataStep6();
            } else {
                TrafficManualData.saveCurrentManualData();
            }
        }
    }
};
