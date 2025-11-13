// Шаблон: Пополнения и выводы
// Создает отчет по депозитам и выплатам с учетом статусов и агента

window.TEMPLATE_DEPOSITS_WITHDRAWALS = {
    id: 'deposits_withdrawals',
    name: 'Пополнения и выводы',
    description: 'Создает отчет по депозитам и выплатам с учетом статусов и агента',
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

        // Формируем результат
        const result = {
            "T1": [
                ["Кол-во заявок", "Успешных"],
                [totalDepositRequests, successfulDepositRequests]
            ],
            "T1.1": [["Тип платежной системы", "Всего заявок", "Успешные"]],
            "T2": [["Метод", "Название Субагента и номер", "Всего заявок", "Успешных"]],
            "T1.2": [
                ["Кол-во заявок", "Успешных"],
                [totalWithdrawalRequests, successfulWithdrawalRequests]
            ],
            "T1.3": [["Тип платежной системы", "Всего заявок", "Успешные"]],
            "T2.1": [["Метод", "Название Субагента и номер", "Всего заявок", "Успешных"]],
            "T5": [
                ["Сумма успешных депозитов в USD", depositsSum.toFixed(2).replace('.', ',')],
                ["Комиссия за депозиты", depositsCommission.toFixed(2).replace('.', ',')],
                ["Сумма успешных выплат в USD", withdrawalsSum.toFixed(2).replace('.', ',')],
                ["Комиссия за выплаты", withdrawalsCommission.toFixed(2).replace('.', ',')],
                ["", ""],
                ["Сумма успешных депозитов BT в USD", btDepositsSum.toFixed(2).replace('.', ',')],
                ["Комиссия за депозиты BT", btDepositsCommission.toFixed(2).replace('.', ',')],
                ["Сумма успешных выплат BT в USD", btWithdrawalsSum.toFixed(2).replace('.', ',')],
                ["Комиссия за выплаты BT", btWithdrawalsCommission.toFixed(2).replace('.', ',')]
            ],
            "К": [["Агент", "Бренд", "Всего транзакций", "Успешных (OK)"]]
        };

        // Добавляем статистику по платежным системам для депозитов
        Object.entries(paymentSystemStats1).sort((a, b) => b[1].total - a[1].total)
            .forEach(([system, stats]) => {
                result["T1.1"].push([system, stats.total, stats.successful]);
            });

        // Добавляем статистику по субагентам для депозитов
        Object.keys(subAgentGroups1).sort().forEach(group => {
            result["T2"].push([group, "", "", ""]);
            Object.keys(subAgentGroups1[group]).sort().forEach(subAgent => {
                const stats = subAgentGroups1[group][subAgent];
                result["T2"].push(["", subAgent, stats.total, stats.successful]);
            });
            result["T2"].push(["", "", "", ""]);
        });

        // Добавляем статистику по платежным системам для выводов
        Object.entries(paymentSystemStats2).sort((a, b) => b[1].total - a[1].total)
            .forEach(([system, stats]) => {
                result["T1.3"].push([system, stats.total, stats.successful]);
            });

        // Добавляем статистику по субагентам для выводов
        Object.keys(subAgentGroups2).sort().forEach(group => {
            result["T2.1"].push([group, "", "", ""]);
            Object.keys(subAgentGroups2[group]).sort().forEach(subAgent => {
                const stats = subAgentGroups2[group][subAgent];
                result["T2.1"].push(["", subAgent, stats.total, stats.successful]);
            });
            result["T2.1"].push(["", "", "", ""]);
        });

        // Формируем данные для листа "К"
        // Сортируем агентов по общему количеству транзакций (от большего к меньшему)
        const sortedAgents = Object.keys(cardPaymentsStats).sort((a, b) => {
            const totalA = Object.values(cardPaymentsStats[a]).reduce((sum, stats) => sum + stats.total, 0);
            const totalB = Object.values(cardPaymentsStats[b]).reduce((sum, stats) => sum + stats.total, 0);
            return totalB - totalA;
        });
        
        sortedAgents.forEach(agent => {
            // Сортируем бренды по количеству транзакций (от большего к меньшему)
            const sortedBrands = Object.keys(cardPaymentsStats[agent]).sort((a, b) => {
                return cardPaymentsStats[agent][b].total - cardPaymentsStats[agent][a].total;
            });
            
            sortedBrands.forEach(brand => {
                const stats = cardPaymentsStats[agent][brand];
                result["К"].push([agent, brand, stats.total, stats.successful]);
            });
        });

        return result;
    }
};