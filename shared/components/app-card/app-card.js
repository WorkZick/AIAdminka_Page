// shared/components/app-card/app-card.js
//
// Phase 25 LIT-03: generic glassmorphism card wrapper.
// Light DOM Lit component reuses .card-glass из shared/css/components/cards.css
// (@layer shared, обёрнут в Plan 25-02). Slots: header / default body / footer.
// Reference: docs/lit-components-conventions.md (Phase 25 LIT-01).
//
// Mandates (LIT-01):
//   - static properties = {...}  (NOT decorators — Pitfall #1)
//   - customElements.define(...) (NOT decorator-based registration)
//   - Light DOM: createRenderRoot() { return this; }
//   - window.litHtml namespacing (collision-safe; LIT-01 §4)
//   - Late-binding registration: handles cold (Lit pending) и warm (Lit ready) loads.

(function () {
    'use strict';

    function defineAppCard() {
        class AppCard extends window.LitElement {
            static properties = {
                variant: { type: String, reflect: true },     // 'default' | 'dense'
                clickable: { type: Boolean, reflect: true }
            };

            // MUST: Light DOM — re-uses .card-glass из @layer shared
            createRenderRoot() { return this; }

            constructor() {
                super();
                this.variant = 'default';
                this.clickable = false;
            }

            render() {
                const html = window.litHtml;
                const classes = `card-glass${this.variant === 'dense' ? ' card-glass--dense' : ''}${this.clickable ? ' card-glass--clickable' : ''}`;
                return html`
                    <div class="${classes}" @click=${this._onClick}>
                        <div class="card-glass__header"><slot name="header"></slot></div>
                        <div class="card-glass__body"><slot></slot></div>
                        <div class="card-glass__footer"><slot name="footer"></slot></div>
                    </div>
                `;
            }

            _onClick(_e) {
                if (this.clickable) {
                    this.dispatchEvent(new CustomEvent('card-click', {
                        bubbles: true,
                        composed: true
                    }));
                }
            }
        }
        customElements.define('app-card', AppCard);
    }

    // Late-binding: handles cold (Lit pending) и warm (Lit ready) loads (LIT-01 §6)
    if (typeof window !== 'undefined') {
        if (window.__LIT_LOADED__) defineAppCard();
        else window.addEventListener('lit-ready', defineAppCard, { once: true });
    }
})();
