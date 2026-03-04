import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Загружает TrafficParsers через new Function, имитируя браузерное окружение.
 * TrafficParsers ссылается на два глобала: XLSX и TrafficState.
 * Мы передаём их как параметры функции, изолируя каждый тест.
 */
function loadTrafficParsers(overrides = {}) {
    const mocks = {
        XLSX: {
            read: vi.fn(),
            utils: { sheet_to_json: vi.fn() }
        },
        TrafficState: {
            ourPartnerIds: []
        },
        FileReader: vi.fn(),
        console: console,
        ...overrides
    };

    const code = readFileSync(
        resolve(__dirname, '../../traffic-calculation/js/modules/traffic-parsers.js'),
        'utf-8'
    );

    const fn = new Function(
        ...Object.keys(mocks),
        `${code}\nreturn TrafficParsers;`
    );

    const TrafficParsers = fn(...Object.values(mocks));
    return { TrafficParsers, mocks };
}

// ─────────────────────────────────────────────
// parseDepositsData — Happy path
// ─────────────────────────────────────────────
describe('TrafficParsers.parseDepositsData()', () => {
    it('should count back comment for matching subagent ID', () => {
        const { TrafficParsers } = loadTrafficParsers();

        const data = [
            ['ID', 'Субагент ID', 'Сумма', 'Доп. параметры №1'],
            ['1', '12345', '100', '{"PaymentsComment": "back"}']
        ];
        const commentsData = {};

        TrafficParsers.parseDepositsData(data, commentsData);

        expect(commentsData['12345']).toBeDefined();
        expect(commentsData['12345'].back).toBe(1);
        expect(commentsData['12345'].cringe).toBe(0);
    });

    it('should count cringe comment for matching subagent ID', () => {
        const { TrafficParsers } = loadTrafficParsers();

        const data = [
            ['ID', 'Субагент ID', 'Сумма', 'Доп. параметры №1'],
            ['2', '99999', '200', '{"PaymentsComment": "cringe"}']
        ];
        const commentsData = {};

        TrafficParsers.parseDepositsData(data, commentsData);

        expect(commentsData['99999'].back).toBe(0);
        expect(commentsData['99999'].cringe).toBe(1);
    });

    it('should accumulate counts across multiple rows for same subagent', () => {
        const { TrafficParsers } = loadTrafficParsers();

        const data = [
            ['Субагент ID', 'Доп. параметры №1'],
            ['11111', '{"PaymentsComment": "back"}'],
            ['11111', '{"PaymentsComment": "back"}'],
            ['11111', '{"PaymentsComment": "cringe"}']
        ];
        const commentsData = {};

        TrafficParsers.parseDepositsData(data, commentsData);

        expect(commentsData['11111'].back).toBe(2);
        expect(commentsData['11111'].cringe).toBe(1);
    });

    it('should accumulate counts for multiple different subagent IDs', () => {
        const { TrafficParsers } = loadTrafficParsers();

        const data = [
            ['Субагент ID', 'Доп. параметры №1'],
            ['AAA', '{"PaymentsComment": "back"}'],
            ['BBB', '{"PaymentsComment": "cringe"}'],
            ['AAA', '{"PaymentsComment": "cringe"}']
        ];
        const commentsData = {};

        TrafficParsers.parseDepositsData(data, commentsData);

        expect(commentsData['AAA'].back).toBe(1);
        expect(commentsData['AAA'].cringe).toBe(1);
        expect(commentsData['BBB'].back).toBe(0);
        expect(commentsData['BBB'].cringe).toBe(1);
    });

    it('should not count rows with other PaymentsComment values', () => {
        const { TrafficParsers } = loadTrafficParsers();

        const data = [
            ['Субагент ID', 'Доп. параметры №1'],
            ['55555', '{"PaymentsComment": "ok"}'],
            ['55555', '{"PaymentsComment": "unknown"}'],
            ['55555', '{}']
        ];
        const commentsData = {};

        TrafficParsers.parseDepositsData(data, commentsData);

        // ID должен быть инициализирован (строки не пустые)
        expect(commentsData['55555'].back).toBe(0);
        expect(commentsData['55555'].cringe).toBe(0);
    });

    it('should find subagent column by case-insensitive keyword match', () => {
        const { TrafficParsers } = loadTrafficParsers();

        // Заголовок с иным регистром: "СУБАГЕНТ ID"
        const data = [
            ['СУБАГЕНТ ID', 'ДОП. ПАРАМЕТРЫ №1'],
            ['77777', '{"PaymentsComment": "back"}']
        ];
        const commentsData = {};

        TrafficParsers.parseDepositsData(data, commentsData);

        expect(commentsData['77777']).toBeDefined();
        expect(commentsData['77777'].back).toBe(1);
    });

    it('should merge into existing commentsData without overwriting prior counts', () => {
        const { TrafficParsers } = loadTrafficParsers();

        const data = [
            ['Субагент ID', 'Доп. параметры №1'],
            ['33333', '{"PaymentsComment": "back"}']
        ];
        // Предзаполненный объект
        const commentsData = { '33333': { back: 5, cringe: 2 } };

        TrafficParsers.parseDepositsData(data, commentsData);

        // back = 5 + 1 = 6, cringe не меняется
        expect(commentsData['33333'].back).toBe(6);
        expect(commentsData['33333'].cringe).toBe(2);
    });

    // ─── Edge cases ───────────────────────────────────────────
    it('should return early when data is null', () => {
        const { TrafficParsers } = loadTrafficParsers();
        const commentsData = {};
        expect(() => TrafficParsers.parseDepositsData(null, commentsData)).not.toThrow();
        expect(Object.keys(commentsData)).toHaveLength(0);
    });

    it('should return early when data is undefined', () => {
        const { TrafficParsers } = loadTrafficParsers();
        const commentsData = {};
        expect(() => TrafficParsers.parseDepositsData(undefined, commentsData)).not.toThrow();
        expect(Object.keys(commentsData)).toHaveLength(0);
    });

    it('should return early when data has only header row (length < 2)', () => {
        const { TrafficParsers } = loadTrafficParsers();
        const commentsData = {};
        TrafficParsers.parseDepositsData([['Субагент ID', 'Доп. параметры №1']], commentsData);
        expect(Object.keys(commentsData)).toHaveLength(0);
    });

    it('should return early when data is empty array', () => {
        const { TrafficParsers } = loadTrafficParsers();
        const commentsData = {};
        TrafficParsers.parseDepositsData([], commentsData);
        expect(Object.keys(commentsData)).toHaveLength(0);
    });

    it('should return early when subagent column is missing', () => {
        const { TrafficParsers } = loadTrafficParsers();

        const data = [
            ['ID', 'Сумма', 'Доп. параметры №1'],
            ['1', '100', '{"PaymentsComment": "back"}']
        ];
        const commentsData = {};

        TrafficParsers.parseDepositsData(data, commentsData);

        expect(Object.keys(commentsData)).toHaveLength(0);
    });

    it('should return early when params column is missing', () => {
        const { TrafficParsers } = loadTrafficParsers();

        const data = [
            ['ID', 'Субагент ID', 'Сумма'],
            ['1', '12345', '100']
        ];
        const commentsData = {};

        TrafficParsers.parseDepositsData(data, commentsData);

        expect(Object.keys(commentsData)).toHaveLength(0);
    });

    it('should skip rows where subagentId is empty', () => {
        const { TrafficParsers } = loadTrafficParsers();

        const data = [
            ['Субагент ID', 'Доп. параметры №1'],
            ['', '{"PaymentsComment": "back"}'],
            [null, '{"PaymentsComment": "back"}']
        ];
        const commentsData = {};

        TrafficParsers.parseDepositsData(data, commentsData);

        expect(Object.keys(commentsData)).toHaveLength(0);
    });

    it('should skip rows where params is empty', () => {
        const { TrafficParsers } = loadTrafficParsers();

        const data = [
            ['Субагент ID', 'Доп. параметры №1'],
            ['12345', ''],
            ['67890', null]
        ];
        const commentsData = {};

        TrafficParsers.parseDepositsData(data, commentsData);

        expect(Object.keys(commentsData)).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────
// countAutoDisables — Happy path
// ─────────────────────────────────────────────
describe('TrafficParsers.countAutoDisables()', () => {
    it('should count an auto-disable for a known partner ID', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['51553'] }
        });

        const excelData = [
            ['id', 'admin', 'subagent', 'date'],
            ['1', 'Aвтоотключалка', 'Jajje kddd 51553', '2024-01-01']
        ];
        const counters = {};

        TrafficParsers.countAutoDisables(excelData, counters);

        expect(counters['51553']).toBe(1);
    });

    it('should increment counter on multiple rows for same partner', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['51553'] }
        });

        const excelData = [
            ['admin', 'subagent'],
            ['Aвтоотключалка', 'Agent 51553'],
            ['Aвтоотключалка', 'Agent 51553'],
            ['Aвтоотключалка', 'Agent 51553']
        ];
        const counters = {};

        TrafficParsers.countAutoDisables(excelData, counters);

        expect(counters['51553']).toBe(3);
    });

    it('should count multiple partner IDs in one subagent string', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['111', '222'] }
        });

        // Строка содержит два ID: 111 и 222
        const excelData = [
            ['admin', 'subagent'],
            ['Aвтоотключалка', 'User 111 and 222']
        ];
        const counters = {};

        TrafficParsers.countAutoDisables(excelData, counters);

        expect(counters['111']).toBe(1);
        expect(counters['222']).toBe(1);
    });

    it('should count only IDs that are in ourPartnerIds', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['999'] }
        });

        const excelData = [
            ['admin', 'subagent'],
            ['Aвтоотключалка', 'Unknown 12345 known 999']
        ];
        const counters = {};

        TrafficParsers.countAutoDisables(excelData, counters);

        expect(counters['999']).toBe(1);
        expect(counters['12345']).toBeUndefined();
    });

    it('should NOT count rows where admin is not "Aвтоотключалка"', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['51553'] }
        });

        const excelData = [
            ['admin', 'subagent'],
            ['Менеджер', 'Agent 51553'],
            ['автоотключалка', 'Agent 51553'],   // строчная а — не совпадает
            ['АВТООТКЛЮЧАЛКА', 'Agent 51553'],   // верхний регистр — не совпадает
            ['Aвтоотключалка ', 'Agent 51553']   // с пробелом в конце — trim спасает
        ];
        const counters = {};

        TrafficParsers.countAutoDisables(excelData, counters);

        // Только строка с пробелом после trim совпадёт (trim происходит в коде)
        expect(counters['51553']).toBe(1);
    });

    it('should detect "Aвтоотключалка" with English capital A (not Russian А)', () => {
        // Это критически важный тест: буква A в начале — английская (U+0041)
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['51553'] }
        });

        const englishA = 'A'; // U+0041 — английская
        const russianA = 'А'; // U+0410 — русская

        const dataWithEnglishA = [
            ['admin', 'subagent'],
            [englishA + 'втоотключалка', 'Agent 51553']
        ];
        const dataWithRussianA = [
            ['admin', 'subagent'],
            [russianA + 'втоотключалка', 'Agent 51553']
        ];

        const countersEnglish = {};
        const countersRussian = {};

        TrafficParsers.countAutoDisables(dataWithEnglishA, countersEnglish);
        TrafficParsers.countAutoDisables(dataWithRussianA, countersRussian);

        // Только английская A должна засчитываться
        expect(countersEnglish['51553']).toBe(1);
        expect(countersRussian['51553']).toBeUndefined();
    });

    it('should skip rows where subagent contains no numbers', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['111'] }
        });

        const excelData = [
            ['admin', 'subagent'],
            ['Aвтоотключалка', 'Agent без номера']
        ];
        const counters = {};

        TrafficParsers.countAutoDisables(excelData, counters);

        expect(Object.keys(counters)).toHaveLength(0);
    });

    it('should work correctly with multiple rows and different IDs', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['100', '200', '300'] }
        });

        const excelData = [
            ['admin', 'subagent'],
            ['Aвтоотключалка', 'Partner 100'],
            ['Aвтоотключалка', 'Partner 200'],
            ['OtherAdmin', 'Partner 300'],         // не считается
            ['Aвтоотключалка', 'Partner 100']      // повторно для 100
        ];
        const counters = {};

        TrafficParsers.countAutoDisables(excelData, counters);

        expect(counters['100']).toBe(2);
        expect(counters['200']).toBe(1);
        expect(counters['300']).toBeUndefined();
    });

    // ─── Edge cases ───────────────────────────────────────────
    it('should return early when excelData is null', () => {
        const { TrafficParsers } = loadTrafficParsers();
        const counters = {};
        expect(() => TrafficParsers.countAutoDisables(null, counters)).not.toThrow();
        expect(Object.keys(counters)).toHaveLength(0);
    });

    it('should return early when excelData has only header row', () => {
        const { TrafficParsers } = loadTrafficParsers();
        const counters = {};
        TrafficParsers.countAutoDisables([['admin', 'subagent']], counters);
        expect(Object.keys(counters)).toHaveLength(0);
    });

    it('should return early when excelData is empty', () => {
        const { TrafficParsers } = loadTrafficParsers();
        const counters = {};
        TrafficParsers.countAutoDisables([], counters);
        expect(Object.keys(counters)).toHaveLength(0);
    });

    it('should return early when admin column is missing', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['51553'] }
        });

        const excelData = [
            ['id', 'subagent'],   // нет колонки admin
            ['1', 'Agent 51553']
        ];
        const counters = {};

        TrafficParsers.countAutoDisables(excelData, counters);

        expect(Object.keys(counters)).toHaveLength(0);
    });

    it('should return early when subagent column is missing', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['51553'] }
        });

        const excelData = [
            ['id', 'admin'],     // нет колонки subagent
            ['1', 'Aвтоотключалка']
        ];
        const counters = {};

        TrafficParsers.countAutoDisables(excelData, counters);

        expect(Object.keys(counters)).toHaveLength(0);
    });

    it('should skip rows where admin value is empty', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['51553'] }
        });

        const excelData = [
            ['admin', 'subagent'],
            ['', 'Agent 51553'],
            [null, 'Agent 51553']
        ];
        const counters = {};

        TrafficParsers.countAutoDisables(excelData, counters);

        expect(Object.keys(counters)).toHaveLength(0);
    });

    it('should skip rows where subagent value is empty', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['51553'] }
        });

        const excelData = [
            ['admin', 'subagent'],
            ['Aвтоотключалка', ''],
            ['Aвтоотключалка', null]
        ];
        const counters = {};

        TrafficParsers.countAutoDisables(excelData, counters);

        expect(Object.keys(counters)).toHaveLength(0);
    });

    it('should not count IDs not in ourPartnerIds even if regex matches', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: [] } // пустой список
        });

        const excelData = [
            ['admin', 'subagent'],
            ['Aвтоотключалка', 'Agent 51553']
        ];
        const counters = {};

        TrafficParsers.countAutoDisables(excelData, counters);

        expect(Object.keys(counters)).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────
