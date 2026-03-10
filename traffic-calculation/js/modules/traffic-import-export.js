// Модуль импорта/экспорта данных
const TrafficImportExport = {
    // Экспорт настроек калькулятора в JSON
    exportTrafficSettings() {
        if (!TrafficState.trafficSettings) {
            Toast.error('Настройки не загружены');
            return;
        }

        // Создаем объект экспорта с метаданными
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            settings: TrafficState.trafficSettings
        };

        // Конвертируем в JSON
        const jsonString = JSON.stringify(exportData, null, 2);

        // Создаем Blob
        const blob = new Blob([jsonString], { type: 'application/json' });

        // Создаем ссылку для скачивания
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `traffic_settings_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // Импорт настроек калькулятора из JSON
    importTrafficSettings() {
        // Создаем input для выбора файла
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const jsonData = JSON.parse(event.target.result);

                    // Валидация структуры
                    if (!jsonData.settings || typeof jsonData.settings !== 'object') {
                        throw new Error('Неверная структура файла настроек');
                    }

                    // Подтверждение перед импортом
                    if (!await ConfirmModal.show('Вы уверены, что хотите заменить текущие настройки на импортированные?')) {
                        return;
                    }

                    // Применяем настройки
                    TrafficState.trafficSettings = jsonData.settings;
                    TrafficCalculator.saveTrafficSettings();

                    // Перерисовываем форму с новыми настройками
                    TrafficCalculator.renderTrafficSettings();

                    Toast.success('Настройки успешно импортированы!');
                } catch (error) {
                    ErrorHandler.handle(error, {
                        module: 'traffic-calculation',
                        action: 'importTrafficSettings',
                        userMessage: `Ошибка при импорте настроек: ${error.message}`
                    });
                }
            };

            reader.onerror = () => {
                Toast.error('Ошибка при чтении файла');
            };

            reader.readAsText(file);
        };

        input.click();
    },

    // Экспорт результатов в Excel
    exportTrafficResults() {
        if (!TrafficState.trafficResults || TrafficState.trafficResults.length === 0) {
            Toast.warning('Нет данных для экспорта');
            return;
        }

        // Подготавливаем данные для Excel
        const data = TrafficState.trafficResults.map(result => ({
            'Метод': result.method,
            'Субагент': result.subagent,
            'ID Субагента': result.subagentId,
            'Хороший': result.scores.good,
            'Нормальный': result.scores.normal,
            'Плохой': result.scores.bad,
            'Ужасный': result.scores.terrible,
            'Всего': result.scores.total,
            '% Трафика': result.trafficPercent + '%'
        }));

        // Создаем книгу Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Результаты');

        // Скачиваем файл
        const date = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `traffic_results_${date}.xlsx`);
    },

    // Экспорт детального отчета в Excel
    exportReportToExcel() {
        if (!TrafficState.currentReportData || TrafficState.currentReportData.length === 0) {
            Toast.warning('Нет данных для экспорта');
            return;
        }

        // Подготавливаем данные для Excel
        const data = TrafficState.currentReportData.map(partner => {
            const date = new Date(partner.dateAdded).toLocaleDateString('ru-RU');
            const statusText = partner.status === 'новый' ? 'Новый' : partner.status === 'старый' ? 'Старый' : 'Закрыт';

            return {
                'Метод': partner.method,
                'Субагент': partner.subagent,
                'Субагент ID': partner.subagentId,
                'Статус': statusText,
                'Дата добавления': date,
                'Back': partner.backCount || 0,
                'Cringe': partner.cringeCount || 0,
                'Автоотключение': partner.autoDisableCount || 0,
                'Кол-во пополнений': partner.depositTransactionsCount || 0,
                'Кол-во выводов': partner.withdrawalTransactionsCount || 0,
                'Обращений по пополнениям': partner.depositAppealsCount || 0,
                'Обращения 15+ мин': partner.delayedAppealsCount || 0,
                '% успешных пополнений': partner.depositSuccessPercent || 0,
                '% успешных выводов': partner.withdrawalSuccessPercent || 0,
                '% Времени работы на пополнения': partner.depositWorkTimePercent || 0,
                '% Времени работы на вывод': partner.withdrawalWorkTimePercent || 0,
                'Игнорирование чатов': partner.chatIgnoring || 0,
                'Игнор Webmanagement': partner.webmanagementIgnore || 0,
                'Очереди на пополнение': partner.depositQueues || 0,
                'Очереди на вывод': partner.withdrawalQueues || 0,
                'Зачисление вне лимитов': partner.creditsOutsideLimits || 0,
                'Одобрение неверной суммы': partner.wrongAmountApproval || 0,
                'Другие нарушения': partner.otherViolations || 0,
                '_description': partner.otherViolationsDescription || '' // Временное поле для комментария
            };
        });

        // Создаем книгу Excel
        const wb = XLSX.utils.book_new();

        // Убираем временное поле перед созданием листа
        const exportData = data.map(({ _description, ...rest }) => rest);
        const ws = XLSX.utils.json_to_sheet(exportData);

        // Добавляем комментарии к ячейкам "Другие нарушения" (колонка W, индекс 22)
        const otherViolationsCol = 22; // Колонка W (23-я колонка, индекс 22)

        data.forEach((row, index) => {
            if (row._description) {
                const cellRef = XLSX.utils.encode_cell({ r: index + 1, c: otherViolationsCol });

                // Создаем ячейку если не существует
                if (!ws[cellRef]) {
                    ws[cellRef] = { v: row['Другие нарушения'], t: 'n' };
                }

                // Добавляем комментарий
                ws[cellRef].c = [{
                    a: 'Описание нарушений',
                    t: row._description
                }];
            }
        });

        XLSX.utils.book_append_sheet(wb, ws, 'Детальный отчет');

        // Скачиваем файл
        const date = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `detailed_report_${date}.xlsx`);
    },

    // Экспорт списка партнеров в JSON
    exportPartners() {
        const partners = storage.getPartners();

        if (partners.length === 0) {
            Toast.warning('Список партнеров пуст. Нечего экспортировать.');
            return;
        }

        // Список полей, которые НЕ нужно экспортировать (данные аналитики)
        const analyticsFields = [
            'backCount', 'cringeCount', 'autoDisableCount', 'prepaymentDisable',
            'depositTransactionsCount', 'withdrawalTransactionsCount',
            'depositAppealsCount', 'delayedAppealsCount',
            'depositSuccessPercent', 'withdrawalSuccessPercent',
            'depositWorkTimePercent', 'withdrawalWorkTimePercent',
            'chatIgnoring', 'webmanagementIgnore',
            'depositQueues', 'withdrawalQueues',
            'creditsOutsideLimits', 'wrongAmountApproval', 'otherViolations'
        ];

        // Экспортируем только базовые данные партнеров (без аналитики)
        const cleanPartners = partners.map(partner => {
            const cleanPartner = {};
            for (const key in partner) {
                // Копируем только если это НЕ поле аналитики
                if (!analyticsFields.includes(key)) {
                    cleanPartner[key] = partner[key];
                }
            }
            return cleanPartner;
        });

        // Создаем объект экспорта с метаданными
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            totalPartners: cleanPartners.length,
            partners: cleanPartners
        };

        // Конвертируем в JSON
        const jsonString = JSON.stringify(exportData, null, 2);

        // Создаем Blob
        const blob = new Blob([jsonString], { type: 'application/json' });

        // Создаем ссылку для скачивания
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `partners_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // Показать модальное окно импорта
    showImportModal() {
        const modal = document.getElementById('importPartnersModal');
        const fileInput = document.getElementById('importPartnersFileInput');
        const preview = document.getElementById('importPartnersPreview');
        const importBtn = document.getElementById('importPartnersBtn');

        // Сброс состояния
        fileInput.value = '';
        preview.classList.add('hidden');
        preview.classList.remove('preview-error');
        preview.innerHTML = '';
        importBtn.disabled = true;

        // Обработчик выбора файла
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) {
                preview.classList.add('hidden');
                importBtn.disabled = true;
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const jsonData = JSON.parse(event.target.result);

                    // Валидация структуры
                    if (!jsonData.partners || !Array.isArray(jsonData.partners)) {
                        throw new Error('Неверная структура файла');
                    }

                    // Показываем превью
                    preview.classList.remove('hidden', 'preview-error');
                    preview.innerHTML = `
                        <strong>Файл готов к импорту:</strong><br>
                        Партнеров в файле: ${jsonData.partners.length}<br>
                        Дата экспорта: ${jsonData.exportDate ? new Date(jsonData.exportDate).toLocaleString('ru-RU') : 'неизвестно'}
                    `;

                    importBtn.disabled = false;
                } catch (error) {
                    preview.classList.remove('hidden');
                    preview.classList.add('preview-error');
                    preview.innerHTML = `<strong>Ошибка:</strong> ${error.message}`;
                    importBtn.disabled = true;
                }
            };

            reader.onerror = () => {
                preview.classList.remove('hidden');
                preview.classList.add('preview-error');
                preview.innerHTML = '<strong>Ошибка:</strong> Не удалось прочитать файл';
                importBtn.disabled = true;
            };

            reader.readAsText(file);
        };

        modal.classList.add('show');

    },

    // Закрыть модальное окно импорта
    closeImportModal() {
        document.getElementById('importPartnersModal').classList.remove('show');
    },

    // Импорт списка партнеров из JSON
    importPartners() {
        const fileInput = document.getElementById('importPartnersFileInput');
        const file = fileInput.files[0];

        if (!file) {
            Toast.warning('Выберите файл для импорта');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const jsonData = JSON.parse(event.target.result);

                // Валидация структуры
                if (!jsonData.partners || !Array.isArray(jsonData.partners)) {
                    throw new Error('Неверная структура файла');
                }

                // Подтверждение перед импортом
                const currentPartners = storage.getPartners();
                var desc = currentPartners.length > 0
                    ? 'Текущие ' + currentPartners.length + ' партнер(ов) будут заменены!'
                    : '';

                if (!await ConfirmModal.show('Импортировать ' + jsonData.partners.length + ' партнер(ов)?', { description: desc, confirmText: 'Импортировать', danger: currentPartners.length > 0 })) {
                    return;
                }

                // Список полей аналитики, которые НЕ должны импортироваться
                const analyticsFields = [
                    'backCount', 'cringeCount', 'autoDisableCount', 'prepaymentDisable',
                    'depositTransactionsCount', 'withdrawalTransactionsCount',
                    'depositAppealsCount', 'delayedAppealsCount',
                    'depositSuccessPercent', 'withdrawalSuccessPercent',
                    'depositWorkTimePercent', 'withdrawalWorkTimePercent',
                    'chatIgnoring', 'webmanagementIgnore',
                    'depositQueues', 'withdrawalQueues',
                    'creditsOutsideLimits', 'wrongAmountApproval', 'otherViolations'
                ];

                // Создаем Map для быстрого поиска существующих партнеров по ID
                const existingPartnersMap = new Map();
                currentPartners.forEach(p => existingPartnersMap.set(p.id, p));

                // Обработка данных с сохранением аналитики
                const processedPartners = jsonData.partners.map(partner => {
                    // Убеждаемся что есть обязательные поля
                    if (!partner.id) {
                        partner.id = Date.now().toString() + Math.random().toString(36).slice(2, 11);
                    }
                    if (!partner.dateAdded) {
                        partner.dateAdded = new Date().toISOString();
                    }
                    if (!partner.status) {
                        partner.status = 'новый';
                    }

                    // Если партнер с таким ID уже существует, сохраняем его данные аналитики
                    const existingPartner = existingPartnersMap.get(partner.id);
                    if (existingPartner) {
                        // Копируем данные аналитики из существующего партнера
                        analyticsFields.forEach(field => {
                            if (existingPartner[field] !== undefined) {
                                partner[field] = existingPartner[field];
                            }
                        });
                    } else {
                        // Для нового партнера удаляем любые данные аналитики из импорта
                        analyticsFields.forEach(field => {
                            delete partner[field];
                        });
                    }

                    return partner;
                });

                // Сохраняем импортированные данные
                storage.savePartners(processedPartners);

                // Обновляем интерфейс
                TrafficRenderer.renderPartners();
                TrafficRenderer.loadMethods();
                TrafficImportExport.closeImportModal();

                Toast.success(`Успешно импортировано ${processedPartners.length} партнер(ов)!`);
            } catch (error) {
                ErrorHandler.handle(error, {
                    module: 'traffic-calculation',
                    action: 'importPartners',
                    userMessage: `Ошибка при импорте: ${error.message}`
                });
            }
        };

        reader.onerror = () => {
            Toast.error('Ошибка при чтении файла');
        };

        reader.readAsText(file);
    },

    // Добавление партнера
    addPartner() {
        const method = document.getElementById('methodSelect').value;
        const subagent = document.getElementById('subagentInput').value.trim();
        const subagentId = document.getElementById('subagentIdInput').value.trim();

        if (!method || !subagent || !subagentId) {
            Toast.warning('Пожалуйста, заполните все поля');
            return;
        }

        const partner = {
            method,
            subagent,
            subagentId
        };

        storage.addPartner(partner);

        // Очищаем форму
        document.getElementById('partnerForm').reset();

        // Обновляем отображение
        TrafficRenderer.renderPartners();
        TrafficRenderer.updateCounts();

        Toast.success('Партнер успешно добавлен!');
    },

    // Удаление партнера
    async deletePartner(id) {
        if (!await ConfirmModal.show('Вы уверены, что хотите удалить этого партнера?', { danger: true })) {
            return;
        }

        storage.deletePartner(id);
        TrafficRenderer.renderPartners();
        TrafficRenderer.updateCounts();
    },

    // Добавление метода
    addMethod() {
        const input = document.getElementById('newMethodInput');
        const methodName = input.value.trim();

        if (!methodName) {
            Toast.warning('Введите название метода');
            return;
        }

        if (storage.addMethod(methodName)) {
            input.value = '';
            TrafficRenderer.loadMethods();
            TrafficRenderer.renderMethodsList();
            Toast.success('Метод добавлен!');
        } else {
            Toast.warning('Такой метод уже существует');
        }
    },

    // Удаление метода
    async deleteMethod(methodName) {
        if (!await ConfirmModal.show('Удалить метод "' + methodName + '"?', { danger: true })) {
            return;
        }

        storage.deleteMethod(methodName);
        TrafficRenderer.loadMethods();
        TrafficRenderer.renderMethodsList();
    },

    // Обновление статусов партнеров
    updatePartnerStatuses() {
        storage.updatePartnerStatuses();
    },

    // Фильтрация партнеров
    filterPartners() {
        TrafficRenderer.renderPartners();
        TrafficRenderer.updateCounts();
    }
};
