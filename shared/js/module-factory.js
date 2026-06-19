/**
 * ModuleFactory — combines signals state + EventManager + OptimisticManager + CRUD delegation.
 *
 * Phase 24 SIG-04: centerpiece of reactive layer. Called INSIDE PageLifecycle.onInit() —
 * does NOT replace PageLifecycle. Lifecycle: ModuleFactory.create() → use → mod.destroy()
 * в PageLifecycle.onDestroy.
 *
 * CRITICAL Pitfall A/B prevention: rollback callback REASSIGNS signal
 * (`items.value = snapshot.slice()`), never mutates in-place. Signals'
 * Object.is detection требует new reference для re-fire effects.
 *
 * CRITICAL Pitfall B prevention: crud.getAll auto-wraps multi-signal write
 * (items + totalCount) в window.batch() — coalesces effect re-fires в ОДИН.
 *
 * CRITICAL Pitfall C prevention: все effect() dispose handles tracked в
 * _disposers array, called в destroy(). Idempotent.
 *
 * Graceful degradation: factory works когда EventManager/OptimisticManager/
 * CloudStorage[entity] недоступны (returns null helpers, нет throws).
 *
 * @example
 *   PageLifecycle.init({
 *       module: 'partners',
 *       async onInit() {
 *           const mod = ModuleFactory.create({
 *               name: 'partners',
 *               entity: 'partners',
 *               pageSize: 20,
 *               optimistic: true
 *           });
 *           window.partnersModule = mod;
 *           mod.effect(() => renderTable(mod.filtered.value));
 *           await mod.crud.getAll();
 *       },
 *       onDestroy() {
 *           window.partnersModule?.destroy();
 *           window.partnersModule = null;
 *       }
 *   });
 */

const ModuleFactory = {
    /**
     * @param {Object} config
     * @param {string} config.name - module identifier (REQUIRED)
     * @param {string} [config.entity] - CloudStorage entity name for CRUD delegation
     * @param {number} [config.pageSize=20]
     * @param {boolean} [config.optimistic=false]
     * @param {string[]} [config.filters=[]] - filter signal field names (optional)
     * @returns {Object} module instance с reactive state + helpers + destroy()
     * @throws {Error} если window.signal недоступен (cdn-deps.js не загружен) или config.name отсутствует
     */
    create(config) {
        if (!config || !config.name) {
            throw new Error('ModuleFactory: config.name is required');
        }
        const { name, entity, pageSize = 20, optimistic = false, filters = [] } = config;

        if (typeof window.signal !== 'function') {
            throw new Error(
                'ModuleFactory: window.signal not available — cdn-deps.js not loaded? ' +
                'Ensure <script type="module" src="../shared/js/cdn-deps.js"></script> is in <head>.'
            );
        }

        // ─────────── Reactive state (signals) ───────────
        const items = window.signal([]);
        const filter = window.signal({});
        const pagination = window.signal({ page: 1, pageSize });
        const totalCount = window.signal(0);
        const filtered = window.computed(() => {
            const f = filter.value;
            const all = items.value;
            const keys = Object.keys(f);
            if (keys.length === 0) return all;
            return all.filter(it => keys.every(k => {
                const v = f[k];
                // Empty/null filter values treated as no filter
                if (v === undefined || v === null || v === '') return true;
                return it[k] === v;
            }));
        });

        // ─────────── Effect dispose tracking (Pitfall C — no memory leak) ───────────
        const _disposers = [];
        function trackEffect(fn) {
            const dispose = window.effect(fn);
            _disposers.push(dispose);
            return dispose;
        }

        // ─────────── Helpers (graceful degradation) ───────────
        const events = (window.EventManager && typeof window.EventManager.create === 'function')
            ? window.EventManager.create()
            : null;
        const optimisticInst = (optimistic && window.OptimisticManager && typeof window.OptimisticManager.create === 'function')
            ? window.OptimisticManager.create(name)
            : null;

        // ─────────── CRUD delegation (Phase 21 entity factory) ───────────
        const crudApi = entity && window.CloudStorage && window.CloudStorage[entity]
            ? window.CloudStorage[entity]
            : null;
        const crud = crudApi ? {
            getAll: async (opts = {}) => {
                const result = await crudApi.getAll({
                    ...opts,
                    page: pagination.value.page,
                    pageSize: pagination.value.pageSize
                });
                // CRITICAL Pitfall B: batch() coalesces multi-signal write — ONE effect re-fire
                window.batch(() => {
                    items.value = result.items || [];
                    totalCount.value = result.totalCount || 0;
                });
                return result;
            },
            save: typeof crudApi.save === 'function' ? crudApi.save.bind(crudApi) : crudApi.save,
            delete: typeof crudApi.delete === 'function' ? crudApi.delete.bind(crudApi) : crudApi.delete
        } : null;

        // ─────────── OptimisticManager + signal REASSIGN bridge ───────────
        // CRITICAL Pitfall A/B: rollback REASSIGNS signal с fresh array, never mutates in-place
        const optimisticReassign = optimisticInst ? {
            apply(opConfig) {
                const userOnRollback = opConfig.onRollback;
                return optimisticInst.apply({
                    ...opConfig,
                    onRollback: (error) => {
                        // REASSIGN signal с fresh array (NOT in-place mutation)
                        // Object.is(prev, next) === false → effects re-fire → UI updates
                        items.value = (opConfig.snapshot || []).slice();
                        if (typeof userOnRollback === 'function') {
                            userOnRollback(error);
                        }
                    }
                });
            },
            confirm: (...args) => optimisticInst.confirm(...args),
            rollback: (...args) => optimisticInst.rollback(...args),
            isPending: (...args) => optimisticInst.isPending(...args),
            getPendingIds: () => optimisticInst.getPendingIds(),
            getPendingCount: () => optimisticInst.getPendingCount()
        } : null;

        // ─────────── Lifecycle ───────────
        let _destroyed = false;
        function destroy() {
            if (_destroyed) return; // idempotent
            _destroyed = true;
            _disposers.forEach(d => {
                try { d(); } catch (e) { /* swallow dispose errors */ }
            });
            _disposers.length = 0;
            if (events) events.destroyAll();
            // OptimisticManager Phase 21 v2.27 не имеет destroy() — pending ops timeout natural
        }

        return {
            // Reactive state (raw signals — consumers can write directly during migration)
            items,
            filter,
            filtered,
            pagination,
            totalCount,
            // Helpers (или null если dep недоступен)
            events,
            optimistic: optimisticReassign,
            crud,
            // Effect tracking helper
            effect: trackEffect,
            // Lifecycle
            destroy
        };
    }
};

// Browser global export (производственный usage через <script src="...">)
if (typeof window !== 'undefined') {
    window.ModuleFactory = ModuleFactory;
}

// CommonJS export для vitest unit tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModuleFactory;
}
