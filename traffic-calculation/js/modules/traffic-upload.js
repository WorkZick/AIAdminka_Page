// Модуль загрузки файлов
const TrafficUpload = {
    // Обработка загрузки "Пополнения и выводы"
    async handleDepositsUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const statusDiv = document.getElementById('depositsStatus');
        statusDiv.className = 'upload-status info';
        statusDiv.textContent = 'Обработка файлов...';

        try {
            const allPartners = storage.getPartners();
            const commentsData = {};

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const data = await TrafficParsers.readExcelFile(file);
                TrafficParsers.parseDepositsData(data, commentsData);
            }

            // Обновляем данные партнеров
            allPartners.forEach(partner => {
                const comments = commentsData[String(partner.subagentId)] || { back: 0, cringe: 0 };
                partner.backCount = comments.back;
                partner.cringeCount = comments.cringe;
            });

            storage.savePartners(allPartners);

            statusDiv.className = 'upload-status success';
            statusDiv.textContent = `Успешно обработано ${files.length} файл(ов). Данные обновлены.`;

            TrafficState.filesUploaded.deposits = true;
            // Отмечаем шаг 2 как завершенный
            if (!TrafficState.completedSteps.includes(2)) {
                TrafficState.completedSteps.push(2);
            }
            TrafficNavigation.updateStepsIndicator(TrafficState.currentStep);
            document.getElementById('step2NextBtn').disabled = false;

            event.target.value = '';

        } catch (error) {
            ErrorHandler.handle(error, {
                module: 'traffic-calculation',
                action: 'handleDepositsUpload'
            });
            statusDiv.className = 'upload-status error';
            statusDiv.textContent = 'Ошибка при обработке файлов: ' + error.message;
        }
    },

    // Обработка загрузки "Контроль качества" (шаг 3)
    async handleQualityUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const statusDiv = document.getElementById('qualityStatus');
        statusDiv.className = 'upload-status info';
        statusDiv.textContent = 'Обработка файлов...';

        try {
            // Шаг 1: Получаем всех партнеров из системы
            const allPartners = storage.getPartners();

            // Шаг 2: Собираем список наших Субагент ID (приводим к строкам для сравнения)
            TrafficState.ourPartnerIds = allPartners.map(p => String(p.subagentId));

            // Шаг 3: Создаем объект для хранения данных контроля качества
            // Формат: { "ID": { depositTransactionsCount: 0, withdrawalTransactionsCount: 0, ... } }
            const qualityData = {};

            // Шаг 4: Обрабатываем каждый загруженный файл
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const excelData = await TrafficParsers.readExcelFile(file);
                TrafficParsers.parseQualityControlData(excelData, qualityData);
            }

            // Шаг 5: Обновляем данные каждого партнера
            allPartners.forEach(partner => {
                const data = qualityData[String(partner.subagentId)] || {};

                // Кол-во пополнений
                partner.depositTransactionsCount = data.depositTransactionsCount || 0;

                // Кол-во выводов
                partner.withdrawalTransactionsCount = data.withdrawalTransactionsCount || 0;

                // Обращений по пополнениям
                partner.depositAppealsCount = data.depositAppealsCount || 0;

                // Обращения обработанные 15+ минут
                partner.delayedAppealsCount = data.delayedAppealsCount || 0;

                // Процент успешных пополнений (конвертируем 0.89 -> 89)
                partner.depositSuccessPercent = data.depositSuccessPercent || 0;

                // Процент успешных выводов (конвертируем 0.89 -> 89)
                partner.withdrawalSuccessPercent = data.withdrawalSuccessPercent || 0;
            });

            // Шаг 6: Сохраняем обновленные данные
            storage.savePartners(allPartners);

            // Успех!
            statusDiv.className = 'upload-status success';
            statusDiv.textContent = `Успешно обработано ${files.length} файл(ов). Данные обновлены.`;

            TrafficState.filesUploaded.quality = true;
            // Отмечаем шаг 3 как завершенный
            if (!TrafficState.completedSteps.includes(3)) {
                TrafficState.completedSteps.push(3);
            }
            TrafficNavigation.updateStepsIndicator(TrafficState.currentStep);
            document.getElementById('step3NextBtn').disabled = false;

            event.target.value = '';

        } catch (error) {
            ErrorHandler.handle(error, {
                module: 'traffic-calculation',
                action: 'handleQualityUpload'
            });
            statusDiv.className = 'upload-status error';
            statusDiv.textContent = 'Ошибка при обработке файлов: ' + error.message;
        }
    },

    // Обработка загрузки "Процентовки" (шаг 5) - Подсчет автоотключений
    async handlePercentUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const statusDiv = document.getElementById('percentStatus');
        statusDiv.className = 'upload-status info';
        statusDiv.textContent = 'Обработка файлов...';

        try {
            // Шаг 1: Получаем всех партнеров из системы
            const allPartners = storage.getPartners();

            // Шаг 2: Собираем список наших Субагент ID (приводим к строкам для сравнения)
            TrafficState.ourPartnerIds = allPartners.map(p => String(p.subagentId));

            // Шаг 3: Создаем объект для хранения счетчиков автоотключений
            // Формат: { "ID": количество }
            const autoDisableCounters = {};

            // Шаг 4: Обрабатываем каждый загруженный файл
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const excelData = await TrafficParsers.readExcelFile(file);
                TrafficParsers.countAutoDisables(excelData, autoDisableCounters);
            }

            // Шаг 5: Обновляем данные каждого партнера
            allPartners.forEach(partner => {
                // Берем количество автоотключений для данного ID
                // Если в файле не нашли - ставим 0
                partner.autoDisableCount = autoDisableCounters[String(partner.subagentId)] || 0;
            });

            // Шаг 6: Сохраняем обновленные данные
            storage.savePartners(allPartners);

            // Успех!
            statusDiv.className = 'upload-status success';
            statusDiv.textContent = `Успешно обработано ${files.length} файл(ов). Данные обновлены.`;

            TrafficState.filesUploaded.percent = true;
            // Отмечаем шаг 5 как завершенный
            if (!TrafficState.completedSteps.includes(5)) {
                TrafficState.completedSteps.push(5);
            }
            TrafficNavigation.updateStepsIndicator(TrafficState.currentStep);
            document.getElementById('step5NextBtn').disabled = false;

            event.target.value = '';

        } catch (error) {
            ErrorHandler.handle(error, {
                module: 'traffic-calculation',
                action: 'handlePercentUpload'
            });
            statusDiv.className = 'upload-status error';
            statusDiv.textContent = 'Ошибка при обработке файлов: ' + error.message;
        }
    },

    // Сброс данных шага 2 (пополнения и выводы)
    async resetDepositsData() {
        if (!TrafficState.filesUploaded.deposits) {
            Toast.warning('Нет данных для сброса');
            return;
        }

        if (!await ConfirmModal.show('Сбросить данные пополнений и выводов (back/cringe)?', { confirmText: 'Сбросить', danger: true })) {
            return;
        }

        const allPartners = storage.getPartners();
        allPartners.forEach(partner => {
            partner.backCount = 0;
            partner.cringeCount = 0;
        });
        storage.savePartners(allPartners);

        TrafficState.filesUploaded.deposits = false;
        TrafficState.completedSteps = TrafficState.completedSteps.filter(s => s !== 2);

        document.getElementById('depositsStatus').textContent = '';
        document.getElementById('depositsStatus').className = 'upload-status';
        document.getElementById('depositsFileInput').value = '';
        document.getElementById('step2NextBtn').disabled = true;

        TrafficNavigation.updateStepsIndicator(TrafficState.currentStep);
        Toast.success('Данные пополнений и выводов сброшены');
    },

    // Сброс данных шага 3 (контроль качества)
    async resetQualityData() {
        if (!TrafficState.filesUploaded.quality) {
            Toast.warning('Нет данных для сброса');
            return;
        }

        if (!await ConfirmModal.show('Сбросить данные контроля качества?', { confirmText: 'Сбросить', danger: true })) {
            return;
        }

        const allPartners = storage.getPartners();
        allPartners.forEach(partner => {
            partner.depositTransactionsCount = 0;
            partner.withdrawalTransactionsCount = 0;
            partner.depositAppealsCount = 0;
            partner.delayedAppealsCount = 0;
            partner.depositSuccessPercent = 0;
            partner.withdrawalSuccessPercent = 0;
        });
        storage.savePartners(allPartners);

        TrafficState.filesUploaded.quality = false;
        TrafficState.completedSteps = TrafficState.completedSteps.filter(s => s !== 3);

        document.getElementById('qualityStatus').textContent = '';
        document.getElementById('qualityStatus').className = 'upload-status';
        document.getElementById('qualityFileInput').value = '';
        document.getElementById('step3NextBtn').disabled = true;

        TrafficNavigation.updateStepsIndicator(TrafficState.currentStep);
        Toast.success('Данные контроля качества сброшены');
    },

    // Сброс данных шага 5 (автоотключения)
    async resetPercentData() {
        if (!TrafficState.filesUploaded.percent) {
            Toast.warning('Нет данных для сброса');
            return;
        }

        if (!await ConfirmModal.show('Сбросить данные автоотключений?', { confirmText: 'Сбросить', danger: true })) {
            return;
        }

        const allPartners = storage.getPartners();
        allPartners.forEach(partner => {
            partner.autoDisableCount = 0;
        });
        storage.savePartners(allPartners);

        TrafficState.filesUploaded.percent = false;
        TrafficState.completedSteps = TrafficState.completedSteps.filter(s => s !== 5);

        document.getElementById('percentStatus').textContent = '';
        document.getElementById('percentStatus').className = 'upload-status';
        document.getElementById('percentFileInput').value = '';
        document.getElementById('step5NextBtn').disabled = true;

        TrafficNavigation.updateStepsIndicator(TrafficState.currentStep);
        Toast.success('Данные автоотключений сброшены');
    }
};
