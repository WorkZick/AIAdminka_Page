// Модуль навигации
const TrafficNavigation = {
    // SIDEBAR
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    },

    // Переключение вкладок
    switchTab(tabName, event) {
        TrafficState.currentTab = tabName;

        // Обновляем кнопки вкладок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        if (event) {
            event.target.closest('.tab-btn').classList.add('active');
        }

        // Показываем нужный контент
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        if (tabName === 'analytics') {
            document.getElementById('analyticsTab').classList.add('active');
            TrafficRenderer.renderAnalytics();
        } else if (tabName === 'report') {
            document.getElementById('reportTab').classList.add('active');
        }
    },

    // Навигация по шагам
    goToStep(stepNumber) {
        // Скрываем все шаги
        document.querySelectorAll('.analytics-step').forEach(step => {
            step.classList.remove('active');
        });

        // Показываем нужный шаг
        const targetStep = document.getElementById(`step${stepNumber}`);
        if (targetStep) {
            targetStep.classList.add('active');
        }

        // Обновляем индикатор шагов
        TrafficNavigation.updateStepsIndicator(stepNumber);

        TrafficState.currentStep = stepNumber;

        // При переходе на шаг 4 (% времени работы) - подготовить список партнеров
        if (stepNumber === 4) {
            TrafficManualData.prepareStep5PartnersList();
            TrafficManualData.checkManualDataCompletion();
        }

        // При переходе на шаг 6 (нарушения) - подготовить список партнеров
        if (stepNumber === 6) {
            TrafficManualData.prepareStep6PartnersList();
            TrafficManualData.checkManualDataCompletionStep6();
        }

        // При переходе на шаг 7 (отчёт) - сгенерировать отчёт
        if (stepNumber === 7) {
            TrafficCalculator.prepareStep7Report();
        }

        // При переходе на шаг 8 (настройки расчёта) - подготовить данные
        if (stepNumber === 8) {
            TrafficCalculator.prepareStep8Settings();
        }

    },

    updateStepsIndicator(currentStep) {
        document.querySelectorAll('.steps-indicator .step').forEach(step => {
            const stepNum = parseInt(step.getAttribute('data-step'));
            step.classList.remove('active', 'clickable');

            if (stepNum === currentStep) {
                step.classList.add('active');
            }

            // Показываем завершенные шаги
            if (TrafficState.completedSteps.includes(stepNum)) {
                step.classList.add('completed');
            } else {
                step.classList.remove('completed');
            }

            // Все шаги кроме текущего - кликабельные (свободная навигация)
            if (stepNum !== currentStep) {
                step.classList.add('clickable');
            }
        });
    },

    // Навигация по кликам на индикаторе шагов (свободная навигация)
    navigateToStep(stepNumber) {
        // Сохраняем данные текущего партнера, если мы на шаге 4 или 6
        if (TrafficState.currentStep === 4 && TrafficState.currentSelectedPartnerId) {
            TrafficManualData.saveCurrentManualData();
        }
        if (TrafficState.currentStep === 6 && TrafficState.currentSelectedPartnerId6) {
            TrafficManualData.saveCurrentManualDataStep6();
        }

        // Сохраняем настройки трафика при уходе с шага 8
        if (TrafficState.currentStep === 8 && TrafficState.trafficSettings) {
            TrafficCalculator.saveTrafficSettings();
        }

        // Переходим на выбранный шаг
        TrafficNavigation.goToStep(stepNumber);
    },

    skipStep(stepNumber) {
        // Пропускаем шаг и переходим к следующему
        TrafficNavigation.goToStep(stepNumber + 1);
    },

    // Завершение аналитики
    completeAnalytics() {
        // Проверяем обязательные шаги в правильном порядке
        if (!TrafficState.filesUploaded.deposits) {
            Toast.warning('Необходимо загрузить данные на шаге 2 "Пополнения и выводы"');
            return;
        }

        if (!TrafficState.filesUploaded.quality) {
            Toast.warning('Необходимо загрузить данные на шаге 3 "Контроль качества"');
            return;
        }

        if (!TrafficState.filesUploaded.percent) {
            Toast.warning('Необходимо загрузить данные на шаге 5 "Автоотключения"');
            return;
        }

        // Сохраняем данные текущего партнера перед завершением
        if (TrafficState.currentSelectedPartnerId) {
            TrafficManualData.saveCurrentManualData();
        }
        if (TrafficState.currentSelectedPartnerId6) {
            TrafficManualData.saveCurrentManualDataStep6();
        }

        // Переключаемся на вкладку "Отчет"
        TrafficState.currentTab = 'report';

        // Обновляем кнопки вкладок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-btn')[1].classList.add('active'); // Вторая кнопка - "Отчет"

        // Показываем вкладку отчета
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById('reportTab').classList.add('active');

        // Автоматически формируем отчет
        TrafficRenderer.generateReport();

    },

    // Подтверждение сброса аналитики
    async confirmResetAnalytics() {
        if (TrafficState.completedSteps.length > 0 || TrafficState.selectedPartners.length > 0) {
            if (await ConfirmModal.show('Сбросить все данные аналитики?', { description: 'Все выбранные партнеры, загруженные файлы и введенные данные будут очищены.', confirmText: 'Сбросить', danger: true })) {
                TrafficNavigation.resetAnalytics();
            }
        } else {
            Toast.warning('Нет данных для сброса');
        }
    },

    // Сброс всех данных аналитики (вызывается вручную или при начале нового анализа)
    resetAnalytics() {
        TrafficState.currentStep = 1;
        TrafficState.completedSteps = [];
        TrafficState.filesUploaded = {
            deposits: false,
            quality: false,
            percent: false
        };

        // Очищаем временные данные аналитики
        storage.clearAnalyticsData();
        TrafficState.currentSelectedPartnerId = null;
        TrafficState.allPartnersListForStep5 = [];
        TrafficState.selectedPartners = [];

        // Очищаем данные расчёта трафика
        TrafficState.currentReportData = [];
        TrafficState.trafficResults = [];

        // Очищаем статусы
        document.getElementById('depositsStatus').textContent = '';
        document.getElementById('qualityStatus').textContent = '';
        document.getElementById('percentStatus').textContent = '';

        // Отключаем кнопки
        document.getElementById('step1NextBtn').disabled = true;
        document.getElementById('step2NextBtn').disabled = true;
        document.getElementById('step3NextBtn').disabled = true;
        document.getElementById('step4NextBtn').disabled = true;
        document.getElementById('step5NextBtn').disabled = true;

        // Очищаем шаг 4 (ручные данные)
        document.getElementById('partnerSearchInput').value = '';
        document.getElementById('manualDataForm').classList.add('hidden');

        // Очищаем шаг 7 (отчёт)
        const reportNotGenerated = document.getElementById('reportNotGenerated');
        const reportGenerated = document.getElementById('reportGenerated');
        if (reportNotGenerated) reportNotGenerated.classList.remove('hidden');
        if (reportGenerated) reportGenerated.classList.add('hidden');

        // Очищаем шаг 9 (результаты расчёта)
        const resultsNotCalculated = document.getElementById('resultsNotCalculated');
        const resultsCalculated = document.getElementById('resultsCalculated');
        if (resultsNotCalculated) resultsNotCalculated.classList.remove('hidden');
        if (resultsCalculated) resultsCalculated.classList.add('hidden');

        // Очищаем input файлов
        const depositsInput = document.getElementById('depositsFileInput');
        const qualityInput = document.getElementById('qualityFileInput');
        const percentInput = document.getElementById('percentFileInput');
        if (depositsInput) depositsInput.value = '';
        if (qualityInput) qualityInput.value = '';
        if (percentInput) percentInput.value = '';

        // Возвращаемся на шаг 1
        TrafficNavigation.goToStep(1);

        // Обновляем предпросмотр
        TrafficRenderer.updateSelectedPartnersView();
    }
};
