// Шаблон: Активные пользователи
// Анализ активных пользователей (прошлый месяц vs текущий месяц)

window.TEMPLATE_ACTIVE_USERS = {
    id: 'active-users',
    name: 'Активные пользователи',
    description: 'Листы: T4, T4.1',
    filesConfig: {
        step1: { name: 'Файл прошлого месяца (ID игрока)', multiple: false },
        step2: { name: 'Файл текущего месяца (ID игрока)', multiple: false }
    },
    handler: (prevMonthData, currentMonthData) => {
        const dataPrev = Array.isArray(prevMonthData) ? prevMonthData[0] : prevMonthData;
        const dataCurrent = Array.isArray(currentMonthData) ? currentMonthData[0] : currentMonthData;

        if (!dataPrev || dataPrev.length === 0) {
            throw new Error('Файл прошлого месяца не содержит данных');
        }
        if (!dataCurrent || dataCurrent.length === 0) {
            throw new Error('Файл текущего месяца не содержит данных');
        }

        // Заголовки для поиска колонок
        const HEADERS_MAP = {
            playerId: ['ID игрока', 'Player ID', 'Номер игрока', 'ID']
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

        // Найти колонку ID игрока в обоих файлах
        const colPrev = findColumn(dataPrev[0] || [], HEADERS_MAP.playerId);
        const colCurrent = findColumn(dataCurrent[0] || [], HEADERS_MAP.playerId);

        if (colPrev === -1) {
            throw new Error(`Не найдена колонка в файле прошлого месяца: ${HEADERS_MAP.playerId.join(' / ')}`);
        }
        if (colCurrent === -1) {
            throw new Error(`Не найдена колонка в файле текущего месяца: ${HEADERS_MAP.playerId.join(' / ')}`);
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

        // Собираем ID игроков из прошлого месяца в словарь
        const prevMonthIds = new Map();
        for (let i = 1; i < dataPrev.length; i++) {
            const row = dataPrev[i];
            if (!row || row.length === 0) continue;
            const id = (row[colPrev] || '').toString().trim();
            if (id !== '') {
                if (prevMonthIds.has(id)) {
                    prevMonthIds.set(id, prevMonthIds.get(id) + 1);
                } else {
                    prevMonthIds.set(id, 1);
                }
            }
        }

        // Собираем ID игроков из текущего месяца и считаем совпадения
        let countCurrent = 0;
        let countMatches = 0;
        const currentMonthIds = new Set();

        for (let i = 1; i < dataCurrent.length; i++) {
            const row = dataCurrent[i];
            if (!row || row.length === 0) continue;
            const id = (row[colCurrent] || '').toString().trim();
            if (id !== '') {
                countCurrent++;
                currentMonthIds.add(id);
                if (prevMonthIds.has(id)) {
                    countMatches += prevMonthIds.get(id);
                }
            }
        }

        const countPrev = prevMonthIds.size > 0
            ? Array.from(prevMonthIds.values()).reduce((sum, count) => sum + count, 0)
            : 0;

        // Расчёты
        const countNew = countCurrent - countMatches; // Новые пользователи
        const countChurn = countPrev - countMatches;  // Отток
        const growthPercent = countPrev > 0 ? (countCurrent - countPrev) / countPrev : 0;
        const matchesPercent = countCurrent > 0 ? countMatches / countCurrent : 0;
        const newPercent = countCurrent > 0 ? countNew / countCurrent : 0;
        const churnPercent = countPrev > 0 ? countChurn / countPrev : 0;
        const currentGrowthPercent = countPrev > 0 ? countCurrent / countPrev - 1 : 0;

        // Инициализация результата
        const result = {
            _useExcelJS: true,
            sheets: {
                'T4': {
                    columns: [
                        { width: 40.71 },  // A - Показатель
                        { width: 7.71 },   // B - Прошлый месяц
                        { width: 1.71 },   // C - разделитель
                        { width: 7.71 },   // D - Текущий месяц
                        { width: 1.71 }    // E - разделитель
                    ],
                    data: [],
                    merges: [],
                    styles: [],
                    rowHeights: { '2': 30 }
                },
                'T4.1': {
                    columns: [
                        { width: 40.71 },  // A - Показатель
                        { width: 7.71 },   // B - Прошлый месяц
                        { width: 1.71 },   // C - разделитель
                        { width: 7.71 },   // D - Текущий месяц (значение)
                        { width: 7.71 },   // E - Текущий месяц (процент)
                        { width: 1.71 }    // F - разделитель
                    ],
                    data: [],
                    merges: [],
                    styles: [],
                    rowHeights: { '2': 30 }
                }
            }
        };

        // ==================== ЛИСТ T4 ====================
        const sheetT4 = result.sheets['T4'];

        // Заголовки (строки 1-2)
        sheetT4.data.push(['Показатель', 'Прошлый месяц', null, 'Текущий месяц', null]);
        sheetT4.data.push([null, null, null, null, null]);

        sheetT4.merges = ['A1:A2', 'B1:B2', 'C1:C2', 'D1:D2', 'E1:E2'];

        // Стили заголовков T4
        sheetT4.styles = [
            { cell: 'A1', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle' } },
            { cell: 'B1', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
            { cell: 'D1', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
            { cell: 'A2', ...headerStyle },
            { cell: 'B2', ...headerStyle },
            { cell: 'D2', ...headerStyle },
            { cell: 'C1', ...separatorStyle },
            { cell: 'E1', ...separatorStyle }
        ];

        // Данные T4
        const t4Data = [
            ['Активные пользователи', countPrev, null, countCurrent, null],
            ['Процент прироста, с предыдущим месяцем', '-', null, growthPercent, null]
        ];

        let t4Row = 3;
        t4Data.forEach((row, idx) => {
            sheetT4.data.push(row);
            sheetT4.styles.push({ cell: `A${t4Row}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
            sheetT4.styles.push({ cell: `B${t4Row}`, ...dataStyle, alignment: { horizontal: 'center', vertical: 'middle' } });
            sheetT4.styles.push({ cell: `C${t4Row}`, ...separatorStyle });

            if (idx === 1) {
                // Процент
                sheetT4.styles.push({ cell: `D${t4Row}`, ...dataStyle, alignment: { horizontal: 'center', vertical: 'middle' }, numFmt: '0.00%' });
            } else {
                sheetT4.styles.push({ cell: `D${t4Row}`, ...dataStyle, alignment: { horizontal: 'center', vertical: 'middle' } });
            }
            sheetT4.styles.push({ cell: `E${t4Row}`, ...separatorStyle });
            t4Row++;
        });

        // Объединяем разделители
        sheetT4.merges.push(`C3:C${t4Row - 1}`);
        sheetT4.merges.push(`E3:E${t4Row - 1}`);

        // ==================== ЛИСТ T4.1 ====================
        const sheetT41 = result.sheets['T4.1'];

        // Заголовки (строки 1-2)
        sheetT41.data.push(['Показатель', 'Прошлый месяц', null, 'Текущий месяц', null, null]);
        sheetT41.data.push([null, null, null, null, null, null]);

        sheetT41.merges = ['A1:A2', 'B1:B2', 'C1:C2', 'D1:E2', 'F1:F2'];

        // Стили заголовков T4.1
        sheetT41.styles = [
            { cell: 'A1', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle' } },
            { cell: 'B1', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
            { cell: 'D1', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
            { cell: 'E1', ...headerStyle }, { cell: 'E2', ...headerStyle },
            { cell: 'A2', ...headerStyle },
            { cell: 'B2', ...headerStyle },
            { cell: 'D2', ...headerStyle },
            { cell: 'C1', ...separatorStyle },
            { cell: 'F1', ...separatorStyle }
        ];

        // Данные T4.1
        const t41Data = [
            ['Количество активных пользователей за месяц', countPrev, null, countCurrent, currentGrowthPercent, null],
            ['Количество активных пользователей, перешедших с прошлого месяца', 'x', null, countMatches, matchesPercent, null],
            ['Количество новых активных пользователей в текущем месяце', 'x', null, countNew, newPercent, null],
            ['Отток активных пользователей с предыдущего месяца', 'x', null, countChurn, churnPercent, null]
        ];

        let t41Row = 3;
        t41Data.forEach((row) => {
            sheetT41.data.push(row);
            sheetT41.styles.push({ cell: `A${t41Row}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
            sheetT41.styles.push({ cell: `B${t41Row}`, ...dataStyle, alignment: { horizontal: 'center', vertical: 'middle' } });
            sheetT41.styles.push({ cell: `C${t41Row}`, ...separatorStyle });
            sheetT41.styles.push({ cell: `D${t41Row}`, ...dataStyle, alignment: { horizontal: 'center', vertical: 'middle' } });
            sheetT41.styles.push({ cell: `E${t41Row}`, ...dataStyle, alignment: { horizontal: 'center', vertical: 'middle' }, numFmt: '0.00%' });
            sheetT41.styles.push({ cell: `F${t41Row}`, ...separatorStyle });
            t41Row++;
        });

        // Объединяем разделители
        sheetT41.merges.push(`C3:C${t41Row - 1}`);
        sheetT41.merges.push(`F3:F${t41Row - 1}`);

        return result;
    }
};
