/**
 * OptimisticManager - Factory for per-module optimistic state management.
 * Each module creates its own instance via OptimisticManager.create(name).
 * Instances are isolated -- no shared pending state between modules.
 *
 * Usage:
 *   const mgr = OptimisticManager.create('partners');
 *   const opId = mgr.apply({ stateRef, index, snapshot, operation, item, onRollback });
 *   // ... async server call ...
 *   mgr.confirm(opId, { realId });  // or mgr.rollback(opId, error);
 *
 * apply() config:
 *   - stateRef    {Array}    Reference to the array being mutated (e.g. PartnersState.cachedPartners).
 *                            Used for rollback restoration. Manager modifies this in-place on rollback.
 *   - index       {number}   Index in stateRef where item lives (update/delete). -1 for add.
 *   - snapshot    {Array}    Deep clone of the FULL stateRef array, taken by caller via
 *                            structuredClone(stateRef) BEFORE mutation. Manager stores for rollback.
 *   - operation   {string}   'add' | 'update' | 'delete'
 *   - item        {Object}   The item object (with _pending: true flag already set by caller).
 *   - onRollback  {Function} Callback(error) called after restoring snapshot (typically re-render).
 *   - timeout     {number}   Optional ms, defaults to DEFAULT_TIMEOUT_MS (30000).
 *
 * Isolation guarantee:
 *   Two instances created via .create() do NOT share any pending state.
 *   Each instance maintains its own internal _ops Map.
 *
 * Auto-rollback:
 *   If confirm/rollback is not called within timeout ms, rollback fires automatically.
 */