// parseQualityControlData — Happy path
// ─────────────────────────────────────────────
describe('TrafficParsers.parseQualityControlData()', () => {
    // Полный набор заголовков
    const FULL_HEADERS = [
        'Субагент ID',
        'Общее количество созданных транзакций на депозиты',
        'Общее количество созданных транзакций на вывод',
        'Общее количество обращений по депозитам',
        'Количество обращений, обработанных с задержкой (15 минут+)',
        'Процент транзакций в статусе успех по депозитам',
        'Процент транзакций в статусе успех по выводам'
    ];

    it('should parse all 6 data columns for a known partner ID', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['42'] }
        });

        const excelData = [
            FULL_HEADERS,
            ['42', '150', '80', '10', '3', '0.95', '0.87']
        ];
        const qualityData = {};

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        expect(qualityData['42']).toBeDefined();
        expect(qualityData['42'].depositTransactionsCount).toBe(150);
        expect(qualityData['42'].withdrawalTransactionsCount).toBe(80);
        expect(qualityData['42'].depositAppealsCount).toBe(10);
        expect(qualityData['42'].delayedAppealsCount).toBe(3);
    });

    it('should convert deposit success percent from 0.95 to 95', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['10'] }
        });

        const excelData = [
            FULL_HEADERS,
            ['10', '100', '50', '5', '1', '0.95', '0.89']
        ];
        const qualityData = {};

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        expect(qualityData['10'].depositSuccessPercent).toBe(95);
    });

    it('should convert withdrawal success percent from 0.89 to 89', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['10'] }
        });

        const excelData = [
            FULL_HEADERS,
            ['10', '100', '50', '5', '1', '0.95', '0.89']
        ];
        const qualityData = {};

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        expect(qualityData['10'].withdrawalSuccessPercent).toBe(89);
    });

    it('should round percent with Math.round: 0.895 -> 90 (or 89 depending on float precision)', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['77'] }
        });

        const excelData = [
            FULL_HEADERS,
            ['77', '0', '0', '0', '0', '0.895', '0.0']
        ];
        const qualityData = {};

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        // Math.round(0.895 * 100) = Math.round(89.5) = 90 in most cases
        // Допускаем 89 или 90 из-за float precision
        expect(qualityData['77'].depositSuccessPercent).toBeGreaterThanOrEqual(89);
        expect(qualityData['77'].depositSuccessPercent).toBeLessThanOrEqual(90);
    });

    it('should convert percent 1.0 -> 100', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['55'] }
        });

        const excelData = [
            FULL_HEADERS,
            ['55', '0', '0', '0', '0', '1.0', '1.0']
        ];
        const qualityData = {};

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        expect(qualityData['55'].depositSuccessPercent).toBe(100);
        expect(qualityData['55'].withdrawalSuccessPercent).toBe(100);
    });

    it('should convert percent 0.0 -> 0', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['44'] }
        });

        const excelData = [
            FULL_HEADERS,
            ['44', '0', '0', '0', '0', '0.0', '0.0']
        ];
        const qualityData = {};

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        expect(qualityData['44'].depositSuccessPercent).toBe(0);
        expect(qualityData['44'].withdrawalSuccessPercent).toBe(0);
    });

    it('should skip rows where subagent ID is not in ourPartnerIds', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['100'] }
        });

        const excelData = [
            FULL_HEADERS,
            ['999', '150', '80', '10', '3', '0.95', '0.87']   // 999 — не в списке
        ];
        const qualityData = {};

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        expect(qualityData['999']).toBeUndefined();
    });

    it('should process multiple rows and filter by ourPartnerIds', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['1', '3'] }
        });

        const excelData = [
            FULL_HEADERS,
            ['1', '10', '5', '2', '1', '0.8', '0.7'],
            ['2', '20', '10', '4', '2', '0.9', '0.85'],   // не наш
            ['3', '30', '15', '6', '3', '0.95', '0.88']
        ];
        const qualityData = {};

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        expect(qualityData['1']).toBeDefined();
        expect(qualityData['2']).toBeUndefined();
        expect(qualityData['3']).toBeDefined();
        expect(qualityData['3'].depositTransactionsCount).toBe(30);
    });

    it('should accept "id cубагента" variant for subagent ID column header', () => {
        // В коде проверяется toLowerCase() === 'id cубагента' (с английской c!)
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['88'] }
        });

        const headers = [
            'ID cубагента',   // вариант с английской c
            'Общее количество созданных транзакций на депозиты',
            'Общее количество созданных транзакций на вывод',
            'Общее количество обращений по депозитам',
            'Количество обращений, обработанных с задержкой (15 минут+)',
            'Процент транзакций в статусе успех по депозитам',
            'Процент транзакций в статусе успех по выводам'
        ];

        const excelData = [
            headers,
            ['88', '50', '25', '5', '1', '0.9', '0.85']
        ];
        const qualityData = {};

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        expect(qualityData['88']).toBeDefined();
        expect(qualityData['88'].depositTransactionsCount).toBe(50);
    });

    it('should accept "субагент id" variant for subagent column (keyword include)', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['99'] }
        });

        const headers = [
            'Субагент ID',   // стандартный вариант
            'Общее количество созданных транзакций на депозиты',
            'Общее количество созданных транзакций на вывод',
            'Общее количество обращений по депозитам',
            'Количество обращений, обработанных с задержкой (15 минут+)',
            'Процент транзакций в статусе успех по депозитам',
            'Процент транзакций в статусе успех по выводам'
        ];

        const excelData = [
            headers,
            ['99', '70', '35', '7', '2', '0.91', '0.82']
        ];
        const qualityData = {};

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        expect(qualityData['99']).toBeDefined();
    });

    it('should default missing optional columns to 0', () => {
        // Заголовки только с ID, без данных по колонкам транзакций
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['33'] }
        });

        const excelData = [
            ['Субагент ID'],  // только ID, все остальные колонки отсутствуют
            ['33']
        ];
        const qualityData = {};

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        expect(qualityData['33']).toBeDefined();
        expect(qualityData['33'].depositTransactionsCount).toBe(0);
        expect(qualityData['33'].withdrawalTransactionsCount).toBe(0);
        expect(qualityData['33'].depositAppealsCount).toBe(0);
        expect(qualityData['33'].delayedAppealsCount).toBe(0);
        expect(qualityData['33'].depositSuccessPercent).toBe(0);
        expect(qualityData['33'].withdrawalSuccessPercent).toBe(0);
    });

    it('should parse integer-like strings for transaction counts', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['22'] }
        });

        const excelData = [
            FULL_HEADERS,
            ['22', '1000', '500', '25', '5', '0.75', '0.6']
        ];
        const qualityData = {};

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        expect(qualityData['22'].depositTransactionsCount).toBe(1000);
        expect(qualityData['22'].withdrawalTransactionsCount).toBe(500);
    });

    it('should handle non-numeric string in count column as 0', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['66'] }
        });

        const excelData = [
            FULL_HEADERS,
            ['66', 'N/A', 'err', 'none', '', '0.5', '0.5']
        ];
        const qualityData = {};

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        expect(qualityData['66'].depositTransactionsCount).toBe(0);
        expect(qualityData['66'].withdrawalTransactionsCount).toBe(0);
        expect(qualityData['66'].depositAppealsCount).toBe(0);
        expect(qualityData['66'].delayedAppealsCount).toBe(0);
    });

    // ─── Edge cases ───────────────────────────────────────────
    it('should return early when excelData is null', () => {
        const { TrafficParsers } = loadTrafficParsers();
        const qualityData = {};
        expect(() => TrafficParsers.parseQualityControlData(null, qualityData)).not.toThrow();
        expect(Object.keys(qualityData)).toHaveLength(0);
    });

    it('should return early when excelData has only header row', () => {
        const { TrafficParsers } = loadTrafficParsers();
        const qualityData = {};
        TrafficParsers.parseQualityControlData([FULL_HEADERS], qualityData);
        expect(Object.keys(qualityData)).toHaveLength(0);
    });

    it('should return early when excelData is empty array', () => {
        const { TrafficParsers } = loadTrafficParsers();
        const qualityData = {};
        TrafficParsers.parseQualityControlData([], qualityData);
        expect(Object.keys(qualityData)).toHaveLength(0);
    });

    it('should return early when subagent ID column is not found', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['42'] }
        });

        const excelData = [
            ['Нет_нужной_колонки', 'Общее количество созданных транзакций на депозиты'],
            ['42', '100']
        ];
        const qualityData = {};

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        expect(Object.keys(qualityData)).toHaveLength(0);
    });

    it('should skip rows where subagentIdValue is empty', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['42'] }
        });

        const excelData = [
            FULL_HEADERS,
            ['', '150', '80', '10', '3', '0.95', '0.87'],
            [null, '150', '80', '10', '3', '0.95', '0.87']
        ];
        const qualityData = {};

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        expect(Object.keys(qualityData)).toHaveLength(0);
    });

    it('should not mutate existing qualityData entries for unrelated IDs', () => {
        const { TrafficParsers } = loadTrafficParsers({
            TrafficState: { ourPartnerIds: ['1', '2'] }
        });

        const excelData = [
            FULL_HEADERS,
            ['1', '10', '5', '1', '0', '0.9', '0.8']
        ];
        const qualityData = { '2': { depositTransactionsCount: 999 } };

        TrafficParsers.parseQualityControlData(excelData, qualityData);

        // ID=2 не был в excelData, должен остаться нетронутым
        expect(qualityData['2'].depositTransactionsCount).toBe(999);
        // ID=1 должен быть добавлен
        expect(qualityData['1']).toBeDefined();
    });
});
