// Модуль загрузки файлов
const TrafficUpload = {
    _MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
    _MAX_FILES: 20,
    _ALLOWED_EXTENSIONS: ['.xlsx', '.xls'],

    _validateFile(file) {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!this._ALLOWED_EXTENSIONS.includes(ext)) {
            return `Файл "${file.name}" не является Excel файлом. Поддерживаются только .xlsx и .xls`;
        }
        if (file.size > this._MAX_FILE_SIZE) {
            return `Файл "${file.name}" слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум: 100 МБ`;
        }
        return null;
    },

    // Отображение результата загрузки
    _showUploadResult(statusDiv, errors, totalCount, stepKey, btnId) {
        const successCount = totalCount - errors.length;
        if (errors.length > 0 && successCount === 0) {
            statusDiv.className = 'upload-status error';
            statusDiv.textContent = `Ошибки: ${errors.join('; ')}`;
        } else if (errors.length > 0) {
            statusDiv.className = 'upload-status warning';
            statusDiv.textContent = `Обработано ${successCount} из ${totalCount}. Ошибки: ${errors.join('; ')}`;
            this._markStepComplete(stepKey, btnId);
        } else {
            statusDiv.className = 'upload-status success';
            statusDiv.textContent = `Успешно обработано ${totalCount} файл(ов). Данные обновлены.`;
            this._markStepComplete(stepKey, btnId);
        }
    },

    // Проверка количества файлов
    _checkFileCount(files, statusDiv) {
        if (files.length > this._MAX_FILES) {
            statusDiv.className = 'upload-status error';
            statusDiv.textContent = `Слишком много файлов (${files.length}). Максимум: ${this._MAX_FILES}`;
            return false;
        }
        return true;
    },

    // Обработка загрузки "Пополнения и выводы"
    async handleDepositsUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const statusDiv = document.getElementById('depositsStatus');
        if (!this._checkFileCount(files, statusDiv)) return;
        statusDiv.className = 'upload-status info';
        statusDiv.textContent = `Обработка файлов (0/${files.length})...`;

        try {
            const allPartners = storage.getPartners();
            const commentsData = Object.create(null);
            const errors = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                statusDiv.textContent = `Обработка файлов (${i + 1}/${files.length}): ${file.name}`;

                const validationError = this._validateFile(file);
                if (validationError) {
                    errors.push(validationError);
                    continue;
                }

                try {
                    const data = await TrafficParsers.readExcelFile(file);
                    if (!data || data.length === 0) {
                        errors.push(`"${file.name}": файл пуст`);
                        continue;
                    }
                    TrafficParsers.parseDepositsData(data, commentsData);
                } catch (error) {
                    errors.push(`"${file.name}": ${error.message}`);
                }
            }

            // Обновляем данные партнеров
            allPartners.forEach(partner => {
                const comments = commentsData[String(partner.subagentId)] || { back: 0, cringe: 0 };
                partner.backCount = comments.back;
                partner.cringeCount = comments.cringe;
            });

            storage.savePartners(allPartners);
            this._showUploadResult(statusDiv, errors, files.length, 'deposits', 'step2NextBtn');
            event.target.value = '';

        } catch (error) {
            ErrorHandler.handle(error, { module: 'traffic-calculation', action: 'handleDepositsUpload' });
            statusDiv.className = 'upload-status error';
            statusDiv.textContent = 'Ошибка при обработке файлов: ' + error.message;
        }
    },

    // Обработка загрузки "Контроль качества" (шаг 3)
    async handleQualityUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const statusDiv = document.getElementById('qualityStatus');
        if (!this._checkFileCount(files, statusDiv)) return;
        statusDiv.className = 'upload-status info';
        statusDiv.textContent = `Обработка файлов (0/${files.length})...`;

        try {
            const allPartners = storage.getPartners();
            TrafficState.ourPartnerIds = allPartners.map(p => String(p.subagentId));
            const qualityData = Object.create(null);
            const errors = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                statusDiv.textContent = `Обработка файлов (${i + 1}/${files.length}): ${file.name}`;

                const validationError = this._validateFile(file);
                if (validationError) {
                    errors.push(validationError);
                    continue;
                }

                try {
                    const excelData = await TrafficParsers.readExcelFile(file);
                    if (!excelData || excelData.length === 0) {
                        errors.push(`"${file.name}": файл пуст`);
                        continue;
                    }
                    TrafficParsers.parseQualityControlData(excelData, qualityData);
                } catch (error) {
                    errors.push(`"${file.name}": ${error.message}`);
                }
            }

            // Обновляем данные каждого партнера
            allPartners.forEach(partner => {
                const data = qualityData[String(partner.subagentId)] || {};
                partner.depositTransactionsCount = data.depositTransactionsCount || 0;
                partner.withdrawalTransactionsCount = data.withdrawalTransactionsCount || 0;
                partner.depositAppealsCount = data.depositAppealsCount || 0;
                partner.delayedAppealsCount = data.delayedAppealsCount || 0;
                partner.depositSuccessPercent = data.depositSuccessPercent || 0;
                partner.withdrawalSuccessPercent = data.withdrawalSuccessPercent || 0;
            });

            storage.savePartners(allPartners);
            this._showUploadResult(statusDiv, errors, files.length, 'quality', 'step3NextBtn');
            event.target.value = '';

        } catch (error) {
            ErrorHandler.handle(error, { module: 'traffic-calculation', action: 'handleQualityUpload' });
            statusDiv.className = 'upload-status error';
            statusDiv.textContent = 'Ошибка при обработке файлов: ' + error.message;
        }
    },

    // Обработка загрузки "Процентовки" (шаг 5) - Подсчет автоотключений
    async handlePercentUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const statusDiv = document.getElementById('percentStatus');
        if (!this._checkFileCount(files, statusDiv)) return;
        statusDiv.className = 'upload-status info';
        statusDiv.textContent = `Обработка файлов (0/${files.length})...`;

        try {
            const allPartners = storage.getPartners();
            TrafficState.ourPartnerIds = allPartners.map(p => String(p.subagentId));
            const autoDisableCounters = Object.create(null);
            const errors = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                statusDiv.textContent = `Обработка файлов (${i + 1}/${files.length}): ${file.name}`;

                const validationError = this._validateFile(file);
                if (validationError) {
                    errors.push(validationError);
                    continue;
                }

                try {
                    const excelData = await TrafficParsers.readExcelFile(file);
                    if (!excelData || excelData.length === 0) {
                        errors.push(`"${file.name}": файл пуст`);
                        continue;
                    }
                    TrafficParsers.countAutoDisables(excelData, autoDisableCounters);
                } catch (error) {
                    errors.push(`"${file.name}": ${error.message}`);
                }
            }

            allPartners.forEach(partner => {
                partner.autoDisableCount = autoDisableCounters[String(partner.subagentId)] || 0;
            });
            storage.savePartners(allPartners);
            this._showUploadResult(statusDiv, errors, files.length, 'percent', 'step5NextBtn');
            event.target.value = '';

        } catch (error) {
            ErrorHandler.handle(error, { module: 'traffic-calculation', action: 'handlePercentUpload' });
            statusDiv.className = 'upload-status error';
            statusDiv.textContent = 'Ошибка при обработке файлов: ' + error.message;
        }
    },

    // Отметка шага как завершенного
    _markStepComplete(stepKey, btnId) {
        TrafficState.filesUploaded[stepKey] = true;
        const stepNumbers = { deposits: 2, quality: 3, percent: 5 };
        const stepNumber = stepNumbers[stepKey];
        if (!TrafficState.completedSteps.includes(stepNumber)) {
            TrafficState.completedSteps.push(stepNumber);
        }
        TrafficNavigation.updateStepsIndicator(TrafficState.currentStep);
        document.getElementById(btnId).disabled = false;
    },

    // Сброс шага (общий метод)
    _resetStepUI(statusId, fileInputId, btnId) {
        const statusDiv = document.getElementById(statusId);
        statusDiv.textContent = '';
        statusDiv.className = 'upload-status';
        document.getElementById(fileInputId).value = '';
        document.getElementById(btnId).disabled = true;
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
        this._resetStepUI('depositsStatus', 'depositsFileInput', 'step2NextBtn');
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
        this._resetStepUI('qualityStatus', 'qualityFileInput', 'step3NextBtn');
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
        this._resetStepUI('percentStatus', 'percentFileInput', 'step5NextBtn');
        TrafficNavigation.updateStepsIndicator(TrafficState.currentStep);
        Toast.success('Данные автоотключений сброшены');
    }
};
