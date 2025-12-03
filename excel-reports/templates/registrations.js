// Шаблон: Регистрации
// Создает отчеты по регистрациям (ТОЛЬКО по заголовкам, БЕЗ привязки к колонкам)

window.TEMPLATE_REGISTRATIONS = {
    id: 'registrations',
    name: 'Регистрации',
    description: 'Листы: T3.1, T3.2, T6, T7',
    filesConfig: {
        step1: { name: 'Файл регистраций', multiple: false }
    },
    handler: (registrationsData) => {
        const data = Array.isArray(registrationsData) ? registrationsData : registrationsData[0];
        
        if (!data || data.length === 0) {
            throw new Error('Файл регистраций не содержит данных');
        }

        // ПРАВИЛЬНЫЕ ЗАГОЛОВКИ
        const HEADERS_MAP = {
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
        
        // ШАГ 1: НАЙТИ ВСЕ КОЛОНКИ ПО ЗАГОЛОВКАМ
        const cols = {
            month: findColumn(headers, HEADERS_MAP.month),
            registrationType: findColumn(headers, HEADERS_MAP.registrationType),
            trafficSource: findColumn(headers, HEADERS_MAP.trafficSource),
            device: findColumn(headers, HEADERS_MAP.device),
            totalRegistrations: findColumn(headers, HEADERS_MAP.totalRegistrations),
            firstDeposit: findColumn(headers, HEADERS_MAP.firstDeposit),
            fastDeposit: findColumn(headers, HEADERS_MAP.fastDeposit),
            playersWithDeposit: findColumn(headers, HEADERS_MAP.playersWithDeposit),
            allDeposits: findColumn(headers, HEADERS_MAP.allDeposits),
            allBets: findColumn(headers, HEADERS_MAP.allBets)
        };

        // Проверка наличия всех колонок
        for (const [key, value] of Object.entries(cols)) {
            if (value === -1) {
                throw new Error(`Не найдена колонка: ${HEADERS_MAP[key].join(' / ')}`);
            }
        }

        const getNumber = (value) => {
            if (value === null || value === undefined || value === '') return 0;
            const num = parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
            return isNaN(num) ? 0 : num;
        };

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

        // Инициализация результатов с поддержкой ExcelJS
        const result = {
            _useExcelJS: true,
            sheets: {
                'T3.1': {
                    columns: [
                        { width: 35.71 }, // A - Показатель (35 + 0.71)
                        { width: 7.71 },  // B - Значение (7 + 0.71)
                        { width: 1.71 }   // C - разделитель (1 + 0.71)
                    ],
                    data: [],
                    merges: [],
                    styles: []
                },
                'T3.2': {
                    columns: [
                        { width: 50.71 }, // A - Показатель (50 + 0.71)
                        { width: 7.71 },  // B - Значение (7 + 0.71)
                        { width: 1.71 }   // C - разделитель (1 + 0.71)
                    ],
                    data: [],
                    merges: [],
                    styles: []
                },
                'T6': {
                    columns: [
                        { width: 35.71 }, // A - Показатель (35 + 0.71)
                        { width: 7.71 },  // B - OneClick (7 + 0.71)
                        { width: 7.71 },  // C - Phone (7 + 0.71)
                        { width: 7.71 },  // D - Full (7 + 0.71)
                        { width: 7.71 },  // E - Social (7 + 0.71)
                        { width: 1.71 }   // F - разделитель (1 + 0.71)
                    ],
                    data: [],
                    merges: [],
                    styles: []
                },
                'T7': {
                    columns: [
                        { width: 45.71 }, // A - Показатель (45 + 0.71)
                        { width: 7.71 },  // B - Android (7 + 0.71)
                        { width: 7.71 },  // C - iOS (7 + 0.71)
                        { width: 7.71 },  // D - WinClient (7 + 0.71)
                        { width: 7.71 },  // E - Web (новый дизайн) (7 + 0.71)
                        { width: 7.71 },  // F - Моб. Версия сайта v3 (7 + 0.71)
                        { width: 7.71 },  // G - Моб. Версия сайта (новый дизайн) (7 + 0.71)
                        { width: 7.71 },  // H - Web v3 (7 + 0.71)
                        { width: 1.71 }   // I - разделитель (1 + 0.71)
                    ],
                    data: [],
                    merges: [],
                    styles: [],
                    rowHeights: { 3: 70 } // Высота 3-й строки
                }
            }
        };

        // ===== ЧАСТЬ 1: ПОИСК "ИТОГО" и заполнение T3.1 =====
        let t31TotalReg = 0, t31FirstDep = 0, t31FastDep = 0, t31Players = 0, t31Deposits = 0, t31Bets = 0;

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const monthValue = (row[cols.month] || '').toString().trim();
            if (monthValue.toLowerCase().includes('итого') || monthValue.toLowerCase().includes('total')) {
                t31TotalReg = getNumber(row[cols.totalRegistrations]);
                t31FirstDep = getNumber(row[cols.firstDeposit]);
                t31FastDep = getNumber(row[cols.fastDeposit]);
                t31Players = getNumber(row[cols.playersWithDeposit]);
                t31Deposits = getNumber(row[cols.allDeposits]);
                t31Bets = getNumber(row[cols.allBets]);
                break;
            }
        }

        // Расчёт процентов
        const firstDepPercent = t31TotalReg > 0 ? t31FirstDep / t31TotalReg : 0;
        const fastDepPercent = t31TotalReg > 0 ? t31FastDep / t31TotalReg : 0;

        // Заголовки T3.1
        result.sheets['T3.1'].data.push(['Показатель', 'Месяц', null]);
        result.sheets['T3.1'].data.push([null, null, null]);
        result.sheets['T3.1'].merges = ['A1:A2', 'B1:B2', 'C1:C2'];
        result.sheets['T3.1'].styles = [
            { cell: 'A1', ...headerStyle },
            { cell: 'B1', ...headerStyle },
            { cell: 'A2', ...headerStyle },
            { cell: 'B2', ...headerStyle },
            { cell: 'C1', ...separatorStyle }
        ];

        // Данные T3.1
        const t31Data = [
            ['Всего регистраций', t31TotalReg],
            ['Количество регистраций за период, из них с первым депозитом', t31FirstDep],
            ['Процент сделавших первый депозит', firstDepPercent],
            ['Количество новых регистраций с быстрым депозитом', t31FastDep],
            ['Процент сделавших быстрый депозит', fastDepPercent],
            ['Всего игроков с первым депозитом в указанный период', t31Players],
            ['Количество депозитов', t31Deposits],
            ['Количество ставок', t31Bets]
        ];

        let t31CurrentRow = 3;
        const t31DataStart = t31CurrentRow;

        t31Data.forEach((row, idx) => {
            result.sheets['T3.1'].data.push([row[0], row[1], null]);
            result.sheets['T3.1'].styles.push({ cell: `A${t31CurrentRow}`, ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });
            // Проценты форматируем как проценты (индексы 2 и 4)
            if (idx === 2 || idx === 4) {
                result.sheets['T3.1'].styles.push({ cell: `B${t31CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
            } else {
                result.sheets['T3.1'].styles.push({ cell: `B${t31CurrentRow}`, ...dataStyle });
            }
            t31CurrentRow++;
        });

        // Жёлтый разделитель
        result.sheets['T3.1'].merges.push(`C${t31DataStart}:C${t31CurrentRow - 1}`);
        result.sheets['T3.1'].styles.push({ cell: `C${t31DataStart}`, ...separatorStyle });

        // ===== ЧАСТЬ 2: СУММИРОВАНИЕ ПО ИСТОЧНИКУ ТРАФИКА =====
        const trafficSums = {
            affilate: { totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
            organic: { totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 }
        };

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            
            const trafficSource = (row[cols.trafficSource] || '').toString().trim().toLowerCase();
            
            if (trafficSource.includes('affilate') || trafficSource.includes('affiliate')) {
                trafficSums.affilate.totalReg += getNumber(row[cols.totalRegistrations]);
                trafficSums.affilate.firstDep += getNumber(row[cols.firstDeposit]);
                trafficSums.affilate.fastDep += getNumber(row[cols.fastDeposit]);
                trafficSums.affilate.players += getNumber(row[cols.playersWithDeposit]);
                trafficSums.affilate.deposits += getNumber(row[cols.allDeposits]);
                trafficSums.affilate.bets += getNumber(row[cols.allBets]);
            }
            
            if (trafficSource.includes('organic')) {
                trafficSums.organic.totalReg += getNumber(row[cols.totalRegistrations]);
                trafficSums.organic.firstDep += getNumber(row[cols.firstDeposit]);
                trafficSums.organic.fastDep += getNumber(row[cols.fastDeposit]);
                trafficSums.organic.players += getNumber(row[cols.playersWithDeposit]);
                trafficSums.organic.deposits += getNumber(row[cols.allDeposits]);
                trafficSums.organic.bets += getNumber(row[cols.allBets]);
            }
        }

        // Заполнение T3.2 (новый формат: Показатель + Значение + разделитель)
        // Заголовки
        result.sheets['T3.2'].data.push(['Показатель', 'Месяц', null]);
        result.sheets['T3.2'].data.push([null, null, null]);
        result.sheets['T3.2'].merges = ['A1:A2', 'B1:B2', 'C1:C2'];
        result.sheets['T3.2'].styles = [
            { cell: 'A1', ...headerStyle },
            { cell: 'B1', ...headerStyle },
            { cell: 'A2', ...headerStyle },
            { cell: 'B2', ...headerStyle },
            { cell: 'C1', ...separatorStyle }
        ];

        // Расчёт процентов для Affiliate и Organic
        const affiliatePercent = trafficSums.affilate.totalReg > 0 ? trafficSums.affilate.firstDep / trafficSums.affilate.totalReg : 0;
        const organicPercent = trafficSums.organic.totalReg > 0 ? trafficSums.organic.firstDep / trafficSums.organic.totalReg : 0;

        // Данные T3.2
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

        // Жёлтый разделитель для T3.2
        result.sheets['T3.2'].merges.push(`C${t32DataStart}:C${t32CurrentRow - 1}`);
        result.sheets['T3.2'].styles.push({ cell: `C${t32DataStart}`, ...separatorStyle });

        // ===== ЧАСТЬ 3: СУММИРОВАНИЕ ПО ТИПАМ РЕГИСТРАЦИИ =====
        const regTypes = {
            full: { name: 'Full', totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
            oneclick: { name: 'OneClick', totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
            phone: { name: 'Phone', totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
            social: { name: 'SocialNetworks', totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 }
        };

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            
            const regType = (row[cols.registrationType] || '').toString().trim().toLowerCase();
            
            let target = null;
            if (regType.includes('full')) target = regTypes.full;
            else if (regType.includes('oneclick') || regType.includes('oneсlick')) target = regTypes.oneclick;
            else if (regType.includes('phone')) target = regTypes.phone;
            else if (regType.includes('social')) target = regTypes.social;
            
            if (target) {
                target.totalReg += getNumber(row[cols.totalRegistrations]);
                target.firstDep += getNumber(row[cols.firstDeposit]);
                target.fastDep += getNumber(row[cols.fastDeposit]);
                target.players += getNumber(row[cols.playersWithDeposit]);
                target.deposits += getNumber(row[cols.allDeposits]);
                target.bets += getNumber(row[cols.allBets]);
            }
        }

        // Заполнение T6 (показатели в строках, типы регистрации в колонках)
        // Заголовки (3 строки: "Показатель" объединен A1:A3, "Месяц" объединен B1:E2, типы в строке 3)
        result.sheets['T6'].data.push(['Показатель', 'Месяц', null, null, null, null]);
        result.sheets['T6'].data.push([null, null, null, null, null, null]);
        result.sheets['T6'].data.push([null, 'OneClick', 'Phone', 'Full', 'Social', null]);

        result.sheets['T6'].merges = ['A1:A3', 'B1:E2', 'F1:F3'];
        result.sheets['T6'].styles = [
            { cell: 'A1', ...headerStyle },
            { cell: 'B1', ...headerStyle },
            { cell: 'C1', ...headerStyle },
            { cell: 'D1', ...headerStyle },
            { cell: 'E1', ...headerStyle },
            { cell: 'A2', ...headerStyle },
            { cell: 'A3', ...headerStyle },
            { cell: 'B3', ...headerStyle },
            { cell: 'C3', ...headerStyle },
            { cell: 'D3', ...headerStyle },
            { cell: 'E3', ...headerStyle },
            { cell: 'F1', ...separatorStyle }
        ];

        // Расчёт процентов для каждого типа
        const oneClickFirstDepPercent = regTypes.oneclick.totalReg > 0 ? regTypes.oneclick.firstDep / regTypes.oneclick.totalReg : 0;
        const phoneFirstDepPercent = regTypes.phone.totalReg > 0 ? regTypes.phone.firstDep / regTypes.phone.totalReg : 0;
        const fullFirstDepPercent = regTypes.full.totalReg > 0 ? regTypes.full.firstDep / regTypes.full.totalReg : 0;
        const socialFirstDepPercent = regTypes.social.totalReg > 0 ? regTypes.social.firstDep / regTypes.social.totalReg : 0;

        const oneClickFastDepPercent = regTypes.oneclick.totalReg > 0 ? regTypes.oneclick.fastDep / regTypes.oneclick.totalReg : 0;
        const phoneFastDepPercent = regTypes.phone.totalReg > 0 ? regTypes.phone.fastDep / regTypes.phone.totalReg : 0;
        const fullFastDepPercent = regTypes.full.totalReg > 0 ? regTypes.full.fastDep / regTypes.full.totalReg : 0;
        const socialFastDepPercent = regTypes.social.totalReg > 0 ? regTypes.social.fastDep / regTypes.social.totalReg : 0;

        // Данные T6 (показатели в строках)
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

        // Жёлтый разделитель для T6
        result.sheets['T6'].merges.push(`F${t6DataStart}:F${t6CurrentRow - 1}`);
        result.sheets['T6'].styles.push({ cell: `F${t6DataStart}`, ...separatorStyle });

        // ===== ЧАСТЬ 4: СУММИРОВАНИЕ ПО УСТРОЙСТВАМ =====
        const devices = {
            android: { name: 'Android', totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
            ios: { name: 'iOS', totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
            winclient: { name: 'WinClient', totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
            webnewdesign: { name: 'Web (новый дизайн)', totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
            mobilev3: { name: 'Моб. версия сайта v3', totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
            mobilenewdesign: { name: 'Моб. версия сайта (новый дизайн)', totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 },
            webv3: { name: 'Web v3', totalReg: 0, firstDep: 0, fastDep: 0, players: 0, deposits: 0, bets: 0 }
        };

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            
            const deviceName = (row[cols.device] || '').toString().trim().toLowerCase();
            
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
                target.totalReg += getNumber(row[cols.totalRegistrations]);
                target.firstDep += getNumber(row[cols.firstDeposit]);
                target.fastDep += getNumber(row[cols.fastDeposit]);
                target.players += getNumber(row[cols.playersWithDeposit]);
                target.deposits += getNumber(row[cols.allDeposits]);
                target.bets += getNumber(row[cols.allBets]);
            }
        }

        // Заполнение T7 (показатели в строках, устройства в колонках с группировкой)
        // Заголовки (3 строки с группами: Mobile, Other, Web)
        result.sheets['T7'].data.push(['Показатель', 'Месяц', null, null, null, null, null, null, null]);
        result.sheets['T7'].data.push([null, 'Mobile', null, 'Other', 'Web', null, null, null, null]);
        result.sheets['T7'].data.push([null, 'Android', 'iOS', 'WinClient', 'Web (новый дизайн)', 'Моб. Версия сайта v3', 'Моб. Версия сайта (новый дизайн)', 'Web v3', null]);

        result.sheets['T7'].merges = ['A1:A3', 'B1:H1', 'B2:C2', 'E2:H2', 'I1:I3'];
        result.sheets['T7'].styles = [
            { cell: 'A1', ...headerStyle },
            { cell: 'B1', ...headerStyle },
            { cell: 'C1', ...headerStyle },
            { cell: 'D1', ...headerStyle },
            { cell: 'E1', ...headerStyle },
            { cell: 'F1', ...headerStyle },
            { cell: 'G1', ...headerStyle },
            { cell: 'H1', ...headerStyle },
            { cell: 'A2', ...headerStyle },
            { cell: 'B2', ...headerStyle },
            { cell: 'C2', ...headerStyle },
            { cell: 'D2', ...headerStyle },
            { cell: 'E2', ...headerStyle },
            { cell: 'F2', ...headerStyle },
            { cell: 'G2', ...headerStyle },
            { cell: 'H2', ...headerStyle },
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

        // Расчёт процентов для каждого устройства
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
                result.sheets['T7'].styles.push({ cell: `B${t7CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                result.sheets['T7'].styles.push({ cell: `C${t7CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                result.sheets['T7'].styles.push({ cell: `D${t7CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                result.sheets['T7'].styles.push({ cell: `E${t7CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                result.sheets['T7'].styles.push({ cell: `F${t7CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                result.sheets['T7'].styles.push({ cell: `G${t7CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
                result.sheets['T7'].styles.push({ cell: `H${t7CurrentRow}`, ...dataStyle, numFmt: '0.00%' });
            } else {
                result.sheets['T7'].styles.push({ cell: `B${t7CurrentRow}`, ...dataStyle });
                result.sheets['T7'].styles.push({ cell: `C${t7CurrentRow}`, ...dataStyle });
                result.sheets['T7'].styles.push({ cell: `D${t7CurrentRow}`, ...dataStyle });
                result.sheets['T7'].styles.push({ cell: `E${t7CurrentRow}`, ...dataStyle });
                result.sheets['T7'].styles.push({ cell: `F${t7CurrentRow}`, ...dataStyle });
                result.sheets['T7'].styles.push({ cell: `G${t7CurrentRow}`, ...dataStyle });
                result.sheets['T7'].styles.push({ cell: `H${t7CurrentRow}`, ...dataStyle });
            }
            t7CurrentRow++;
        });

        // Жёлтый разделитель для T7
        result.sheets['T7'].merges.push(`I${t7DataStart}:I${t7CurrentRow - 1}`);
        result.sheets['T7'].styles.push({ cell: `I${t7DataStart}`, ...separatorStyle });

        return result;
    }
};
