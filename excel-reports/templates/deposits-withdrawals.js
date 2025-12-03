// Шаблон: Пополнения и выводы
// Создает отчет по депозитам и выплатам с учетом статусов и агента

window.TEMPLATE_DEPOSITS_WITHDRAWALS = {
    id: 'deposits_withdrawals',
    name: 'Пополнения и выводы',
    description: 'Листы: T1, T1.1, T1.2, T1.3, T2, T2.1, T5, К',
    filesConfig: {
        step1: { name: 'Пополнения', multiple: true },
        step2: { name: 'Выводы', multiple: true }
    },
    handler: (depositsFiles, withdrawalsFiles) => {
        // Объединяем все файлы пополнений в один массив
        const allDepositsData = [];
        depositsFiles.forEach(fileData => {
            if (fileData && fileData.length > 0) {
                if (allDepositsData.length === 0) {
                    allDepositsData.push(fileData[0]); // заголовки
                }
                for (let i = 1; i < fileData.length; i++) {
                    allDepositsData.push(fileData[i]);
                }
            }
        });

        // Объединяем все файлы выводов в один массив
        const allWithdrawalsData = [];
        withdrawalsFiles.forEach(fileData => {
            if (fileData && fileData.length > 0) {
                if (allWithdrawalsData.length === 0) {
                    allWithdrawalsData.push(fileData[0]); // заголовки
                }
                for (let i = 1; i < fileData.length; i++) {
                    allWithdrawalsData.push(fileData[i]);
                }
            }
        });

        if (!allDepositsData || !allWithdrawalsData) {
            throw new Error('Один или оба типа файлов не содержат данных');
        }

        const findColumnIndex = (headers, columnName) => {
            if (!headers) return -1;
            const cleanName = columnName.trim().toLowerCase();
            for (let i = 0; i < headers.length; i++) {
                if (headers[i] && headers[i].toString().trim().toLowerCase() === cleanName) {
                    return i;
                }
            }
            return -1;
        };

        // Индексы колонок для депозитов
        const amountIndex1 = findColumnIndex(allDepositsData[0], "сумма в валюте отчета");
        const statusIndex1 = findColumnIndex(allDepositsData[0], "статус транзакции");
        const commissionIndex1 = findColumnIndex(allDepositsData[0], "сумма комиссии в валюте отчёта");
        const agentIdIndex1 = findColumnIndex(allDepositsData[0], "id агента");
        const paymentSystemIndex1 = findColumnIndex(allDepositsData[0], "тип платежной системы");
        const subAgentGroupIndex1 = findColumnIndex(allDepositsData[0], "группа субагентов");
        const subAgentIndex1 = findColumnIndex(allDepositsData[0], "субагент");
        const subAgentIdIndex1 = findColumnIndex(allDepositsData[0], "id субагента");
        const agentIndex1 = findColumnIndex(allDepositsData[0], "агент");
        const brandIndex1 = findColumnIndex(allDepositsData[0], "бренд");

        // Индексы колонок для выводов
        const amountIndex2 = findColumnIndex(allWithdrawalsData[0], "сумма в валюте отчета");
        const statusIndex2 = findColumnIndex(allWithdrawalsData[0], "статус транзакции");
        const commissionIndex2 = findColumnIndex(allWithdrawalsData[0], "сумма комиссии в валюте отчёта");
        const agentIdIndex2 = findColumnIndex(allWithdrawalsData[0], "id агента");
        const paymentSystemIndex2 = findColumnIndex(allWithdrawalsData[0], "тип платежной системы");
        const subAgentGroupIndex2 = findColumnIndex(allWithdrawalsData[0], "группа субагентов");
        const subAgentIndex2 = findColumnIndex(allWithdrawalsData[0], "субагент");
        const subAgentIdIndex2 = findColumnIndex(allWithdrawalsData[0], "id субагента");

        // Обработка депозитов
        let depositsSum = 0;
        let depositsCommission = 0;
        let btDepositsSum = 0;
        let btDepositsCommission = 0;
        let totalDepositRequests = 0;
        let successfulDepositRequests = 0;
        const paymentSystemStats1 = {};
        const subAgentGroups1 = {};
        
        // Структура для листа "К": агент → бренд → {total, successful}
        const cardPaymentsStats = {};

        for (let i = 1; i < allDepositsData.length; i++) {
            const row = allDepositsData[i];
            if (!row || row.length === 0) continue;

            const status = row[statusIndex1]?.toString().trim().toUpperCase() || "";
            const agentId = row[agentIdIndex1]?.toString().trim() || "";
            const isAgentBT = agentId === "279";
            const paymentSystem = row[paymentSystemIndex1]?.toString().trim() || 'Не указано';
            const subAgentGroup = row[subAgentGroupIndex1]?.toString().trim() || 'Без группы';
            const subAgent = row[subAgentIndex1]?.toString().trim() || 'Без названия';
            const subAgentId = row[subAgentIdIndex1]?.toString().trim() || 'Без ID';

            // Обработка данных для листа "К" - только банковские карты
            if (paymentSystem === 'Банковские карты') {
                const agent = row[agentIndex1]?.toString().trim() || 'Не указано';
                const brand = row[brandIndex1]?.toString().trim() || 'Не указано';
                
                if (!cardPaymentsStats[agent]) {
                    cardPaymentsStats[agent] = {};
                }
                if (!cardPaymentsStats[agent][brand]) {
                    cardPaymentsStats[agent][brand] = { total: 0, successful: 0 };
                }
                cardPaymentsStats[agent][brand].total++;
                if (status === "OK") {
                    cardPaymentsStats[agent][brand].successful++;
                }
            }

            totalDepositRequests++;
            if (status === "OK") successfulDepositRequests++;

            if (!paymentSystemStats1[paymentSystem]) {
                paymentSystemStats1[paymentSystem] = { total: 0, successful: 0 };
            }
            paymentSystemStats1[paymentSystem].total++;
            if (status === "OK") paymentSystemStats1[paymentSystem].successful++;

            if (isAgentBT) {
                const subAgentKey = `${subAgent} ${subAgentId}`;
                if (!subAgentGroups1[subAgentGroup]) {
                    subAgentGroups1[subAgentGroup] = {};
                }
                if (!subAgentGroups1[subAgentGroup][subAgentKey]) {
                    subAgentGroups1[subAgentGroup][subAgentKey] = { total: 0, successful: 0 };
                }
                subAgentGroups1[subAgentGroup][subAgentKey].total++;
                if (status === "OK") {
                    subAgentGroups1[subAgentGroup][subAgentKey].successful++;
                }
            }

            if (status === "OK") {
                const amount = parseFloat(row[amountIndex1]?.toString().replace(/[^0-9.-]/g, '') || 0);
                const commission = parseFloat(row[commissionIndex1]?.toString().replace(/[^0-9.-]/g, '') || 0);
                depositsSum += amount;
                depositsCommission += commission;
                if (isAgentBT) {
                    btDepositsSum += amount;
                    btDepositsCommission += commission;
                }
            }
        }

        // Обработка выводов
        let withdrawalsSum = 0;
        let withdrawalsCommission = 0;
        let btWithdrawalsSum = 0;
        let btWithdrawalsCommission = 0;
        let totalWithdrawalRequests = 0;
        let successfulWithdrawalRequests = 0;
        const paymentSystemStats2 = {};
        const subAgentGroups2 = {};

        for (let i = 1; i < allWithdrawalsData.length; i++) {
            const row = allWithdrawalsData[i];
            if (!row || row.length === 0) continue;

            const status = row[statusIndex2]?.toString().trim() || "";
            const agentId = row[agentIdIndex2]?.toString().trim() || "";
            const isAgentBT = agentId === "279";
            const paymentSystem = row[paymentSystemIndex2]?.toString().trim() || 'Не указано';
            const subAgentGroup = row[subAgentGroupIndex2]?.toString().trim() || 'Без группы';
            const subAgent = row[subAgentIndex2]?.toString().trim() || 'Без названия';
            const subAgentId = row[subAgentIdIndex2]?.toString().trim() || 'Без ID';

            totalWithdrawalRequests++;
            if (status === "Одобрено") successfulWithdrawalRequests++;

            if (!paymentSystemStats2[paymentSystem]) {
                paymentSystemStats2[paymentSystem] = { total: 0, successful: 0 };
            }
            paymentSystemStats2[paymentSystem].total++;
            if (status === "Одобрено") paymentSystemStats2[paymentSystem].successful++;

            if (isAgentBT) {
                const subAgentKey = `${subAgent} ${subAgentId}`;
                if (!subAgentGroups2[subAgentGroup]) {
                    subAgentGroups2[subAgentGroup] = {};
                }
                if (!subAgentGroups2[subAgentGroup][subAgentKey]) {
                    subAgentGroups2[subAgentGroup][subAgentKey] = { total: 0, successful: 0 };
                }
                subAgentGroups2[subAgentGroup][subAgentKey].total++;
                if (status === "Одобрено") {
                    subAgentGroups2[subAgentGroup][subAgentKey].successful++;
                }
            }

            if (status === "Одобрено") {
                const amount = parseFloat(row[amountIndex2]?.toString().replace(/[^0-9.-]/g, '') || 0);
                const commission = parseFloat(row[commissionIndex2]?.toString().replace(/[^0-9.-]/g, '') || 0);
                withdrawalsSum += amount;
                withdrawalsCommission += commission;
                if (isAgentBT) {
                    btWithdrawalsSum += amount;
                    btWithdrawalsCommission += commission;
                }
            }
        }

        // Рассчитываем конверсию (как число для Excel)
        const depositsConversion = totalDepositRequests > 0
            ? successfulDepositRequests / totalDepositRequests
            : 0;
        const withdrawalsConversion = totalWithdrawalRequests > 0
            ? successfulWithdrawalRequests / totalWithdrawalRequests
            : 0;

        // Цвета проекта (ARGB формат) - светлее
        const COLORS = {
            header: 'FF3D3D3D',     // светлее чёрного
            headerText: 'FFFFFFFF', // белый текст
            yellow: 'FFFFD966',     // светло-жёлтый
            border: 'FF808080',     // серые границы
            dataText: 'FF1A1A1A'    // тёмный текст для данных
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
            font: {
                name: 'Bahnschrift Condensed',
                size: 10,
                color: { argb: COLORS.headerText }
            },
            border: thinBorder
        };
        const dataStyle = {
            font: {
                name: 'Bahnschrift Light Condensed',
                size: 10,
                color: { argb: COLORS.dataText }
            },
            border: thinBorder
        };
        const separatorStyle = {
            fill: COLORS.yellow,
            border: thinBorder
        };

        // Формируем результат с поддержкой ExcelJS
        const result = {
            _useExcelJS: true,
            sheets: {
                "T1": {
                    columns: [
                        { width: 14.71 }, // A - Всего заявок (14 + 0.71)
                        { width: 7.71 },  // B - Успешных (7 + 0.71)
                        { width: 7.71 },  // C - Конверсия (7 + 0.71)
                        { width: 1.71 }   // D - разделитель (1 + 0.71)
                    ],
                    data: [
                        ["Месяц", null, null, null],
                        ["Всего заявок", "Успешных", "Конверсия", null],
                        [totalDepositRequests, successfulDepositRequests, depositsConversion, null]
                    ],
                    merges: ["A1:C1", "D1:D3"],
                    styles: [
                        // Заголовок "Месяц"
                        { cell: "A1", ...headerStyle },
                        { cell: "B1", ...headerStyle },
                        { cell: "C1", ...headerStyle },
                        // Заголовки столбцов
                        { cell: "A2", ...headerStyle },
                        { cell: "B2", ...headerStyle },
                        { cell: "C2", ...headerStyle },
                        // Данные
                        { cell: "A3", ...dataStyle },
                        { cell: "B3", ...dataStyle },
                        { cell: "C3", ...dataStyle, numFmt: '0.00%' },
                        // Жёлтый разделитель (объединён)
                        { cell: "D1", ...separatorStyle }
                    ]
                },
                "T1.1": {
                    columns: [
                        { width: 14.71 }, // A - Тип платежной системы (14 + 0.71)
                        { width: 7.71 },  // B - Все заявки (7 + 0.71)
                        { width: 7.71 },  // C - Успешных (7 + 0.71)
                        { width: 7.71 },  // D - Конверсия (7 + 0.71)
                        { width: 1.71 }   // E - разделитель (1 + 0.71)
                    ],
                    data: [],
                    merges: [],
                    styles: []
                },
                "T2": {
                    columns: [
                        { width: 10.71 }, // A - Метод (10 + 0.71)
                        { width: 25.71 }, // B - Название Субагента (25 + 0.71)
                        { width: 7.71 },  // C - Заявок (7 + 0.71)
                        { width: 7.71 },  // D - Успешных (7 + 0.71)
                        { width: 7.71 },  // E - Конверсия (7 + 0.71)
                        { width: 1.71 }   // F - разделитель (1 + 0.71)
                    ],
                    data: [],
                    merges: [],
                    styles: []
                },
                "T1.2": {
                    columns: [
                        { width: 14.71 }, // (14 + 0.71)
                        { width: 7.71 },  // (7 + 0.71)
                        { width: 7.71 },  // (7 + 0.71)
                        { width: 1.71 }   // (1 + 0.71)
                    ],
                    data: [
                        ["Месяц", null, null, null],
                        ["Всего заявок", "Успешных", "Конверсия", null],
                        [totalWithdrawalRequests, successfulWithdrawalRequests, withdrawalsConversion, null]
                    ],
                    merges: ["A1:C1", "D1:D3"],
                    styles: [
                        { cell: "A1", ...headerStyle },
                        { cell: "B1", ...headerStyle },
                        { cell: "C1", ...headerStyle },
                        { cell: "A2", ...headerStyle },
                        { cell: "B2", ...headerStyle },
                        { cell: "C2", ...headerStyle },
                        { cell: "A3", ...dataStyle },
                        { cell: "B3", ...dataStyle },
                        { cell: "C3", ...dataStyle, numFmt: '0.00%' },
                        { cell: "D1", ...separatorStyle }
                    ]
                },
                "T1.3": {
                    columns: [
                        { width: 14.71 }, // A - Тип платежной системы (14 + 0.71)
                        { width: 7.71 },  // B - Все заявки (7 + 0.71)
                        { width: 7.71 },  // C - Успешных (7 + 0.71)
                        { width: 7.71 },  // D - Конверсия (7 + 0.71)
                        { width: 1.71 }   // E - разделитель (1 + 0.71)
                    ],
                    data: [],
                    merges: [],
                    styles: []
                },
                "T2.1": {
                    columns: [
                        { width: 10.71 }, // A - Метод (10 + 0.71)
                        { width: 25.71 }, // B - Название Субагента (25 + 0.71)
                        { width: 7.71 },  // C - Заявок (7 + 0.71)
                        { width: 7.71 },  // D - Успешных (7 + 0.71)
                        { width: 7.71 },  // E - Конверсия (7 + 0.71)
                        { width: 1.71 }   // F - разделитель (1 + 0.71)
                    ],
                    data: [],
                    merges: [],
                    styles: []
                },
                "T5": {
                    columns: [
                        { width: 30.71 }, // A - Показатель (30 + 0.71)
                        { width: 7.71 },  // B - Значение (7 + 0.71)
                        { width: 1.71 }   // C - разделитель (1 + 0.71)
                    ],
                    data: [],
                    merges: [],
                    styles: []
                },
                "К": {
                    columns: [
                        { width: 15.71 }, // A - Агент (15 + 0.71)
                        { width: 15.71 }, // B - Бренд (15 + 0.71)
                        { width: 15.71 }, // C - Всего заявок (15 + 0.71)
                        { width: 7.71 },  // D - Успешных (7 + 0.71)
                        { width: 7.71 },  // E - Конверсия (7 + 0.71)
                        { width: 1.71 }   // F - разделитель (1 + 0.71)
                    ],
                    data: [],
                    merges: [],
                    styles: []
                }
            }
        };

        // Добавляем статистику по платежным системам для депозитов (T1.1)
        const t11Data = Object.entries(paymentSystemStats1).sort((a, b) => b[1].total - a[1].total);
        const t11TotalRequests = t11Data.reduce((sum, [, stats]) => sum + stats.total, 0);
        const t11TotalSuccessful = t11Data.reduce((sum, [, stats]) => sum + stats.successful, 0);
        const t11TotalConversion = t11TotalRequests > 0
            ? t11TotalSuccessful / t11TotalRequests
            : 0;

        // Заголовки
        result.sheets["T1.1"].data.push(["Тип платежной системы", "Месяц", null, null, null]);
        result.sheets["T1.1"].data.push([null, "Все заявки", "Успешных", "Конверсия", null]);

        // Данные
        t11Data.forEach(([system, stats]) => {
            const conversion = stats.total > 0
                ? stats.successful / stats.total
                : 0;
            result.sheets["T1.1"].data.push([system, stats.total, stats.successful, conversion, null]);
        });

        // Пустая строка и итого
        result.sheets["T1.1"].data.push([null, null, null, null, null]);
        result.sheets["T1.1"].data.push(["Всего по ГЕО:", t11TotalRequests, t11TotalSuccessful, t11TotalConversion, null]);

        // Merges для T1.1
        const t11LastRow = result.sheets["T1.1"].data.length;
        result.sheets["T1.1"].merges = ["A1:A2", "B1:D1", `E1:E${t11LastRow}`];

        // Стили для T1.1
        result.sheets["T1.1"].styles = [
            // Строка 1 - заголовок месяца
            { cell: "A1", ...headerStyle },
            { cell: "B1", ...headerStyle },
            { cell: "C1", ...headerStyle },
            { cell: "D1", ...headerStyle },
            // Строка 2 - заголовки колонок
            { cell: "A2", ...headerStyle },
            { cell: "B2", ...headerStyle },
            { cell: "C2", ...headerStyle },
            { cell: "D2", ...headerStyle },
            // Разделитель
            { cell: "E1", ...separatorStyle }
        ];
        // Стили для строк данных (без последней строки - итого)
        for (let i = 3; i < t11LastRow; i++) {
            result.sheets["T1.1"].styles.push({ cell: `A${i}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
            result.sheets["T1.1"].styles.push({ cell: `B${i}`, ...dataStyle });
            result.sheets["T1.1"].styles.push({ cell: `C${i}`, ...dataStyle });
            result.sheets["T1.1"].styles.push({ cell: `D${i}`, ...dataStyle, numFmt: '0.00%' });
        }
        // Стиль для строки "Всего по ГЕО:" - с заливкой заголовка
        result.sheets["T1.1"].styles.push({ cell: `A${t11LastRow}`, ...headerStyle, alignment: { horizontal: 'right', vertical: 'middle' } });
        result.sheets["T1.1"].styles.push({ cell: `B${t11LastRow}`, ...headerStyle });
        result.sheets["T1.1"].styles.push({ cell: `C${t11LastRow}`, ...headerStyle });
        result.sheets["T1.1"].styles.push({ cell: `D${t11LastRow}`, ...headerStyle, numFmt: '0.00%' });

        // Добавляем статистику по субагентам для депозитов (T2) - с группировкой по методу
        // Заголовки T2 (6 колонок: A-Метод, B-Название, C-Заявок, D-Успешных, E-Конверсия, F-разделитель)
        result.sheets["T2"].data.push(["Метод", "Название Субагента и номер", "Месяц", null, null, null]);
        result.sheets["T2"].data.push([null, null, "Заявок", "Успешных", "Конверсия", null]);

        // Merges для T2 - базовые для заголовков
        result.sheets["T2"].merges = ["A1:A2", "B1:B2", "C1:E1", "F1:F2"];

        // Стили для заголовков T2
        result.sheets["T2"].styles = [
            { cell: "A1", ...headerStyle },
            { cell: "B1", ...headerStyle },
            { cell: "C1", ...headerStyle },
            { cell: "D1", ...headerStyle },
            { cell: "E1", ...headerStyle },
            { cell: "A2", ...headerStyle },
            { cell: "B2", ...headerStyle },
            { cell: "C2", ...headerStyle },
            { cell: "D2", ...headerStyle },
            { cell: "E2", ...headerStyle },
            { cell: "F1", ...separatorStyle }
        ];

        // Сортируем группы по общему количеству заявок
        const sortedGroups1 = Object.keys(subAgentGroups1).sort((a, b) => {
            const totalA = Object.values(subAgentGroups1[a]).reduce((sum, s) => sum + s.total, 0);
            const totalB = Object.values(subAgentGroups1[b]).reduce((sum, s) => sum + s.total, 0);
            return totalB - totalA;
        });

        let t2CurrentRow = 3; // Начинаем с 3-й строки (после заголовков)

        sortedGroups1.forEach((group, groupIdx) => {
            const subagents = subAgentGroups1[group];
            const subagentList = Object.entries(subagents)
                .map(([name, stats]) => ({ name, total: stats.total, successful: stats.successful }))
                .sort((a, b) => a.name.localeCompare(b.name));

            const groupStartRow = t2CurrentRow;

            // Добавляем субагентов группы
            subagentList.forEach((s, idx) => {
                const conversion = s.total > 0 ? s.successful / s.total : 0;
                // Первая строка группы - имя метода, остальные - null (будет merge)
                result.sheets["T2"].data.push([idx === 0 ? group : null, s.name, s.total, s.successful, conversion, null]);

                // Стили для строки данных
                result.sheets["T2"].styles.push({ cell: `A${t2CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                result.sheets["T2"].styles.push({ cell: `B${t2CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                result.sheets["T2"].styles.push({ cell: `C${t2CurrentRow}`, ...dataStyle });
                result.sheets["T2"].styles.push({ cell: `D${t2CurrentRow}`, ...dataStyle });
                result.sheets["T2"].styles.push({ cell: `E${t2CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                t2CurrentRow++;
            });

            // Merge для столбца "Метод" если больше 1 строки в группе
            if (subagentList.length > 1) {
                result.sheets["T2"].merges.push(`A${groupStartRow}:A${t2CurrentRow - 1}`);
            }

            // Итого по группе
            const groupTotal = subagentList.reduce((sum, s) => sum + s.total, 0);
            const groupSuccessful = subagentList.reduce((sum, s) => sum + s.successful, 0);
            const groupConversion = groupTotal > 0 ? groupSuccessful / groupTotal : 0;

            result.sheets["T2"].data.push(["Всего по ГЕО:", null, groupTotal, groupSuccessful, groupConversion, null]);
            // Merge для "Всего по ГЕО:"
            result.sheets["T2"].merges.push(`A${t2CurrentRow}:B${t2CurrentRow}`);

            // Стили для итоговой строки группы
            result.sheets["T2"].styles.push({ cell: `A${t2CurrentRow}`, ...headerStyle, alignment: { horizontal: 'right', vertical: 'middle' } });
            result.sheets["T2"].styles.push({ cell: `B${t2CurrentRow}`, ...headerStyle });
            result.sheets["T2"].styles.push({ cell: `C${t2CurrentRow}`, ...headerStyle });
            result.sheets["T2"].styles.push({ cell: `D${t2CurrentRow}`, ...headerStyle });
            result.sheets["T2"].styles.push({ cell: `E${t2CurrentRow}`, ...headerStyle, numFmt: '0.00%' });

            // Жёлтый разделитель для этой группы (столбец F от начала группы до "Всего по ГЕО:")
            result.sheets["T2"].merges.push(`F${groupStartRow}:F${t2CurrentRow}`);
            result.sheets["T2"].styles.push({ cell: `F${groupStartRow}`, ...separatorStyle });
            t2CurrentRow++;

            // Горизонтальный разделитель между группами (кроме последней)
            if (groupIdx < sortedGroups1.length - 1) {
                result.sheets["T2"].data.push([null, null, null, null, null, null]);
                // Merge горизонтального разделителя на всю ширину
                result.sheets["T2"].merges.push(`A${t2CurrentRow}:F${t2CurrentRow}`);
                result.sheets["T2"].styles.push({ cell: `A${t2CurrentRow}`, ...separatorStyle });
                t2CurrentRow++;
            }
        });

        // Добавляем статистику по платежным системам для выводов (T1.3)
        const t13Data = Object.entries(paymentSystemStats2).sort((a, b) => b[1].total - a[1].total);
        const t13TotalRequests = t13Data.reduce((sum, [, stats]) => sum + stats.total, 0);
        const t13TotalSuccessful = t13Data.reduce((sum, [, stats]) => sum + stats.successful, 0);
        const t13TotalConversion = t13TotalRequests > 0
            ? t13TotalSuccessful / t13TotalRequests
            : 0;

        // Заголовки
        result.sheets["T1.3"].data.push(["Тип платежной системы", "Месяц", null, null, null]);
        result.sheets["T1.3"].data.push([null, "Все заявки", "Успешных", "Конверсия", null]);

        // Данные
        t13Data.forEach(([system, stats]) => {
            const conversion = stats.total > 0
                ? stats.successful / stats.total
                : 0;
            result.sheets["T1.3"].data.push([system, stats.total, stats.successful, conversion, null]);
        });

        // Пустая строка и итого
        result.sheets["T1.3"].data.push([null, null, null, null, null]);
        result.sheets["T1.3"].data.push(["Всего по ГЕО:", t13TotalRequests, t13TotalSuccessful, t13TotalConversion, null]);

        // Merges для T1.3
        const t13LastRow = result.sheets["T1.3"].data.length;
        result.sheets["T1.3"].merges = ["A1:A2", "B1:D1", `E1:E${t13LastRow}`];

        // Стили для T1.3
        result.sheets["T1.3"].styles = [
            // Строка 1 - заголовок месяца
            { cell: "A1", ...headerStyle },
            { cell: "B1", ...headerStyle },
            { cell: "C1", ...headerStyle },
            { cell: "D1", ...headerStyle },
            // Строка 2 - заголовки колонок
            { cell: "A2", ...headerStyle },
            { cell: "B2", ...headerStyle },
            { cell: "C2", ...headerStyle },
            { cell: "D2", ...headerStyle },
            // Разделитель
            { cell: "E1", ...separatorStyle }
        ];
        // Стили для строк данных (без последней строки - итого)
        for (let i = 3; i < t13LastRow; i++) {
            result.sheets["T1.3"].styles.push({ cell: `A${i}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
            result.sheets["T1.3"].styles.push({ cell: `B${i}`, ...dataStyle });
            result.sheets["T1.3"].styles.push({ cell: `C${i}`, ...dataStyle });
            result.sheets["T1.3"].styles.push({ cell: `D${i}`, ...dataStyle, numFmt: '0.00%' });
        }
        // Стиль для строки "Всего по ГЕО:" - с заливкой заголовка
        result.sheets["T1.3"].styles.push({ cell: `A${t13LastRow}`, ...headerStyle, alignment: { horizontal: 'right', vertical: 'middle' } });
        result.sheets["T1.3"].styles.push({ cell: `B${t13LastRow}`, ...headerStyle });
        result.sheets["T1.3"].styles.push({ cell: `C${t13LastRow}`, ...headerStyle });
        result.sheets["T1.3"].styles.push({ cell: `D${t13LastRow}`, ...headerStyle, numFmt: '0.00%' });

        // Добавляем статистику по субагентам для выводов (T2.1) - с группировкой по методу
        // Заголовки T2.1 (6 колонок: A-Метод, B-Название, C-Заявок, D-Успешных, E-Конверсия, F-разделитель)
        result.sheets["T2.1"].data.push(["Метод", "Название Субагента и номер", "Месяц", null, null, null]);
        result.sheets["T2.1"].data.push([null, null, "Заявок", "Успешных", "Конверсия", null]);

        // Merges для T2.1 - базовые для заголовков
        result.sheets["T2.1"].merges = ["A1:A2", "B1:B2", "C1:E1", "F1:F2"];

        // Стили для заголовков T2.1
        result.sheets["T2.1"].styles = [
            { cell: "A1", ...headerStyle },
            { cell: "B1", ...headerStyle },
            { cell: "C1", ...headerStyle },
            { cell: "D1", ...headerStyle },
            { cell: "E1", ...headerStyle },
            { cell: "A2", ...headerStyle },
            { cell: "B2", ...headerStyle },
            { cell: "C2", ...headerStyle },
            { cell: "D2", ...headerStyle },
            { cell: "E2", ...headerStyle },
            { cell: "F1", ...separatorStyle }
        ];

        // Сортируем группы по общему количеству заявок
        const sortedGroups2 = Object.keys(subAgentGroups2).sort((a, b) => {
            const totalA = Object.values(subAgentGroups2[a]).reduce((sum, s) => sum + s.total, 0);
            const totalB = Object.values(subAgentGroups2[b]).reduce((sum, s) => sum + s.total, 0);
            return totalB - totalA;
        });

        let t21CurrentRow = 3; // Начинаем с 3-й строки (после заголовков)

        sortedGroups2.forEach((group, groupIdx) => {
            const subagents = subAgentGroups2[group];
            const subagentList = Object.entries(subagents)
                .map(([name, stats]) => ({ name, total: stats.total, successful: stats.successful }))
                .sort((a, b) => a.name.localeCompare(b.name));

            const groupStartRow = t21CurrentRow;

            // Добавляем субагентов группы
            subagentList.forEach((s, idx) => {
                const conversion = s.total > 0 ? s.successful / s.total : 0;
                // Первая строка группы - имя метода, остальные - null (будет merge)
                result.sheets["T2.1"].data.push([idx === 0 ? group : null, s.name, s.total, s.successful, conversion, null]);

                // Стили для строки данных
                result.sheets["T2.1"].styles.push({ cell: `A${t21CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                result.sheets["T2.1"].styles.push({ cell: `B${t21CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                result.sheets["T2.1"].styles.push({ cell: `C${t21CurrentRow}`, ...dataStyle });
                result.sheets["T2.1"].styles.push({ cell: `D${t21CurrentRow}`, ...dataStyle });
                result.sheets["T2.1"].styles.push({ cell: `E${t21CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                t21CurrentRow++;
            });

            // Merge для столбца "Метод" если больше 1 строки в группе
            if (subagentList.length > 1) {
                result.sheets["T2.1"].merges.push(`A${groupStartRow}:A${t21CurrentRow - 1}`);
            }

            // Итого по группе
            const groupTotal = subagentList.reduce((sum, s) => sum + s.total, 0);
            const groupSuccessful = subagentList.reduce((sum, s) => sum + s.successful, 0);
            const groupConversion = groupTotal > 0 ? groupSuccessful / groupTotal : 0;

            result.sheets["T2.1"].data.push(["Всего по ГЕО:", null, groupTotal, groupSuccessful, groupConversion, null]);
            // Merge для "Всего по ГЕО:"
            result.sheets["T2.1"].merges.push(`A${t21CurrentRow}:B${t21CurrentRow}`);

            // Стили для итоговой строки группы
            result.sheets["T2.1"].styles.push({ cell: `A${t21CurrentRow}`, ...headerStyle, alignment: { horizontal: 'right', vertical: 'middle' } });
            result.sheets["T2.1"].styles.push({ cell: `B${t21CurrentRow}`, ...headerStyle });
            result.sheets["T2.1"].styles.push({ cell: `C${t21CurrentRow}`, ...headerStyle });
            result.sheets["T2.1"].styles.push({ cell: `D${t21CurrentRow}`, ...headerStyle });
            result.sheets["T2.1"].styles.push({ cell: `E${t21CurrentRow}`, ...headerStyle, numFmt: '0.00%' });

            // Жёлтый разделитель для этой группы (столбец F от начала группы до "Всего по ГЕО:")
            result.sheets["T2.1"].merges.push(`F${groupStartRow}:F${t21CurrentRow}`);
            result.sheets["T2.1"].styles.push({ cell: `F${groupStartRow}`, ...separatorStyle });
            t21CurrentRow++;

            // Горизонтальный разделитель между группами (кроме последней)
            if (groupIdx < sortedGroups2.length - 1) {
                result.sheets["T2.1"].data.push([null, null, null, null, null, null]);
                // Merge горизонтального разделителя на всю ширину
                result.sheets["T2.1"].merges.push(`A${t21CurrentRow}:F${t21CurrentRow}`);
                result.sheets["T2.1"].styles.push({ cell: `A${t21CurrentRow}`, ...separatorStyle });
                t21CurrentRow++;
            }
        });

        // Формируем данные для листа T5
        // Расчёты
        const netProfitGeo = depositsSum - withdrawalsSum - depositsCommission - withdrawalsCommission;
        const btDepositPercent = depositsSum > 0 ? btDepositsSum / depositsSum : 0;
        const btWithdrawalPercent = withdrawalsSum > 0 ? btWithdrawalsSum / withdrawalsSum : 0;
        const netProfitBT = btDepositsSum - btWithdrawalsSum - btDepositsCommission - btWithdrawalsCommission;

        // Заголовки T5
        result.sheets["T5"].data.push(["Показатель", "Месяц", null]);
        result.sheets["T5"].merges = ["A1:A2", "B1:B2", "C1:C2"];
        result.sheets["T5"].data.push([null, null, null]);

        // Стили для заголовков
        result.sheets["T5"].styles = [
            { cell: "A1", ...headerStyle },
            { cell: "B1", ...headerStyle },
            { cell: "A2", ...headerStyle },
            { cell: "B2", ...headerStyle },
            { cell: "C1", ...separatorStyle }
        ];

        // Блок 1: Общие данные
        const t5Block1 = [
            ["Сумма успешных депозитов в USD", Math.round(depositsSum)],
            ["Комиссия за депозиты", Math.round(depositsCommission)],
            ["Сумма успешных выплат в USD", Math.round(withdrawalsSum)],
            ["Комиссия за выплаты", Math.round(withdrawalsCommission)],
            ["Чистая прибыль по ГЕО", Math.round(netProfitGeo)]
        ];

        let t5CurrentRow = 3;
        const t5Block1Start = t5CurrentRow;

        t5Block1.forEach(row => {
            result.sheets["T5"].data.push([row[0], row[1], null]);
            result.sheets["T5"].styles.push({ cell: `A${t5CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
            result.sheets["T5"].styles.push({ cell: `B${t5CurrentRow}`, ...dataStyle });
            t5CurrentRow++;
        });

        // Жёлтый разделитель для блока 1
        result.sheets["T5"].merges.push(`C${t5Block1Start}:C${t5CurrentRow - 1}`);
        result.sheets["T5"].styles.push({ cell: `C${t5Block1Start}`, ...separatorStyle });

        // Горизонтальный разделитель между блоками
        result.sheets["T5"].data.push([null, null, null]);
        result.sheets["T5"].merges.push(`A${t5CurrentRow}:C${t5CurrentRow}`);
        result.sheets["T5"].styles.push({ cell: `A${t5CurrentRow}`, ...separatorStyle });
        t5CurrentRow++;

        // Блок 2: Данные BT
        const t5Block2 = [
            ["Сумма успешных депозитов BT в USD", Math.round(btDepositsSum)],
            ["Комиссия за депозиты", Math.round(btDepositsCommission)],
            ["Процент BT, от общего числа успешных депозитов", btDepositPercent],
            ["Сумма успешных выплат BT в USD", Math.round(btWithdrawalsSum)],
            ["Комиссия за выплаты", Math.round(btWithdrawalsCommission)],
            ["Процент BT, от общего числа успешных выплат", btWithdrawalPercent],
            ["Чистая прибыль по методу BT", Math.round(netProfitBT)]
        ];

        const t5Block2Start = t5CurrentRow;

        t5Block2.forEach((row, idx) => {
            result.sheets["T5"].data.push([row[0], row[1], null]);
            result.sheets["T5"].styles.push({ cell: `A${t5CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
            // Проценты форматируем как проценты
            if (idx === 2 || idx === 5) {
                result.sheets["T5"].styles.push({ cell: `B${t5CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
            } else {
                result.sheets["T5"].styles.push({ cell: `B${t5CurrentRow}`, ...dataStyle });
            }
            t5CurrentRow++;
        });

        // Жёлтый разделитель для блока 2
        result.sheets["T5"].merges.push(`C${t5Block2Start}:C${t5CurrentRow - 1}`);
        result.sheets["T5"].styles.push({ cell: `C${t5Block2Start}`, ...separatorStyle });

        // Формируем данные для листа "К"
        // Заголовки
        result.sheets["К"].data.push(["Агент", "Бренд", "Месяц", null, null, null]);
        result.sheets["К"].data.push([null, null, "Всего заявок", "Успешных", "Конверсия", null]);

        // Merges для заголовков
        result.sheets["К"].merges = ["A1:A2", "B1:B2", "C1:E1", "F1:F2"];

        // Стили для заголовков
        result.sheets["К"].styles = [
            { cell: "A1", ...headerStyle },
            { cell: "B1", ...headerStyle },
            { cell: "C1", ...headerStyle },
            { cell: "D1", ...headerStyle },
            { cell: "E1", ...headerStyle },
            { cell: "A2", ...headerStyle },
            { cell: "B2", ...headerStyle },
            { cell: "C2", ...headerStyle },
            { cell: "D2", ...headerStyle },
            { cell: "E2", ...headerStyle },
            { cell: "F1", ...separatorStyle }
        ];

        // Сортируем агентов по количеству заявок
        const sortedAgents = Object.keys(cardPaymentsStats).sort((a, b) => {
            const totalA = Object.values(cardPaymentsStats[a]).reduce((sum, stats) => sum + stats.total, 0);
            const totalB = Object.values(cardPaymentsStats[b]).reduce((sum, stats) => sum + stats.total, 0);
            return totalB - totalA;
        });

        let kCurrentRow = 3;

        // Собираем статистику по методам (брендам)
        const brandTotals = {};

        sortedAgents.forEach((agent, agentIdx) => {
            const agentStartRow = kCurrentRow;

            // Сортируем бренды по алфавиту
            const sortedBrands = Object.keys(cardPaymentsStats[agent]).sort((a, b) => a.localeCompare(b));

            sortedBrands.forEach((brand, brandIdx) => {
                const stats = cardPaymentsStats[agent][brand];
                const conversion = stats.total > 0 ? stats.successful / stats.total : 0;

                // Собираем статистику по брендам для итогов
                if (!brandTotals[brand]) {
                    brandTotals[brand] = { total: 0, successful: 0 };
                }
                brandTotals[brand].total += stats.total;
                brandTotals[brand].successful += stats.successful;

                // Первая строка агента - имя агента, остальные - null
                result.sheets["К"].data.push([brandIdx === 0 ? agent : null, brand, stats.total, stats.successful, conversion, null]);

                // Стили для строки данных
                result.sheets["К"].styles.push({ cell: `A${kCurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                result.sheets["К"].styles.push({ cell: `B${kCurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                result.sheets["К"].styles.push({ cell: `C${kCurrentRow}`, ...dataStyle });
                result.sheets["К"].styles.push({ cell: `D${kCurrentRow}`, ...dataStyle });
                result.sheets["К"].styles.push({ cell: `E${kCurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                kCurrentRow++;
            });

            // Merge для столбца "Агент" если больше 1 бренда
            if (sortedBrands.length > 1) {
                result.sheets["К"].merges.push(`A${agentStartRow}:A${kCurrentRow - 1}`);
            }

            // Жёлтый разделитель для этого агента
            result.sheets["К"].merges.push(`F${agentStartRow}:F${kCurrentRow - 1}`);
            result.sheets["К"].styles.push({ cell: `F${agentStartRow}`, ...separatorStyle });

            // Горизонтальный разделитель между агентами (кроме последнего)
            if (agentIdx < sortedAgents.length - 1) {
                result.sheets["К"].data.push([null, null, null, null, null, null]);
                result.sheets["К"].merges.push(`A${kCurrentRow}:F${kCurrentRow}`);
                result.sheets["К"].styles.push({ cell: `A${kCurrentRow}`, ...separatorStyle });
                kCurrentRow++;
            }
        });

        // Пустая строка перед итогами
        result.sheets["К"].data.push([null, null, null, null, null, null]);
        kCurrentRow++;

        // Итоги по методам
        const methodsOrder = ['VISA', 'MASTERCARD'];
        const kTotalsStartRow = kCurrentRow;

        methodsOrder.forEach(method => {
            if (brandTotals[method]) {
                const stats = brandTotals[method];
                const conversion = stats.total > 0 ? stats.successful / stats.total : 0;
                result.sheets["К"].data.push([`Всего по методу ${method}:`, null, stats.total, stats.successful, conversion, null]);
                result.sheets["К"].merges.push(`A${kCurrentRow}:B${kCurrentRow}`);
                result.sheets["К"].styles.push({ cell: `A${kCurrentRow}`, ...headerStyle, alignment: { horizontal: 'right', vertical: 'middle' } });
                result.sheets["К"].styles.push({ cell: `B${kCurrentRow}`, ...headerStyle });
                result.sheets["К"].styles.push({ cell: `C${kCurrentRow}`, ...headerStyle });
                result.sheets["К"].styles.push({ cell: `D${kCurrentRow}`, ...headerStyle });
                result.sheets["К"].styles.push({ cell: `E${kCurrentRow}`, ...headerStyle, numFmt: '0.00%' });
                kCurrentRow++;
            }
        });

        // Всего по остальным (не VISA и не MASTERCARD)
        let otherTotal = 0;
        let otherSuccessful = 0;
        Object.entries(brandTotals).forEach(([brand, stats]) => {
            if (!methodsOrder.includes(brand)) {
                otherTotal += stats.total;
                otherSuccessful += stats.successful;
            }
        });

        if (otherTotal > 0) {
            const otherConversion = otherTotal > 0 ? otherSuccessful / otherTotal : 0;
            result.sheets["К"].data.push(["Всего по остальным:", null, otherTotal, otherSuccessful, otherConversion, null]);
            result.sheets["К"].merges.push(`A${kCurrentRow}:B${kCurrentRow}`);
            result.sheets["К"].styles.push({ cell: `A${kCurrentRow}`, ...headerStyle, alignment: { horizontal: 'right', vertical: 'middle' } });
            result.sheets["К"].styles.push({ cell: `B${kCurrentRow}`, ...headerStyle });
            result.sheets["К"].styles.push({ cell: `C${kCurrentRow}`, ...headerStyle });
            result.sheets["К"].styles.push({ cell: `D${kCurrentRow}`, ...headerStyle });
            result.sheets["К"].styles.push({ cell: `E${kCurrentRow}`, ...headerStyle, numFmt: '0.00%' });
            kCurrentRow++;
        }

        // Общий итог по ГЕО
        const kGrandTotal = Object.values(brandTotals).reduce((sum, s) => sum + s.total, 0);
        const kGrandSuccessful = Object.values(brandTotals).reduce((sum, s) => sum + s.successful, 0);
        const kGrandConversion = kGrandTotal > 0 ? kGrandSuccessful / kGrandTotal : 0;

        result.sheets["К"].data.push(["Всего по ГЕО:", null, kGrandTotal, kGrandSuccessful, kGrandConversion, null]);
        result.sheets["К"].merges.push(`A${kCurrentRow}:B${kCurrentRow}`);
        result.sheets["К"].styles.push({ cell: `A${kCurrentRow}`, ...headerStyle, alignment: { horizontal: 'right', vertical: 'middle' } });
        result.sheets["К"].styles.push({ cell: `B${kCurrentRow}`, ...headerStyle });
        result.sheets["К"].styles.push({ cell: `C${kCurrentRow}`, ...headerStyle });
        result.sheets["К"].styles.push({ cell: `D${kCurrentRow}`, ...headerStyle });
        result.sheets["К"].styles.push({ cell: `E${kCurrentRow}`, ...headerStyle, numFmt: '0.00%' });

        // Жёлтый разделитель для итогов
        result.sheets["К"].merges.push(`F${kTotalsStartRow}:F${kCurrentRow}`);
        result.sheets["К"].styles.push({ cell: `F${kTotalsStartRow}`, ...separatorStyle });

        return result;
    }
};