// Модуль парсеров данных (Web Worker для Excel + функции парсинга)
const TrafficParsers = {
    _AUTO_DISABLE_ADMIN: 'Aвтоотключалка', // A — латинская (U+0041)
    _worker: null,
    _workerBusy: false,
    _workerQueue: [],

    // Получить или создать Worker (ленивая инициализация)
    _getWorker() {
        if (!this._worker) {
            this._worker = new Worker('js/modules/excel-worker.js');
            this._worker.onerror = (e) => {
                console.error('Excel Worker error:', e.message);
            };
        }
        return this._worker;
    },

    // Чтение Excel файла через Web Worker (с очередью)
    readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const task = () => this._processInWorker(file).then(resolve, reject);

            if (this._workerBusy) {
                this._workerQueue.push(task);
            } else {
                this._workerBusy = true;
                task().finally(() => this._processNextInQueue());
            }
        });
    },

    // Обработать следующую задачу из очереди
    _processNextInQueue() {
        const next = this._workerQueue.shift();
        if (next) {
            next().finally(() => this._processNextInQueue());
        } else {
            this._workerBusy = false;
        }
    },

    // Отправка файла в Worker и ожидание результата
    async _processInWorker(file) {
        const WORKER_TIMEOUT = 120000; // 2 минуты
        const arrayBuffer = await file.arrayBuffer();
        const worker = this._getWorker();

        return new Promise((resolve, reject) => {
            let batchedData = null;

            const timer = setTimeout(() => {
                cleanup();
                this._worker.terminate();
                this._worker = null;
                reject(new Error('Превышено время обработки файла. Файл слишком большой или повреждён.'));
            }, WORKER_TIMEOUT);

            const cleanup = () => {
                clearTimeout(timer);
                worker.removeEventListener('message', handler);
                worker.removeEventListener('error', errorHandler);
            };

            const errorHandler = (e) => {
                cleanup();
                reject(new Error('Ошибка Worker: ' + (e.message || 'неизвестная ошибка')));
            };

            const handler = (e) => {
                const msg = e.data;

                switch (msg.type) {
                    case 'done':
                        cleanup();
                        resolve(msg.data);
                        break;

                    case 'start':
                        batchedData = new Array(msg.totalRows);
                        break;

                    case 'batch':
                        for (let i = 0; i < msg.batch.length; i++) {
                            batchedData[msg.offset + i] = msg.batch[i];
                        }
                        break;

                    case 'batch-end':
                        cleanup();
                        for (let i = 0; i < msg.batch.length; i++) {
                            batchedData[msg.offset + i] = msg.batch[i];
                        }
                        resolve(batchedData);
                        break;

                    case 'error':
                        cleanup();
                        reject(new Error(msg.error));
                        break;
                }
            };

            worker.addEventListener('message', handler);
            worker.addEventListener('error', errorHandler);

            // Transferable ArrayBuffer — zero-copy transfer to Worker
            worker.postMessage({ arrayBuffer, fileIndex: 0 }, [arrayBuffer]);
        });
    },

    // Завершение Worker при уничтожении
    destroy() {
        if (this._worker) {
            this._worker.terminate();
            this._worker = null;
        }
        this._workerBusy = false;
        this._workerQueue = [];
    },

    // Парсинг данных из отчета "Пополнения и выводы"
    parseDepositsData(data, commentsData) {
        if (!data || data.length < 2) return; // Нет данных или только заголовки

        const headers = data[0];
        const subagentIdIndex = headers.findIndex(h => {
            if (!h) return false;
            const header = h.toString().toLowerCase();
            return header.includes('субагент') && header.includes('id');
        });
        const paramsIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('доп. параметры №'));

        if (subagentIdIndex === -1 || paramsIndex === -1) return;

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
        if (!excelData || excelData.length < 2) return;

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
            // ВАЖНО: первая A — латинская (U+0041), остальное — кириллица
            if (admin !== TrafficParsers._AUTO_DISABLE_ADMIN) continue;

            // Шаг 4: Извлекаем все числа из колонки subagent
            // Пример: "Jajje kddd dskd ksdks 51553" -> ["51553"]
            // Пример: "User 123 and 456" -> ["123", "456"]
            const foundNumbers = subagent.match(/\d+/g);

            // Если чисел не найдено - пропускаем
            if (!foundNumbers || foundNumbers.length === 0) continue;

            // Шаг 5: Проверяем каждое найденное число
            for (let j = 0; j < foundNumbers.length; j++) {
                const numberId = foundNumbers[j];
                // Проверяем: есть ли этот ID в нашей системе?
                if (TrafficState.ourPartnerIds.includes(numberId)) {
                    if (!counters[numberId]) {
                        counters[numberId] = 0;
                    }
                    counters[numberId]++;
                }
            }
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
        if (!excelData || excelData.length < 2) return;

        // Шаг 1: Находим индексы всех нужных колонок по точным названиям
        const headerRow = excelData[0];

        // Ищем колонку с ID субагента (с учетом возможных вариантов написания)
        const subagentIdIndex = headerRow.findIndex(header => {
            if (!header) return false;
            const h = header.toString().trim().toLowerCase();
            return h === 'субагент id' || h === 'id субагента' || h === 'id cубагента' || (h.includes('субагент') && h.includes('id'));
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

        // Шаг 2: Проходим по всем строкам (кроме заголовков)
        for (let rowIndex = 1; rowIndex < excelData.length; rowIndex++) {
            const row = excelData[rowIndex];

            // Получаем ID субагента из строки
            const subagentIdValue = row[subagentIdIndex];
            if (!subagentIdValue) continue;

            const subagentId = subagentIdValue.toString().trim();

            // Шаг 3: Проверяем - есть ли этот ID в нашей системе?
            if (!TrafficState.ourPartnerIds.includes(subagentId)) continue;

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
    }
};
