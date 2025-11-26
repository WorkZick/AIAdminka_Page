// Основной модуль управления трафиком
const trafficCalc = {
    currentTab: 'partners',
    selectedPartners: [],
    editingPartnerId: null,
    currentReportData: null,
    currentStep: 1,
    completedSteps: [], // Список завершенных шагов
    filesUploaded: {
        deposits: false,
        quality: false,
        percent: false
    },

    // КАЛЬКУЛЯТОР ТРАФИКА

    // Открыть калькулятор трафика
    openTrafficCalculator() {
        if (!this.currentReportData || this.currentReportData.length === 0) {
            alert('Сначала сформируйте отчет');
            return;
        }

        // Загружаем или создаем настройки
        this.trafficSettings = this.loadTrafficSettings();
        
        // Отображаем форму настроек
        this.renderTrafficSettings();
        
        // Открываем модальное окно
        document.getElementById('trafficCalculatorModal').classList.add('show');
        
        // Обновляем иконки
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    // Закрыть калькулятор трафика
    closeTrafficCalculator() {
        document.getElementById('trafficCalculatorModal').classList.remove('show');
    },

    // Загрузить настройки из localStorage или создать дефолтные
    loadTrafficSettings() {
        const saved = localStorage.getItem('trafficSettings');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Error loading traffic settings:', e);
            }
        }
        return this.getDefaultTrafficSettings();
    },

    // Получить дефолтные настройки
    getDefaultTrafficSettings() {
        const settings = {};
        
        this.trafficParams.forEach(param => {
            if (param.type === 'text') {
                // Для текстовых полей (например, статус)
                settings[param.key] = {
                    good: { value: 'новый', points: 10 },
                    normal: { value: 'старый', points: 5 },
                    bad: { value: 'закрыт', points: -5 },
                    terrible: { value: '', points: -10 }
                };
            } else if (param.type === 'percent') {
                // Для процентов (80-100 = хорошо, 60-79 = нормально, и т.д.)
                settings[param.key] = {
                    good: { min: 80, max: 100, points: 10 },
                    normal: { min: 60, max: 79, points: 5 },
                    bad: { min: 40, max: 59, points: -5 },
                    terrible: { min: 0, max: 39, points: -10 }
                };
            } else if (param.type === 'multiplier') {
                // Для множителя (баллы за каждое нарушение)
                settings[param.key] = {
                    pointsPerItem: -20
                };
            } else {
                // Для числовых полей (чем меньше = лучше)
                settings[param.key] = {
                    good: { min: 0, max: 0, points: 10 },
                    normal: { min: 1, max: 2, points: 5 },
                    bad: { min: 3, max: 5, points: -5 },
                    terrible: { min: 6, max: 9999, points: -10 }
                };
            }
        });
        
        return settings;
    },

    // Сохранить настройки
    saveTrafficSettings() {
        localStorage.setItem('trafficSettings', JSON.stringify(this.trafficSettings));
    },

    // Экспорт настроек калькулятора в JSON
    exportTrafficSettings() {
        if (!this.trafficSettings) {
            alert('Настройки не загружены');
            return;
        }

        // Создаем объект экспорта с метаданными
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            settings: this.trafficSettings
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
            reader.onload = (event) => {
                try {
                    const jsonData = JSON.parse(event.target.result);

                    // Валидация структуры
                    if (!jsonData.settings || typeof jsonData.settings !== 'object') {
                        throw new Error('Неверная структура файла настроек');
                    }

                    // Подтверждение перед импортом
                    if (!confirm('Вы уверены, что хотите заменить текущие настройки на импортированные?')) {
                        return;
                    }

                    // Применяем настройки
                    this.trafficSettings = jsonData.settings;
                    this.saveTrafficSettings();

                    // Перерисовываем форму с новыми настройками
                    this.renderTrafficSettings();

                    // Обновляем иконки
                    if (typeof lucide !== 'undefined') {
                        lucide.createIcons();
                    }

                    alert('Настройки успешно импортированы!');
                } catch (error) {
                    alert(`Ошибка при импорте настроек: ${error.message}`);
                    console.error('Import error:', error);
                }
            };

            reader.onerror = () => {
                alert('Ошибка при чтении файла');
            };

            reader.readAsText(file);
        };

        input.click();
    },

    // Отрисовать форму настроек
    renderTrafficSettings() {
        const container = document.getElementById('trafficSettingsForm');
        if (!container) return;

        container.innerHTML = this.trafficParams.map(param => {
            const settings = this.trafficSettings[param.key];
            
            if (param.type === 'text') {
                // Для текстовых полей
                return `
                    <div class="traffic-param-section">
                        <div class="traffic-param-header">
                            <i data-lucide="type"></i>
                            ${this.escapeHtml(param.name)}
                        </div>
                        <div class="traffic-param-grid">
                            <div class="traffic-level-card good">
                                <div class="traffic-level-title">Хор.</div>
                                <div class="form-group">
                                    <label>Значение</label>
                                    <input type="text" value="${this.escapeHtml(settings.good.value)}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'good', 'value', this.value)">
                                </div>
                                <div class="traffic-points-group">
                                    <label>Баллы:</label>
                                    <input type="number" value="${settings.good.points}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'good', 'points', parseInt(this.value))">
                                </div>
                            </div>
                            <div class="traffic-level-card normal">
                                <div class="traffic-level-title">Норм.</div>
                                <div class="form-group">
                                    <label>Значение</label>
                                    <input type="text" value="${this.escapeHtml(settings.normal.value)}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'normal', 'value', this.value)">
                                </div>
                                <div class="traffic-points-group">
                                    <label>Баллы:</label>
                                    <input type="number" value="${settings.normal.points}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'normal', 'points', parseInt(this.value))">
                                </div>
                            </div>
                            <div class="traffic-level-card bad">
                                <div class="traffic-level-title">Плох.</div>
                                <div class="form-group">
                                    <label>Значение</label>
                                    <input type="text" value="${this.escapeHtml(settings.bad.value)}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'bad', 'value', this.value)">
                                </div>
                                <div class="traffic-points-group">
                                    <label>Баллы:</label>
                                    <input type="number" value="${settings.bad.points}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'bad', 'points', parseInt(this.value))">
                                </div>
                            </div>
                            <div class="traffic-level-card terrible">
                                <div class="traffic-level-title">Ужас.</div>
                                <div class="form-group">
                                    <label>Значение</label>
                                    <input type="text" value="${this.escapeHtml(settings.terrible.value)}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'terrible', 'value', this.value)">
                                </div>
                                <div class="traffic-points-group">
                                    <label>Баллы:</label>
                                    <input type="number" value="${settings.terrible.points}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'terrible', 'points', parseInt(this.value))">
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else if (param.type === 'multiplier') {
                // Для множителя (баллы за каждое нарушение)
                return `
                    <div class="traffic-param-section">
                        <div class="traffic-param-header">
                            <i data-lucide="alert-triangle"></i>
                            ${this.escapeHtml(param.name)}
                        </div>
                        <div class="traffic-multiplier-settings">
                            <div class="traffic-multiplier-card">
                                <div class="traffic-multiplier-info">
                                    <span class="multiplier-label">Баллы за каждое нарушение:</span>
                                    <input type="number" value="${settings.pointsPerItem || -20}"
                                           onchange="trafficCalc.updateTrafficSettingMultiplier('${param.key}', 'pointsPerItem', parseInt(this.value))">
                                </div>
                                <div class="multiplier-example">
                                    Пример: 5 нарушений = <span id="${param.key}Example">${(settings.pointsPerItem || -20) * 5}</span> баллов
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Для числовых и процентных полей
                return `
                    <div class="traffic-param-section">
                        <div class="traffic-param-header">
                            <i data-lucide="hash"></i>
                            ${this.escapeHtml(param.name)}
                        </div>
                        <div class="traffic-param-grid">
                            <div class="traffic-level-card good">
                                <div class="traffic-level-title">Хор.</div>
                                <div class="traffic-range-group">
                                    <label>От:</label>
                                    <input type="number" value="${settings.good.min}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'good', 'min', parseFloat(this.value))">
                                </div>
                                <div class="traffic-range-group">
                                    <label>До:</label>
                                    <input type="number" value="${settings.good.max}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'good', 'max', parseFloat(this.value))">
                                </div>
                                <div class="traffic-points-group">
                                    <label>Баллы:</label>
                                    <input type="number" value="${settings.good.points}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'good', 'points', parseInt(this.value))">
                                </div>
                            </div>
                            <div class="traffic-level-card normal">
                                <div class="traffic-level-title">Норм.</div>
                                <div class="traffic-range-group">
                                    <label>От:</label>
                                    <input type="number" value="${settings.normal.min}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'normal', 'min', parseFloat(this.value))">
                                </div>
                                <div class="traffic-range-group">
                                    <label>До:</label>
                                    <input type="number" value="${settings.normal.max}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'normal', 'max', parseFloat(this.value))">
                                </div>
                                <div class="traffic-points-group">
                                    <label>Баллы:</label>
                                    <input type="number" value="${settings.normal.points}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'normal', 'points', parseInt(this.value))">
                                </div>
                            </div>
                            <div class="traffic-level-card bad">
                                <div class="traffic-level-title">Плох.</div>
                                <div class="traffic-range-group">
                                    <label>От:</label>
                                    <input type="number" value="${settings.bad.min}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'bad', 'min', parseFloat(this.value))">
                                </div>
                                <div class="traffic-range-group">
                                    <label>До:</label>
                                    <input type="number" value="${settings.bad.max}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'bad', 'max', parseFloat(this.value))">
                                </div>
                                <div class="traffic-points-group">
                                    <label>Баллы:</label>
                                    <input type="number" value="${settings.bad.points}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'bad', 'points', parseInt(this.value))">
                                </div>
                            </div>
                            <div class="traffic-level-card terrible">
                                <div class="traffic-level-title">Ужас.</div>
                                <div class="traffic-range-group">
                                    <label>От:</label>
                                    <input type="number" value="${settings.terrible.min}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'terrible', 'min', parseFloat(this.value))">
                                </div>
                                <div class="traffic-range-group">
                                    <label>До:</label>
                                    <input type="number" value="${settings.terrible.max}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'terrible', 'max', parseFloat(this.value))">
                                </div>
                                <div class="traffic-points-group">
                                    <label>Баллы:</label>
                                    <input type="number" value="${settings.terrible.points}"
                                           onchange="trafficCalc.updateTrafficSetting('${param.key}', 'terrible', 'points', parseInt(this.value))">
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }).join('');

        // Обновляем иконки
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    // Обновить настройку
    updateTrafficSetting(paramKey, level, field, value) {
        if (!this.trafficSettings[paramKey]) return;
        this.trafficSettings[paramKey][level][field] = value;
        this.saveTrafficSettings();
    },

    // Обновить настройку множителя
    updateTrafficSettingMultiplier(paramKey, field, value) {
        if (!this.trafficSettings[paramKey]) return;
        this.trafficSettings[paramKey][field] = value;
        this.saveTrafficSettings();

        // Обновляем пример
        const exampleEl = document.getElementById(paramKey + 'Example');
        if (exampleEl) {
            exampleEl.textContent = value * 5;
        }
    },

    // Рассчитать трафик
    calculateTraffic() {
        if (!this.currentReportData || this.currentReportData.length === 0) {
            alert('Нет данных для расчета');
            return;
        }

        // Выполняем расчет для каждого партнера
        this.trafficResults = this.currentReportData.map(partner => {
            const scores = this.evaluatePartner(partner, this.trafficSettings);
            return {
                method: partner.method,
                subagent: partner.subagent,
                subagentId: partner.subagentId,
                scores: scores
            };
        });

        // Рассчитываем процент трафика для каждого партнера
        this.calculateTrafficPercentages();

        // Закрываем настройки и показываем результаты
        this.closeTrafficCalculator();
        this.showTrafficResults();
    },

    // Рассчитать процент трафика для каждого партнера (внутри каждого метода отдельно)
    calculateTrafficPercentages() {
        if (!this.trafficResults || this.trafficResults.length === 0) return;

        // Группируем партнеров по методу
        const methodGroups = {};
        this.trafficResults.forEach(result => {
            const method = result.method;
            if (!methodGroups[method]) {
                methodGroups[method] = [];
            }
            methodGroups[method].push(result);
        });

        // Рассчитываем проценты для каждого метода отдельно (100% на каждый метод)
        Object.keys(methodGroups).forEach(method => {
            const groupResults = methodGroups[method];

            // Считаем сумму баллов внутри метода
            const totalScore = groupResults.reduce((sum, result) => sum + result.scores.total, 0);

            if (totalScore === 0) {
                // Если все баллы 0, делим равномерно внутри метода
                const equalPercent = Math.floor(100 / groupResults.length);
                groupResults.forEach((result, index) => {
                    result.trafficPercent = index === 0 ? 100 - (equalPercent * (groupResults.length - 1)) : equalPercent;
                });
                return;
            }

            // Рассчитываем процент для каждого и округляем вниз
            let results = groupResults.map(result => {
                const exactPercent = (result.scores.total / totalScore) * 100;
                const floorPercent = Math.floor(exactPercent);
                return {
                    result: result,
                    exactPercent: exactPercent,
                    floorPercent: floorPercent,
                    remainder: exactPercent - floorPercent
                };
            });

            // Присваиваем округленные проценты
            results.forEach(item => {
                item.result.trafficPercent = item.floorPercent;
            });

            // Вычисляем остаток до 100%
            const currentTotal = results.reduce((sum, item) => sum + item.floorPercent, 0);
            let deficit = 100 - currentTotal;

            // Распределяем остаток между субагентами с наибольшими остатками
            if (deficit > 0) {
                results.sort((a, b) => {
                    if (Math.abs(b.remainder - a.remainder) > 0.0001) {
                        return b.remainder - a.remainder;
                    }
                    return b.result.scores.total - a.result.scores.total;
                });

                for (let i = 0; i < deficit && i < results.length; i++) {
                    results[i].result.trafficPercent += 1;
                }
            }
        });
    },

    // Оценить одного партнера
    evaluatePartner(partner, settings) {
        const scores = {
            good: 0,
            normal: 0,
            bad: 0,
            terrible: 0,
            total: 0
        };

        // Рассчитываем дни с момента добавления
        partner.daysFromAdded = this.getDaysFromAdded(partner.dateAdded);

        // Проходим по всем параметрам
        this.trafficParams.forEach(param => {
            const paramSettings = settings[param.key];
            if (!paramSettings) return;

            let value = partner[param.key];
            
            // Для параметра "дней с момента добавления" берем рассчитанное значение
            if (param.key === 'daysFromAdded') {
                value = partner.daysFromAdded;
            }

            if (param.type === 'text') {
                // Для текстовых полей сравниваем строки
                if (value === paramSettings.good.value) {
                    scores.good += paramSettings.good.points;
                } else if (value === paramSettings.normal.value) {
                    scores.normal += paramSettings.normal.points;
                } else if (value === paramSettings.bad.value) {
                    scores.bad += paramSettings.bad.points;
                } else {
                    scores.terrible += paramSettings.terrible.points;
                }
            } else if (param.type === 'multiplier') {
                // Для множителя - баллы за каждое нарушение
                const numValue = parseInt(value) || 0;
                const pointsPerItem = paramSettings.pointsPerItem || -20;
                const totalPoints = numValue * pointsPerItem;

                // Добавляем в bad если отрицательные, в good если положительные
                if (totalPoints < 0) {
                    scores.bad += totalPoints;
                } else if (totalPoints > 0) {
                    scores.good += totalPoints;
                }
            } else {
                // Для числовых и процентных полей проверяем диапазон
                const numValue = parseFloat(value) || 0;

                if (numValue >= paramSettings.good.min && numValue <= paramSettings.good.max) {
                    scores.good += paramSettings.good.points;
                } else if (numValue >= paramSettings.normal.min && numValue <= paramSettings.normal.max) {
                    scores.normal += paramSettings.normal.points;
                } else if (numValue >= paramSettings.bad.min && numValue <= paramSettings.bad.max) {
                    scores.bad += paramSettings.bad.points;
                } else if (numValue >= paramSettings.terrible.min && numValue <= paramSettings.terrible.max) {
                    scores.terrible += paramSettings.terrible.points;
                }
            }
        });

        // Считаем общий балл
        scores.total = scores.good + scores.normal + scores.bad + scores.terrible;

        return scores;
    },

    // Получить количество дней с момента добавления
    getDaysFromAdded(dateAdded) {
        if (!dateAdded) return 0;
        const addedDate = new Date(dateAdded);
        const now = new Date();
        const diffTime = Math.abs(now - addedDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    },

    // Показать результаты расчета
    showTrafficResults() {
        const tbody = document.getElementById('trafficResultsTableBody');
        if (!tbody || !this.trafficResults) return;

        const getScoreClass = (score) => {
            if (score > 0) return 'score-positive';
            if (score < 0) return 'score-negative';
            return 'score-zero';
        };

        // Группируем результаты по методу
        const methodGroups = {};
        this.trafficResults.forEach(result => {
            const method = result.method;
            if (!methodGroups[method]) {
                methodGroups[method] = [];
            }
            methodGroups[method].push(result);
        });

        // Сортируем партнеров внутри каждого метода по проценту (убывание)
        Object.keys(methodGroups).forEach(method => {
            methodGroups[method].sort((a, b) => b.trafficPercent - a.trafficPercent);
        });

        // Формируем HTML с группировкой по методам
        let html = '';
        const methods = Object.keys(methodGroups).sort();

        methods.forEach((method, methodIndex) => {
            const groupResults = methodGroups[method];
            const totalPercent = groupResults.reduce((sum, r) => sum + r.trafficPercent, 0);

            // Заголовок метода
            html += `
                <tr class="method-header-row">
                    <td colspan="9">
                        <strong>${this.escapeHtml(method)}</strong>
                        <span class="method-summary">(${groupResults.length} субагентов, всего ${totalPercent}%)</span>
                    </td>
                </tr>
            `;

            // Партнеры внутри метода
            groupResults.forEach(result => {
                html += `
                    <tr>
                        <td>${this.escapeHtml(result.method)}</td>
                        <td>${this.escapeHtml(result.subagent)}</td>
                        <td>${this.escapeHtml(result.subagentId)}</td>
                        <td class="${getScoreClass(result.scores.good)}">${result.scores.good}</td>
                        <td class="${getScoreClass(result.scores.normal)}">${result.scores.normal}</td>
                        <td class="${getScoreClass(result.scores.bad)}">${result.scores.bad}</td>
                        <td class="${getScoreClass(result.scores.terrible)}">${result.scores.terrible}</td>
                        <td class="${getScoreClass(result.scores.total)}"><strong>${result.scores.total}</strong></td>
                        <td class="traffic-percent"><strong>${result.trafficPercent}%</strong></td>
                    </tr>
                `;
            });
        });

        tbody.innerHTML = html;

        // Открываем модальное окно результатов
        document.getElementById('trafficResultsModal').classList.add('show');

        // Обновляем иконки
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    // Закрыть результаты
    closeTrafficResults() {
        document.getElementById('trafficResultsModal').classList.remove('show');
    },

    // Экспорт результатов в Excel
    exportTrafficResults() {
        if (!this.trafficResults || this.trafficResults.length === 0) {
            alert('Нет данных для экспорта');
            return;
        }

        // Подготавливаем данные для Excel
        const data = this.trafficResults.map(result => ({
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
    ourPartnerIds: [], // Список наших Субагент ID
    currentSelectedPartnerId: null, // Текущий выбранный партнер для ручных данных
    allPartnersListForStep5: [], // Список всех партнеров для шага 5
    trafficSettings: null, // Настройки калькулятора трафика
    trafficResults: null, // Результаты расчета трафика

    // Параметры для оценки трафика (16 параметров)
    trafficParams: [
        { key: 'backCount', name: 'Back', type: 'number' },
        { key: 'cringeCount', name: 'Cringe', type: 'number' },
        { key: 'autoDisableCount', name: 'Автоотключение', type: 'number' },
        { key: 'depositAppealsCount', name: 'Обращений по пополнениям', type: 'number' },
        { key: 'delayedAppealsCount', name: 'Обращения 15+ мин', type: 'number' },
        { key: 'depositSuccessPercent', name: '% успешных пополнений', type: 'percent' },
        { key: 'withdrawalSuccessPercent', name: '% успешных выводов', type: 'percent' },
        { key: 'depositWorkTimePercent', name: '% Времени работы на пополнения', type: 'percent' },
        { key: 'withdrawalWorkTimePercent', name: '% Времени работы на вывод', type: 'percent' },
        { key: 'chatIgnoring', name: 'Игнорирование чатов', type: 'number' },
        { key: 'webmanagementIgnore', name: 'Игнор Webmanagement', type: 'number' },
        { key: 'depositQueues', name: 'Очереди на пополнение', type: 'number' },
        { key: 'withdrawalQueues', name: 'Очереди на вывод', type: 'number' },
        { key: 'creditsOutsideLimits', name: 'Зачисление вне лимитов', type: 'number' },
        { key: 'wrongAmountApproval', name: 'Одобрение неверной суммы', type: 'number' },
        { key: 'otherViolations', name: 'Другие нарушения', type: 'multiplier' }
    ],

    // Инициализация
    init() {
        this.loadMethods();
        this.updatePartnerStatuses();
        this.renderPartners();
        this.setupEventListeners();
        this.updateCounts();
    },

    // Настройка обработчиков событий
    setupEventListeners() {
        // Форма добавления партнера
        const partnerForm = document.getElementById('partnerForm');
        if (partnerForm) {
            partnerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addPartner();
            });
        }

        // Форма редактирования
        const editForm = document.getElementById('editForm');
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveEdit();
            });
        }
    },

    // Переключение вкладок
    switchTab(tabName) {
        this.currentTab = tabName;

        // Обновляем кнопки вкладок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.closest('.tab-btn').classList.add('active');

        // Показываем нужный контент
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        if (tabName === 'partners') {
            document.getElementById('partnersTab').classList.add('active');
        } else if (tabName === 'analytics') {
            document.getElementById('analyticsTab').classList.add('active');
            this.renderAnalytics();
        } else if (tabName === 'report') {
            document.getElementById('reportTab').classList.add('active');
        }

        // Обновляем иконки
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
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

    // Обновление статусов партнеров
    updatePartnerStatuses() {
        storage.updatePartnerStatuses();
    },

    // Добавление партнера
    addPartner() {
        const method = document.getElementById('methodSelect').value;
        const subagent = document.getElementById('subagentInput').value.trim();
        const subagentId = document.getElementById('subagentIdInput').value.trim();

        if (!method || !subagent || !subagentId) {
            alert('Пожалуйста, заполните все поля');
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
        this.renderPartners();
        this.updateCounts();

        alert('Партнер успешно добавлен!');
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
                    <td>${this.escapeHtml(partner.method)}</td>
                    <td>${this.escapeHtml(partner.subagent)}</td>
                    <td>${this.escapeHtml(partner.subagentId)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${date}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn" onclick="trafficCalc.editPartner('${partner.id}')" title="Редактировать">
                                <i data-lucide="edit"></i> Изменить
                            </button>
                            <button class="action-btn delete" onclick="trafficCalc.deletePartner('${partner.id}')" title="Удалить">
                                <i data-lucide="trash-2"></i> Удалить
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Обновляем иконки
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    // Фильтрация партнеров
    filterPartners() {
        this.renderPartners();
        this.updateCounts();
    },

    // Редактирование партнера
    editPartner(id) {
        const partners = storage.getPartners();
        const partner = partners.find(p => p.id === id);
        if (!partner) return;

        this.editingPartnerId = id;

        document.getElementById('editPartnerId').value = id;
        document.getElementById('editMethodSelect').value = partner.method;
        document.getElementById('editSubagentInput').value = partner.subagent;
        document.getElementById('editSubagentIdInput').value = partner.subagentId;
        document.getElementById('editStatusSelect').value = partner.status;

        document.getElementById('editModal').classList.add('show');

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    // Сохранение изменений
    saveEdit() {
        const id = document.getElementById('editPartnerId').value;
        const method = document.getElementById('editMethodSelect').value;
        const subagent = document.getElementById('editSubagentInput').value.trim();
        const subagentId = document.getElementById('editSubagentIdInput').value.trim();
        const status = document.getElementById('editStatusSelect').value;

        if (!method || !subagent || !subagentId) {
            alert('Пожалуйста, заполните все поля');
            return;
        }

        storage.updatePartner(id, {
            method,
            subagent,
            subagentId,
            status
        });

        this.closeEditModal();
        this.renderPartners();
        this.updateCounts();

        alert('Изменения сохранены!');
    },

    // Закрытие модального окна редактирования
    closeEditModal() {
        document.getElementById('editModal').classList.remove('show');
        this.editingPartnerId = null;
    },

    // Удаление партнера
    deletePartner(id) {
        if (!confirm('Вы уверены, что хотите удалить этого партнера?')) {
            return;
        }

        storage.deletePartner(id);
        this.renderPartners();
        this.updateCounts();
    },

    // Управление методами
    showMethodModal() {
        this.renderMethodsList();
        document.getElementById('methodModal').classList.add('show');

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
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
            container.innerHTML = '<p style="text-align: center; color: #999; font-style: italic;">Методы не добавлены</p>';
            return;
        }

        container.innerHTML = methods.map(method => `
            <div class="method-item">
                <span>${this.escapeHtml(method)}</span>
                <button onclick="trafficCalc.deleteMethod('${this.escapeHtml(method)}')">
                    <i data-lucide="trash-2"></i> Удалить
                </button>
            </div>
        `).join('');

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    addMethod() {
        const input = document.getElementById('newMethodInput');
        const methodName = input.value.trim();

        if (!methodName) {
            alert('Введите название метода');
            return;
        }

        if (storage.addMethod(methodName)) {
            input.value = '';
            this.loadMethods();
            this.renderMethodsList();
            alert('Метод добавлен!');
        } else {
            alert('Такой метод уже существует');
        }
    },

    deleteMethod(methodName) {
        if (!confirm(`Удалить метод "${methodName}"?`)) {
            return;
        }

        storage.deleteMethod(methodName);
        this.loadMethods();
        this.renderMethodsList();
    },

    // Аналитика
    renderAnalytics() {
        this.updateSelectedPartnersView();
    },

    // Выбор всех партнеров
    selectAll() {
        const partners = storage.getPartners();
        this.selectedPartners = partners.map(p => p.id);
        this.updateSelectedPartnersView();
        this.hideAllPanels();
    },

    // Очистка выбора
    clearSelection() {
        this.selectedPartners = [];
        this.updateSelectedPartnersView();
    },

    // Показать выбор по методу
    showMethodSelection() {
        this.hideAllPanels();
        const panel = document.getElementById('methodSelectionPanel');
        panel.style.display = 'block';

        const methods = storage.getMethods();
        const container = document.getElementById('methodCheckboxes');
        
        container.innerHTML = methods.map(method => `
            <label>
                <input type="checkbox" value="${this.escapeHtml(method)}" class="method-checkbox">
                ${this.escapeHtml(method)}
            </label>
        `).join('');
    },

    // Применить выбор по методу
    applyMethodSelection() {
        const checkboxes = document.querySelectorAll('.method-checkbox:checked');
        const selectedMethods = Array.from(checkboxes).map(cb => cb.value);

        if (selectedMethods.length === 0) {
            alert('Выберите хотя бы один метод');
            return;
        }

        const partners = storage.getPartners();
        this.selectedPartners = partners
            .filter(p => selectedMethods.includes(p.method))
            .map(p => p.id);

        this.updateSelectedPartnersView();
        this.hideAllPanels();
    },

    // Показать ручной выбор
    showManualSelection() {
        this.hideAllPanels();
        const panel = document.getElementById('manualSelectionPanel');
        panel.style.display = 'block';

        const partners = storage.getPartners();
        const container = document.getElementById('partnerCheckboxes');
        
        container.innerHTML = partners.map(partner => `
            <label>
                <input type="checkbox" value="${partner.id}" class="partner-checkbox" 
                    ${this.selectedPartners.includes(partner.id) ? 'checked' : ''}>
                ${this.escapeHtml(partner.subagent)} (${this.escapeHtml(partner.method)})
            </label>
        `).join('');
    },

    // Применить ручной выбор
    applyManualSelection() {
        const checkboxes = document.querySelectorAll('.partner-checkbox:checked');
        this.selectedPartners = Array.from(checkboxes).map(cb => cb.value);

        if (this.selectedPartners.length === 0) {
            alert('Выберите хотя бы одного партнера');
            return;
        }

        this.updateSelectedPartnersView();
        this.hideAllPanels();
    },

    // Скрыть все панели выбора
    hideAllPanels() {
        document.getElementById('methodSelectionPanel').style.display = 'none';
        document.getElementById('manualSelectionPanel').style.display = 'none';
    },

    // Обновление предпросмотра выбранных партнеров
    updateSelectedPartnersView() {
        const tbody = document.getElementById('selectedPartnersTableBody');
        if (!tbody) return;

        const allPartners = storage.getPartners();
        const selected = allPartners.filter(p => this.selectedPartners.includes(p.id));

        document.getElementById('selectedCount').textContent = selected.length;

        if (selected.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Партнеры не выбраны</td></tr>';
            // Отключаем кнопку "Далее" на шаге 1
            const nextBtn = document.getElementById('step1NextBtn');
            if (nextBtn) nextBtn.disabled = true;
            // Убираем шаг 1 из завершенных
            this.completedSteps = this.completedSteps.filter(s => s !== 1);
            this.updateStepsIndicator(this.currentStep);
            return;
        }

        tbody.innerHTML = selected.map(partner => {
            const statusClass = partner.status === 'новый' ? 'new' : partner.status === 'старый' ? 'old' : 'closed';
            const statusText = partner.status === 'новый' ? 'Новый' : partner.status === 'старый' ? 'Старый' : 'Закрыт';

            return `
                <tr>
                    <td>${this.escapeHtml(partner.method)}</td>
                    <td>${this.escapeHtml(partner.subagent)}</td>
                    <td>${this.escapeHtml(partner.subagentId)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                </tr>
            `;
        }).join('');

        // Включаем кнопку "Далее" на шаге 1
        const nextBtn = document.getElementById('step1NextBtn');
        if (nextBtn) nextBtn.disabled = false;
        // Отмечаем шаг 1 как завершенный
        if (!this.completedSteps.includes(1)) {
            this.completedSteps.push(1);
        }
        this.updateStepsIndicator(this.currentStep);
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
        this.updateStepsIndicator(stepNumber);

        this.currentStep = stepNumber;

        // При переходе на шаг 4 (% времени работы) - подготовить список партнеров
        if (stepNumber === 4) {
            this.prepareStep5PartnersList();
            this.checkManualDataCompletion();
        }

        // При переходе на шаг 6 (нарушения) - подготовить список партнеров
        if (stepNumber === 6) {
            this.prepareStep6PartnersList();
            this.checkManualDataCompletionStep6();
        }

        // Обновляем иконки
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    updateStepsIndicator(currentStep) {
        document.querySelectorAll('.steps-indicator .step').forEach(step => {
            const stepNum = parseInt(step.getAttribute('data-step'));
            step.classList.remove('active');

            if (stepNum === currentStep) {
                step.classList.add('active');
            }

            // Показываем завершенные шаги
            if (this.completedSteps.includes(stepNum)) {
                step.classList.add('completed');
            } else {
                step.classList.remove('completed');
            }
        });
    },

    // Навигация по кликам на индикаторе шагов
    navigateToStep(stepNumber) {
        // Сохраняем данные текущего партнера, если мы на шаге 4 или 6
        if (this.currentStep === 4 && this.currentSelectedPartnerId) {
            this.saveCurrentManualData();
        }
        if (this.currentStep === 6 && this.currentSelectedPartnerId6) {
            this.saveCurrentManualDataStep6();
        }

        // Переходим на выбранный шаг
        this.goToStep(stepNumber);
    },

    skipStep(stepNumber) {
        // Пропускаем шаг и переходим к следующему
        this.goToStep(stepNumber + 1);
    },

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
                const data = await this.readExcelFile(file);
                this.parseDepositsData(data, commentsData);
            }

            // Обновляем данные партнеров
            allPartners.forEach(partner => {
                const comments = commentsData[partner.subagentId] || { back: 0, cringe: 0 };
                partner.backCount = comments.back;
                partner.cringeCount = comments.cringe;
            });

            storage.savePartners(allPartners);

            statusDiv.className = 'upload-status success';
            statusDiv.textContent = `Успешно обработано ${files.length} файл(ов). Данные обновлены.`;

            this.filesUploaded.deposits = true;
            // Отмечаем шаг 2 как завершенный
            if (!this.completedSteps.includes(2)) {
                this.completedSteps.push(2);
            }
            this.updateStepsIndicator(this.currentStep);
            document.getElementById('step2NextBtn').disabled = false;

            event.target.value = '';

        } catch (error) {
            console.error('Error processing files:', error);
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

            // Шаг 2: Собираем список наших Субагент ID
            this.ourPartnerIds = allPartners.map(p => p.subagentId);

            // Шаг 3: Создаем объект для хранения счетчиков автоотключений
            // Формат: { "ID": количество }
            const autoDisableCounters = {};

            // Шаг 4: Обрабатываем каждый загруженный файл
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const excelData = await this.readExcelFile(file);
                this.countAutoDisables(excelData, autoDisableCounters);
            }

            // Шаг 5: Обновляем данные каждого партнера
            allPartners.forEach(partner => {
                // Берем количество автоотключений для данного ID
                // Если в файле не нашли - ставим 0
                partner.autoDisableCount = autoDisableCounters[partner.subagentId] || 0;
            });

            // Шаг 6: Сохраняем обновленные данные
            storage.savePartners(allPartners);

            // Успех!
            statusDiv.className = 'upload-status success';
            statusDiv.textContent = `Успешно обработано ${files.length} файл(ов). Данные обновлены.`;

            this.filesUploaded.percent = true;
            // Отмечаем шаг 5 как завершенный
            if (!this.completedSteps.includes(5)) {
                this.completedSteps.push(5);
            }
            this.updateStepsIndicator(this.currentStep);
            document.getElementById('step5NextBtn').disabled = false;

            event.target.value = '';

        } catch (error) {
            console.error('Error processing files:', error);
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

            // Шаг 2: Собираем список наших Субагент ID
            this.ourPartnerIds = allPartners.map(p => p.subagentId);

            // Шаг 3: Создаем объект для хранения данных контроля качества
            // Формат: { "ID": { depositTransactionsCount: 0, withdrawalTransactionsCount: 0, ... } }
            const qualityData = {};

            // Шаг 4: Обрабатываем каждый загруженный файл
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const excelData = await this.readExcelFile(file);
                this.parseQualityControlData(excelData, qualityData);
            }

            // Шаг 5: Обновляем данные каждого партнера
            allPartners.forEach(partner => {
                const data = qualityData[partner.subagentId] || {};

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

            this.filesUploaded.quality = true;
            // Отмечаем шаг 3 как завершенный
            if (!this.completedSteps.includes(3)) {
                this.completedSteps.push(3);
            }
            this.updateStepsIndicator(this.currentStep);
            document.getElementById('step3NextBtn').disabled = false;

            event.target.value = '';

        } catch (error) {
            console.error('Error processing files:', error);
            statusDiv.className = 'upload-status error';
            statusDiv.textContent = 'Ошибка при обработке файлов: ' + error.message;
        }
    },

    // Завершение аналитики
    completeAnalytics() {
        if (!this.filesUploaded.deposits) {
            alert('Необходимо загрузить обязательный отчет "Пополнения и выводы"');
            return;
        }

        if (!this.filesUploaded.percent) {
            alert('Необходимо загрузить обязательный отчет "Отчет по процентовкам"');
            return;
        }

        if (!this.filesUploaded.quality) {
            alert('Необходимо загрузить обязательный отчет "Контроль качества работы"');
            return;
        }

        // Сохраняем данные текущего партнера перед завершением
        if (this.currentSelectedPartnerId) {
            this.saveCurrentManualData();
        }
        if (this.currentSelectedPartnerId6) {
            this.saveCurrentManualDataStep6();
        }

        // Переключаемся на вкладку "Отчет"
        this.currentTab = 'report';

        // Обновляем кнопки вкладок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-btn')[2].classList.add('active'); // Третья кнопка - "Отчет"

        // Показываем вкладку отчета
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById('reportTab').classList.add('active');

        // Автоматически формируем отчет
        this.generateReport();

        // Обновляем иконки
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    // Подтверждение сброса аналитики
    confirmResetAnalytics() {
        if (this.completedSteps.length > 0 || this.selectedPartners.length > 0) {
            if (confirm('Вы уверены, что хотите сбросить все данные аналитики? Все выбранные партнеры, загруженные файлы и введенные данные будут очищены.')) {
                this.resetAnalytics();
            }
        } else {
            alert('Нет данных для сброса');
        }
    },

    // Сброс всех данных аналитики (вызывается вручную или при начале нового анализа)
    resetAnalytics() {
        this.currentStep = 1;
        this.completedSteps = [];
        this.filesUploaded = {
            deposits: false,
            quality: false,
            percent: false
        };
        this.currentSelectedPartnerId = null;
        this.allPartnersListForStep5 = [];
        this.selectedPartners = [];

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
        document.getElementById('manualDataForm').style.display = 'none';

        // Очищаем input файлов
        const depositsInput = document.getElementById('depositsFileInput');
        const qualityInput = document.getElementById('qualityFileInput');
        const percentInput = document.getElementById('percentFileInput');
        if (depositsInput) depositsInput.value = '';
        if (qualityInput) qualityInput.value = '';
        if (percentInput) percentInput.value = '';

        // Возвращаемся на шаг 1
        this.goToStep(1);

        // Обновляем предпросмотр
        this.updateSelectedPartnersView();
    },

    // ШАГ 4: РУЧНЫЕ ДАННЫЕ

    // Подготовка списка партнеров для шага 4 (ручные данные)
    prepareStep5PartnersList() {
        const allPartners = storage.getPartners();
        this.allPartnersListForStep5 = allPartners.filter(p => this.selectedPartners.includes(p.id));
        this.renderStep5PartnersList();
    },

    // Отображение списка партнеров
    renderStep5PartnersList(filterText = '') {
        const select = document.getElementById('partnerSelectList');
        if (!select) return;

        if (this.allPartnersListForStep5.length === 0) {
            select.innerHTML = '<option value="">Сначала выберите партнеров на шаге 1</option>';
            return;
        }

        // Фильтруем по подстроке
        const filtered = filterText 
            ? this.allPartnersListForStep5.filter(p => 
                p.subagent.toLowerCase().includes(filterText.toLowerCase()))
            : this.allPartnersListForStep5;

        if (filtered.length === 0) {
            select.innerHTML = '<option value="">Ничего не найдено</option>';
            return;
        }

        select.innerHTML = filtered.map(partner => 
            `<option value="${partner.id}">${this.escapeHtml(partner.subagent)} (${this.escapeHtml(partner.method)})</option>`
        ).join('');
    },

    // Фильтрация списка партнеров при вводе
    filterPartnersList() {
        const searchInput = document.getElementById('partnerSearchInput');
        if (!searchInput) return;
        
        const filterText = searchInput.value.trim();
        this.renderStep5PartnersList(filterText);
    },

    // Загрузка ручных данных для выбранного партнера (шаг 4 - только % времени работы)
    loadPartnerManualData() {
        const select = document.getElementById('partnerSelectList');
        if (!select || !select.value) {
            document.getElementById('manualDataForm').style.display = 'none';
            return;
        }

        // Сначала сохраняем данные предыдущего партнера, если он был выбран
        if (this.currentSelectedPartnerId) {
            this.saveCurrentManualData();
        }

        const partnerId = select.value;
        this.currentSelectedPartnerId = partnerId;

        // Получаем актуальные данные из storage
        const allPartners = storage.getPartners();
        const partner = allPartners.find(p => p.id === partnerId);
        if (!partner) return;

        // Отображаем форму
        document.getElementById('selectedPartnerName').textContent = partner.subagent;
        document.getElementById('manualDataForm').style.display = 'block';

        // Загружаем сохраненные значения только для процентов времени работы
        document.getElementById('depositWorkTimePercent').value = partner.depositWorkTimePercent || 0;
        document.getElementById('withdrawalWorkTimePercent').value = partner.withdrawalWorkTimePercent || 0;

        // Обновляем иконки
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    // Увеличение значения
    incrementManualValue(fieldId) {
        const input = document.getElementById(fieldId);
        if (!input) return;

        input.value = parseInt(input.value || 0) + 1;
        // Сохраняем в зависимости от того, на каком шаге мы находимся
        if (this.currentStep === 6) {
            this.saveCurrentManualDataStep6();
        } else {
            this.saveCurrentManualData();
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
            if (this.currentStep === 6) {
                this.saveCurrentManualDataStep6();
            } else {
                this.saveCurrentManualData();
            }
        }
    },

    // Сохранение текущих ручных данных (шаг 4 - только % времени работы)
    saveCurrentManualData() {
        if (!this.currentSelectedPartnerId) return;

        const allPartners = storage.getPartners();
        const partner = allPartners.find(p => p.id === this.currentSelectedPartnerId);
        if (!partner) return;

        // Сохраняем только процент времени работы
        partner.depositWorkTimePercent = parseInt(document.getElementById('depositWorkTimePercent').value || 0);
        partner.withdrawalWorkTimePercent = parseInt(document.getElementById('withdrawalWorkTimePercent').value || 0);

        storage.savePartners(allPartners);

        // Проверяем, заполнены ли данные хотя бы для одного партнера
        this.checkManualDataCompletion();
    },

    // Проверка заполнения ручных данных (шаг 4 - только % времени работы)
    checkManualDataCompletion() {
        const allPartners = storage.getPartners();
        const selectedPartnersData = allPartners.filter(p => this.selectedPartners.includes(p.id));

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
            if (!this.completedSteps.includes(4)) {
                this.completedSteps.push(4);
            }
        } else {
            this.completedSteps = this.completedSteps.filter(s => s !== 4);
        }
        this.updateStepsIndicator(this.currentStep);
    },

    // Сброс данных по времени работы для текущего партнера (шаг 4)
    resetWorkTimeData() {
        if (!this.currentSelectedPartnerId) return;

        if (!confirm('Вы уверены, что хотите сбросить данные по времени работы для этого субагента?')) {
            return;
        }

        // Сбрасываем поля ввода
        document.getElementById('depositWorkTimePercent').value = 0;
        document.getElementById('withdrawalWorkTimePercent').value = 0;

        // Сохраняем изменения
        this.saveCurrentManualData();
    },

    // Сброс данных по времени работы для всех субагентов (шаг 4)
    resetAllWorkTimeData() {
        if (!confirm('Вы уверены, что хотите сбросить данные по времени работы для ВСЕХ выбранных субагентов?')) {
            return;
        }

        const allPartners = storage.getPartners();
        const selectedPartnersData = allPartners.filter(p => this.selectedPartners.includes(p.id));

        if (selectedPartnersData.length === 0) {
            alert('Нет выбранных субагентов для сброса');
            return;
        }

        // Сбрасываем данные для всех выбранных партнеров
        selectedPartnersData.forEach(partner => {
            partner.depositWorkTimePercent = 0;
            partner.withdrawalWorkTimePercent = 0;
        });

        storage.savePartners(allPartners);

        // Обновляем отображение, если текущий партнер выбран
        if (this.currentSelectedPartnerId) {
            document.getElementById('depositWorkTimePercent').value = 0;
            document.getElementById('withdrawalWorkTimePercent').value = 0;
        }

        // Проверяем заполнение данных
        this.checkManualDataCompletion();

        alert(`Данные по времени работы сброшены для ${selectedPartnersData.length} субагентов`);
    },

    // ========== Шаг 6: Нарушения ==========

    // Подготовка списка партнеров для шага 6 (нарушения)
    prepareStep6PartnersList() {
        const allPartners = storage.getPartners();
        this.allPartnersListForStep6 = allPartners.filter(p => this.selectedPartners.includes(p.id));
        this.renderStep6PartnersList();
    },

    // Отображение списка партнеров для шага 6
    renderStep6PartnersList(filterText = '') {
        const select = document.getElementById('partnerSelectList6');
        if (!select) return;

        if (this.allPartnersListForStep6.length === 0) {
            select.innerHTML = '<option value="">Сначала выберите партнеров на шаге 1</option>';
            return;
        }

        // Фильтруем по подстроке
        const filtered = filterText
            ? this.allPartnersListForStep6.filter(p =>
                p.subagent.toLowerCase().includes(filterText.toLowerCase()))
            : this.allPartnersListForStep6;

        if (filtered.length === 0) {
            select.innerHTML = '<option value="">Ничего не найдено</option>';
            return;
        }

        select.innerHTML = filtered.map(partner =>
            `<option value="${partner.id}">${this.escapeHtml(partner.subagent)} (${this.escapeHtml(partner.method)})</option>`
        ).join('');
    },

    // Фильтрация списка партнеров при вводе (шаг 6)
    filterPartnersListStep6() {
        const searchInput = document.getElementById('partnerSearchInput6');
        if (!searchInput) return;

        const filterText = searchInput.value.trim();
        this.renderStep6PartnersList(filterText);
    },

    // Загрузка данных по нарушениям для выбранного партнера (шаг 6)
    loadPartnerManualDataStep6() {
        const select = document.getElementById('partnerSelectList6');
        if (!select || !select.value) {
            document.getElementById('manualDataForm6').style.display = 'none';
            return;
        }

        // Сначала сохраняем данные предыдущего партнера, если он был выбран
        if (this.currentSelectedPartnerId6) {
            this.saveCurrentManualDataStep6();
        }

        const partnerId = select.value;
        this.currentSelectedPartnerId6 = partnerId;

        // Получаем актуальные данные из storage
        const allPartners = storage.getPartners();
        const partner = allPartners.find(p => p.id === partnerId);
        if (!partner) return;

        // Отображаем форму
        document.getElementById('selectedPartnerName6').textContent = partner.subagent;
        document.getElementById('manualDataForm6').style.display = 'block';

        // Загружаем сохраненные значения нарушений
        document.getElementById('chatIgnoring').value = partner.chatIgnoring || 0;
        document.getElementById('webmanagementIgnore').value = partner.webmanagementIgnore || 0;
        document.getElementById('depositQueues').value = partner.depositQueues || 0;
        document.getElementById('withdrawalQueues').value = partner.withdrawalQueues || 0;
        document.getElementById('creditsOutsideLimits').value = partner.creditsOutsideLimits || 0;
        document.getElementById('wrongAmountApproval').value = partner.wrongAmountApproval || 0;
        document.getElementById('otherViolations').value = partner.otherViolations || 0;
        document.getElementById('otherViolationsDescription').value = partner.otherViolationsDescription || '';

        // Обновляем иконки
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    // Сохранение данных по нарушениям (шаг 6)
    saveCurrentManualDataStep6() {
        if (!this.currentSelectedPartnerId6) return;

        const allPartners = storage.getPartners();
        const partner = allPartners.find(p => p.id === this.currentSelectedPartnerId6);
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
        this.checkManualDataCompletionStep6();
    },

    // Проверка заполнения данных по нарушениям (шаг 6)
    checkManualDataCompletionStep6() {
        const allPartners = storage.getPartners();
        const selectedPartnersData = allPartners.filter(p => this.selectedPartners.includes(p.id));

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

        // Активируем кнопку, если есть данные
        const nextBtn = document.getElementById('step6NextBtn');
        if (nextBtn) {
            nextBtn.disabled = !hasFilledData;
        }

        // Отмечаем шаг 6 как завершенный, если есть данные
        if (hasFilledData) {
            if (!this.completedSteps.includes(6)) {
                this.completedSteps.push(6);
            }
        } else {
            this.completedSteps = this.completedSteps.filter(s => s !== 6);
        }
        this.updateStepsIndicator(this.currentStep);
    },

    // Сброс данных по нарушениям для текущего партнера (шаг 6)
    resetViolationsData() {
        if (!this.currentSelectedPartnerId6) return;

        if (!confirm('Вы уверены, что хотите сбросить данные по нарушениям для этого субагента?')) {
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
        this.saveCurrentManualDataStep6();
    },

    // Сброс данных по нарушениям для всех субагентов (шаг 6)
    resetAllViolationsData() {
        if (!confirm('Вы уверены, что хотите сбросить данные по нарушениям для ВСЕХ выбранных субагентов?')) {
            return;
        }

        const allPartners = storage.getPartners();
        const selectedPartnersData = allPartners.filter(p => this.selectedPartners.includes(p.id));

        if (selectedPartnersData.length === 0) {
            alert('Нет выбранных субагентов для сброса');
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
        if (this.currentSelectedPartnerId6) {
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
        this.checkManualDataCompletionStep6();

        alert(`Данные по нарушениям сброшены для ${selectedPartnersData.length} субагентов`);
    },


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

    // Парсинг данных из отчета "Пополнения и выводы"
    parseDepositsData(data, commentsData) {
        if (!data || data.length < 2) return; // Нет данных или только заголовки

        const headers = data[0];
        const subagentIdIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('id субагент'));
        const paramsIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('доп. параметры №'));

        if (subagentIdIndex === -1 || paramsIndex === -1) {
            console.warn('Не найдены необходимые колонки в файле');
            return;
        }

        // Обрабатываем строки (пропускаем заголовки)
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const subagentId = row[subagentIdIndex];
            const params = row[paramsIndex];

            if (!subagentId || !params) continue;

            const subagentIdStr = subagentId.toString().trim();
            const paramsStr = params.toString();

            // Инициализируем счетчики если еще нет
            if (!commentsData[subagentIdStr]) {
                commentsData[subagentIdStr] = { back: 0, cringe: 0 };
            }

            // Подсчитываем back
            if (paramsStr.includes('"PaymentsComment": "back"')) {
                commentsData[subagentIdStr].back++;
            }

            // Подсчитываем cringe
            if (paramsStr.includes('"PaymentsComment": "cringe"')) {
                commentsData[subagentIdStr].cringe++;
            }
        }
    },

    /**
     * Подсчет автоотключений из Excel файла
     * 
     * Алгоритм:
     * 1. Находим колонки "admin" и "subagent"
     * 2. Для каждой строки:
     *    - Проверяем: admin == "Aвтоотключалка" (с английской A)
     *    - Извлекаем все числа из subagent (пример: "Jajje kddd 51553" -> ["51553"])
     *    - Проверяем каждое найденное число: есть ли оно в нашей системе?
     *    - Если да -> увеличиваем счетчик для этого ID
     * 
     * @param {Array} excelData - Данные из Excel файла (массив строк)
     * @param {Object} counters - Объект для хранения счетчиков { "ID": количество }
     */
    countAutoDisables(excelData, counters) {
        // Проверка: есть ли данные в файле?
        if (!excelData || excelData.length < 2) {
            console.warn('Файл пуст или содержит только заголовки');
            return;
        }

        // Шаг 1: Находим индексы нужных колонок
        const headerRow = excelData[0]; // Первая строка - заголовки
        
        // Ищем колонку "admin" (регистр не важен)
        const adminColumnIndex = headerRow.findIndex(header => 
            header && header.toString().toLowerCase() === 'admin'
        );
        
        // Ищем колонку "subagent" (регистр не важен)
        const subagentColumnIndex = headerRow.findIndex(header => 
            header && header.toString().toLowerCase() === 'subagent'
        );

        // Проверка: нашли ли нужные колонки?
        if (adminColumnIndex === -1) {
            console.error('Колонка "admin" не найдена в файле');
            return;
        }
        if (subagentColumnIndex === -1) {
            console.error('Колонка "subagent" не найдена в файле');
            return;
        }

        // Шаг 2: Проходим по всем строкам (кроме заголовков)
        for (let rowIndex = 1; rowIndex < excelData.length; rowIndex++) {
            const row = excelData[rowIndex];
            
            // Получаем значения из нужных колонок
            const adminValue = row[adminColumnIndex];
            const subagentValue = row[subagentColumnIndex];

            // Пропускаем пустые строки
            if (!adminValue || !subagentValue) continue;

            // Преобразуем в строки и убираем лишние пробелы
            const admin = adminValue.toString().trim();
            const subagent = subagentValue.toString().trim();

            // Шаг 3: Проверяем, есть ли в колонке admin слово "Aвтоотключалка"
            // ВАЖНО: слово начинается с английской буквы A!
            if (admin !== 'Aвтоотключалка') continue;

            // Шаг 4: Извлекаем все числа из колонки subagent
            // Пример: "Jajje kddd dskd ksdks 51553" -> ["51553"]
            // Пример: "User 123 and 456" -> ["123", "456"]
            const foundNumbers = subagent.match(/\d+/g);
            
            // Если чисел не найдено - пропускаем
            if (!foundNumbers || foundNumbers.length === 0) continue;

            // Шаг 5: Проверяем каждое найденное число
            foundNumbers.forEach(numberId => {
                // Проверяем: есть ли этот ID в нашей системе?
                if (this.ourPartnerIds.includes(numberId)) {
                    // Если да - увеличиваем счетчик
                    if (!counters[numberId]) {
                        counters[numberId] = 0; // Инициализируем, если еще нет
                    }
                    counters[numberId]++; // +1 автоотключение
                }
            });
        }
    },

    /**
     * Парсинг данных контроля качества из Excel файла
     * 
     * Алгоритм:
     * 1. Находим колонку "ID cубагента"
     * 2. Находим 6 целевых колонок с данными (по точным названиям)
     * 3. Для каждой строки:
     *    - Проверяем: есть ли ID субагента в нашей системе?
     *    - Если да -> извлекаем данные из всех 6 колонок
     *    - Конвертируем проценты из 0.89 в 89
     * 
     * @param {Array} excelData - Данные из Excel файла (массив строк)
     * @param {Object} qualityData - Объект для хранения данных { "ID": { ...данные } }
     */
    parseQualityControlData(excelData, qualityData) {
        // Проверка: есть ли данные в файле?
        if (!excelData || excelData.length < 2) {
            console.warn('Файл пуст или содержит только заголовки');
            return;
        }

        // Шаг 1: Находим индексы всех нужных колонок по точным названиям
        const headerRow = excelData[0];
        
        // Ищем колонку "ID cубагента" (с учетом возможных вариантов написания)
        const subagentIdIndex = headerRow.findIndex(header => {
            if (!header) return false;
            const h = header.toString().trim();
            return h === 'ID cубагента' || h === 'ID субагента' || h === 'id cубагента' || h === 'id субагента';
        });
        
        // Ищем целевые колонки с данными (точные названия)
        const depositTransactionsIndex = headerRow.findIndex(header => 
            header && header.toString().trim() === 'Общее количество созданных транзакций на депозиты'
        );
        
        const withdrawalTransactionsIndex = headerRow.findIndex(header => 
            header && header.toString().trim() === 'Общее количество созданных транзакций на вывод'
        );
        
        const depositAppealsIndex = headerRow.findIndex(header => 
            header && header.toString().trim() === 'Общее количество обращений по депозитам'
        );
        
        const delayedAppealsIndex = headerRow.findIndex(header => 
            header && header.toString().trim() === 'Количество обращений, обработанных с задержкой (15 минут+)'
        );
        
        const depositSuccessIndex = headerRow.findIndex(header => 
            header && header.toString().trim() === 'Процент транзакций в статусе успех по депозитам'
        );
        
        const withdrawalSuccessIndex = headerRow.findIndex(header => 
            header && header.toString().trim() === 'Процент транзакций в статусе успех по выводам'
        );

        // Проверка: нашли ли обязательную колонку ID субагента?
        if (subagentIdIndex === -1) {
            console.error('Колонка "ID cубагента" не найдена в файле');
            return;
        }

        // Логируем что нашли и что не нашли
        console.log('Найденные колонки:', {
            subagentId: subagentIdIndex,
            depositTransactions: depositTransactionsIndex,
            withdrawalTransactions: withdrawalTransactionsIndex,
            depositAppeals: depositAppealsIndex,
            delayedAppeals: delayedAppealsIndex,
            depositSuccess: depositSuccessIndex,
            withdrawalSuccess: withdrawalSuccessIndex
        });

        // Шаг 2: Проходим по всем строкам (кроме заголовков)
        for (let rowIndex = 1; rowIndex < excelData.length; rowIndex++) {
            const row = excelData[rowIndex];
            
            // Получаем ID субагента из строки
            const subagentIdValue = row[subagentIdIndex];
            if (!subagentIdValue) continue;
            
            const subagentId = subagentIdValue.toString().trim();

            // Шаг 3: Проверяем - есть ли этот ID в нашей системе?
            if (!this.ourPartnerIds.includes(subagentId)) continue;

            // Шаг 4: Извлекаем данные из всех найденных колонок
            const data = {
                // Кол-во пополнений
                depositTransactionsCount: depositTransactionsIndex !== -1 
                    ? (parseInt(row[depositTransactionsIndex]) || 0) 
                    : 0,
                
                // Кол-во выводов
                withdrawalTransactionsCount: withdrawalTransactionsIndex !== -1 
                    ? (parseInt(row[withdrawalTransactionsIndex]) || 0) 
                    : 0,
                
                // Обращений по пополнениям
                depositAppealsCount: depositAppealsIndex !== -1 
                    ? (parseInt(row[depositAppealsIndex]) || 0) 
                    : 0,
                
                // Обращения обработанные 15+ минут
                delayedAppealsCount: delayedAppealsIndex !== -1 
                    ? (parseInt(row[delayedAppealsIndex]) || 0) 
                    : 0,
                
                // Процент успешных пополнений (конвертируем 0.89 -> 89)
                depositSuccessPercent: depositSuccessIndex !== -1 
                    ? Math.round((parseFloat(row[depositSuccessIndex]) || 0) * 100) 
                    : 0,
                
                // Процент успешных выводов (конвертируем 0.89 -> 89)
                withdrawalSuccessPercent: withdrawalSuccessIndex !== -1 
                    ? Math.round((parseFloat(row[withdrawalSuccessIndex]) || 0) * 100) 
                    : 0
            };

            // Сохраняем данные для этого ID
            qualityData[subagentId] = data;
        }
    },

    // Парсинг данных из отчета "Контроль качества" (старая функция - удалена)
    parseQualityData(data, autoDisableData) {
        // Эта функция больше не используется
    },

    // Чтение Excel файла
    readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    // Генерация отчета
    generateReport() {
        if (this.selectedPartners.length === 0) {
            alert('Сначала выберите партнеров на вкладке "Аналитика"');
            return;
        }

        const allPartners = storage.getPartners();
        const reportData = allPartners.filter(p => this.selectedPartners.includes(p.id));

        // Подсчет статистики
        const stats = {
            total: reportData.length,
            new: reportData.filter(p => p.status === 'новый').length,
            old: reportData.filter(p => p.status === 'старый').length,
            closed: reportData.filter(p => p.status === 'закрыт').length
        };

        // Обновляем статистику
        document.getElementById('reportTotalCount').textContent = stats.total;
        document.getElementById('reportNewCount').textContent = stats.new;
        document.getElementById('reportOldCount').textContent = stats.old;
        document.getElementById('reportClosedCount').textContent = stats.closed;

        // Отображаем детальную таблицу
        const tbody = document.getElementById('reportTableBody');
        tbody.innerHTML = reportData.map(partner => {
            const date = new Date(partner.dateAdded).toLocaleDateString('ru-RU');
            const statusClass = partner.status === 'новый' ? 'new' : partner.status === 'старый' ? 'old' : 'closed';
            const statusText = partner.status === 'новый' ? 'Новый' : partner.status === 'старый' ? 'Старый' : 'Закрыт';

            return `
                <tr>
                    <td>${this.escapeHtml(partner.method)}</td>
                    <td>${this.escapeHtml(partner.subagent)}</td>
                    <td>${this.escapeHtml(partner.subagentId)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${date}</td>
                    <td>${partner.backCount || 0}</td>
                    <td>${partner.cringeCount || 0}</td>
                    <td>${partner.autoDisableCount || 0}</td>
                    <td>${partner.depositTransactionsCount || 0}</td>
                    <td>${partner.withdrawalTransactionsCount || 0}</td>
                    <td>${partner.depositAppealsCount || 0}</td>
                    <td>${partner.delayedAppealsCount || 0}</td>
                    <td>${partner.depositSuccessPercent || 0}%</td>
                    <td>${partner.withdrawalSuccessPercent || 0}%</td>
                    <td>${partner.depositWorkTimePercent || 0}%</td>
                    <td>${partner.withdrawalWorkTimePercent || 0}%</td>
                    <td>${partner.chatIgnoring || 0}</td>
                    <td>${partner.webmanagementIgnore || 0}</td>
                    <td>${partner.depositQueues || 0}</td>
                    <td>${partner.withdrawalQueues || 0}</td>
                    <td>${partner.creditsOutsideLimits || 0}</td>
                    <td>${partner.wrongAmountApproval || 0}</td>
                    <td class="violations-cell" ${partner.otherViolationsDescription ? `data-tooltip="${this.escapeHtml(partner.otherViolationsDescription)}"` : ''}>${partner.otherViolations || 0}${partner.otherViolationsDescription ? ' <i data-lucide="info" style="width:14px;height:14px;vertical-align:middle;opacity:0.6;"></i>' : ''}</td>
                </tr>
            `;
        }).join('');

        // Сохраняем данные отчета для детального просмотра
        this.currentReportData = reportData;

        // Показываем отчет, скрываем плейсхолдер
        document.getElementById('reportNotGenerated').style.display = 'none';
        document.getElementById('reportGenerated').style.display = 'block';

        // Обновляем иконки
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    // Экспорт детального отчета в Excel
    exportReportToExcel() {
        if (!this.currentReportData || this.currentReportData.length === 0) {
            alert('Нет данных для экспорта. Сначала сформируйте отчет.');
            return;
        }

        // Подготавливаем данные для Excel
        const data = this.currentReportData.map(partner => {
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

    // Показать детальный отчет
    showDetailedReport() {
        if (!this.currentReportData || this.currentReportData.length === 0) {
            alert('Сначала сформируйте отчет');
            return;
        }

        const tbody = document.getElementById('detailedReportTableBody');
        tbody.innerHTML = this.currentReportData.map(partner => {
            const date = new Date(partner.dateAdded).toLocaleDateString('ru-RU');
            const statusClass = partner.status === 'новый' ? 'new' : partner.status === 'старый' ? 'old' : 'closed';
            const statusText = partner.status === 'новый' ? 'Новый' : partner.status === 'старый' ? 'Старый' : 'Закрыт';

            return `
                <tr>
                    <td>${this.escapeHtml(partner.method)}</td>
                    <td>${this.escapeHtml(partner.subagent)}</td>
                    <td>${this.escapeHtml(partner.subagentId)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${date}</td>
                    <td>${partner.backCount || 0}</td>
                    <td>${partner.cringeCount || 0}</td>
                    <td>${partner.autoDisableCount || 0}</td>
                    <td>${partner.depositTransactionsCount || 0}</td>
                    <td>${partner.withdrawalTransactionsCount || 0}</td>
                    <td>${partner.depositAppealsCount || 0}</td>
                    <td>${partner.delayedAppealsCount || 0}</td>
                    <td>${partner.depositSuccessPercent || 0}%</td>
                    <td>${partner.withdrawalSuccessPercent || 0}%</td>
                    <td>${partner.depositWorkTimePercent || 0}%</td>
                    <td>${partner.withdrawalWorkTimePercent || 0}%</td>
                    <td>${partner.chatIgnoring || 0}</td>
                    <td>${partner.webmanagementIgnore || 0}</td>
                    <td>${partner.depositQueues || 0}</td>
                    <td>${partner.withdrawalQueues || 0}</td>
                    <td>${partner.creditsOutsideLimits || 0}</td>
                    <td>${partner.wrongAmountApproval || 0}</td>
                    <td class="violations-cell" ${partner.otherViolationsDescription ? `data-tooltip="${this.escapeHtml(partner.otherViolationsDescription)}"` : ''}>${partner.otherViolations || 0}${partner.otherViolationsDescription ? ' <i data-lucide="info" style="width:14px;height:14px;vertical-align:middle;opacity:0.6;"></i>' : ''}</td>
                </tr>
            `;
        }).join('');

        document.getElementById('detailedReportModal').classList.add('show');

        // Обновляем иконки
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    // Закрыть детальный отчет
    closeDetailedReport() {
        document.getElementById('detailedReportModal').classList.remove('show');
    },

    // Экранирование HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Экспорт списка партнеров в JSON
    exportPartners() {
        const partners = storage.getPartners();

        if (partners.length === 0) {
            alert('Список партнеров пуст. Нечего экспортировать.');
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
        preview.style.display = 'none';
        preview.innerHTML = '';
        importBtn.disabled = true;

        // Обработчик выбора файла
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) {
                preview.style.display = 'none';
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
                    preview.style.display = 'block';
                    preview.innerHTML = `
                        <strong>Файл готов к импорту:</strong><br>
                        Партнеров в файле: ${jsonData.partners.length}<br>
                        Дата экспорта: ${jsonData.exportDate ? new Date(jsonData.exportDate).toLocaleString('ru-RU') : 'неизвестно'}
                    `;

                    importBtn.disabled = false;
                } catch (error) {
                    preview.style.display = 'block';
                    preview.style.background = '#f8d7da';
                    preview.style.color = '#721c24';
                    preview.innerHTML = `<strong>Ошибка:</strong> ${error.message}`;
                    importBtn.disabled = true;
                }
            };

            reader.onerror = () => {
                preview.style.display = 'block';
                preview.style.background = '#f8d7da';
                preview.style.color = '#721c24';
                preview.innerHTML = '<strong>Ошибка:</strong> Не удалось прочитать файл';
                importBtn.disabled = true;
            };

            reader.readAsText(file);
        };

        modal.classList.add('show');

        // Обновляем иконки
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
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
            alert('Выберите файл для импорта');
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

                // Подтверждение перед импортом
                const currentPartners = storage.getPartners();
                let confirmMessage = `Вы уверены, что хотите импортировать ${jsonData.partners.length} партнер(ов)?`;

                if (currentPartners.length > 0) {
                    confirmMessage += `\n\nВнимание: Текущие ${currentPartners.length} партнер(ов) будут заменены!`;
                }

                if (!confirm(confirmMessage)) {
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
                        partner.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
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
                this.renderPartners();
                this.loadMethods();
                this.closeImportModal();

                alert(`Успешно импортировано ${processedPartners.length} партнер(ов)!`);
            } catch (error) {
                alert(`Ошибка при импорте: ${error.message}`);
                console.error('Import error:', error);
            }
        };

        reader.onerror = () => {
            alert('Ошибка при чтении файла');
        };

        reader.readAsText(file);
    }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    trafficCalc.init();
});
