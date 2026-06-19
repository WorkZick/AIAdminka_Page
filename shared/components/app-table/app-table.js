// shared/components/app-table/app-table.js
//
// Phase 25 LIT-02 — generic <app-table> Lit-компонент.
//
// Самый большой generic component в Phase 25 — заменяет 4 разных table renderers
// (partners/admin/team-info/audit-log) единым компонентом для Phase 27 mass migration.
//
// Light DOM (createRenderRoot=this) reuses CSS из @layer shared:
//   - .table / .table-hover / .table th.sortable (shared/css/components/tables.css)
//   - .loading-state / .spinner / .loading-text   (shared/css/components/loading.css)
//   - .empty-state                                (shared/css/components/loading.css)
//   - .skeleton-row                               (shared/css/components/skeleton.css) — used by consumers
//   - .item--pending / .item--error / .selected  (shared/css/components/optimistic.css)
//
// 5 reactive properties:
//   - items:        Array  — [{id, ...fields}] data rows
//   - columns:      Array  — [{key, label, render?, sortable?}] column config; render(item) optional cell renderer
//   - loading:      Boolean (reflect) — show spinner instead of table
//   - emptyMessage: String (attribute='empty-message') — fallback empty-state text
//   - selectedId:   String (attribute='selected-id') — id of row to mark as .selected
//
// 2 events (CustomEvent, bubbles+composed):
//   - row-click   detail: { id, item }       — emitted on <tr> click
//   - sort-change detail: { field }          — emitted on sortable <th> click (field = col.key)
//
// 2 named slots:
//   - <slot name="header-actions">  — above table (filter buttons, page actions)
//   - <slot name="empty">           — overrides default .empty-state markup
//
// Critical: window.litRepeat directive с stable keys (item.id) preserves DOM identity, focus,
// selection across reorders/filter changes — replaces brittle .map() row rendering.
//
// Optimistic UI integration (Phase 24 ModuleFactory):
//   item._pending=true → row gets .item--pending  (60% opacity + spinner via optimistic.css)
//   item._error=true   → row gets .item--error    (red border + shake animation)
//
// Pitfall #1: static properties (NOT decorators).
// Pitfall #11: dual-folder identical (mirror в SimpleAIAdminka/shared/components/app-table/).
//
// NB: VirtualScroller integration deferred per CONTEXT.md (partners pilot uses regular table —
// 3K rows acceptable per v2.29 benchmark gate). Phase 27 may revisit.
//
// References: 25-RESEARCH.md §"Code Examples / app-table skeleton" + Lit repeat() directive.
//             docs/lit-components-conventions.md §3 (mandates) + §6 (late-binding).

(function () {
    'use strict';

    function defineAppTable() {
        class AppTable extends window.LitElement {
            static properties = {
                items: { type: Array },
                columns: { type: Array },
                loading: { type: Boolean, reflect: true },
                emptyMessage: { type: String, attribute: 'empty-message' },
                selectedId: { type: String, attribute: 'selected-id' }
            };

            // MUST: Light DOM — re-use existing @layer shared CSS classes
            createRenderRoot() { return this; }

            constructor() {
                super();
                this.items = [];
                this.columns = [];
                this.loading = false;
                this.emptyMessage = 'Нет данных';
                this.selectedId = null;
            }

            disconnectedCallback() {
                super.disconnectedCallback();
                // No effect/event subscriptions to dispose — events handled inline via @click;
                // future signal integration will push disposers here per Phase 24 pattern.
            }

            _onRowClick(item) {
                this.dispatchEvent(new CustomEvent('row-click', {
                    detail: { id: item.id, item },
                    bubbles: true,
                    composed: true
                }));
            }

            _onSortClick(col) {
                if (!col || !col.sortable) return;
                this.dispatchEvent(new CustomEvent('sort-change', {
                    detail: { field: col.key },
                    bubbles: true,
                    composed: true
                }));
            }

            _rowClassName(item) {
                let cls = '';
                if (this.selectedId !== null && this.selectedId !== undefined && this.selectedId === item.id) {
                    cls += 'selected';
                }
                if (item._pending) {
                    cls += (cls ? ' ' : '') + 'item--pending';
                }
                if (item._error) {
                    cls += (cls ? ' ' : '') + 'item--error';
                }
                return cls;
            }

            render() {
                const html = window.litHtml;
                const litRepeat = window.litRepeat;

                if (this.loading) {
                    return html`
                        <div class="loading-state">
                            <div class="spinner"></div>
                            <div class="loading-text">Загрузка...</div>
                        </div>
                    `;
                }

                if (!this.items || this.items.length === 0) {
                    return html`
                        <slot name="empty">
                            <div class="empty-state">${this.emptyMessage}</div>
                        </slot>
                    `;
                }

                return html`
                    <slot name="header-actions"></slot>
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                ${this.columns.map(col => html`
                                    <th
                                        class="${col.sortable ? 'sortable' : ''}"
                                        data-key="${col.key}"
                                        @click=${() => this._onSortClick(col)}
                                    >${col.label}</th>
                                `)}
                            </tr>
                        </thead>
                        <tbody>
                            ${litRepeat(
                                this.items,
                                item => item.id,
                                item => html`
                                    <tr
                                        class="${this._rowClassName(item)}"
                                        data-id="${item.id}"
                                        @click=${() => this._onRowClick(item)}
                                    >
                                        ${this.columns.map(col => html`
                                            <td data-key="${col.key}">${col.render ? col.render(item) : (item[col.key] ?? '')}</td>
                                        `)}
                                    </tr>
                                `
                            )}
                        </tbody>
                    </table>
                `;
            }
        }
        customElements.define('app-table', AppTable);
    }

    // Late-binding: handles cold (Lit not yet loaded) and warm (already loaded) cases
    if (window.__LIT_LOADED__) defineAppTable();
    else window.addEventListener('lit-ready', defineAppTable, { once: true });
})();
