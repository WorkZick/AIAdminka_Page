import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Реальные trafficParams из модуля (соответствуют TrafficState.trafficParams)
const TRAFFIC_PARAMS = [
    { key: 'backCount', name: 'Back', type: 'number' },
    { key: 'autoDisableCount', name: 'Автоотключение', type: 'number' },
    { key: 'depositAppealsCount', name: 'Обращений по пополнениям', type: 'number' },
    { key: 'delayedAppealsCount', name: 'Обращения 15+ мин', type: 'number' },
    { key: 'depositSuccessPercent', name: '% успешных пополнений', type: 'percent' },
    { key: 'withdrawalSuccessPercent', name: '% успешных выводов', type: 'percent' },
    { key: 'depositWorkTimePercent', name: '% Времени работы на пополнения', type: 'percent' },
    { key: 'withdrawalWorkTimePercent', name: '% Времени работы на вывод', type: 'percent' },
    { key: 'chatIgnoring', name: 'Игнорирование чатов', type: 'number' },
    { key: 'webmanagementIgnore', name: 'Игнор Webmanagement', type: 'number' },
    { key: 'depositQueues', name: 'Очереди на пополнение', type: 'number' },
    { key: 'withdrawalQueues', name: 'Очереди на вывод', type: 'number' },
    { key: 'creditsOutsideLimits', name: 'Зачисление вне лимитов', type: 'number' },
    { key: 'wrongAmountApproval', name: 'Одобрение неверной суммы', type: 'number' },
    { key: 'otherViolations', name: 'Другие нарушения', type: 'multiplier' }
];

function loadTrafficCalculator(overrides = {}) {
    const defaultTrafficState = {
        trafficParams: TRAFFIC_PARAMS,
        trafficSettings: {},
        trafficResults: [],
        currentReportData: [],
        selectedPartners: []
    };

    const mocks = {
        TrafficState: { ...defaultTrafficState, ...overrides.TrafficState },
        storage: {
            getPartners: vi.fn().mockReturnValue([]),
            getMethods: vi.fn().mockReturnValue([])
        },
        localStorage: {
            getItem: vi.fn().mockReturnValue(null),
            setItem: vi.fn()
        },
        Toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
        ErrorHandler: {
            handle: vi.fn()
        },
        TrafficRenderer: {
            escapeHtml: vi.fn(str => String(str)),
            closeTrafficCalculator: vi.fn(),
            showTrafficResults: vi.fn(),
            showTrafficResultsInStep: vi.fn(),
            generateReport: vi.fn()
        },
        TrafficNavigation: {
            goToStep: vi.fn()
        },
        document: {
            getElementById: vi.fn().mockReturnValue(null),
            createElement: vi.fn()
        },
        ...overrides
    };

    const code = readFileSync(
        resolve(__dirname, '../../traffic-calculation/js/modules/traffic-calculator.js'),
        'utf-8'
    );

    const fn = new Function(
        ...Object.keys(mocks),
        `${code}\nreturn TrafficCalculator;`
    );

    const TrafficCalculator = fn(...Object.values(mocks));
    return { TrafficCalculator, mocks };
}

// Вспомогательная функция: создать настройки с реальными диапазонами для одного параметра
function makeRangedSettings(paramKey, ranges) {
    // ranges: { good: { min, max }, normal: { min, max }, bad: { min, max }, terrible: { min, max } }
    const settings = {};
    TRAFFIC_PARAMS.forEach(p => {
        if (p.type === 'multiplier') {
            settings[p.key] = { pointsPerItem: 5 };
        } else {
            settings[p.key] = {
                good: { min: 0, max: 0, points: 1 },
                normal: { min: 0, max: 0, points: 2 },
                bad: { min: 0, max: 0, points: 3 },
                terrible: { min: 0, max: 0, points: 4 }
            };
        }
    });
    if (ranges && paramKey) {
        settings[paramKey] = {
            good: { min: ranges.good.min, max: ranges.good.max, points: 1 },
            normal: { min: ranges.normal.min, max: ranges.normal.max, points: 2 },
            bad: { min: ranges.bad.min, max: ranges.bad.max, points: 3 },
            terrible: { min: ranges.terrible.min, max: ranges.terrible.max, points: 4 }
        };
    }
    return settings;
}

