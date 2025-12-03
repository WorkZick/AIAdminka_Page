// Шаблон: Общий отчет
// Объединяет все шаблоны в один документ

window.TEMPLATE_COMBINED_REPORT = {
    id: 'combined-report',
    name: 'Общий отчет',
    description: 'Листы: T1, T1.1, T1.2, T1.3, T2, T2.1, T3.1, T3.2, T3.4, T4, T4.1, T5, T6, T7, T9, К',
    filesConfig: {
        step1: { name: 'Пополнения', multiple: true },
        step2: { name: 'Выводы', multiple: true },
        step3: { name: 'Регистрации', multiple: false },
        step4: { name: 'Транзакции B-TAG', multiple: false },
        step5: { name: 'Активные пользователи - прошлый месяц', multiple: false },
        step6: { name: 'Активные пользователи - текущий месяц', multiple: false },
        step7: { name: 'Аналитика T9', multiple: false }
    },
    handler: (stepsData) => {
        // stepsData = { step1: [...], step2: [...], step3: [...], ... }

        // =============== ОБЩИЕ СТИЛИ ===============
        const COLORS = {
            header: 'FF3D3D3D',
            headerText: 'FFFFFFFF',
            yellow: 'FFFFD966',
            border: 'FF808080',
            dataText: 'FF1A1A1A'
        };

        const thinBorder = {
            top: { style: 'thin', color: { argb: COLORS.border } },
            left: { style: 'thin', color: { argb: COLORS.border } },
            bottom: { style: 'thin', color: { argb: COLORS.border } },
            right: { style: 'thin', color: { argb: COLORS.border } }
        };

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

        // Утилиты
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

        const getNumber = (value) => {
            if (value === null || value === undefined || value === '') return 0;
            const num = parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
            return isNaN(num) ? 0 : num;
        };

        // Инициализация результата с правильным порядком листов
        const result = {
            _useExcelJS: true,
            sheets: {}
        };

        // Порядок листов
        const sheetsOrder = ['T1', 'T1.1', 'T1.2', 'T1.3', 'К', 'T2', 'T2.1', 'T3.1', 'T3.2', 'T3.4', 'T4', 'T4.1', 'T5', 'T6', 'T7', 'T9'];

        // Создаем пустые листы в правильном порядке
        sheetsOrder.forEach(name => {
            result.sheets[name] = { columns: [], data: [], merges: [], styles: [] };
        });

        // =============== ОБРАБОТКА ПОПОЛНЕНИЙ И ВЫВОДОВ (T1, T1.1, T1.2, T1.3, T2, T2.1, T5, К) ===============
        if (stepsData.step1 && stepsData.step1.length > 0 && stepsData.step2 && stepsData.step2.length > 0) {
            // Объединяем файлы пополнений
            const allDepositsData = [];
            stepsData.step1.forEach(fileData => {
                if (fileData && fileData.length > 0) {
                    if (allDepositsData.length === 0) {
                        allDepositsData.push(fileData[0]);
                    }
                    for (let i = 1; i < fileData.length; i++) {
                        allDepositsData.push(fileData[i]);
                    }
                }
            });

            // Объединяем файлы выводов
            const allWithdrawalsData = [];
            stepsData.step2.forEach(fileData => {
                if (fileData && fileData.length > 0) {
                    if (allWithdrawalsData.length === 0) {
                        allWithdrawalsData.push(fileData[0]);
                    }
                    for (let i = 1; i < fileData.length; i++) {
                        allWithdrawalsData.push(fileData[i]);
                    }
                }
            });

            if (allDepositsData.length > 0 && allWithdrawalsData.length > 0) {
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
                let depositsSum = 0, depositsCommission = 0, btDepositsSum = 0, btDepositsCommission = 0;
                let totalDepositRequests = 0, successfulDepositRequests = 0;
                const paymentSystemStats1 = {}, subAgentGroups1 = {}, cardPaymentsStats = {};

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

                    if (paymentSystem === 'Банковские карты') {
                        const agent = row[agentIndex1]?.toString().trim() || 'Не указано';
                        const brand = row[brandIndex1]?.toString().trim() || 'Не указано';
                        if (!cardPaymentsStats[agent]) cardPaymentsStats[agent] = {};
                        if (!cardPaymentsStats[agent][brand]) cardPaymentsStats[agent][brand] = { total: 0, successful: 0 };
                        cardPaymentsStats[agent][brand].total++;
                        if (status === "OK") cardPaymentsStats[agent][brand].successful++;
                    }

                    totalDepositRequests++;
                    if (status === "OK") successfulDepositRequests++;

                    if (!paymentSystemStats1[paymentSystem]) paymentSystemStats1[paymentSystem] = { total: 0, successful: 0 };
                    paymentSystemStats1[paymentSystem].total++;
                    if (status === "OK") paymentSystemStats1[paymentSystem].successful++;

                    if (isAgentBT) {
                        const subAgentKey = `${subAgent} ${subAgentId}`;
                        if (!subAgentGroups1[subAgentGroup]) subAgentGroups1[subAgentGroup] = {};
                        if (!subAgentGroups1[subAgentGroup][subAgentKey]) subAgentGroups1[subAgentGroup][subAgentKey] = { total: 0, successful: 0 };
                        subAgentGroups1[subAgentGroup][subAgentKey].total++;
                        if (status === "OK") subAgentGroups1[subAgentGroup][subAgentKey].successful++;
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
                let withdrawalsSum = 0, withdrawalsCommission = 0, btWithdrawalsSum = 0, btWithdrawalsCommission = 0;
                let totalWithdrawalRequests = 0, successfulWithdrawalRequests = 0;
                const paymentSystemStats2 = {}, subAgentGroups2 = {};

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

                    if (!paymentSystemStats2[paymentSystem]) paymentSystemStats2[paymentSystem] = { total: 0, successful: 0 };
                    paymentSystemStats2[paymentSystem].total++;
                    if (status === "Одобрено") paymentSystemStats2[paymentSystem].successful++;

                    if (isAgentBT) {
                        const subAgentKey = `${subAgent} ${subAgentId}`;
                        if (!subAgentGroups2[subAgentGroup]) subAgentGroups2[subAgentGroup] = {};
                        if (!subAgentGroups2[subAgentGroup][subAgentKey]) subAgentGroups2[subAgentGroup][subAgentKey] = { total: 0, successful: 0 };
                        subAgentGroups2[subAgentGroup][subAgentKey].total++;
                        if (status === "Одобрено") subAgentGroups2[subAgentGroup][subAgentKey].successful++;
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

                const depositsConversion = totalDepositRequests > 0 ? successfulDepositRequests / totalDepositRequests : 0;
                const withdrawalsConversion = totalWithdrawalRequests > 0 ? successfulWithdrawalRequests / totalWithdrawalRequests : 0;

                // ===== T1 =====
                result.sheets['T1'].columns = [{ width: 14.71 }, { width: 7.71 }, { width: 7.71 }, { width: 1.71 }];
                result.sheets['T1'].data = [
                    ["Месяц", null, null, null],
                    ["Всего заявок", "Успешных", "Конверсия", null],
                    [totalDepositRequests, successfulDepositRequests, depositsConversion, null]
                ];
                result.sheets['T1'].merges = ["A1:C1", "D1:D3"];
                result.sheets['T1'].styles = [
                    { cell: "A1", ...headerStyle }, { cell: "B1", ...headerStyle }, { cell: "C1", ...headerStyle },
                    { cell: "A2", ...headerStyle }, { cell: "B2", ...headerStyle }, { cell: "C2", ...headerStyle },
                    { cell: "A3", ...dataStyle }, { cell: "B3", ...dataStyle }, { cell: "C3", ...dataStyle, numFmt: '0.00%' },
                    { cell: "D1", ...separatorStyle }
                ];

                // ===== T1.1 =====
                result.sheets['T1.1'].columns = [{ width: 14.71 }, { width: 7.71 }, { width: 7.71 }, { width: 7.71 }, { width: 1.71 }];
                result.sheets['T1.1'].data.push(["Тип платежной системы", "Месяц", null, null, null]);
                result.sheets['T1.1'].data.push([null, "Все заявки", "Успешных", "Конверсия", null]);

                const t11Data = Object.entries(paymentSystemStats1).sort((a, b) => b[1].total - a[1].total);
                t11Data.forEach(([system, stats]) => {
                    const conversion = stats.total > 0 ? stats.successful / stats.total : 0;
                    result.sheets['T1.1'].data.push([system, stats.total, stats.successful, conversion, null]);
                });
                const t11TotalRequests = t11Data.reduce((sum, [, stats]) => sum + stats.total, 0);
                const t11TotalSuccessful = t11Data.reduce((sum, [, stats]) => sum + stats.successful, 0);
                result.sheets['T1.1'].data.push([null, null, null, null, null]);
                result.sheets['T1.1'].data.push(["Всего по ГЕО:", t11TotalRequests, t11TotalSuccessful, t11TotalRequests > 0 ? t11TotalSuccessful / t11TotalRequests : 0, null]);

                const t11LastRow = result.sheets['T1.1'].data.length;
                result.sheets['T1.1'].merges = ["A1:A2", "B1:D1", `E1:E${t11LastRow}`];
                result.sheets['T1.1'].styles = [
                    { cell: "A1", ...headerStyle }, { cell: "B1", ...headerStyle }, { cell: "C1", ...headerStyle }, { cell: "D1", ...headerStyle },
                    { cell: "A2", ...headerStyle }, { cell: "B2", ...headerStyle }, { cell: "C2", ...headerStyle }, { cell: "D2", ...headerStyle },
                    { cell: "E1", ...separatorStyle }
                ];
                for (let i = 3; i < t11LastRow; i++) {
                    result.sheets['T1.1'].styles.push({ cell: `A${i}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                    result.sheets['T1.1'].styles.push({ cell: `B${i}`, ...dataStyle });
                    result.sheets['T1.1'].styles.push({ cell: `C${i}`, ...dataStyle });
                    result.sheets['T1.1'].styles.push({ cell: `D${i}`, ...dataStyle, numFmt: '0.00%' });
                }
                result.sheets['T1.1'].styles.push({ cell: `A${t11LastRow}`, ...headerStyle, alignment: { horizontal: 'right', vertical: 'middle' } });
                result.sheets['T1.1'].styles.push({ cell: `B${t11LastRow}`, ...headerStyle });
                result.sheets['T1.1'].styles.push({ cell: `C${t11LastRow}`, ...headerStyle });
                result.sheets['T1.1'].styles.push({ cell: `D${t11LastRow}`, ...headerStyle, numFmt: '0.00%' });

                // ===== T1.2 =====
                result.sheets['T1.2'].columns = [{ width: 14.71 }, { width: 7.71 }, { width: 7.71 }, { width: 1.71 }];
                result.sheets['T1.2'].data = [
                    ["Месяц", null, null, null],
                    ["Всего заявок", "Успешных", "Конверсия", null],
                    [totalWithdrawalRequests, successfulWithdrawalRequests, withdrawalsConversion, null]
                ];
                result.sheets['T1.2'].merges = ["A1:C1", "D1:D3"];
                result.sheets['T1.2'].styles = [
                    { cell: "A1", ...headerStyle }, { cell: "B1", ...headerStyle }, { cell: "C1", ...headerStyle },
                    { cell: "A2", ...headerStyle }, { cell: "B2", ...headerStyle }, { cell: "C2", ...headerStyle },
                    { cell: "A3", ...dataStyle }, { cell: "B3", ...dataStyle }, { cell: "C3", ...dataStyle, numFmt: '0.00%' },
                    { cell: "D1", ...separatorStyle }
                ];

                // ===== T1.3 =====
                result.sheets['T1.3'].columns = [{ width: 14.71 }, { width: 7.71 }, { width: 7.71 }, { width: 7.71 }, { width: 1.71 }];
                result.sheets['T1.3'].data.push(["Тип платежной системы", "Месяц", null, null, null]);
                result.sheets['T1.3'].data.push([null, "Все заявки", "Успешных", "Конверсия", null]);

                const t13Data = Object.entries(paymentSystemStats2).sort((a, b) => b[1].total - a[1].total);
                t13Data.forEach(([system, stats]) => {
                    const conversion = stats.total > 0 ? stats.successful / stats.total : 0;
                    result.sheets['T1.3'].data.push([system, stats.total, stats.successful, conversion, null]);
                });
                const t13TotalRequests = t13Data.reduce((sum, [, stats]) => sum + stats.total, 0);
                const t13TotalSuccessful = t13Data.reduce((sum, [, stats]) => sum + stats.successful, 0);
                result.sheets['T1.3'].data.push([null, null, null, null, null]);
                result.sheets['T1.3'].data.push(["Всего по ГЕО:", t13TotalRequests, t13TotalSuccessful, t13TotalRequests > 0 ? t13TotalSuccessful / t13TotalRequests : 0, null]);

                const t13LastRow = result.sheets['T1.3'].data.length;
                result.sheets['T1.3'].merges = ["A1:A2", "B1:D1", `E1:E${t13LastRow}`];
                result.sheets['T1.3'].styles = [
                    { cell: "A1", ...headerStyle }, { cell: "B1", ...headerStyle }, { cell: "C1", ...headerStyle }, { cell: "D1", ...headerStyle },
                    { cell: "A2", ...headerStyle }, { cell: "B2", ...headerStyle }, { cell: "C2", ...headerStyle }, { cell: "D2", ...headerStyle },
                    { cell: "E1", ...separatorStyle }
                ];
                for (let i = 3; i < t13LastRow; i++) {
                    result.sheets['T1.3'].styles.push({ cell: `A${i}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                    result.sheets['T1.3'].styles.push({ cell: `B${i}`, ...dataStyle });
                    result.sheets['T1.3'].styles.push({ cell: `C${i}`, ...dataStyle });
                    result.sheets['T1.3'].styles.push({ cell: `D${i}`, ...dataStyle, numFmt: '0.00%' });
                }
                result.sheets['T1.3'].styles.push({ cell: `A${t13LastRow}`, ...headerStyle, alignment: { horizontal: 'right', vertical: 'middle' } });
                result.sheets['T1.3'].styles.push({ cell: `B${t13LastRow}`, ...headerStyle });
                result.sheets['T1.3'].styles.push({ cell: `C${t13LastRow}`, ...headerStyle });
                result.sheets['T1.3'].styles.push({ cell: `D${t13LastRow}`, ...headerStyle, numFmt: '0.00%' });

                // ===== К (Банковские карты) =====
                result.sheets['К'].columns = [{ width: 15.71 }, { width: 15.71 }, { width: 15.71 }, { width: 7.71 }, { width: 7.71 }, { width: 1.71 }];
                result.sheets['К'].data.push(["Агент", "Бренд", "Месяц", null, null, null]);
                result.sheets['К'].data.push([null, null, "Всего заявок", "Успешных", "Конверсия", null]);
                result.sheets['К'].merges = ["A1:A2", "B1:B2", "C1:E1", "F1:F2"];
                result.sheets['К'].styles = [
                    { cell: "A1", ...headerStyle }, { cell: "B1", ...headerStyle }, { cell: "C1", ...headerStyle },
                    { cell: "D1", ...headerStyle }, { cell: "E1", ...headerStyle },
                    { cell: "A2", ...headerStyle }, { cell: "B2", ...headerStyle }, { cell: "C2", ...headerStyle },
                    { cell: "D2", ...headerStyle }, { cell: "E2", ...headerStyle },
                    { cell: "F1", ...separatorStyle }
                ];

                const sortedAgents = Object.keys(cardPaymentsStats).sort((a, b) => {
                    const totalA = Object.values(cardPaymentsStats[a]).reduce((sum, stats) => sum + stats.total, 0);
                    const totalB = Object.values(cardPaymentsStats[b]).reduce((sum, stats) => sum + stats.total, 0);
                    return totalB - totalA;
                });

                let kCurrentRow = 3;
                const brandTotals = {};

                sortedAgents.forEach((agent, agentIdx) => {
                    const agentStartRow = kCurrentRow;
                    const sortedBrands = Object.keys(cardPaymentsStats[agent]).sort((a, b) => a.localeCompare(b));

                    sortedBrands.forEach((brand, brandIdx) => {
                        const stats = cardPaymentsStats[agent][brand];
                        const conversion = stats.total > 0 ? stats.successful / stats.total : 0;

                        if (!brandTotals[brand]) brandTotals[brand] = { total: 0, successful: 0 };
                        brandTotals[brand].total += stats.total;
                        brandTotals[brand].successful += stats.successful;

                        result.sheets['К'].data.push([brandIdx === 0 ? agent : null, brand, stats.total, stats.successful, conversion, null]);
                        result.sheets['К'].styles.push({ cell: `A${kCurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                        result.sheets['К'].styles.push({ cell: `B${kCurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                        result.sheets['К'].styles.push({ cell: `C${kCurrentRow}`, ...dataStyle });
                        result.sheets['К'].styles.push({ cell: `D${kCurrentRow}`, ...dataStyle });
                        result.sheets['К'].styles.push({ cell: `E${kCurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                        kCurrentRow++;
                    });

                    if (sortedBrands.length > 1) {
                        result.sheets['К'].merges.push(`A${agentStartRow}:A${kCurrentRow - 1}`);
                    }
                    result.sheets['К'].merges.push(`F${agentStartRow}:F${kCurrentRow - 1}`);
                    result.sheets['К'].styles.push({ cell: `F${agentStartRow}`, ...separatorStyle });

                    if (agentIdx < sortedAgents.length - 1) {
                        result.sheets['К'].data.push([null, null, null, null, null, null]);
                        result.sheets['К'].merges.push(`A${kCurrentRow}:F${kCurrentRow}`);
                        result.sheets['К'].styles.push({ cell: `A${kCurrentRow}`, ...separatorStyle });
                        kCurrentRow++;
                    }
                });

                result.sheets['К'].data.push([null, null, null, null, null, null]);
                kCurrentRow++;

                const methodsOrder = ['VISA', 'MASTERCARD'];
                const kTotalsStartRow = kCurrentRow;

                methodsOrder.forEach(method => {
                    if (brandTotals[method]) {
                        const stats = brandTotals[method];
                        const conversion = stats.total > 0 ? stats.successful / stats.total : 0;
                        result.sheets['К'].data.push([`Всего по методу ${method}:`, null, stats.total, stats.successful, conversion, null]);
                        result.sheets['К'].merges.push(`A${kCurrentRow}:B${kCurrentRow}`);
                        result.sheets['К'].styles.push({ cell: `A${kCurrentRow}`, ...headerStyle, alignment: { horizontal: 'right', vertical: 'middle' } });
                        result.sheets['К'].styles.push({ cell: `B${kCurrentRow}`, ...headerStyle });
                        result.sheets['К'].styles.push({ cell: `C${kCurrentRow}`, ...headerStyle });
                        result.sheets['К'].styles.push({ cell: `D${kCurrentRow}`, ...headerStyle });
                        result.sheets['К'].styles.push({ cell: `E${kCurrentRow}`, ...headerStyle, numFmt: '0.00%' });
                        kCurrentRow++;
                    }
                });

                const kGrandTotal = Object.values(brandTotals).reduce((sum, s) => sum + s.total, 0);
                const kGrandSuccessful = Object.values(brandTotals).reduce((sum, s) => sum + s.successful, 0);
                result.sheets['К'].data.push(["Всего по ГЕО:", null, kGrandTotal, kGrandSuccessful, kGrandTotal > 0 ? kGrandSuccessful / kGrandTotal : 0, null]);
                result.sheets['К'].merges.push(`A${kCurrentRow}:B${kCurrentRow}`);
                result.sheets['К'].styles.push({ cell: `A${kCurrentRow}`, ...headerStyle, alignment: { horizontal: 'right', vertical: 'middle' } });
                result.sheets['К'].styles.push({ cell: `B${kCurrentRow}`, ...headerStyle });
                result.sheets['К'].styles.push({ cell: `C${kCurrentRow}`, ...headerStyle });
                result.sheets['К'].styles.push({ cell: `D${kCurrentRow}`, ...headerStyle });
                result.sheets['К'].styles.push({ cell: `E${kCurrentRow}`, ...headerStyle, numFmt: '0.00%' });

                result.sheets['К'].merges.push(`F${kTotalsStartRow}:F${kCurrentRow}`);
                result.sheets['К'].styles.push({ cell: `F${kTotalsStartRow}`, ...separatorStyle });

                // ===== T2 (Субагенты депозитов) =====
                result.sheets['T2'].columns = [{ width: 10.71 }, { width: 25.71 }, { width: 7.71 }, { width: 7.71 }, { width: 7.71 }, { width: 1.71 }];
                result.sheets['T2'].data.push(["Метод", "Название Субагента и номер", "Месяц", null, null, null]);
                result.sheets['T2'].data.push([null, null, "Заявок", "Успешных", "Конверсия", null]);
                result.sheets['T2'].merges = ["A1:A2", "B1:B2", "C1:E1", "F1:F2"];
                result.sheets['T2'].styles = [
                    { cell: "A1", ...headerStyle }, { cell: "B1", ...headerStyle }, { cell: "C1", ...headerStyle },
                    { cell: "D1", ...headerStyle }, { cell: "E1", ...headerStyle },
                    { cell: "A2", ...headerStyle }, { cell: "B2", ...headerStyle }, { cell: "C2", ...headerStyle },
                    { cell: "D2", ...headerStyle }, { cell: "E2", ...headerStyle },
                    { cell: "F1", ...separatorStyle }
                ];

                const sortedGroups1 = Object.keys(subAgentGroups1).sort((a, b) => {
                    const totalA = Object.values(subAgentGroups1[a]).reduce((sum, s) => sum + s.total, 0);
                    const totalB = Object.values(subAgentGroups1[b]).reduce((sum, s) => sum + s.total, 0);
                    return totalB - totalA;
                });

                let t2CurrentRow = 3;
                sortedGroups1.forEach((group, groupIdx) => {
                    const subagents = subAgentGroups1[group];
                    const subagentList = Object.entries(subagents).map(([name, stats]) => ({ name, total: stats.total, successful: stats.successful })).sort((a, b) => a.name.localeCompare(b.name));
                    const groupStartRow = t2CurrentRow;

                    subagentList.forEach((s, idx) => {
                        const conversion = s.total > 0 ? s.successful / s.total : 0;
                        result.sheets['T2'].data.push([idx === 0 ? group : null, s.name, s.total, s.successful, conversion, null]);
                        result.sheets['T2'].styles.push({ cell: `A${t2CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                        result.sheets['T2'].styles.push({ cell: `B${t2CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                        result.sheets['T2'].styles.push({ cell: `C${t2CurrentRow}`, ...dataStyle });
                        result.sheets['T2'].styles.push({ cell: `D${t2CurrentRow}`, ...dataStyle });
                        result.sheets['T2'].styles.push({ cell: `E${t2CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                        t2CurrentRow++;
                    });

                    if (subagentList.length > 1) result.sheets['T2'].merges.push(`A${groupStartRow}:A${t2CurrentRow - 1}`);

                    const groupTotal = subagentList.reduce((sum, s) => sum + s.total, 0);
                    const groupSuccessful = subagentList.reduce((sum, s) => sum + s.successful, 0);
                    result.sheets['T2'].data.push(["Всего по ГЕО:", null, groupTotal, groupSuccessful, groupTotal > 0 ? groupSuccessful / groupTotal : 0, null]);
                    result.sheets['T2'].merges.push(`A${t2CurrentRow}:B${t2CurrentRow}`);
                    result.sheets['T2'].styles.push({ cell: `A${t2CurrentRow}`, ...headerStyle, alignment: { horizontal: 'right', vertical: 'middle' } });
                    result.sheets['T2'].styles.push({ cell: `B${t2CurrentRow}`, ...headerStyle });
                    result.sheets['T2'].styles.push({ cell: `C${t2CurrentRow}`, ...headerStyle });
                    result.sheets['T2'].styles.push({ cell: `D${t2CurrentRow}`, ...headerStyle });
                    result.sheets['T2'].styles.push({ cell: `E${t2CurrentRow}`, ...headerStyle, numFmt: '0.00%' });
                    result.sheets['T2'].merges.push(`F${groupStartRow}:F${t2CurrentRow}`);
                    result.sheets['T2'].styles.push({ cell: `F${groupStartRow}`, ...separatorStyle });
                    t2CurrentRow++;

                    if (groupIdx < sortedGroups1.length - 1) {
                        result.sheets['T2'].data.push([null, null, null, null, null, null]);
                        result.sheets['T2'].merges.push(`A${t2CurrentRow}:F${t2CurrentRow}`);
                        result.sheets['T2'].styles.push({ cell: `A${t2CurrentRow}`, ...separatorStyle });
                        t2CurrentRow++;
                    }
                });

                // ===== T2.1 (Субагенты выводов) =====
                result.sheets['T2.1'].columns = [{ width: 10.71 }, { width: 25.71 }, { width: 7.71 }, { width: 7.71 }, { width: 7.71 }, { width: 1.71 }];
                result.sheets['T2.1'].data.push(["Метод", "Название Субагента и номер", "Месяц", null, null, null]);
                result.sheets['T2.1'].data.push([null, null, "Заявок", "Успешных", "Конверсия", null]);
                result.sheets['T2.1'].merges = ["A1:A2", "B1:B2", "C1:E1", "F1:F2"];
                result.sheets['T2.1'].styles = [
                    { cell: "A1", ...headerStyle }, { cell: "B1", ...headerStyle }, { cell: "C1", ...headerStyle },
                    { cell: "D1", ...headerStyle }, { cell: "E1", ...headerStyle },
                    { cell: "A2", ...headerStyle }, { cell: "B2", ...headerStyle }, { cell: "C2", ...headerStyle },
                    { cell: "D2", ...headerStyle }, { cell: "E2", ...headerStyle },
                    { cell: "F1", ...separatorStyle }
                ];

                const sortedGroups2 = Object.keys(subAgentGroups2).sort((a, b) => {
                    const totalA = Object.values(subAgentGroups2[a]).reduce((sum, s) => sum + s.total, 0);
                    const totalB = Object.values(subAgentGroups2[b]).reduce((sum, s) => sum + s.total, 0);
                    return totalB - totalA;
                });

                let t21CurrentRow = 3;
                sortedGroups2.forEach((group, groupIdx) => {
                    const subagents = subAgentGroups2[group];
                    const subagentList = Object.entries(subagents).map(([name, stats]) => ({ name, total: stats.total, successful: stats.successful })).sort((a, b) => a.name.localeCompare(b.name));
                    const groupStartRow = t21CurrentRow;

                    subagentList.forEach((s, idx) => {
                        const conversion = s.total > 0 ? s.successful / s.total : 0;
                        result.sheets['T2.1'].data.push([idx === 0 ? group : null, s.name, s.total, s.successful, conversion, null]);
                        result.sheets['T2.1'].styles.push({ cell: `A${t21CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                        result.sheets['T2.1'].styles.push({ cell: `B${t21CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                        result.sheets['T2.1'].styles.push({ cell: `C${t21CurrentRow}`, ...dataStyle });
                        result.sheets['T2.1'].styles.push({ cell: `D${t21CurrentRow}`, ...dataStyle });
                        result.sheets['T2.1'].styles.push({ cell: `E${t21CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                        t21CurrentRow++;
                    });

                    if (subagentList.length > 1) result.sheets['T2.1'].merges.push(`A${groupStartRow}:A${t21CurrentRow - 1}`);

                    const groupTotal = subagentList.reduce((sum, s) => sum + s.total, 0);
                    const groupSuccessful = subagentList.reduce((sum, s) => sum + s.successful, 0);
                    result.sheets['T2.1'].data.push(["Всего по ГЕО:", null, groupTotal, groupSuccessful, groupTotal > 0 ? groupSuccessful / groupTotal : 0, null]);
                    result.sheets['T2.1'].merges.push(`A${t21CurrentRow}:B${t21CurrentRow}`);
                    result.sheets['T2.1'].styles.push({ cell: `A${t21CurrentRow}`, ...headerStyle, alignment: { horizontal: 'right', vertical: 'middle' } });
                    result.sheets['T2.1'].styles.push({ cell: `B${t21CurrentRow}`, ...headerStyle });
                    result.sheets['T2.1'].styles.push({ cell: `C${t21CurrentRow}`, ...headerStyle });
                    result.sheets['T2.1'].styles.push({ cell: `D${t21CurrentRow}`, ...headerStyle });
                    result.sheets['T2.1'].styles.push({ cell: `E${t21CurrentRow}`, ...headerStyle, numFmt: '0.00%' });
                    result.sheets['T2.1'].merges.push(`F${groupStartRow}:F${t21CurrentRow}`);
                    result.sheets['T2.1'].styles.push({ cell: `F${groupStartRow}`, ...separatorStyle });
                    t21CurrentRow++;

                    if (groupIdx < sortedGroups2.length - 1) {
                        result.sheets['T2.1'].data.push([null, null, null, null, null, null]);
                        result.sheets['T2.1'].merges.push(`A${t21CurrentRow}:F${t21CurrentRow}`);
                        result.sheets['T2.1'].styles.push({ cell: `A${t21CurrentRow}`, ...separatorStyle });
                        t21CurrentRow++;
                    }
                });

                // ===== T5 =====
                const netProfitGeo = depositsSum - withdrawalsSum - depositsCommission - withdrawalsCommission;
                const btDepositPercent = depositsSum > 0 ? btDepositsSum / depositsSum : 0;
                const btWithdrawalPercent = withdrawalsSum > 0 ? btWithdrawalsSum / withdrawalsSum : 0;
                const netProfitBT = btDepositsSum - btWithdrawalsSum - btDepositsCommission - btWithdrawalsCommission;

                result.sheets['T5'].columns = [{ width: 30.71 }, { width: 7.71 }, { width: 1.71 }];
                result.sheets['T5'].data.push(["Показатель", "Месяц", null]);
                result.sheets['T5'].data.push([null, null, null]);
                result.sheets['T5'].merges = ["A1:A2", "B1:B2", "C1:C2"];
                result.sheets['T5'].styles = [
                    { cell: "A1", ...headerStyle }, { cell: "B1", ...headerStyle },
                    { cell: "A2", ...headerStyle }, { cell: "B2", ...headerStyle },
                    { cell: "C1", ...separatorStyle }
                ];

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
                    result.sheets['T5'].data.push([row[0], row[1], null]);
                    result.sheets['T5'].styles.push({ cell: `A${t5CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                    result.sheets['T5'].styles.push({ cell: `B${t5CurrentRow}`, ...dataStyle });
                    t5CurrentRow++;
                });
                result.sheets['T5'].merges.push(`C${t5Block1Start}:C${t5CurrentRow - 1}`);
                result.sheets['T5'].styles.push({ cell: `C${t5Block1Start}`, ...separatorStyle });

                result.sheets['T5'].data.push([null, null, null]);
                result.sheets['T5'].merges.push(`A${t5CurrentRow}:C${t5CurrentRow}`);
                result.sheets['T5'].styles.push({ cell: `A${t5CurrentRow}`, ...separatorStyle });
                t5CurrentRow++;

                const t5Block2 = [
                    ["Сумма успешных депозитов BT в USD", Math.round(btDepositsSum), false],
                    ["Комиссия за депозиты", Math.round(btDepositsCommission), false],
                    ["Процент BT, от общего числа успешных депозитов", btDepositPercent, true],
                    ["Сумма успешных выплат BT в USD", Math.round(btWithdrawalsSum), false],
                    ["Комиссия за выплаты", Math.round(btWithdrawalsCommission), false],
                    ["Процент BT, от общего числа успешных выплат", btWithdrawalPercent, true],
                    ["Чистая прибыль по методу BT", Math.round(netProfitBT), false]
                ];

                const t5Block2Start = t5CurrentRow;
                t5Block2.forEach(row => {
                    result.sheets['T5'].data.push([row[0], row[1], null]);
                    result.sheets['T5'].styles.push({ cell: `A${t5CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                    if (row[2]) {
                        result.sheets['T5'].styles.push({ cell: `B${t5CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                    } else {
                        result.sheets['T5'].styles.push({ cell: `B${t5CurrentRow}`, ...dataStyle });
                    }
                    t5CurrentRow++;
                });
                result.sheets['T5'].merges.push(`C${t5Block2Start}:C${t5CurrentRow - 1}`);
                result.sheets['T5'].styles.push({ cell: `C${t5Block2Start}`, ...separatorStyle });
            }
        }

        // =============== ОБРАБОТКА РЕГИСТРАЦИЙ (T3.1, T3.2, T6, T7) ===============
        if (stepsData.step3 && stepsData.step3.length > 0) {
            const regData = stepsData.step3[0];
            if (regData && regData.length > 0) {
                const HEADERS_MAP_REG = {
                    month: ['Месяц', 'Month'],
                    registrationType: ['Тип регистрации', 'Registration type'],
                    trafficSource: ['Источник трафика', 'Traffic source'],
                    device: ['Устройство', 'Device'],
                    totalRegistrations: ['Всего регистраций', 'Total registrations'],
                    firstDeposit: ['Количество регистраций за период, из них с первым депозитом', 'Registrations, including with first deposit, in period'],
                    fastDeposit: ['Количество новых регистраций с быстрым депозитом', 'New registrations with fast deposit'],
                    playersWithDeposit: ['Игроки с регистрацией и первым депозитом за указанный период', 'Customers who registered and made their first deposit within the specified period'],
                    allDeposits: ['Количество всех депозитов игроков, зарегистрированных за указанный период', 'Total number of deposits made by customers who registered within the specified period'],
                    allBets: ['Количество всех ставок игроков, зарегистрированных за указанный период', 'Total number of bets placed by customers who registered within the specified period']
                };

                const colsReg = {
                    month: findColumn(regData[0], HEADERS_MAP_REG.month),
                    registrationType: findColumn(regData[0], HEADERS_MAP_REG.registrationType),
                    trafficSource: findColumn(regData[0], HEADERS_MAP_REG.trafficSource),
                    device: findColumn(regData[0], HEADERS_MAP_REG.device),
                    totalRegistrations: findColumn(regData[0], HEADERS_MAP_REG.totalRegistrations),
                    firstDeposit: findColumn(regData[0], HEADERS_MAP_REG.firstDeposit),
                    fastDeposit: findColumn(regData[0], HEADERS_MAP_REG.fastDeposit),
                    playersWithDeposit: findColumn(regData[0], HEADERS_MAP_REG.playersWithDeposit),
                    allDeposits: findColumn(regData[0], HEADERS_MAP_REG.allDeposits),
                    allBets: findColumn(regData[0], HEADERS_MAP_REG.allBets)
                };

                // T3.1 - Итого
                let t31TotalReg = 0, t31FirstDep = 0, t31FastDep = 0, t31Players = 0, t31Deposits = 0, t31Bets = 0;
                for (let i = 1; i < regData.length; i++) {
                    const row = regData[i];
                    if (!row) continue;
                    const monthValue = (row[colsReg.month] || '').toString().trim();
                    if (monthValue.toLowerCase().includes('итого') || monthValue.toLowerCase().includes('total')) {
                        t31TotalReg = getNumber(row[colsReg.totalRegistrations]);
                        t31FirstDep = getNumber(row[colsReg.firstDeposit]);
                        t31FastDep = getNumber(row[colsReg.fastDeposit]);
                        t31Players = getNumber(row[colsReg.playersWithDeposit]);
                        t31Deposits = getNumber(row[colsReg.allDeposits]);
                        t31Bets = getNumber(row[colsReg.allBets]);
                        break;
                    }
                }

                const firstDepPercent = t31TotalReg > 0 ? t31FirstDep / t31TotalReg : 0;
                const fastDepPercent = t31TotalReg > 0 ? t31FastDep / t31TotalReg : 0;

                result.sheets['T3.1'].columns = [{ width: 35.71 }, { width: 7.71 }, { width: 1.71 }];
                result.sheets['T3.1'].data.push(['Показатель', 'Месяц', null]);
                result.sheets['T3.1'].data.push([null, null, null]);
                result.sheets['T3.1'].merges = ['A1:A2', 'B1:B2', 'C1:C2'];
                result.sheets['T3.1'].styles = [
                    { cell: 'A1', ...headerStyle }, { cell: 'B1', ...headerStyle },
                    { cell: 'A2', ...headerStyle }, { cell: 'B2', ...headerStyle },
                    { cell: 'C1', ...separatorStyle }
                ];

                const t31DataArr = [
                    ['Всего регистраций', t31TotalReg, false],
                    ['Количество регистраций за период, из них с первым депозитом', t31FirstDep, false],
                    ['Процент сделавших первый депозит', firstDepPercent, true],
                    ['Количество новых регистраций с быстрым депозитом', t31FastDep, false],
                    ['Процент сделавших быстрый депозит', fastDepPercent, true],
                    ['Всего игроков с первым депозитом в указанный период', t31Players, false],
                    ['Количество депозитов', t31Deposits, false],
                    ['Количество ставок', t31Bets, false]
                ];

                let t31CurrentRow = 3;
                const t31DataStart = t31CurrentRow;
                t31DataArr.forEach(row => {
                    result.sheets['T3.1'].data.push([row[0], row[1], null]);
                    result.sheets['T3.1'].styles.push({ cell: `A${t31CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                    if (row[2]) {
                        result.sheets['T3.1'].styles.push({ cell: `B${t31CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                    } else {
                        result.sheets['T3.1'].styles.push({ cell: `B${t31CurrentRow}`, ...dataStyle });
                    }
                    t31CurrentRow++;
                });
                result.sheets['T3.1'].merges.push(`C${t31DataStart}:C${t31CurrentRow - 1}`);
                result.sheets['T3.1'].styles.push({ cell: `C${t31DataStart}`, ...separatorStyle });

                // T3.2 - По источникам трафика
                const trafficSums = {
                    affilate: { totalReg: 0, firstDep: 0 },
                    organic: { totalReg: 0, firstDep: 0 }
                };

                for (let i = 1; i < regData.length; i++) {
                    const row = regData[i];
                    if (!row) continue;
                    const trafficSource = (row[colsReg.trafficSource] || '').toString().trim().toLowerCase();
                    if (trafficSource.includes('affilate') || trafficSource.includes('affiliate')) {
                        trafficSums.affilate.totalReg += getNumber(row[colsReg.totalRegistrations]);
                        trafficSums.affilate.firstDep += getNumber(row[colsReg.firstDeposit]);
                    }
                    if (trafficSource.includes('organic')) {
                        trafficSums.organic.totalReg += getNumber(row[colsReg.totalRegistrations]);
                        trafficSums.organic.firstDep += getNumber(row[colsReg.firstDeposit]);
                    }
                }

                const affiliatePercent = trafficSums.affilate.totalReg > 0 ? trafficSums.affilate.firstDep / trafficSums.affilate.totalReg : 0;
                const organicPercent = trafficSums.organic.totalReg > 0 ? trafficSums.organic.firstDep / trafficSums.organic.totalReg : 0;

                result.sheets['T3.2'].columns = [{ width: 50.71 }, { width: 7.71 }, { width: 1.71 }];
                result.sheets['T3.2'].data.push(['Показатель', 'Месяц', null]);
                result.sheets['T3.2'].data.push([null, null, null]);
                result.sheets['T3.2'].merges = ['A1:A2', 'B1:B2', 'C1:C2'];
                result.sheets['T3.2'].styles = [
                    { cell: 'A1', ...headerStyle }, { cell: 'B1', ...headerStyle },
                    { cell: 'A2', ...headerStyle }, { cell: 'B2', ...headerStyle },
                    { cell: 'C1', ...separatorStyle }
                ];

                const t32Data = [
                    ['Всего зарегистрировалось аккаунтов', t31TotalReg, false],
                    ['Всего зарегистрировалось аккаунтов (Affiliate)', trafficSums.affilate.totalReg, false],
                    ['Число зарегистрированных аккаунтов, сделавших первый депозит (Affiliate)', trafficSums.affilate.firstDep, false],
                    ['Процент зарегистрированных аккаунтов, сделавших первый депозит (Affiliate)', affiliatePercent, true],
                    ['Всего зарегистрировалось аккаунтов (Organic)', trafficSums.organic.totalReg, false],
                    ['Число зарегистрированных аккаунтов, сделавших первый депозит (Organic)', trafficSums.organic.firstDep, false],
                    ['Процент зарегистрированных аккаунтов, сделавших первый депозит (Organic)', organicPercent, true]
                ];

                let t32CurrentRow = 3;
                const t32DataStart = t32CurrentRow;
                t32Data.forEach(row => {
                    result.sheets['T3.2'].data.push([row[0], row[1], null]);
                    result.sheets['T3.2'].styles.push({ cell: `A${t32CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                    if (row[2]) {
                        result.sheets['T3.2'].styles.push({ cell: `B${t32CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                    } else {
                        result.sheets['T3.2'].styles.push({ cell: `B${t32CurrentRow}`, ...dataStyle });
                    }
                    t32CurrentRow++;
                });
                result.sheets['T3.2'].merges.push(`C${t32DataStart}:C${t32CurrentRow - 1}`);
                result.sheets['T3.2'].styles.push({ cell: `C${t32DataStart}`, ...separatorStyle });

                // ===== T6: ПО ТИПАМ РЕГИСТРАЦИИ =====
                const regTypes = {
                    full: { totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
                    oneclick: { totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
                    phone: { totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
                    social: { totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 }
                };

                for (let i = 1; i < regData.length; i++) {
                    const row = regData[i];
                    if (!row || row.length === 0) continue;

                    const regType = (row[colsReg.registrationType] || '').toString().trim().toLowerCase();

                    let target = null;
                    if (regType.includes('full')) target = regTypes.full;
                    else if (regType.includes('oneclick') || regType.includes('oneсlick')) target = regTypes.oneclick;
                    else if (regType.includes('phone')) target = regTypes.phone;
                    else if (regType.includes('social')) target = regTypes.social;

                    if (target) {
                        target.totalReg += getNumber(row[colsReg.totalRegistrations]);
                        target.firstDep += getNumber(row[colsReg.firstDeposit]);
                        target.fastDep += getNumber(row[colsReg.fastDeposit]);
                        target.players += getNumber(row[colsReg.playersWithDeposit]);
                        target.deposits += getNumber(row[colsReg.allDeposits]);
                        target.bets += getNumber(row[colsReg.allBets]);
                    }
                }

                // Расчёт процентов для T6
                const oneClickFirstDepPercent = regTypes.oneclick.totalReg > 0 ? regTypes.oneclick.firstDep / regTypes.oneclick.totalReg : 0;
                const phoneFirstDepPercent = regTypes.phone.totalReg > 0 ? regTypes.phone.firstDep / regTypes.phone.totalReg : 0;
                const fullFirstDepPercent = regTypes.full.totalReg > 0 ? regTypes.full.firstDep / regTypes.full.totalReg : 0;
                const socialFirstDepPercent = regTypes.social.totalReg > 0 ? regTypes.social.firstDep / regTypes.social.totalReg : 0;

                const oneClickFastDepPercent = regTypes.oneclick.totalReg > 0 ? regTypes.oneclick.fastDep / regTypes.oneclick.totalReg : 0;
                const phoneFastDepPercent = regTypes.phone.totalReg > 0 ? regTypes.phone.fastDep / regTypes.phone.totalReg : 0;
                const fullFastDepPercent = regTypes.full.totalReg > 0 ? regTypes.full.fastDep / regTypes.full.totalReg : 0;
                const socialFastDepPercent = regTypes.social.totalReg > 0 ? regTypes.social.fastDep / regTypes.social.totalReg : 0;

                result.sheets['T6'].columns = [{ width: 35.71 }, { width: 7.71 }, { width: 7.71 }, { width: 7.71 }, { width: 7.71 }, { width: 1.71 }];
                result.sheets['T6'].data.push(['Показатель', 'Месяц', null, null, null, null]);
                result.sheets['T6'].data.push([null, null, null, null, null, null]);
                result.sheets['T6'].data.push([null, 'OneClick', 'Phone', 'Full', 'Social', null]);
                result.sheets['T6'].merges = ['A1:A3', 'B1:E2', 'F1:F3'];
                result.sheets['T6'].styles = [
                    { cell: 'A1', ...headerStyle }, { cell: 'B1', ...headerStyle }, { cell: 'C1', ...headerStyle },
                    { cell: 'D1', ...headerStyle }, { cell: 'E1', ...headerStyle },
                    { cell: 'A2', ...headerStyle }, { cell: 'A3', ...headerStyle },
                    { cell: 'B3', ...headerStyle }, { cell: 'C3', ...headerStyle },
                    { cell: 'D3', ...headerStyle }, { cell: 'E3', ...headerStyle },
                    { cell: 'F1', ...separatorStyle }
                ];

                const t6Data = [
                    ['Всего регистраций', regTypes.oneclick.totalReg, regTypes.phone.totalReg, regTypes.full.totalReg, regTypes.social.totalReg, false],
                    ['Количество регистраций с первым депозитом', regTypes.oneclick.firstDep, regTypes.phone.firstDep, regTypes.full.firstDep, regTypes.social.firstDep, false],
                    ['Процент сделавших первый депозит', oneClickFirstDepPercent, phoneFirstDepPercent, fullFirstDepPercent, socialFirstDepPercent, true],
                    ['Количество новых регистраций с быстрым депозитом', regTypes.oneclick.fastDep, regTypes.phone.fastDep, regTypes.full.fastDep, regTypes.social.fastDep, false],
                    ['Процент сделавших быстрый депозит', oneClickFastDepPercent, phoneFastDepPercent, fullFastDepPercent, socialFastDepPercent, true],
                    ['Всего игроков с первым депозитом в указанный период', regTypes.oneclick.players, regTypes.phone.players, regTypes.full.players, regTypes.social.players, false],
                    ['Количество депозитов', regTypes.oneclick.deposits, regTypes.phone.deposits, regTypes.full.deposits, regTypes.social.deposits, false],
                    ['Количество ставок', regTypes.oneclick.bets, regTypes.phone.bets, regTypes.full.bets, regTypes.social.bets, false]
                ];

                let t6CurrentRow = 4;
                const t6DataStart = t6CurrentRow;
                t6Data.forEach(row => {
                    result.sheets['T6'].data.push([row[0], row[1], row[2], row[3], row[4], null]);
                    result.sheets['T6'].styles.push({ cell: `A${t6CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                    if (row[5]) {
                        result.sheets['T6'].styles.push({ cell: `B${t6CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                        result.sheets['T6'].styles.push({ cell: `C${t6CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                        result.sheets['T6'].styles.push({ cell: `D${t6CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                        result.sheets['T6'].styles.push({ cell: `E${t6CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                    } else {
                        result.sheets['T6'].styles.push({ cell: `B${t6CurrentRow}`, ...dataStyle });
                        result.sheets['T6'].styles.push({ cell: `C${t6CurrentRow}`, ...dataStyle });
                        result.sheets['T6'].styles.push({ cell: `D${t6CurrentRow}`, ...dataStyle });
                        result.sheets['T6'].styles.push({ cell: `E${t6CurrentRow}`, ...dataStyle });
                    }
                    t6CurrentRow++;
                });
                result.sheets['T6'].merges.push(`F${t6DataStart}:F${t6CurrentRow - 1}`);
                result.sheets['T6'].styles.push({ cell: `F${t6DataStart}`, ...separatorStyle });

                // ===== T7: ПО УСТРОЙСТВАМ =====
                const devices = {
                    android: { totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
                    ios: { totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
                    winclient: { totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
                    webnewdesign: { totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
                    mobilev3: { totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
                    mobilenewdesign: { totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
                    webv3: { totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 }
                };

                for (let i = 1; i < regData.length; i++) {
                    const row = regData[i];
                    if (!row || row.length === 0) continue;

                    const deviceName = (row[colsReg.device] || '').toString().trim().toLowerCase();

                    let target = null;
                    if (deviceName.includes('android') || deviceName.includes('андроид')) {
                        target = devices.android;
                    } else if (deviceName.includes('ios') || deviceName.includes('айос')) {
                        target = devices.ios;
                    } else if (deviceName.includes('winclient') || deviceName.includes('винклиент')) {
                        target = devices.winclient;
                    } else if (deviceName.includes('web v3') || deviceName.includes('веб v3')) {
                        target = devices.webv3;
                    } else if ((deviceName.includes('мобильная') || deviceName.includes('mobile') || deviceName.includes('моб')) &&
                               (deviceName.includes('v3') || deviceName.includes('версия сайта v3'))) {
                        target = devices.mobilev3;
                    } else if ((deviceName.includes('web') || deviceName.includes('веб')) &&
                               (deviceName.includes('новый дизайн') || deviceName.includes('new design'))) {
                        target = devices.webnewdesign;
                    } else if ((deviceName.includes('мобильная') || deviceName.includes('mobile') || deviceName.includes('моб')) &&
                               (deviceName.includes('новый дизайн') || deviceName.includes('new design'))) {
                        target = devices.mobilenewdesign;
                    }

                    if (target) {
                        target.totalReg += getNumber(row[colsReg.totalRegistrations]);
                        target.firstDep += getNumber(row[colsReg.firstDeposit]);
                        target.fastDep += getNumber(row[colsReg.fastDeposit]);
                        target.players += getNumber(row[colsReg.playersWithDeposit]);
                        target.deposits += getNumber(row[colsReg.allDeposits]);
                        target.bets += getNumber(row[colsReg.allBets]);
                    }
                }

                // Расчёт процентов для T7
                const androidFirstDepPercent = devices.android.totalReg > 0 ? devices.android.firstDep / devices.android.totalReg : 0;
                const iosFirstDepPercent = devices.ios.totalReg > 0 ? devices.ios.firstDep / devices.ios.totalReg : 0;
                const winclientFirstDepPercent = devices.winclient.totalReg > 0 ? devices.winclient.firstDep / devices.winclient.totalReg : 0;
                const webnewFirstDepPercent = devices.webnewdesign.totalReg > 0 ? devices.webnewdesign.firstDep / devices.webnewdesign.totalReg : 0;
                const mobv3FirstDepPercent = devices.mobilev3.totalReg > 0 ? devices.mobilev3.firstDep / devices.mobilev3.totalReg : 0;
                const mobnewFirstDepPercent = devices.mobilenewdesign.totalReg > 0 ? devices.mobilenewdesign.firstDep / devices.mobilenewdesign.totalReg : 0;
                const webv3FirstDepPercent = devices.webv3.totalReg > 0 ? devices.webv3.firstDep / devices.webv3.totalReg : 0;

                const androidFastDepPercent = devices.android.totalReg > 0 ? devices.android.fastDep / devices.android.totalReg : 0;
                const iosFastDepPercent = devices.ios.totalReg > 0 ? devices.ios.fastDep / devices.ios.totalReg : 0;
                const winclientFastDepPercent = devices.winclient.totalReg > 0 ? devices.winclient.fastDep / devices.winclient.totalReg : 0;
                const webnewFastDepPercent = devices.webnewdesign.totalReg > 0 ? devices.webnewdesign.fastDep / devices.webnewdesign.totalReg : 0;
                const mobv3FastDepPercent = devices.mobilev3.totalReg > 0 ? devices.mobilev3.fastDep / devices.mobilev3.totalReg : 0;
                const mobnewFastDepPercent = devices.mobilenewdesign.totalReg > 0 ? devices.mobilenewdesign.fastDep / devices.mobilenewdesign.totalReg : 0;
                const webv3FastDepPercent = devices.webv3.totalReg > 0 ? devices.webv3.fastDep / devices.webv3.totalReg : 0;

                result.sheets['T7'].columns = [{ width: 45.71 }, { width: 7.71 }, { width: 7.71 }, { width: 7.71 }, { width: 7.71 }, { width: 7.71 }, { width: 7.71 }, { width: 7.71 }, { width: 1.71 }];
                result.sheets['T7'].data.push(['Показатель', 'Месяц', null, null, null, null, null, null, null]);
                result.sheets['T7'].data.push([null, 'Mobile', null, 'Other', 'Web', null, null, null, null]);
                result.sheets['T7'].data.push([null, 'Android', 'iOS', 'WinClient', 'Web (новый дизайн)', 'Моб. Версия сайта v3', 'Моб. Версия сайта (новый дизайн)', 'Web v3', null]);
                result.sheets['T7'].merges = ['A1:A3', 'B1:H1', 'B2:C2', 'E2:H2', 'I1:I3'];
                result.sheets['T7'].rowHeights = { 3: 70 };
                result.sheets['T7'].styles = [
                    { cell: 'A1', ...headerStyle }, { cell: 'B1', ...headerStyle }, { cell: 'C1', ...headerStyle },
                    { cell: 'D1', ...headerStyle }, { cell: 'E1', ...headerStyle }, { cell: 'F1', ...headerStyle },
                    { cell: 'G1', ...headerStyle }, { cell: 'H1', ...headerStyle },
                    { cell: 'A2', ...headerStyle }, { cell: 'B2', ...headerStyle }, { cell: 'C2', ...headerStyle },
                    { cell: 'D2', ...headerStyle }, { cell: 'E2', ...headerStyle }, { cell: 'F2', ...headerStyle },
                    { cell: 'G2', ...headerStyle }, { cell: 'H2', ...headerStyle },
                    { cell: 'A3', ...headerStyle },
                    { cell: 'B3', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
                    { cell: 'C3', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
                    { cell: 'D3', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
                    { cell: 'E3', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
                    { cell: 'F3', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
                    { cell: 'G3', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
                    { cell: 'H3', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
                    { cell: 'I1', ...separatorStyle }
                ];

                const t7Data = [
                    ['Всего регистраций', devices.android.totalReg, devices.ios.totalReg, devices.winclient.totalReg, devices.webnewdesign.totalReg, devices.mobilev3.totalReg, devices.mobilenewdesign.totalReg, devices.webv3.totalReg, false],
                    ['Количество регистраций, с первым депозитом', devices.android.firstDep, devices.ios.firstDep, devices.winclient.firstDep, devices.webnewdesign.firstDep, devices.mobilev3.firstDep, devices.mobilenewdesign.firstDep, devices.webv3.firstDep, false],
                    ['Процент сделавших первый депозит', androidFirstDepPercent, iosFirstDepPercent, winclientFirstDepPercent, webnewFirstDepPercent, mobv3FirstDepPercent, mobnewFirstDepPercent, webv3FirstDepPercent, true],
                    ['Количество новых регистраций с быстрым депозитом', devices.android.fastDep, devices.ios.fastDep, devices.winclient.fastDep, devices.webnewdesign.fastDep, devices.mobilev3.fastDep, devices.mobilenewdesign.fastDep, devices.webv3.fastDep, false],
                    ['Процент сделавших быстрый депозит', androidFastDepPercent, iosFastDepPercent, winclientFastDepPercent, webnewFastDepPercent, mobv3FastDepPercent, mobnewFastDepPercent, webv3FastDepPercent, true],
                    ['Всего игроков с первым депозитом в указанный период', devices.android.players, devices.ios.players, devices.winclient.players, devices.webnewdesign.players, devices.mobilev3.players, devices.mobilenewdesign.players, devices.webv3.players, false],
                    ['Количество депозитов', devices.android.deposits, devices.ios.deposits, devices.winclient.deposits, devices.webnewdesign.deposits, devices.mobilev3.deposits, devices.mobilenewdesign.deposits, devices.webv3.deposits, false],
                    ['Количество ставок', devices.android.bets, devices.ios.bets, devices.winclient.bets, devices.webnewdesign.bets, devices.mobilev3.bets, devices.mobilenewdesign.bets, devices.webv3.bets, false]
                ];

                let t7CurrentRow = 4;
                const t7DataStart = t7CurrentRow;
                t7Data.forEach(row => {
                    result.sheets['T7'].data.push([row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], null]);
                    result.sheets['T7'].styles.push({ cell: `A${t7CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                    if (row[8]) {
                        for (let col = 1; col <= 7; col++) {
                            const colLetter = String.fromCharCode(65 + col);
                            result.sheets['T7'].styles.push({ cell: `${colLetter}${t7CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                        }
                    } else {
                        for (let col = 1; col <= 7; col++) {
                            const colLetter = String.fromCharCode(65 + col);
                            result.sheets['T7'].styles.push({ cell: `${colLetter}${t7CurrentRow}`, ...dataStyle });
                        }
                    }
                    t7CurrentRow++;
                });
                result.sheets['T7'].merges.push(`I${t7DataStart}:I${t7CurrentRow - 1}`);
                result.sheets['T7'].styles.push({ cell: `I${t7DataStart}`, ...separatorStyle });
            }
        }

        // =============== ОБРАБОТКА B-TAG (T3.4) ===============
        if (stepsData.step4 && stepsData.step4.length > 0) {
            const btagData = stepsData.step4[0];
            if (btagData && btagData.length > 0) {
                const HEADERS_MAP_BTAG = {
                    playerId: ['Номер игрока'],
                    status1: ['Статус 1 транзакции'],
                    status2: ['Статус 2 транзакции']
                };

                const colsBtag = {
                    playerId: findColumn(btagData[0], HEADERS_MAP_BTAG.playerId),
                    status1: findColumn(btagData[0], HEADERS_MAP_BTAG.status1),
                    status2: findColumn(btagData[0], HEADERS_MAP_BTAG.status2)
                };

                let valueCount = 0, okCount = 0, отказCount = 0, okОтказCount = 0, отказOkCount = 0;

                for (let i = 1; i < btagData.length; i++) {
                    const row = btagData[i];
                    if (!row || row.length === 0) continue;

                    const playerId = (row[colsBtag.playerId] || '').toString().trim();
                    const status1 = (row[colsBtag.status1] || '').toString().trim();
                    const status2 = (row[colsBtag.status2] || '').toString().trim();

                    if (playerId !== '') valueCount++;
                    if (status1 === 'ОК') okCount++;
                    if (status1 === 'Отказ') отказCount++;
                    if (status1 === 'ОК' && status2 === 'ОК') okОтказCount++;
                    if (status1 === 'Отказ' && status2 === 'Отказ') отказOkCount++;
                }

                const firstDepositPercent = valueCount > 0 ? okCount / valueCount : 0;
                const secondDepositPercent = okCount > 0 ? okОтказCount / okCount : 0;
                const firstRefusalPercent = valueCount > 0 ? отказCount / valueCount : 0;
                const retryAfterRefusalPercent = отказCount > 0 ? отказOkCount / отказCount : 0;

                result.sheets['T3.4'].columns = [{ width: 50.71 }, { width: 7.71 }, { width: 1.71 }];
                result.sheets['T3.4'].data.push(['Показатель', 'Месяц', null]);
                result.sheets['T3.4'].data.push([null, null, null]);
                result.sheets['T3.4'].merges = ['A1:A2', 'B1:B2', 'C1:C2'];
                result.sheets['T3.4'].styles = [
                    { cell: 'A1', ...headerStyle }, { cell: 'B1', ...headerStyle },
                    { cell: 'A2', ...headerStyle }, { cell: 'B2', ...headerStyle },
                    { cell: 'C1', ...separatorStyle }
                ];

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

                let t34CurrentRow = 3;
                const t34DataStart = t34CurrentRow;
                t34Data.forEach(row => {
                    result.sheets['T3.4'].data.push([row[0], row[1], null]);
                    result.sheets['T3.4'].styles.push({ cell: `A${t34CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                    if (row[2]) {
                        result.sheets['T3.4'].styles.push({ cell: `B${t34CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                    } else {
                        result.sheets['T3.4'].styles.push({ cell: `B${t34CurrentRow}`, ...dataStyle });
                    }
                    t34CurrentRow++;
                });
                result.sheets['T3.4'].merges.push(`C${t34DataStart}:C${t34CurrentRow - 1}`);
                result.sheets['T3.4'].styles.push({ cell: `C${t34DataStart}`, ...separatorStyle });
            }
        }

        // =============== ОБРАБОТКА АКТИВНЫХ ПОЛЬЗОВАТЕЛЕЙ (T4, T4.1) ===============
        if (stepsData.step5 && stepsData.step5.length > 0 && stepsData.step6 && stepsData.step6.length > 0) {
            const dataPrev = stepsData.step5[0];
            const dataCurrent = stepsData.step6[0];

            if (dataPrev && dataPrev.length > 0 && dataCurrent && dataCurrent.length > 0) {
                const HEADERS_MAP_USERS = { playerId: ['ID игрока', 'Player ID', 'Номер игрока', 'ID'] };
                const colPrev = findColumn(dataPrev[0] || [], HEADERS_MAP_USERS.playerId);
                const colCurrent = findColumn(dataCurrent[0] || [], HEADERS_MAP_USERS.playerId);

                if (colPrev !== -1 && colCurrent !== -1) {
                    const prevMonthIds = new Map();
                    for (let i = 1; i < dataPrev.length; i++) {
                        const row = dataPrev[i];
                        if (!row || row.length === 0) continue;
                        const id = (row[colPrev] || '').toString().trim();
                        if (id !== '') {
                            prevMonthIds.set(id, (prevMonthIds.get(id) || 0) + 1);
                        }
                    }

                    let countCurrent = 0, countMatches = 0;
                    for (let i = 1; i < dataCurrent.length; i++) {
                        const row = dataCurrent[i];
                        if (!row || row.length === 0) continue;
                        const id = (row[colCurrent] || '').toString().trim();
                        if (id !== '') {
                            countCurrent++;
                            if (prevMonthIds.has(id)) {
                                countMatches += prevMonthIds.get(id);
                            }
                        }
                    }

                    const countPrev = prevMonthIds.size > 0 ? Array.from(prevMonthIds.values()).reduce((sum, count) => sum + count, 0) : 0;
                    const countNew = countCurrent - countMatches;
                    const countChurn = countPrev - countMatches;
                    const growthPercent = countPrev > 0 ? (countCurrent - countPrev) / countPrev : 0;
                    const matchesPercent = countCurrent > 0 ? countMatches / countCurrent : 0;
                    const newPercent = countCurrent > 0 ? countNew / countCurrent : 0;
                    const churnPercent = countPrev > 0 ? countChurn / countPrev : 0;
                    const currentGrowthPercent = countPrev > 0 ? countCurrent / countPrev - 1 : 0;

                    // T4
                    result.sheets['T4'].columns = [{ width: 40.71 }, { width: 7.71 }, { width: 1.71 }, { width: 7.71 }, { width: 1.71 }];
                    result.sheets['T4'].data.push(['Показатель', 'Прошлый месяц', null, 'Текущий месяц', null]);
                    result.sheets['T4'].data.push([null, null, null, null, null]);
                    result.sheets['T4'].merges = ['A1:A2', 'B1:B2', 'C1:C2', 'D1:D2', 'E1:E2'];
                    result.sheets['T4'].rowHeights = { '2': 30 };
                    result.sheets['T4'].styles = [
                        { cell: 'A1', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle' } },
                        { cell: 'B1', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
                        { cell: 'D1', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
                        { cell: 'A2', ...headerStyle }, { cell: 'B2', ...headerStyle }, { cell: 'D2', ...headerStyle },
                        { cell: 'C1', ...separatorStyle }, { cell: 'E1', ...separatorStyle }
                    ];

                    const t4Data = [
                        ['Активные пользователи', countPrev, null, countCurrent, null, false],
                        ['Процент прироста, с предыдущим месяцем', '-', null, growthPercent, null, true]
                    ];

                    let t4Row = 3;
                    t4Data.forEach(row => {
                        result.sheets['T4'].data.push([row[0], row[1], row[2], row[3], row[4]]);
                        result.sheets['T4'].styles.push({ cell: `A${t4Row}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                        result.sheets['T4'].styles.push({ cell: `B${t4Row}`, ...dataStyle, alignment: { horizontal: 'center', vertical: 'middle' } });
                        result.sheets['T4'].styles.push({ cell: `C${t4Row}`, ...separatorStyle });
                        if (row[5]) {
                            result.sheets['T4'].styles.push({ cell: `D${t4Row}`, ...dataStyle, alignment: { horizontal: 'center', vertical: 'middle' }, numFmt: '0.00%' });
                        } else {
                            result.sheets['T4'].styles.push({ cell: `D${t4Row}`, ...dataStyle, alignment: { horizontal: 'center', vertical: 'middle' } });
                        }
                        result.sheets['T4'].styles.push({ cell: `E${t4Row}`, ...separatorStyle });
                        t4Row++;
                    });
                    result.sheets['T4'].merges.push(`C3:C${t4Row - 1}`);
                    result.sheets['T4'].merges.push(`E3:E${t4Row - 1}`);

                    // T4.1
                    result.sheets['T4.1'].columns = [{ width: 40.71 }, { width: 7.71 }, { width: 1.71 }, { width: 7.71 }, { width: 7.71 }, { width: 1.71 }];
                    result.sheets['T4.1'].data.push(['Показатель', 'Прошлый месяц', null, 'Текущий месяц', null, null]);
                    result.sheets['T4.1'].data.push([null, null, null, null, null, null]);
                    result.sheets['T4.1'].merges = ['A1:A2', 'B1:B2', 'C1:C2', 'D1:E2', 'F1:F2'];
                    result.sheets['T4.1'].rowHeights = { '2': 30 };
                    result.sheets['T4.1'].styles = [
                        { cell: 'A1', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle' } },
                        { cell: 'B1', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
                        { cell: 'D1', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
                        { cell: 'E1', ...headerStyle }, { cell: 'E2', ...headerStyle },
                        { cell: 'A2', ...headerStyle }, { cell: 'B2', ...headerStyle }, { cell: 'D2', ...headerStyle },
                        { cell: 'C1', ...separatorStyle }, { cell: 'F1', ...separatorStyle }
                    ];

                    const t41Data = [
                        ['Количество активных пользователей за месяц', countPrev, null, countCurrent, currentGrowthPercent, null],
                        ['Количество активных пользователей, перешедших с прошлого месяца', 'x', null, countMatches, matchesPercent, null],
                        ['Количество новых активных пользователей в текущем месяце', 'x', null, countNew, newPercent, null],
                        ['Отток активных пользователей с предыдущего месяца', 'x', null, countChurn, churnPercent, null]
                    ];

                    let t41Row = 3;
                    t41Data.forEach(row => {
                        result.sheets['T4.1'].data.push(row);
                        result.sheets['T4.1'].styles.push({ cell: `A${t41Row}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
                        result.sheets['T4.1'].styles.push({ cell: `B${t41Row}`, ...dataStyle, alignment: { horizontal: 'center', vertical: 'middle' } });
                        result.sheets['T4.1'].styles.push({ cell: `C${t41Row}`, ...separatorStyle });
                        result.sheets['T4.1'].styles.push({ cell: `D${t41Row}`, ...dataStyle, alignment: { horizontal: 'center', vertical: 'middle' } });
                        result.sheets['T4.1'].styles.push({ cell: `E${t41Row}`, ...dataStyle, alignment: { horizontal: 'center', vertical: 'middle' }, numFmt: '0.00%' });
                        result.sheets['T4.1'].styles.push({ cell: `F${t41Row}`, ...separatorStyle });
                        t41Row++;
                    });
                    result.sheets['T4.1'].merges.push(`C3:C${t41Row - 1}`);
                    result.sheets['T4.1'].merges.push(`F3:F${t41Row - 1}`);
                }
            }
        }

        // =============== ОБРАБОТКА АНАЛИТИКИ T9 ===============
        if (stepsData.step7 && stepsData.step7.length > 0) {
            const t9Data = stepsData.step7[0];
            if (t9Data && t9Data.length > 0) {
                const HEADERS_MAP_T9 = {
                    product: ['Продукт'],
                    productType: ['Тип продукта'],
                    usersCount: ['Кол-во пользователей'],
                    operationsCount: ['Кол-во операций']
                };

                const colsT9 = {
                    product: findColumn(t9Data[0], HEADERS_MAP_T9.product),
                    productType: findColumn(t9Data[0], HEADERS_MAP_T9.productType),
                    usersCount: findColumn(t9Data[0], HEADERS_MAP_T9.usersCount),
                    operationsCount: findColumn(t9Data[0], HEADERS_MAP_T9.operationsCount)
                };

                const productTypes = ['Slot', '1xGames', 'Live Casino'];
                const groupedData = {};
                let otherTypesUsers = 0, otherTypesOperations = 0;

                for (let i = 1; i < t9Data.length; i++) {
                    const row = t9Data[i];
                    if (!row || row.length === 0) continue;

                    const productType = (row[colsT9.productType] || '').toString().trim();
                    const product = (row[colsT9.product] || '').toString().trim();
                    const usersCount = parseFloat(row[colsT9.usersCount]) || 0;
                    const operationsCount = parseFloat(row[colsT9.operationsCount]) || 0;

                    if (productTypes.includes(productType)) {
                        if (product === '') continue;
                        if (!groupedData[productType]) groupedData[productType] = {};
                        if (!groupedData[productType][product]) groupedData[productType][product] = { users: 0, operations: 0 };
                        groupedData[productType][product].users += usersCount;
                        groupedData[productType][product].operations += operationsCount;
                    } else {
                        otherTypesUsers += usersCount;
                        otherTypesOperations += operationsCount;
                    }
                }

                const getTop5WithOthers = (typeData) => {
                    if (!typeData) return { top5: [], others: { users: 0, operations: 0 }, total: { users: 0, operations: 0 } };
                    const sorted = Object.entries(typeData).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.operations - a.operations);
                    const top5 = sorted.slice(0, 5);
                    const rest = sorted.slice(5);
                    const others = rest.reduce((acc, item) => ({ users: acc.users + item.users, operations: acc.operations + item.operations }), { users: 0, operations: 0 });
                    const total = sorted.reduce((acc, item) => ({ users: acc.users + item.users, operations: acc.operations + item.operations }), { users: 0, operations: 0 });
                    return { top5, others, total };
                };

                result.sheets['T9'].columns = [{ width: 10.71 }, { width: 20.71 }, { width: 10.71 }, { width: 10.71 }, { width: 10.71 }, { width: 10.71 }, { width: 1.71 }];
                result.sheets['T9'].data.push(['Месяц', null, null, null, null, null, null]);
                result.sheets['T9'].merges.push('A1:F1');
                result.sheets['T9'].styles.push({ cell: 'A1', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle' } });
                result.sheets['T9'].styles.push({ cell: 'G1', ...separatorStyle });

                result.sheets['T9'].data.push(['Тип продукта', 'Продукт', 'Количество пользователей', 'Количество операций', 'Всего по типу продукта', 'Всего количество операций', null]);
                result.sheets['T9'].rowHeights = { '2': 40 };
                result.sheets['T9'].styles.push({ cell: 'A2', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle' } });
                result.sheets['T9'].styles.push({ cell: 'B2', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle' } });
                result.sheets['T9'].styles.push({ cell: 'C2', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
                result.sheets['T9'].styles.push({ cell: 'D2', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
                result.sheets['T9'].styles.push({ cell: 'E2', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
                result.sheets['T9'].styles.push({ cell: 'F2', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
                result.sheets['T9'].styles.push({ cell: 'G2', ...separatorStyle });

                let t9CurrentRow = 3;
                let grandTotalUsers = 0, grandTotalOperations = 0;

                productTypes.forEach(typeName => {
                    const { top5, others, total } = getTop5WithOthers(groupedData[typeName]);
                    if (top5.length === 0 && others.users === 0) return;

                    const startRow = t9CurrentRow;

                    top5.forEach((item, index) => {
                        result.sheets['T9'].data.push([
                            index === 0 ? typeName : null, item.name, item.users, item.operations,
                            index === 0 ? total.users : null, index === 0 ? total.operations : null, null
                        ]);
                        for (let col = 0; col < 6; col++) {
                            const colLetter = String.fromCharCode(65 + col);
                            const alignment = col < 2 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
                            result.sheets['T9'].styles.push({ cell: `${colLetter}${t9CurrentRow}`, ...dataStyle, alignment });
                        }
                        result.sheets['T9'].styles.push({ cell: `G${t9CurrentRow}`, ...separatorStyle });
                        t9CurrentRow++;
                    });

                    if (others.users > 0 || others.operations > 0) {
                        result.sheets['T9'].data.push([
                            top5.length === 0 ? typeName : null, 'Другие', others.users, others.operations,
                            top5.length === 0 ? total.users : null, top5.length === 0 ? total.operations : null, null
                        ]);
                        for (let col = 0; col < 6; col++) {
                            const colLetter = String.fromCharCode(65 + col);
                            const alignment = col < 2 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
                            result.sheets['T9'].styles.push({ cell: `${colLetter}${t9CurrentRow}`, ...dataStyle, alignment });
                        }
                        result.sheets['T9'].styles.push({ cell: `G${t9CurrentRow}`, ...separatorStyle });
                        t9CurrentRow++;
                    }

                    const endRow = t9CurrentRow - 1;
                    if (endRow > startRow) {
                        result.sheets['T9'].merges.push(`A${startRow}:A${endRow}`);
                        result.sheets['T9'].merges.push(`E${startRow}:E${endRow}`);
                        result.sheets['T9'].merges.push(`F${startRow}:F${endRow}`);
                    }

                    grandTotalUsers += total.users;
                    grandTotalOperations += total.operations;
                });

                if (otherTypesUsers > 0 || otherTypesOperations > 0) {
                    result.sheets['T9'].data.push(['Остальные типы продуктов', null, otherTypesUsers, otherTypesOperations, otherTypesUsers, otherTypesOperations, null]);
                    result.sheets['T9'].merges.push(`A${t9CurrentRow}:B${t9CurrentRow}`);
                    for (let col = 0; col < 6; col++) {
                        const colLetter = String.fromCharCode(65 + col);
                        result.sheets['T9'].styles.push({ cell: `${colLetter}${t9CurrentRow}`, ...dataStyle, alignment: { horizontal: col < 2 ? 'left' : 'center', vertical: 'middle' } });
                    }
                    result.sheets['T9'].styles.push({ cell: `G${t9CurrentRow}`, ...separatorStyle });
                    grandTotalUsers += otherTypesUsers;
                    grandTotalOperations += otherTypesOperations;
                    t9CurrentRow++;
                }

                result.sheets['T9'].data.push(['Всего по ГЕО', null, grandTotalUsers, grandTotalOperations, grandTotalUsers, grandTotalOperations, null]);
                result.sheets['T9'].merges.push(`A${t9CurrentRow}:B${t9CurrentRow}`);
                for (let col = 0; col < 6; col++) {
                    const colLetter = String.fromCharCode(65 + col);
                    result.sheets['T9'].styles.push({ cell: `${colLetter}${t9CurrentRow}`, ...headerStyle, alignment: { horizontal: col < 2 ? 'left' : 'center', vertical: 'middle' } });
                }
                result.sheets['T9'].styles.push({ cell: `G${t9CurrentRow}`, ...separatorStyle });
                result.sheets['T9'].merges.push(`G1:G${t9CurrentRow}`);
            }
        }

        // Удаляем пустые листы
        sheetsOrder.forEach(name => {
            if (result.sheets[name].data.length === 0) {
                delete result.sheets[name];
            }
        });

        return result;
    }
};
