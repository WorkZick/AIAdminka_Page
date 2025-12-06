// Шаблон: B-TAG
// Анализ транзакций по статусам (по заголовкам, БЕЗ привязки к колонкам)

window.TEMPLATE_B_TAG = {
    id: 'b-tag',
    name: 'B-TAG',
    description: 'Листы: T3.4',
    filesConfig: {
        step1: {
            name: 'Файл транзакций',
            multiple: true,
            requiredColumns: ['Номер игрока', 'Статус 1 транзакции', 'Статус 2 транзакции']
        }
    },
    handler: (transactionsData) => {
        // Объединяем данные из всех файлов
        let combinedData = [];
        const filesArray = Array.isArray(transactionsData) ? transactionsData : [transactionsData];

        if (filesArray.length === 0) {
            throw new Error('Нет загруженных файлов');
        }

        // Обрабатываем первый файл (берем заголовки)
        const firstFile = filesArray[0];
        if (!firstFile || firstFile.length === 0) {
            throw new Error('Первый файл не содержит данных');
        }

        combinedData = [...firstFile]; // Копируем весь первый файл (с заголовками)

        // Добавляем данные из остальных файлов (без заголовков)
        for (let i = 1; i < filesArray.length; i++) {
            const file = filesArray[i];
            if (!file || file.length <= 1) continue; // Пропускаем пустые файлы или файлы только с заголовками

            // Добавляем строки начиная со второй (пропускаем заголовок)
            for (let j = 1; j < file.length; j++) {
                if (file[j] && file[j].length > 0) {
                    combinedData.push(file[j]);
                }
            }
        }

        const data = combinedData;

        if (!data || data.length === 0) {
            throw new Error('Файлы не содержат данных');
        }

        // Заголовки для поиска колонок
        const HEADERS_MAP = {
            playerId: ['Номер игрока'],
            status1: ['Статус 1 транзакции'],
            status2: ['Статус 2 транзакции']
        };

        // Функция поиска колонки по заголовку
        const findColumn = (headers, possibleNames) => {
            for (let i = 0; i < headers.length; i++) {
                const header = (headers[i] || '').toString().trim();
                for (const name of possibleNames) {
                    if (header.toLowerCase() === name.toLowerCase()) {
                        return i;
                    }
                }
            }
            return -1;
        };

        const headers = data[0];

        // Найти все колонки по заголовкам
        const cols = {
            playerId: findColumn(headers, HEADERS_MAP.playerId),
            status1: findColumn(headers, HEADERS_MAP.status1),
            status2: findColumn(headers, HEADERS_MAP.status2)
        };

        // Проверка наличия всех колонок
        for (const [key, value] of Object.entries(cols)) {
            if (value === -1) {
                throw new Error(`Не найдена колонка: ${HEADERS_MAP[key].join(' / ')}`);
            }
        }

        // Цвета проекта (ARGB формат)
        const COLORS = {
            header: 'FF3D3D3D',
            headerText: 'FFFFFFFF',
            yellow: 'FFFFD966',
            border: 'FF808080',
            dataText: 'FF1A1A1A'
        };

        // Общие границы
        const thinBorder = {
            top: { style: 'thin', color: { argb: COLORS.border } },
            left: { style: 'thin', color: { argb: COLORS.border } },
            bottom: { style: 'thin', color: { argb: COLORS.border } },
            right: { style: 'thin', color: { argb: COLORS.border } }
        };

        // Стили
        const headerStyle = {
            fill: COLORS.header,
            font: { name: 'Bahnschrift Condensed', size: 10, color: { argb: COLORS.headerText } },
            border: thinBorder
        };
        const dataStyle = {
            font: { name: 'Bahnschrift Light Condensed', size: 10, color: { argb: COLORS.dataText } },
            border: thinBorder
        };
        const separatorStyle = {
            fill: COLORS.yellow,
            border: thinBorder
        };

        // Счётчики (как в VBA макросе)
        let valueCount = 0;      // Кол-во записей (A ≠ пусто)
        let okCount = 0;         // M = "ОК"
        let отказCount = 0;      // M = "Отказ"
        let okОтказCount = 0;    // M = "ОК" И P = "ОК"
        let отказOkCount = 0;    // M = "Отказ" И P = "Отказ"

        // Проходим по всем строкам данных (начиная со 2-й, т.к. 1-я - заголовки)
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const playerId = (row[cols.playerId] || '').toString().trim();
            const status1 = (row[cols.status1] || '').toString().trim();
            const status2 = (row[cols.status2] || '').toString().trim();

            // Считаем количество записей (непустой номер игрока)
            if (playerId !== '') {
                valueCount++;
            }

            // Считаем "ОК" в статусе 1
            if (status1 === 'ОК') {
                okCount++;
            }

            // Считаем "Отказ" в статусе 1
            if (status1 === 'Отказ') {
                отказCount++;
            }

            // Считаем "ОК" в статусе 1 И "ОК" в статусе 2
            if (status1 === 'ОК' && status2 === 'ОК') {
                okОтказCount++;
            }

            // Считаем "Отказ" в статусе 1 И "Отказ" в статусе 2
            if (status1 === 'Отказ' && status2 === 'Отказ') {
                отказOkCount++;
            }
        }

        // Расчёт процентов
        const firstDepositPercent = valueCount > 0 ? okCount / valueCount : 0;
        const secondDepositPercent = okCount > 0 ? okОтказCount / okCount : 0;
        const firstRefusalPercent = valueCount > 0 ? отказCount / valueCount : 0;
        const retryAfterRefusalPercent = отказCount > 0 ? отказOkCount / отказCount : 0;

        // Инициализация результата
        const result = {
            _useExcelJS: true,
            sheets: {
                'T3.4': {
                    columns: [
                        { width: 50.71 }, // A - Показатель (50 + 0.71)
                        { width: 7.71 },  // B - Значение (7 + 0.71)
                        { width: 1.71 }   // C - разделитель (1 + 0.71)
                    ],
                    data: [],
                    merges: [],
                    styles: []
                }
            }
        };

        // Заголовки
        result.sheets['T3.4'].data.push(['Показатель', 'Месяц', null]);
        result.sheets['T3.4'].data.push([null, null, null]);
        result.sheets['T3.4'].merges = ['A1:A2', 'B1:B2', 'C1:C2'];
        result.sheets['T3.4'].styles = [
            { cell: 'A1', ...headerStyle },
            { cell: 'B1', ...headerStyle },
            { cell: 'A2', ...headerStyle },
            { cell: 'B2', ...headerStyle },
            { cell: 'C1', ...separatorStyle }
        ];

        // Данные T3.4
        const t34Data = [
            ['Кол-во зарегистрированных аккаунтов', valueCount, false],
            ['Кол-во пользователей, сделавших первый успешный депозит', okCount, false],
            ['Процент пользователей, сделавших первый успешный депозит', firstDepositPercent, true],
            ['Кол-во пользователей, сделавших второй успешный депозит', okОтказCount, false],
            ['Процент пользователей, сделавших второй успешный депозит после первого', secondDepositPercent, true],
            ['Пользователи, получившие отказ на первый депозит', отказCount, false],
            ['Процент пользователей, получившие отказ на первый депозит', firstRefusalPercent, true],
            ['Пользователи, сделавшие повторную попытку после отказа', отказOkCount, false],
            ['Процент пользователей, сделавших повторную попытку после отказа', retryAfterRefusalPercent, true]
        ];

        let currentRow = 3;
        const dataStart = currentRow;

        t34Data.forEach(row => {
            result.sheets['T3.4'].data.push([row[0], row[1], null]);
            result.sheets['T3.4'].styles.push({ cell: `A${currentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
            if (row[2]) {
                result.sheets['T3.4'].styles.push({ cell: `B${currentRow}`, ...dataStyle, numFmt: '0.00%' });
            } else {
                result.sheets['T3.4'].styles.push({ cell: `B${currentRow}`, ...dataStyle });
            }
            currentRow++;
        });

        // Жёлтый разделитель
        result.sheets['T3.4'].merges.push(`C${dataStart}:C${currentRow - 1}`);
        result.sheets['T3.4'].styles.push({ cell: `C${dataStart}`, ...separatorStyle });

        return result;
    }
};
