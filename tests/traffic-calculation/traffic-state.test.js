import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadTrafficState() {
    const code = readFileSync(
        resolve(__dirname, '../../traffic-calculation/js/modules/traffic-state.js'),
        'utf-8'
    );
    const fn = new Function(`${code}\nreturn TrafficState;`);
    return fn();
}

describe('TrafficState', () => {
    let state;

    beforeEach(() => {
        state = loadTrafficState();
    });

    // ------------------------------------------------------------------
    // Структура — поля верхнего уровня
    // ------------------------------------------------------------------

    it('should have currentTab === "analytics"', () => {
        expect(state.currentTab).toBe('analytics');
    });

    it('should have selectedPartners as empty array', () => {
        expect(state.selectedPartners).toEqual([]);
    });

    it('should have editingPartnerId === null', () => {
        expect(state.editingPartnerId).toBeNull();
    });

    it('should have currentStep === 1', () => {
        expect(state.currentStep).toBe(1);
    });

    it('should have completedSteps as empty array', () => {
        expect(state.completedSteps).toEqual([]);
    });

    it('should have dataLoaded === false', () => {
        expect(state.dataLoaded).toBe(false);
    });

    it('should have ourPartnerIds as empty array', () => {
        expect(state.ourPartnerIds).toEqual([]);
    });

    // ------------------------------------------------------------------
    // Структура — filesUploaded
    // ------------------------------------------------------------------

    it('should have filesUploaded.deposits === false', () => {
        expect(state.filesUploaded.deposits).toBe(false);
    });

    it('should have filesUploaded.quality === false', () => {
        expect(state.filesUploaded.quality).toBe(false);
    });

    it('should have filesUploaded.percent === false', () => {
        expect(state.filesUploaded.percent).toBe(false);
    });

    // ------------------------------------------------------------------
    // trafficParams — размер и обязательные поля
    // ------------------------------------------------------------------

    it('should have exactly 15 trafficParams', () => {
        expect(state.trafficParams).toHaveLength(15);
    });

    it('should have key, name, type on every trafficParam', () => {
        for (const param of state.trafficParams) {
            expect(param).toHaveProperty('key');
            expect(param).toHaveProperty('name');
            expect(param).toHaveProperty('type');
            expect(typeof param.key).toBe('string');
            expect(typeof param.name).toBe('string');
            expect(typeof param.type).toBe('string');
        }
    });

    // ------------------------------------------------------------------
    // trafficParams — распределение по типам
    // ------------------------------------------------------------------

    it('should have 10 params of type "number"', () => {
        const count = state.trafficParams.filter(p => p.type === 'number').length;
        expect(count).toBe(10);
    });

    it('should have 4 params of type "percent"', () => {
        const count = state.trafficParams.filter(p => p.type === 'percent').length;
        expect(count).toBe(4);
    });

    it('should have 1 param of type "multiplier"', () => {
        const count = state.trafficParams.filter(p => p.type === 'multiplier').length;
        expect(count).toBe(1);
    });

    // ------------------------------------------------------------------
    // trafficParams — конкретные keys
    // ------------------------------------------------------------------

    it('should contain all expected param keys', () => {
        const expectedKeys = [
            'backCount',
            'autoDisableCount',
            'depositAppealsCount',
            'delayedAppealsCount',
            'depositSuccessPercent',
            'withdrawalSuccessPercent',
            'depositWorkTimePercent',
            'withdrawalWorkTimePercent',
            'chatIgnoring',
            'webmanagementIgnore',
            'depositQueues',
            'withdrawalQueues',
            'creditsOutsideLimits',
            'wrongAmountApproval',
            'otherViolations'
        ];
        const actualKeys = state.trafficParams.map(p => p.key);
        for (const key of expectedKeys) {
            expect(actualKeys).toContain(key);
        }
    });

    it('should have otherViolations as the only "multiplier" param', () => {
        const multipliers = state.trafficParams.filter(p => p.type === 'multiplier');
        expect(multipliers).toHaveLength(1);
        expect(multipliers[0].key).toBe('otherViolations');
    });

    // ------------------------------------------------------------------
    // availableMethods
    // ------------------------------------------------------------------

    it('should have availableMethods as empty array', () => {
        expect(state.availableMethods).toEqual([]);
    });
});
