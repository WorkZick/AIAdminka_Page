// Шаблон: Аналитика Т9
// Анализ продуктов по типам (TOP-5 + Другие)

window.TEMPLATE_ANALYTICS_T9 = {
    id: 'analytics-t9',
    name: 'Аналитика Т9',
    description: 'Листы: T9',
    filesConfig: {
        step1: { name: 'Файл с данными', multiple: false }
    },
    handler: (inputData) => {
        const data = Array.isArray(inputData) ? inputData : inputData[0];

        if (!data || data.length === 0) {
            throw new Error('Файл не содержит данных');
        }

        // Заголовки для поиска колонок
        const HEADERS_MAP = {
            product: ['Продукт'],
            productType: ['Тип продукта'],
            usersCount: ['Кол-во пользователей'],
            operationsCount: ['Кол-во операций']
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
            product: findColumn(headers, HEADERS_MAP.product),
            productType: findColumn(headers, HEADERS_MAP.productType),
            usersCount: findColumn(headers, HEADERS_MAP.usersCount),
            operationsCount: findColumn(headers, HEADERS_MAP.operationsCount)
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

        // Типы продуктов для анализа
        const productTypes = ['Slot', '1xGames', 'Live Casino'];

        // Собираем данные по типам продуктов
        const groupedData = {};
        let otherTypesUsers = 0;
        let otherTypesOperations = 0;

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const productType = (row[cols.productType] || '').toString().trim();
            const product = (row[cols.product] || '').toString().trim();
            const usersCount = parseFloat(row[cols.usersCount]) || 0;
            const operationsCount = parseFloat(row[cols.operationsCount]) || 0;

            if (productTypes.includes(productType)) {
                if (product === '') continue; // Пропускаем пустые продукты только для основных типов
                if (!groupedData[productType]) {
                    groupedData[productType] = {};
                }
                if (!groupedData[productType][product]) {
                    groupedData[productType][product] = { users: 0, operations: 0 };
                }
                groupedData[productType][product].users += usersCount;
                groupedData[productType][product].operations += operationsCount;
            } else {
                // Все остальные типы продуктов (любые записи не из Slot/1xGames/Live Casino)
                otherTypesUsers += usersCount;
                otherTypesOperations += operationsCount;
            }
        }

        // Функция для получения TOP-5 + Другие
        const getTop5WithOthers = (typeData) => {
            if (!typeData) return { top5: [], others: { users: 0, operations: 0 }, total: { users: 0, operations: 0 } };

            const sorted = Object.entries(typeData)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.operations - a.operations);

            const top5 = sorted.slice(0, 5);
            const rest = sorted.slice(5);

            const others = rest.reduce((acc, item) => ({
                users: acc.users + item.users,
                operations: acc.operations + item.operations
            }), { users: 0, operations: 0 });

            const total = sorted.reduce((acc, item) => ({
                users: acc.users + item.users,
                operations: acc.operations + item.operations
            }), { users: 0, operations: 0 });

            return { top5, others, total };
        };

        // Инициализация результата
        const result = {
            _useExcelJS: true,
            sheets: {
                'T9': {
                    columns: [
                        { width: 10.71 },  // A - Тип продукта
                        { width: 20.71 },  // B - Продукт
                        { width: 10.71 },  // C - Количество пользователей
                        { width: 10.71 },  // D - Количество операций
                        { width: 10.71 },  // E - Всего по типу продукта
                        { width: 10.71 },  // F - Всего количество операций
                        { width: 1.71 }    // G - разделитель
                    ],
                    data: [],
                    merges: [],
                    styles: [],
                    rowHeights: { '2': 40 }
                }
            }
        };

        const sheet = result.sheets['T9'];

        // Заголовок "Месяц" (строка 1)
        sheet.data.push(['Месяц', null, null, null, null, null, null]);
        sheet.merges.push('A1:F1');
        sheet.styles.push({ cell: 'A1', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle' } });
        sheet.styles.push({ cell: 'G1', ...separatorStyle });

        // Заголовки столбцов (строка 2)
        sheet.data.push([
            'Тип продукта',
            'Продукт',
            'Количество пользователей',
            'Количество операций',
            'Всего по типу продукта',
            'Всего количество операций',
            null
        ]);
        // Стили для заголовков (A, B без переноса, C-F с переносом)
        sheet.styles.push({ cell: 'A2', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle' } });
        sheet.styles.push({ cell: 'B2', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle' } });
        sheet.styles.push({ cell: 'C2', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
        sheet.styles.push({ cell: 'D2', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
        sheet.styles.push({ cell: 'E2', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
        sheet.styles.push({ cell: 'F2', ...headerStyle, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
        sheet.styles.push({ cell: 'G2', ...separatorStyle });

        let currentRow = 3;
        let grandTotalUsers = 0;
        let grandTotalOperations = 0;

        // Обрабатываем каждый тип продукта
        productTypes.forEach(typeName => {
            const { top5, others, total } = getTop5WithOthers(groupedData[typeName]);

            if (top5.length === 0 && others.users === 0 && others.operations === 0) return;

            const startRow = currentRow;

            // TOP-5 продуктов
            top5.forEach((item, index) => {
                sheet.data.push([
                    index === 0 ? typeName : null,
                    item.name,
                    item.users,
                    item.operations,
                    index === 0 ? total.users : null,
                    index === 0 ? total.operations : null,
                    null
                ]);

                // Стили для строки
                for (let col = 0; col < 6; col++) {
                    const colLetter = String.fromCharCode(65 + col);
                    const alignment = col < 2 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
                    sheet.styles.push({ cell: `${colLetter}${currentRow}`, ...dataStyle, alignment });
                }
                sheet.styles.push({ cell: `G${currentRow}`, ...separatorStyle });

                currentRow++;
            });

            // Строка "Другие" (если есть)
            if (others.users > 0 || others.operations > 0) {
                sheet.data.push([
                    top5.length === 0 ? typeName : null,
                    'Другие',
                    others.users,
                    others.operations,
                    top5.length === 0 ? total.users : null,
                    top5.length === 0 ? total.operations : null,
                    null
                ]);

                for (let col = 0; col < 6; col++) {
                    const colLetter = String.fromCharCode(65 + col);
                    const alignment = col < 2 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
                    sheet.styles.push({ cell: `${colLetter}${currentRow}`, ...dataStyle, alignment });
                }
                sheet.styles.push({ cell: `G${currentRow}`, ...separatorStyle });

                currentRow++;
            }

            const endRow = currentRow - 1;

            // Объединяем ячейки для типа продукта и итогов
            if (endRow > startRow) {
                sheet.merges.push(`A${startRow}:A${endRow}`);
                sheet.merges.push(`E${startRow}:E${endRow}`);
                sheet.merges.push(`F${startRow}:F${endRow}`);
            }

            grandTotalUsers += total.users;
            grandTotalOperations += total.operations;
        });

        // Строка "Остальные типы продуктов"
        if (otherTypesUsers > 0 || otherTypesOperations > 0) {
            sheet.data.push([
                'Остальные типы продуктов',
                null,
                otherTypesUsers,
                otherTypesOperations,
                otherTypesUsers,
                otherTypesOperations,
                null
            ]);

            sheet.merges.push(`A${currentRow}:B${currentRow}`);
            for (let col = 0; col < 6; col++) {
                const colLetter = String.fromCharCode(65 + col);
                sheet.styles.push({ cell: `${colLetter}${currentRow}`, ...dataStyle, alignment: { horizontal: col < 2 ? 'left' : 'center', vertical: 'middle' } });
            }
            sheet.styles.push({ cell: `G${currentRow}`, ...separatorStyle });

            grandTotalUsers += otherTypesUsers;
            grandTotalOperations += otherTypesOperations;
            currentRow++;
        }

        // Строка "Всего по ГЕО"
        sheet.data.push([
            'Всего по ГЕО',
            null,
            grandTotalUsers,
            grandTotalOperations,
            grandTotalUsers,
            grandTotalOperations,
            null
        ]);

        sheet.merges.push(`A${currentRow}:B${currentRow}`);
        for (let col = 0; col < 6; col++) {
            const colLetter = String.fromCharCode(65 + col);
            sheet.styles.push({ cell: `${colLetter}${currentRow}`, ...headerStyle, alignment: { horizontal: col < 2 ? 'left' : 'center', vertical: 'middle' } });
        }
        sheet.styles.push({ cell: `G${currentRow}`, ...separatorStyle });

        // Объединяем разделитель
        sheet.merges.push(`G1:G${currentRow}`);

        return result;
    }
};
