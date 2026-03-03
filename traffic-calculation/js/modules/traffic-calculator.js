// Модуль расчёта трафика
const TrafficCalculator = {
    // Загрузить настройки из localStorage или создать дефолтные
    loadTrafficSettings() {
        const saved = localStorage.getItem('trafficSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                // Миграция: исправляем старые отрицательные значения на положительные
                Object.keys(settings).forEach(key => {
                    if (settings[key].pointsPerItem !== undefined && settings[key].pointsPerItem < 0) {
                        settings[key].pointsPerItem = 5;
                    }
                });
                // Сохраняем мигрированные настройки
                localStorage.setItem('trafficSettings', JSON.stringify(settings));
                return settings;
            } catch (e) {
                ErrorHandler.handle(e, {
                    module: 'traffic-calculation',
                    action: 'loadTrafficSettings'
                });
            }
        }
        return TrafficCalculator.getDefaultTrafficSettings();
    },

    // Получить дефолтные настройки
    // Логика: чем больше баллов — тем хуже результат, тем меньше трафика
    getDefaultTrafficSettings() {
        const settings = {};

        TrafficState.trafficParams.forEach(param => {
            if (param.type === 'text') {
                // Для текстовых полей (например, статус)
                settings[param.key] = {
                    good: { value: '', points: 1 },
                    normal: { value: '', points: 2 },
                    bad: { value: '', points: 3 },
                    terrible: { value: '', points: 4 }
                };
            } else if (param.type === 'percent') {
                // Для процентов
                settings[param.key] = {
                    good: { min: 0, max: 0, points: 1 },
                    normal: { min: 0, max: 0, points: 2 },
                    bad: { min: 0, max: 0, points: 3 },
                    terrible: { min: 0, max: 0, points: 4 }
                };
            } else if (param.type === 'multiplier') {
                // Для множителя (баллы за каждое нарушение)
                settings[param.key] = {
                    pointsPerItem: 5
                };
            } else {
                // Для числовых полей
                settings[param.key] = {
                    good: { min: 0, max: 0, points: 1 },
                    normal: { min: 0, max: 0, points: 2 },
                    bad: { min: 0, max: 0, points: 3 },
                    terrible: { min: 0, max: 0, points: 4 }
                };
            }
        });

        return settings;
    },

    // Сохранить настройки
    saveTrafficSettings() {
        localStorage.setItem('trafficSettings', JSON.stringify(TrafficState.trafficSettings));
    },

    // Отрисовать форму настроек
    renderTrafficSettings() {
        const container = document.getElementById('trafficSettingsForm');
        if (!container) return;

        // Добавляем легенду
        const legend = `
            <div class="traffic-legend">
                <span class="traffic-legend-title">Уровни:</span>
                <div class="traffic-legend-item"><span class="traffic-legend-dot good"></span>Хороший</div>
                <div class="traffic-legend-item"><span class="traffic-legend-dot normal"></span>Нормальный</div>
                <div class="traffic-legend-item"><span class="traffic-legend-dot bad"></span>Плохой</div>
                <div class="traffic-legend-item"><span class="traffic-legend-dot terrible"></span>Ужасный</div>
            </div>
        `;

        container.innerHTML = legend + TrafficState.trafficParams.map(param => {
            const settings = TrafficState.trafficSettings[param.key];

            if (param.type === 'text') {
                // Для текстовых полей
                return `
                    <div class="traffic-param-section">
                        <div class="traffic-param-header">
                            <img src="../shared/icons/filter.svg" alt="">
                            ${TrafficRenderer.escapeHtml(param.name)}
                        </div>
                        <div class="traffic-param-grid">
                            <div class="traffic-level-card good">
                                <div class="traffic-level-title">Хор.</div>
                                <div class="form-group">
                                    <span>Значение</span>
                                    <input type="text" value="${TrafficRenderer.escapeHtml(settings.good.value)}"
                                           data-param="${param.key}" data-level="good" data-field="value">
                                </div>
                                <div class="traffic-points-group">
                                    <span>Баллы:</span>
                                    <input type="number" value="${settings.good.points}"
                                           data-param="${param.key}" data-level="good" data-field="points">
                                </div>
                            </div>
                            <div class="traffic-level-card normal">
                                <div class="traffic-level-title">Норм.</div>
                                <div class="form-group">
                                    <span>Значение</span>
                                    <input type="text" value="${TrafficRenderer.escapeHtml(settings.normal.value)}"
                                           data-param="${param.key}" data-level="normal" data-field="value">
                                </div>
                                <div class="traffic-points-group">
                                    <span>Баллы:</span>
                                    <input type="number" value="${settings.normal.points}"
                                           data-param="${param.key}" data-level="normal" data-field="points">
                                </div>
                            </div>
                            <div class="traffic-level-card bad">
                                <div class="traffic-level-title">Плох.</div>
                                <div class="form-group">
                                    <span>Значение</span>
                                    <input type="text" value="${TrafficRenderer.escapeHtml(settings.bad.value)}"
                                           data-param="${param.key}" data-level="bad" data-field="value">
                                </div>
                                <div class="traffic-points-group">
                                    <span>Баллы:</span>
                                    <input type="number" value="${settings.bad.points}"
                                           data-param="${param.key}" data-level="bad" data-field="points">
                                </div>
                            </div>
                            <div class="traffic-level-card terrible">
                                <div class="traffic-level-title">Ужас.</div>
                                <div class="form-group">
                                    <span>Значение</span>
                                    <input type="text" value="${TrafficRenderer.escapeHtml(settings.terrible.value)}"
                                           data-param="${param.key}" data-level="terrible" data-field="value">
                                </div>
                                <div class="traffic-points-group">
                                    <span>Баллы:</span>
                                    <input type="number" value="${settings.terrible.points}"
                                           data-param="${param.key}" data-level="terrible" data-field="points">
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
                            <img src="../shared/icons/cross.svg" alt="">
                            ${TrafficRenderer.escapeHtml(param.name)}
                        </div>
                        <div class="traffic-multiplier-settings">
                            <div class="traffic-multiplier-card">
                                <div class="traffic-multiplier-info">
                                    <span class="multiplier-label">Штрафные баллы за каждое нарушение:</span>
                                    <input type="number" value="${settings.pointsPerItem || 5}" min="0"
                                           data-param="${param.key}" data-field="pointsPerItem" data-multiplier="true">
                                </div>
                                <div class="multiplier-example">
                                    Пример: 3 нарушения × <span id="${param.key}Multiplier">${settings.pointsPerItem || 5}</span> = <span id="${param.key}Example">+${(settings.pointsPerItem || 5) * 3}</span> штрафных баллов
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
                            <img src="../shared/icons/filter.svg" alt="">
                            ${TrafficRenderer.escapeHtml(param.name)}
                        </div>
                        <div class="traffic-param-grid">
                            <div class="traffic-level-card good">
                                <div class="traffic-level-title">Хор.</div>
                                <div class="traffic-range-group">
                                    <span>От:</span>
                                    <input type="number" value="${settings.good.min}"
                                           data-param="${param.key}" data-level="good" data-field="min">
                                </div>
                                <div class="traffic-range-group">
                                    <span>До:</span>
                                    <input type="number" value="${settings.good.max}"
                                           data-param="${param.key}" data-level="good" data-field="max">
                                </div>
                                <div class="traffic-points-group">
                                    <span>Баллы:</span>
                                    <input type="number" value="${settings.good.points}"
                                           data-param="${param.key}" data-level="good" data-field="points">
                                </div>
                            </div>
                            <div class="traffic-level-card normal">
                                <div class="traffic-level-title">Норм.</div>
                                <div class="traffic-range-group">
                                    <span>От:</span>
                                    <input type="number" value="${settings.normal.min}"
                                           data-param="${param.key}" data-level="normal" data-field="min">
                                </div>
                                <div class="traffic-range-group">
                                    <span>До:</span>
                                    <input type="number" value="${settings.normal.max}"
                                           data-param="${param.key}" data-level="normal" data-field="max">
                                </div>
                                <div class="traffic-points-group">
                                    <span>Баллы:</span>
                                    <input type="number" value="${settings.normal.points}"
                                           data-param="${param.key}" data-level="normal" data-field="points">
                                </div>
                            </div>
                            <div class="traffic-level-card bad">
                                <div class="traffic-level-title">Плох.</div>
                                <div class="traffic-range-group">
                                    <span>От:</span>
                                    <input type="number" value="${settings.bad.min}"
                                           data-param="${param.key}" data-level="bad" data-field="min">
                                </div>
                                <div class="traffic-range-group">
                                    <span>До:</span>
                                    <input type="number" value="${settings.bad.max}"
                                           data-param="${param.key}" data-level="bad" data-field="max">
                                </div>
                                <div class="traffic-points-group">
                                    <span>Баллы:</span>
                                    <input type="number" value="${settings.bad.points}"
                                           data-param="${param.key}" data-level="bad" data-field="points">
                                </div>
                            </div>
                            <div class="traffic-level-card terrible">
                                <div class="traffic-level-title">Ужас.</div>
                                <div class="traffic-range-group">
                                    <span>От:</span>
                                    <input type="number" value="${settings.terrible.min}"
                                           data-param="${param.key}" data-level="terrible" data-field="min">
                                </div>
                                <div class="traffic-range-group">
                                    <span>До:</span>
                                    <input type="number" value="${settings.terrible.max}"
                                           data-param="${param.key}" data-level="terrible" data-field="max">
                                </div>
                                <div class="traffic-points-group">
                                    <span>Баллы:</span>
                                    <input type="number" value="${settings.terrible.points}"
                                           data-param="${param.key}" data-level="terrible" data-field="points">
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }).join('');

        // Event delegation для всех настроек трафика
        container.addEventListener('change', (e) => {
            const input = e.target;

            // Обработка множителей
            if (input.dataset.multiplier) {
                TrafficCalculator.updateTrafficSettingMultiplier(
                    input.dataset.param,
                    input.dataset.field,
                    parseInt(input.value)
                );
            }
            // Обработка обычных настроек
            else if (input.dataset.param && input.dataset.level && input.dataset.field) {
                let value = input.value;

                // Преобразуем значение в зависимости от типа
                if (input.type === 'number') {
                    value = input.dataset.field === 'points' ? parseInt(value) : parseFloat(value);
                }

                TrafficCalculator.updateTrafficSetting(
                    input.dataset.param,
                    input.dataset.level,
                    input.dataset.field,
                    value
                );
            }
        });
    },

    // Обновить настройку
    updateTrafficSetting(paramKey, level, field, value) {
        if (!TrafficState.trafficSettings[paramKey]) return;
        TrafficState.trafficSettings[paramKey][level][field] = value;
        TrafficCalculator.saveTrafficSettings();
    },

    // Обновить настройку множителя
    updateTrafficSettingMultiplier(paramKey, field, value) {
        if (!TrafficState.trafficSettings[paramKey]) return;
        TrafficState.trafficSettings[paramKey][field] = value;
        TrafficCalculator.saveTrafficSettings();

        // Обновляем пример (3 нарушения × баллы = штрафные баллы)
        const multiplierEl = document.getElementById(paramKey + 'Multiplier');
        const exampleEl = document.getElementById(paramKey + 'Example');
        if (multiplierEl) {
            multiplierEl.textContent = value;
        }
        if (exampleEl) {
            exampleEl.textContent = '+' + (value * 3);
        }
    },

    // Переключить отображение подсказки
    toggleHelp() {
        const helpContent = document.getElementById('trafficHelpContent');
        if (helpContent) {
            helpContent.classList.toggle('hidden');
        }
    },

    /**
     * Оценить качество работы партнера по всем параметрам
     *
     * @param {Object} partner - Данные партнера
     * @param {Object} settings - Настройки оценки (пороги и баллы для каждого параметра)
     * @returns {Object} Объект с баллами: { good, normal, bad, terrible, total }
     *
     * @description
     * Проходит по всем параметрам (backCount, depositSuccessPercent и т.д.) и:
     * - Для числовых полей: проверяет попадание в диапазоны (good/normal/bad/terrible)
     * - Для текстовых полей: сравнивает точное соответствие
     * - Для множителя: начисляет штрафные баллы за каждое нарушение
     * Чем больше итоговый балл - тем хуже работает партнер - тем меньше трафика получит
     */
    evaluatePartner(partner, settings) {
        const scores = {
            good: 0,
            normal: 0,
            bad: 0,
            terrible: 0,
            total: 0
        };

        // Рассчитываем дни с момента добавления
        partner.daysFromAdded = TrafficCalculator.getDaysFromAdded(partner.dateAdded);

        // Проходим по всем параметрам
        TrafficState.trafficParams.forEach(param => {
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
                // Для множителя - штрафные баллы за каждое нарушение
                const numValue = parseInt(value) || 0;
                const pointsPerItem = paramSettings.pointsPerItem || 5;
                const totalPoints = numValue * pointsPerItem;

                // Нарушения всегда добавляют штрафные баллы (больше баллов = хуже = меньше трафика)
                if (totalPoints > 0) {
                    scores.bad += totalPoints;
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

    /**
     * Рассчитать процент трафика для каждого партнера
     * Распределение происходит внутри каждого метода отдельно (100% на метод)
     * Использует обратную пропорцию: чем больше баллов (хуже работа) — тем меньше % трафика
     *
     * @description
     * 1. Группирует партнеров по методу
     * 2. Для каждого метода рассчитывает обратные баллы (1/(score+1))
     * 3. Распределяет 100% трафика пропорционально обратным баллам
     * 4. Округляет вниз и распределяет остаток по партнёрам с лучшими показателями
     */
    calculateTrafficPercentages() {
        if (!TrafficState.trafficResults || TrafficState.trafficResults.length === 0) return;

        // Группируем партнеров по методу
        const methodGroups = {};
        TrafficState.trafficResults.forEach(result => {
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

            // Обратная пропорция: используем 1/(score+1) для расчёта
            // Чем меньше баллов — тем больше inverseScore — тем больше % трафика
            const inverseData = groupResults.map(result => ({
                result: result,
                inverseScore: 1 / (result.scores.total + 1)
            }));

            const totalInverse = inverseData.reduce((sum, item) => sum + item.inverseScore, 0);

            // Рассчитываем процент для каждого и округляем вниз
            let results = inverseData.map(item => {
                const exactPercent = (item.inverseScore / totalInverse) * 100;
                const floorPercent = Math.floor(exactPercent);
                return {
                    result: item.result,
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
            // При равных остатках приоритет партнёру с меньшими баллами (лучше работает)
            if (deficit > 0) {
                results.sort((a, b) => {
                    if (Math.abs(b.remainder - a.remainder) > 0.0001) {
                        return b.remainder - a.remainder;
                    }
                    return a.result.scores.total - b.result.scores.total;
                });

                for (let i = 0; i < deficit && i < results.length; i++) {
                    results[i].result.trafficPercent += 1;
                }
            }
        });
    },

    // Рассчитать трафик
    calculateTraffic() {
        if (!TrafficState.currentReportData || TrafficState.currentReportData.length === 0) {
            Toast.warning('Нет данных для расчета');
            return;
        }

        // Выполняем расчет для каждого партнера
        TrafficState.trafficResults = TrafficState.currentReportData.map(partner => {
            const scores = TrafficCalculator.evaluatePartner(partner, TrafficState.trafficSettings);
            return {
                method: partner.method,
                subagent: partner.subagent,
                subagentId: partner.subagentId,
                scores: scores
            };
        });

        // Рассчитываем процент трафика для каждого партнера
        TrafficCalculator.calculateTrafficPercentages();

        // Закрываем настройки и показываем результаты
        TrafficRenderer.closeTrafficCalculator();
        TrafficRenderer.showTrafficResults();
    },

    // Рассчитать трафик и показать результаты (для кнопки "Рассчитать" на шаге 8)
    calculateAndShowResults() {
        if (!TrafficState.currentReportData || TrafficState.currentReportData.length === 0) {
            Toast.warning('Нет данных для расчета');
            return;
        }

        // Выполняем расчет для каждого партнера
        TrafficState.trafficResults = TrafficState.currentReportData.map(partner => {
            const scores = TrafficCalculator.evaluatePartner(partner, TrafficState.trafficSettings);
            return {
                method: partner.method,
                subagent: partner.subagent,
                subagentId: partner.subagentId,
                scores: scores
            };
        });

        // Рассчитываем процент трафика для каждого партнера
        TrafficCalculator.calculateTrafficPercentages();

        // Переходим на шаг 9 и показываем результаты
        TrafficNavigation.goToStep(9);
        TrafficRenderer.showTrafficResultsInStep();
    },

    // Подготовка шага 7 (отчёт)
    prepareStep7Report() {
        // Генерируем отчёт на основе данных предыдущих шагов
        if (TrafficState.selectedPartners.length === 0) {
            Toast.warning('Сначала выберите партнеров');
            TrafficNavigation.goToStep(1);
            return;
        }

        // Вызываем генерацию отчёта
        TrafficRenderer.generateReport();
    },

    // Подготовка шага 8 (настройки расчёта)
    prepareStep8Settings() {
        // Формируем данные для расчёта
        if (TrafficState.selectedPartners.length === 0) {
            Toast.warning('Сначала выберите партнеров');
            TrafficNavigation.goToStep(1);
            return;
        }

        const allPartners = storage.getPartners();
        TrafficState.currentReportData = allPartners.filter(p => TrafficState.selectedPartners.includes(p.id));

        // Загружаем или создаем настройки
        TrafficState.trafficSettings = TrafficCalculator.loadTrafficSettings();

        // Отображаем форму настроек
        TrafficCalculator.renderTrafficSettings();
    }
};