const OptimisticManager = (() => {
    const DEFAULT_TIMEOUT_MS = 30000;

    // Phase 65 (OPTIMISTIC-01): global registry of all created instances для cross-module isPending lookup.
    // Used by CloudStorage._mergeDelta to skip server-side updates for currently pending items.
    const _instances = new Set();

    /**
     * Create an isolated OptimisticManager instance for a named module.
     * @param {string} name - Module name (e.g. 'partners', 'team', 'admin'). Used for event detail.
     * @returns {{ apply, confirm, rollback, isPending, getPendingIds, getPendingCount, name }}
     */
    function create(name) {
        // _ops: Map<opId, { snapshot, stateRef, index, operation, item, onRollback, timer }>
        const _ops = new Map();

        // Phase 65 (OPTIMISTIC-01): track instance в global registry для isPendingGlobal lookup
        const _instance = { _ops: _ops, name: name };
        _instances.add(_instance);

        /**
         * Apply an optimistic mutation and record the pending operation.
         * The caller must:
         *   1. Take snapshot: const snapshot = structuredClone(stateRef);
         *   2. Mutate stateRef in-place (add/update/delete + set item._pending = true).
         *   3. Call apply() with the snapshot and mutation metadata.
         *   4. Render the optimistic UI.
         *   5. Await the server call, then confirm() or rollback().
         *
         * @param {Object} config
         * @param {Array}    config.stateRef    Reference to the array being mutated.
         * @param {number}   config.index       Item index in stateRef. -1 for add operations.
         * @param {Array}    config.snapshot    Deep clone of stateRef taken BEFORE mutation.
         * @param {string}   config.operation   'add' | 'update' | 'delete'
         * @param {Object}   config.item        Item object (with _pending: true).
         * @param {Function} [config.onRollback] Callback(error) invoked after snapshot restore.
         * @param {number}   [config.timeout]   Custom timeout in ms. Default: 30000.
         * @returns {string} opId — UUID identifying this pending operation.
         */
        function apply(config) {
            const opId = crypto.randomUUID();
            const timeoutMs = (typeof config.timeout === 'number' && config.timeout > 0)
                ? config.timeout
                : DEFAULT_TIMEOUT_MS;

            const timer = setTimeout(() => {
                if (_ops.has(opId)) {
                    rollback(
                        opId,
                        new Error('Timeout: server did not respond within ' + timeoutMs + 'ms')
                    );
                }
            }, timeoutMs);

            _ops.set(opId, {
                snapshot:   config.snapshot,
                stateRef:   config.stateRef,
                index:      config.index,
                operation:  config.operation,
                item:       config.item,
                onRollback: config.onRollback || null,
                timer
            });

            return opId;
        }

        /**
         * Confirm a pending operation — server responded successfully.
         * For 'add' operations, replaces temp id with server-assigned realId.
         * Removes _pending and _error flags from the item.
         * Idempotent: calling with unknown opId logs a warning and returns.
         *
         * @param {string} opId               ID returned by apply().
         * @param {Object} [options={}]
         * @param {string} [options.realId]   Server-assigned id for 'add' operations.
         */
        function confirm(opId, options = {}) {
            if (!_ops.has(opId)) {
                console.warn('[OptimisticManager:' + name + '] confirm() called for unknown opId:', opId);
                return;
            }

            const op = _ops.get(opId);
            _cleanup(opId);

            // For add operations, replace temp id with server-assigned realId
            let oldId = null;
            let newId = null;
            if (op.operation === 'add' && options.realId != null) {
                oldId = op.item.id;
                newId = options.realId;
                const found = op.stateRef.find(it => it.id === oldId);
                if (found) {
                    found.id = newId;
                }
                // Also update the item reference itself so callers hold correct id
                op.item.id = newId;
            }

            // Clear pending/error flags from the live item
            if (op.item) {
                delete op.item._pending;
                delete op.item._error;
            }

            // Phase 65 (OPTIMISTIC-03): dispatch optimistic-confirm CustomEvent для cross-module subscribers
            // (parallel to existing optimistic-rollback event). Subscribers могут re-trigger cache sync.
            if (typeof document !== 'undefined' && typeof CustomEvent !== 'undefined') {
                document.dispatchEvent(new CustomEvent('optimistic-confirm', {
                    detail: {
                        module: name,
                        opId: opId,
                        operation: op.operation,
                        id: op.item ? op.item.id : null,
                        ns: name,                     // module name = ns convention
                        oldId: oldId,                 // null если operation !== 'add'
                        newId: newId                  // null если operation !== 'add'
                    }
                }));
            }
        }

        /**
         * Rollback a pending operation — server call failed or timed out.
         * Restores stateRef from snapshot in-place, calls onRollback(error),
         * and dispatches a 'optimistic-rollback' CustomEvent on document.
         * Idempotent: calling with unknown opId logs a warning and returns.
         *
         * @param {string} opId   ID returned by apply().
         * @param {Error}  error  The error that caused the rollback.
         */
        function rollback(opId, error) {
            if (!_ops.has(opId)) {
                console.warn('[OptimisticManager:' + name + '] rollback() called for unknown opId:', opId);
                return;
            }

            const op = _ops.get(opId);
            _cleanup(opId);

            // Restore stateRef contents from snapshot (in-place, preserving reference)
            op.stateRef.length = 0;
            op.stateRef.push(...op.snapshot);

            // Notify caller so it can re-render and show error UI
            if (typeof op.onRollback === 'function') {
                op.onRollback(error);
            }

            // Dispatch global event for cross-module observability
            document.dispatchEvent(new CustomEvent('optimistic-rollback', {
                detail: {
                    module:    name,
                    opId,
                    operation: op.operation,
                    error
                }
            }));
        }

        /**
         * Check whether an item has an active in-flight operation.
         * Used by polling code to skip re-applying stale server data.
         *
         * @param {string|number} itemId   The item's id field.
         * @returns {boolean}
         */
        function isPending(itemId) {
            for (const op of _ops.values()) {
                if (op.item && op.item.id === itemId) {
                    return true;
                }
            }
            return false;
        }

        /**
         * Get all item IDs that have active in-flight operations.
         * @returns {Array<string|number>}
         */
        function getPendingIds() {
            return [..._ops.values()].map(op => op.item && op.item.id);
        }

        /**
         * Get the number of active pending operations.
         * @returns {number}
         */
        function getPendingCount() {
            return _ops.size;
        }

        /**
         * Internal helper: clear timeout and remove op from map.
         * @param {string} opId
         */
        function _cleanup(opId) {
            const op = _ops.get(opId);
            if (op) {
                clearTimeout(op.timer);
            }
            _ops.delete(opId);
        }

        return { apply, confirm, rollback, isPending, getPendingIds, getPendingCount, name };
    }

    /**
     * Phase 65 (OPTIMISTIC-01): global isPending lookup across ALL created instances.
     * Used by CloudStorage._mergeDelta to skip server-side updates для currently pending items.
     *
     * @param {string|number} itemId - The item's id field
     * @returns {boolean}
     */
    function isPendingGlobal(itemId) {
        for (const instance of _instances) {
            for (const op of instance._ops.values()) {
                if (op.item && op.item.id === itemId) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Phase 65 (OPTIMISTIC-02): get count of pending operations in named namespace.
     * Used by CloudStorage to skip notModified short-circuit когда pending writes exist
     * (always full refetch чтобы detect server-side conflicts).
     *
     * @param {string} ns - namespace name (matches OptimisticManager.create(name))
     * @returns {number}
     */
    function getPendingCountGlobal(ns) {
        let count = 0;
        for (const instance of _instances) {
            if (instance.name === ns) {
                count += instance._ops.size;
            }
        }
        return count;
    }

    return { create, isPendingGlobal, getPendingCountGlobal };
})();

// Экспорт для тестов (Vitest / Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimisticManager;
}