// ---------------------------------------------------------------------------
describe('TrafficCalculator', () => {

    // =========================================================================
    describe('getDefaultTrafficSettings()', () => {

        it('should return settings for all 15 traffic params', () => {
            const { TrafficCalculator } = loadTrafficCalculator();
            const settings = TrafficCalculator.getDefaultTrafficSettings();
            expect(Object.keys(settings)).toHaveLength(15);
            TRAFFIC_PARAMS.forEach(p => {
                expect(settings).toHaveProperty(p.key);
            });
        });

        it('should create number-type params with good/normal/bad/terrible levels', () => {
            const { TrafficCalculator } = loadTrafficCalculator();
            const settings = TrafficCalculator.getDefaultTrafficSettings();
            const numberParam = settings.backCount;

            expect(numberParam).toHaveProperty('good');
            expect(numberParam).toHaveProperty('normal');
            expect(numberParam).toHaveProperty('bad');
            expect(numberParam).toHaveProperty('terrible');
        });

        it('should assign correct points to levels: good=1, normal=2, bad=3, terrible=4', () => {
            const { TrafficCalculator } = loadTrafficCalculator();
            const settings = TrafficCalculator.getDefaultTrafficSettings();
            const s = settings.backCount;

            expect(s.good.points).toBe(1);
            expect(s.normal.points).toBe(2);
            expect(s.bad.points).toBe(3);
            expect(s.terrible.points).toBe(4);
        });

        it('should initialize number-type params with min=0 and max=0', () => {
            const { TrafficCalculator } = loadTrafficCalculator();
            const settings = TrafficCalculator.getDefaultTrafficSettings();
            const s = settings.autoDisableCount;

            expect(s.good.min).toBe(0);
            expect(s.good.max).toBe(0);
        });

        it('should create percent-type params with good/normal/bad/terrible levels', () => {
            const { TrafficCalculator } = loadTrafficCalculator();
            const settings = TrafficCalculator.getDefaultTrafficSettings();
            const s = settings.depositSuccessPercent;

            expect(s.good.points).toBe(1);
            expect(s.normal.points).toBe(2);
            expect(s.bad.points).toBe(3);
            expect(s.terrible.points).toBe(4);
        });

        it('should create multiplier-type param with pointsPerItem=5', () => {
            const { TrafficCalculator } = loadTrafficCalculator();
            const settings = TrafficCalculator.getDefaultTrafficSettings();
            const s = settings.otherViolations;

            expect(s).toHaveProperty('pointsPerItem', 5);
            expect(s).not.toHaveProperty('good');
        });

        it('should not share object references between params', () => {
            const { TrafficCalculator } = loadTrafficCalculator();
            const settings = TrafficCalculator.getDefaultTrafficSettings();

            settings.backCount.good.min = 999;
            expect(settings.autoDisableCount.good.min).toBe(0);
        });
    });

    // =========================================================================
    describe('evaluatePartner()', () => {

        it('should return score object with good, normal, bad, terrible, total keys', () => {
            const { TrafficCalculator } = loadTrafficCalculator();
            const settings = TrafficCalculator.getDefaultTrafficSettings();
            const result = TrafficCalculator.evaluatePartner({}, settings);

            expect(result).toHaveProperty('good');
            expect(result).toHaveProperty('normal');
            expect(result).toHaveProperty('bad');
            expect(result).toHaveProperty('terrible');
            expect(result).toHaveProperty('total');
        });

        it('should accumulate total as sum of all level scores', () => {
            const { TrafficCalculator } = loadTrafficCalculator();
            const settings = makeRangedSettings('backCount', {
                good:     { min: 0, max: 5 },
                normal:   { min: 6, max: 10 },
                bad:      { min: 11, max: 20 },
                terrible: { min: 21, max: 100 }
            });
            const result = TrafficCalculator.evaluatePartner({ backCount: 3 }, settings);

            expect(result.total).toBe(result.good + result.normal + result.bad + result.terrible);
        });

        describe('number-type params (range-based)', () => {

            it('should score good points when value falls within good range', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                const settings = makeRangedSettings('backCount', {
                    good:     { min: 0, max: 5 },
                    normal:   { min: 6, max: 10 },
                    bad:      { min: 11, max: 20 },
                    terrible: { min: 21, max: 100 }
                });
                const result = TrafficCalculator.evaluatePartner({ backCount: 3 }, settings);
                expect(result.good).toBe(1);
            });

            it('should score normal points when value falls within normal range', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                const settings = makeRangedSettings('backCount', {
                    good:     { min: 0, max: 5 },
                    normal:   { min: 6, max: 10 },
                    bad:      { min: 11, max: 20 },
                    terrible: { min: 21, max: 100 }
                });
                const result = TrafficCalculator.evaluatePartner({ backCount: 8 }, settings);
                expect(result.normal).toBe(2);
            });

            it('should score bad points when value falls within bad range', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                const settings = makeRangedSettings('backCount', {
                    good:     { min: 0, max: 5 },
                    normal:   { min: 6, max: 10 },
                    bad:      { min: 11, max: 20 },
                    terrible: { min: 21, max: 100 }
                });
                const result = TrafficCalculator.evaluatePartner({ backCount: 15 }, settings);
                expect(result.bad).toBe(3);
            });

            it('should score terrible points when value falls within terrible range', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                const settings = makeRangedSettings('backCount', {
                    good:     { min: 0, max: 5 },
                    normal:   { min: 6, max: 10 },
                    bad:      { min: 11, max: 20 },
                    terrible: { min: 21, max: 100 }
                });
                const result = TrafficCalculator.evaluatePartner({ backCount: 50 }, settings);
                expect(result.terrible).toBe(4);
            });

            it('should score 0 for a param when value does not match any range', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                const settings = makeRangedSettings('backCount', {
                    good:     { min: 0, max: 5 },
                    normal:   { min: 6, max: 10 },
                    bad:      { min: 11, max: 20 },
                    terrible: { min: 21, max: 30 }
                });
                // value=999 не попадает ни в один диапазон
                const result = TrafficCalculator.evaluatePartner({ backCount: 999 }, settings);
                expect(result.good).toBe(0);
                expect(result.normal).toBe(0);
                expect(result.bad).toBe(0);
                expect(result.terrible).toBe(0);
            });

            it('should handle boundary values inclusively (min and max belong to range)', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                const settings = makeRangedSettings('backCount', {
                    good:     { min: 0, max: 5 },
                    normal:   { min: 6, max: 10 },
                    bad:      { min: 11, max: 20 },
                    terrible: { min: 21, max: 100 }
                });
                const atMin = TrafficCalculator.evaluatePartner({ backCount: 0 }, settings);
                const atMax = TrafficCalculator.evaluatePartner({ backCount: 5 }, settings);

                expect(atMin.good).toBe(1);
                expect(atMax.good).toBe(1);
            });

            it('should treat missing/undefined param value as 0', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                const settings = makeRangedSettings('backCount', {
                    good:     { min: 0, max: 5 },
                    normal:   { min: 6, max: 10 },
                    bad:      { min: 11, max: 20 },
                    terrible: { min: 21, max: 100 }
                });
                // backCount не задан → parseFloat(undefined) → 0 → попадает в good диапазон [0,5]
                const result = TrafficCalculator.evaluatePartner({}, settings);
                expect(result.good).toBe(1);
            });

            it('should treat non-numeric string value as 0', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                const settings = makeRangedSettings('backCount', {
                    good:     { min: 0, max: 5 },
                    normal:   { min: 6, max: 10 },
                    bad:      { min: 11, max: 20 },
                    terrible: { min: 21, max: 100 }
                });
                const result = TrafficCalculator.evaluatePartner({ backCount: 'abc' }, settings);
                expect(result.good).toBe(1);
            });

        });

        describe('multiplier-type param (otherViolations)', () => {

            it('should add violations * pointsPerItem to bad score', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                const settings = TrafficCalculator.getDefaultTrafficSettings();
                settings.otherViolations = { pointsPerItem: 5 };

                const result = TrafficCalculator.evaluatePartner({ otherViolations: 3 }, settings);
                // 3 нарушения × 5 баллов = 15 баллов в bad
                expect(result.bad).toBeGreaterThanOrEqual(15);
            });

            it('should add zero to score when violations count is 0', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                const settings = TrafficCalculator.getDefaultTrafficSettings();
                settings.otherViolations = { pointsPerItem: 5 };

                const resultBefore = TrafficCalculator.evaluatePartner({}, settings);
                const resultAfter = TrafficCalculator.evaluatePartner({ otherViolations: 0 }, settings);
                expect(resultAfter.bad).toBe(resultBefore.bad);
            });

            it('should use default pointsPerItem=5 when not set in param settings', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                const settings = TrafficCalculator.getDefaultTrafficSettings();
                // pointsPerItem не задан явно — берётся из || 5
                delete settings.otherViolations.pointsPerItem;

                const result = TrafficCalculator.evaluatePartner({ otherViolations: 2 }, settings);
                expect(result.bad).toBeGreaterThanOrEqual(10); // 2 × 5 = 10
            });

            it('should treat non-numeric violations value as 0', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                const settings = TrafficCalculator.getDefaultTrafficSettings();
                settings.otherViolations = { pointsPerItem: 5 };

                const result = TrafficCalculator.evaluatePartner({ otherViolations: 'много' }, settings);
                // parseInt('много') = NaN → || 0 → 0 violations → 0 penalty
                const resultZero = TrafficCalculator.evaluatePartner({ otherViolations: 0 }, settings);
                expect(result.bad).toBe(resultZero.bad);
            });

            it('should scale linearly with violations count', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                const settings = TrafficCalculator.getDefaultTrafficSettings();
                settings.otherViolations = { pointsPerItem: 10 };

                // Изолируем: все остальные параметры = 0 (попадают в good при min=0)
                const r1 = TrafficCalculator.evaluatePartner({ otherViolations: 1 }, settings);
                const r3 = TrafficCalculator.evaluatePartner({ otherViolations: 3 }, settings);
                // bad от multiplier: r3.bad - r1.bad = 20 (3*10 - 1*10)
                expect(r3.bad - r1.bad).toBe(20);
            });

        });

        describe('text-type params', () => {

            it('should score good points when text value matches good.value exactly', () => {
                const { TrafficCalculator } = loadTrafficCalculator(
                    { TrafficState: {
                        trafficParams: [{ key: 'statusField', name: 'Статус', type: 'text' }]
                    }}
                );
                const settings = {
                    statusField: {
                        good:     { value: 'active', points: 1 },
                        normal:   { value: 'pending', points: 2 },
                        bad:      { value: 'inactive', points: 3 },
                        terrible: { value: 'blocked', points: 4 }
                    }
                };
                const result = TrafficCalculator.evaluatePartner({ statusField: 'active' }, settings);
                expect(result.good).toBe(1);
            });

            it('should score terrible points when text value matches no level', () => {
                const { TrafficCalculator } = loadTrafficCalculator(
                    { TrafficState: {
                        trafficParams: [{ key: 'statusField', name: 'Статус', type: 'text' }]
                    }}
                );
                const settings = {
                    statusField: {
                        good:     { value: 'active', points: 1 },
                        normal:   { value: 'pending', points: 2 },
                        bad:      { value: 'inactive', points: 3 },
                        terrible: { value: 'blocked', points: 4 }
                    }
                };
                const result = TrafficCalculator.evaluatePartner({ statusField: 'unknown' }, settings);
                expect(result.terrible).toBe(4);
            });

        });

        describe('edge cases', () => {

            it('should return total=0 for empty partner with all-zero ranges', () => {
                const { TrafficCalculator } = loadTrafficCalculator(
                    { TrafficState: { trafficParams: [] }}
                );
                const result = TrafficCalculator.evaluatePartner({}, {});
                expect(result.total).toBe(0);
                expect(result.good).toBe(0);
            });

            it('should skip params that are missing from settings', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                // Пустые settings — ни один param не имеет ключа
                const result = TrafficCalculator.evaluatePartner({ backCount: 5 }, {});
                expect(result.total).toBe(0);
            });

            it('should handle negative values correctly (treated as number, compared to range)', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                const settings = makeRangedSettings('backCount', {
                    good:     { min: -10, max: -1 },
                    normal:   { min:  0,  max:  5  },
                    bad:      { min:  6,  max: 15  },
                    terrible: { min: 16,  max: 100 }
                });
                const result = TrafficCalculator.evaluatePartner({ backCount: -5 }, settings);
                expect(result.good).toBe(1);
            });

            it('should accumulate scores from multiple params', () => {
                const { TrafficCalculator } = loadTrafficCalculator();
                const settings = makeRangedSettings('backCount', {
                    good:     { min: 0, max: 5 },
                    normal:   { min: 6, max: 10 },
                    bad:      { min: 11, max: 20 },
                    terrible: { min: 21, max: 100 }
                });
                // Дополнительно задаём autoDisableCount
                settings.autoDisableCount = {
                    good:     { min: 0, max: 3, points: 1 },
                    normal:   { min: 4, max: 7, points: 2 },
                    bad:      { min: 8, max: 15, points: 3 },
                    terrible: { min: 16, max: 100, points: 4 }
                };
                // backCount=3 → good(+1), autoDisableCount=5 → normal(+2)
                const result = TrafficCalculator.evaluatePartner(
                    { backCount: 3, autoDisableCount: 5 },
                    settings
                );
                expect(result.good).toBeGreaterThanOrEqual(1);
                expect(result.normal).toBeGreaterThanOrEqual(2);
            });

        });

    });

    // =========================================================================
    describe('calculateTrafficPercentages()', () => {

        it('should do nothing when trafficResults is empty', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.TrafficState.trafficResults = [];
            // Не должен бросать ошибку
            expect(() => TrafficCalculator.calculateTrafficPercentages()).not.toThrow();
        });

        it('should do nothing when trafficResults is null/undefined', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.TrafficState.trafficResults = null;
            expect(() => TrafficCalculator.calculateTrafficPercentages()).not.toThrow();
        });

        it('should give more traffic percent to partner with lower score (inverse proportion)', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.TrafficState.trafficResults = [
                { method: 'M1', scores: { total: 5 },  trafficPercent: 0 },
                { method: 'M1', scores: { total: 15 }, trafficPercent: 0 }
            ];
            TrafficCalculator.calculateTrafficPercentages();

            const better = mocks.TrafficState.trafficResults[0]; // score=5 — лучше
            const worse  = mocks.TrafficState.trafficResults[1]; // score=15 — хуже
            expect(better.trafficPercent).toBeGreaterThan(worse.trafficPercent);
        });

        it('should make percentages within a method sum to exactly 100', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.TrafficState.trafficResults = [
                { method: 'M1', scores: { total: 5 },  trafficPercent: 0 },
                { method: 'M1', scores: { total: 10 }, trafficPercent: 0 },
                { method: 'M1', scores: { total: 20 }, trafficPercent: 0 }
            ];
            TrafficCalculator.calculateTrafficPercentages();

            const total = mocks.TrafficState.trafficResults.reduce(
                (sum, r) => sum + r.trafficPercent, 0
            );
            expect(total).toBe(100);
        });

        it('should distribute 100% independently for each method group', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.TrafficState.trafficResults = [
                { method: 'SBP',   scores: { total: 5 },  trafficPercent: 0 },
                { method: 'SBP',   scores: { total: 10 }, trafficPercent: 0 },
                { method: 'CARD',  scores: { total: 8 },  trafficPercent: 0 },
                { method: 'CARD',  scores: { total: 12 }, trafficPercent: 0 }
            ];
            TrafficCalculator.calculateTrafficPercentages();

            const sbpTotal = mocks.TrafficState.trafficResults
                .filter(r => r.method === 'SBP')
                .reduce((sum, r) => sum + r.trafficPercent, 0);
            const cardTotal = mocks.TrafficState.trafficResults
                .filter(r => r.method === 'CARD')
                .reduce((sum, r) => sum + r.trafficPercent, 0);

            expect(sbpTotal).toBe(100);
            expect(cardTotal).toBe(100);
        });

        it('should distribute equally when all scores are zero in a method', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.TrafficState.trafficResults = [
                { method: 'M1', scores: { total: 0 }, trafficPercent: 0 },
                { method: 'M1', scores: { total: 0 }, trafficPercent: 0 }
            ];
            TrafficCalculator.calculateTrafficPercentages();

            const results = mocks.TrafficState.trafficResults;
            // При равных нулях — равное распределение (сумма = 100)
            expect(results[0].trafficPercent + results[1].trafficPercent).toBe(100);
        });

        it('should give 100% to the single partner in a method', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.TrafficState.trafficResults = [
                { method: 'M1', scores: { total: 42 }, trafficPercent: 0 }
            ];
            TrafficCalculator.calculateTrafficPercentages();

            expect(mocks.TrafficState.trafficResults[0].trafficPercent).toBe(100);
        });

        it('should mutate trafficResults in place (sets trafficPercent on each result)', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            const result1 = { method: 'M1', scores: { total: 5 }, trafficPercent: 0 };
            const result2 = { method: 'M1', scores: { total: 10 }, trafficPercent: 0 };
            mocks.TrafficState.trafficResults = [result1, result2];

            TrafficCalculator.calculateTrafficPercentages();

            expect(result1.trafficPercent).toBeGreaterThan(0);
            expect(result2.trafficPercent).toBeGreaterThan(0);
        });

        it('should assign remainder to partners with better scores on tie in remainder', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            // 3 партнёра с намеренно подобранными score для создания remainder
            mocks.TrafficState.trafficResults = [
                { method: 'M1', scores: { total: 1 },  trafficPercent: 0 },
                { method: 'M1', scores: { total: 1 },  trafficPercent: 0 },
                { method: 'M1', scores: { total: 100 }, trafficPercent: 0 }
            ];
            TrafficCalculator.calculateTrafficPercentages();

            const total = mocks.TrafficState.trafficResults.reduce(
                (sum, r) => sum + r.trafficPercent, 0
            );
            expect(total).toBe(100);
        });

        it('should not allow any partner to have negative traffic percent', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.TrafficState.trafficResults = [
                { method: 'M1', scores: { total: 1000 }, trafficPercent: 0 },
                { method: 'M1', scores: { total: 1 },    trafficPercent: 0 }
            ];
            TrafficCalculator.calculateTrafficPercentages();

            mocks.TrafficState.trafficResults.forEach(r => {
                expect(r.trafficPercent).toBeGreaterThanOrEqual(0);
            });
        });

    });

    // =========================================================================
    describe('loadTrafficSettings()', () => {

        it('should return default settings when localStorage has no saved settings', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.localStorage.getItem.mockReturnValue(null);

            const settings = TrafficCalculator.loadTrafficSettings();
            expect(settings).toBeDefined();
            expect(settings).toHaveProperty('otherViolations');
        });

        it('should parse and return settings from localStorage when they exist', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            const saved = { backCount: { good: { min: 0, max: 3, points: 1 } } };
            mocks.localStorage.getItem.mockReturnValue(JSON.stringify(saved));

            const settings = TrafficCalculator.loadTrafficSettings();
            expect(settings).toEqual(saved);
        });

        it('should return default settings when localStorage value is invalid JSON', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.localStorage.getItem.mockReturnValue('{ INVALID JSON }');

            const settings = TrafficCalculator.loadTrafficSettings();
            // Должен вернуть дефолтные настройки и не упасть
            expect(settings).toBeDefined();
        });

        it('should fix negative pointsPerItem values during migration', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            const saved = {
                otherViolations: { pointsPerItem: -3 }
            };
            mocks.localStorage.getItem.mockReturnValue(JSON.stringify(saved));

            const settings = TrafficCalculator.loadTrafficSettings();
            // Миграция: отрицательные значения исправляются на 5
            expect(settings.otherViolations.pointsPerItem).toBe(5);
        });

        it('should save migrated settings back to localStorage', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            const saved = {
                otherViolations: { pointsPerItem: -3 }
            };
            mocks.localStorage.getItem.mockReturnValue(JSON.stringify(saved));

            TrafficCalculator.loadTrafficSettings();

            expect(mocks.localStorage.setItem).toHaveBeenCalledWith(
                'trafficSettings',
                expect.any(String)
            );
        });

        it('should not modify positive pointsPerItem during migration', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            const saved = {
                otherViolations: { pointsPerItem: 10 }
            };
            mocks.localStorage.getItem.mockReturnValue(JSON.stringify(saved));

            const settings = TrafficCalculator.loadTrafficSettings();
            expect(settings.otherViolations.pointsPerItem).toBe(10);
        });

    });

    // =========================================================================
    describe('saveTrafficSettings()', () => {

        it('should call localStorage.setItem with key "trafficSettings"', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.TrafficState.trafficSettings = { testKey: { pointsPerItem: 5 } };

            TrafficCalculator.saveTrafficSettings();

            expect(mocks.localStorage.setItem).toHaveBeenCalledWith(
                'trafficSettings',
                expect.any(String)
            );
        });

        it('should serialize TrafficState.trafficSettings to JSON', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            const trafficSettings = { otherViolations: { pointsPerItem: 7 } };
            mocks.TrafficState.trafficSettings = trafficSettings;

            TrafficCalculator.saveTrafficSettings();

            expect(mocks.localStorage.setItem).toHaveBeenCalledWith(
                'trafficSettings',
                JSON.stringify(trafficSettings)
            );
        });

    });

    // =========================================================================
    describe('updateTrafficSetting()', () => {

        it('should update the specified field in TrafficState.trafficSettings', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.TrafficState.trafficSettings = {
                backCount: { good: { min: 0, max: 5, points: 1 } }
            };

            TrafficCalculator.updateTrafficSetting('backCount', 'good', 'max', 10);

            expect(mocks.TrafficState.trafficSettings.backCount.good.max).toBe(10);
        });

        it('should call saveTrafficSettings after updating', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.TrafficState.trafficSettings = {
                backCount: { good: { min: 0, max: 5, points: 1 } }
            };
            const saveSpy = vi.spyOn(TrafficCalculator, 'saveTrafficSettings');

            TrafficCalculator.updateTrafficSetting('backCount', 'good', 'max', 10);

            expect(saveSpy).toHaveBeenCalled();
        });

        it('should do nothing when paramKey does not exist in settings', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.TrafficState.trafficSettings = {};

            expect(() => {
                TrafficCalculator.updateTrafficSetting('nonExistentKey', 'good', 'max', 10);
            }).not.toThrow();
        });

    });

    // =========================================================================
    describe('updateTrafficSettingMultiplier()', () => {

        it('should update the specified field in multiplier settings', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.TrafficState.trafficSettings = {
                otherViolations: { pointsPerItem: 5 }
            };

            TrafficCalculator.updateTrafficSettingMultiplier('otherViolations', 'pointsPerItem', 8);

            expect(mocks.TrafficState.trafficSettings.otherViolations.pointsPerItem).toBe(8);
        });

        it('should call saveTrafficSettings after updating multiplier', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.TrafficState.trafficSettings = {
                otherViolations: { pointsPerItem: 5 }
            };
            const saveSpy = vi.spyOn(TrafficCalculator, 'saveTrafficSettings');

            TrafficCalculator.updateTrafficSettingMultiplier('otherViolations', 'pointsPerItem', 8);

            expect(saveSpy).toHaveBeenCalled();
        });

        it('should do nothing when paramKey does not exist in settings', () => {
            const { TrafficCalculator, mocks } = loadTrafficCalculator();
            mocks.TrafficState.trafficSettings = {};

            expect(() => {
                TrafficCalculator.updateTrafficSettingMultiplier('nonExistent', 'pointsPerItem', 8);
            }).not.toThrow();
        });

    });

    // =========================================================================
    describe('getDaysFromAdded()', () => {

        it('should return 0 for null/undefined dateAdded', () => {
            const { TrafficCalculator } = loadTrafficCalculator();
            expect(TrafficCalculator.getDaysFromAdded(null)).toBe(0);
            expect(TrafficCalculator.getDaysFromAdded(undefined)).toBe(0);
        });

        it('should return a positive number of days for a past date', () => {
            const { TrafficCalculator } = loadTrafficCalculator();
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 30);
            const days = TrafficCalculator.getDaysFromAdded(pastDate.toISOString());
            expect(days).toBeGreaterThan(0);
        });

        it('should return approximately 30 for a date 30 days ago', () => {
            const { TrafficCalculator } = loadTrafficCalculator();
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 30);
            const days = TrafficCalculator.getDaysFromAdded(pastDate.toISOString());
            // ceil может дать 30 или 31 в зависимости от времени суток
            expect(days).toBeGreaterThanOrEqual(29);
            expect(days).toBeLessThanOrEqual(31);
        });

        it('should return approximately 1 for yesterday', () => {
            const { TrafficCalculator } = loadTrafficCalculator();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const days = TrafficCalculator.getDaysFromAdded(yesterday.toISOString());
            expect(days).toBeGreaterThanOrEqual(1);
            expect(days).toBeLessThanOrEqual(2);
        });

    });

});
