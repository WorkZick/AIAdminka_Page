// Шаблон: Регистрации
// Создает отчеты по регистрациям (ТОЛЬКО по заголовкам, БЕЗ привязки к колонкам)

window.TEMPLATE_REGISTRATIONS = {
    id: 'registrations',
    name: 'Регистрации',
    description: 'Создает отчеты по регистрациям (ТОЛЬКО по заголовкам, БЕЗ привязки к колонкам)',
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

        // Инициализация результатов (БЕЗ УПОМИНАНИЯ КОЛОНОК!)
        const result = {
            'T3.1': [['Наименование', 'Значение']],
            'T3.2': [['Тип трафика', 'Всего регистраций', 'С первым депозитом', 'С быстрым депозитом', 'Игроки с депозитом', 'Все депозиты', 'Все ставки']],
            'T6': [['Тип регистрации', 'Всего регистраций', 'С первым депозитом', 'С быстрым депозитом', 'Игроки с депозитом', 'Все депозиты', 'Все ставки']],
            'T7': [['Показатель', 'Android', 'iOS', 'WinClient', 'Web (новый дизайн)', 'Моб. версия сайта v3', 'Моб. версия сайта (новый дизайн)', 'Web v3']]
        };

        // ===== ЧАСТЬ 1: ПОИСК "ИТОГО" =====
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            
            const monthValue = (row[cols.month] || '').toString().trim();
            if (monthValue.toLowerCase().includes('итого') || monthValue.toLowerCase().includes('total')) {
                result['T3.1'].push(['Всего регистраций', getNumber(row[cols.totalRegistrations])]);
                result['T3.1'].push(['С первым депозитом', getNumber(row[cols.firstDeposit])]);
                result['T3.1'].push(['С быстрым депозитом', getNumber(row[cols.fastDeposit])]);
                result['T3.1'].push(['Игроки с депозитом', getNumber(row[cols.playersWithDeposit])]);
                result['T3.1'].push(['Все депозиты', getNumber(row[cols.allDeposits])]);
                result['T3.1'].push(['Все ставки', getNumber(row[cols.allBets])]);
                break;
            }
        }

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

        result['T3.2'].push(['Affilate', 
            trafficSums.affilate.totalReg, 
            trafficSums.affilate.firstDep, 
            trafficSums.affilate.fastDep, 
            trafficSums.affilate.players, 
            trafficSums.affilate.deposits, 
            trafficSums.affilate.bets
        ]);
        result['T3.2'].push(['Organic', 
            trafficSums.organic.totalReg, 
            trafficSums.organic.firstDep, 
            trafficSums.organic.fastDep, 
            trafficSums.organic.players, 
            trafficSums.organic.deposits, 
            trafficSums.organic.bets
        ]);

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

        Object.values(regTypes).forEach(type => {
            result['T6'].push([type.name, type.totalReg, type.firstDep, type.fastDep, type.players, type.deposits, type.bets]);
        });

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

        // Формируем T7 (ПОКАЗАТЕЛИ В СТРОКАХ, УСТРОЙСТВА В КОЛОНКАХ)
        result['T7'].push([
            'Всего регистраций',
            devices.android.totalReg, devices.ios.totalReg, devices.winclient.totalReg,
            devices.webnewdesign.totalReg, devices.mobilev3.totalReg, devices.mobilenewdesign.totalReg, devices.webv3.totalReg
        ]);
        
        result['T7'].push([
            'Количество рег. с первым депозитом',
            devices.android.firstDep, devices.ios.firstDep, devices.winclient.firstDep,
            devices.webnewdesign.firstDep, devices.mobilev3.firstDep, devices.mobilenewdesign.firstDep, devices.webv3.firstDep
        ]);
        
        result['T7'].push([
            'Количество новых рег. с быстрым депозитом',
            devices.android.fastDep, devices.ios.fastDep, devices.winclient.fastDep,
            devices.webnewdesign.fastDep, devices.mobilev3.fastDep, devices.mobilenewdesign.fastDep, devices.webv3.fastDep
        ]);
        
        result['T7'].push([
            'Игроки с регистрацией и первым депозитом',
            devices.android.players, devices.ios.players, devices.winclient.players,
            devices.webnewdesign.players, devices.mobilev3.players, devices.mobilenewdesign.players, devices.webv3.players
        ]);
        
        result['T7'].push([
            'Количество всех депозитов',
            devices.android.deposits, devices.ios.deposits, devices.winclient.deposits,
            devices.webnewdesign.deposits, devices.mobilev3.deposits, devices.mobilenewdesign.deposits, devices.webv3.deposits
        ]);
        
        result['T7'].push([
            'Количество всех ставок',
            devices.android.bets, devices.ios.bets, devices.winclient.bets,
            devices.webnewdesign.bets, devices.mobilev3.bets, devices.mobilenewdesign.bets, devices.webv3.bets
        ]);

        return result;
    }
};
