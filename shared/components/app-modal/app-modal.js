// shared/components/app-modal/app-modal.js
//
// Phase 25 LIT-04: unified modal с focus trap, Escape, backdrop click, body overflow lock.
// Light DOM Lit component reuses .modal-overlay/.modal/.modal-header/-body/-footer
// из shared/css/components/modal.css (@layer shared).
// Reference: docs/lit-components-conventions.md (Phase 25 LIT-01) + 25-RESEARCH.md §"app-modal skeleton".
//
// Mandates (LIT-01):
//   • static properties = {...}  (NOT @property декоратор — Pitfall #1)
//   • customElements.define(...) (NOT @customElement декоратор)
//   • Light DOM: createRenderRoot() { return this; }
//   • window.litHtml namespacing (collision-safe; LIT-01 §4)
//   • Late-binding registration: handles cold (Lit pending) и warm (Lit ready) loads.
//   • disconnectedCallback dispose (Pitfall C): restore body.overflow + remove keydown listener
//                                              даже если модалка уничтожается с open=true.
//
// Critical UX behaviors (BFIX-19 prerequisite):
//   1. Focus trap: при open=true первый focusable focused через requestAnimationFrame;
//      Tab cycles forward (last → first); Shift-Tab cycles backward (first → last).
//   2. Escape key (document keydown) → close + dispatch 'close' CustomEvent.
//   3. Backdrop click (e.target === .modal-overlay) → close.
//   4. Body lock: при open=true `document.body.style.overflow='hidden'`; при close — restore ''.
//   5. Focus return: при open сохраняем document.activeElement; при close возвращаем focus.

(function () {
    'use strict';

    function defineAppModal() {
        class AppModal extends window.LitElement {
            static properties = {
                open: { type: Boolean, reflect: true },
                title: { type: String },
                size: { type: String }   // 'sm' | 'md' | 'lg'
            };

            // MUST: Light DOM (re-use existing modal CSS classes из @layer shared)
            createRenderRoot() { return this; }

            constructor() {
                super();
                this.open = false;
                this.title = '';
                this.size = 'md';
                this._lastFocused = null;
                this._keydownHandler = this._onKeydown.bind(this);
                this._slottedMain = [];   // original children без slot=footer (DocumentFragment storage)
                this._slottedFooter = []; // original children с slot=footer
            }

            connectedCallback() {
                super.connectedCallback();
                // BFIX (audit 2026-05-19): Light DOM не поддерживает <slot>. Original children
                // оставались в normal flow (визуально внизу страницы) пока render-template добавлял
                // пустые .modal-overlay/.modal-body после них.
                // Решение: до Lit render snapshot'им children в массивы, но НЕ удаляем сразу
                // (другой код может getElementById их). Удаляем при первом open=true перед инжектом.
                // Параллельно: пока open=false, скрываем сам <app-modal> через display:none,
                // чтобы originals не рендерились в normal flow.
                if (this._slottedMain.length === 0 && this._slottedFooter.length === 0 && this.children.length > 0) {
                    Array.from(this.children).forEach(ch => {
                        if (ch.getAttribute && ch.getAttribute('slot') === 'footer') {
                            ch.removeAttribute('slot');
                            this._slottedFooter.push(ch);
                        } else {
                            this._slottedMain.push(ch);
                        }
                    });
                }
                if (!this.open) this.style.display = 'none';
            }

            updated(changedProperties) {
                if (changedProperties.has('open')) {
                    // BFIX (audit 2026-05-19 regression-2): `display: block` (не пустая строка).
                    // CSS rule `app-modal { display: contents }` (modal.css:9-11) — после reset
                    // inline style host элемент становится `display: contents` → Playwright
                    // `state: visible` check падает (элемент без bbox). `display: block` даёт
                    // host'у свой box (visual идентично, children .modal остаётся position:fixed).
                    this.style.display = this.open ? 'block' : 'none';
                }
                // After Lit render with open=true: move slotted children into modal-body/footer
                if (this.open) {
                    const bodyEl = this.querySelector(':scope > .modal.active > .modal-dialog > .modal-body');
                    const footerEl = this.querySelector(':scope > .modal.active > .modal-dialog > .modal-footer');
                    if (bodyEl) {
                        bodyEl.querySelectorAll('slot').forEach(s => s.remove());
                        this._slottedMain.forEach(ch => { if (ch.parentElement !== bodyEl) bodyEl.appendChild(ch); });
                    }
                    if (footerEl) {
                        footerEl.querySelectorAll('slot').forEach(s => s.remove());
                        this._slottedFooter.forEach(ch => { if (ch.parentElement !== footerEl) footerEl.appendChild(ch); });
                    }
                } else {
                    // open=false: Lit render `html\`\`` cleared everything including moved children.
                    // Re-attach them as direct children of host so getElementById can find them
                    // when next _showConfirm() runs BEFORE setting open=true.
                    // BFIX (audit 2026-05-19): без этого второй раз _showConfirm падал с
                    // "Cannot set properties of null (setting 'textContent')".
                    this._slottedMain.forEach(ch => { if (ch.parentElement !== this) this.appendChild(ch); });
                    this._slottedFooter.forEach(ch => { if (ch.parentElement !== this) this.appendChild(ch); });
                }
                if (changedProperties.has('open')) {
                    if (this.open) {
                        // Save previously focused element для restore on close
                        this._lastFocused = document.activeElement;
                        // Lock body scroll
                        document.body.style.overflow = 'hidden';
                        // Listen for Escape + Tab focus trap
                        document.addEventListener('keydown', this._keydownHandler);
                        // Focus first focusable after render commits
                        requestAnimationFrame(() => {
                            const first = this.querySelector(
                                'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
                            );
                            first?.focus();
                        });
                    } else {
                        // Restore body scroll
                        document.body.style.overflow = '';
                        // Remove keydown listener
                        document.removeEventListener('keydown', this._keydownHandler);
                        // Restore focus to previously focused element
                        this._lastFocused?.focus?.();
                    }
                }
            }

            // Pitfall C: disconnectedCallback dispose — restore body.overflow + remove listener
            // даже если модалка уничтожается с open=true (без явного close transition).
            disconnectedCallback() {
                super.disconnectedCallback();
                document.body.style.overflow = '';
                document.removeEventListener('keydown', this._keydownHandler);
            }

            _onKeydown(e) {
                if (!this.open) return;
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this._close();
                } else if (e.key === 'Tab') {
                    // Focus trap: cycle focus within modal
                    const focusables = this.querySelectorAll(
                        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    );
                    if (focusables.length === 0) return;
                    const first = focusables[0];
                    const last = focusables[focusables.length - 1];
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }

            _onBackdropClick(e) {
                // Закрываем только если кликнули непосредственно по overlay (не по child).
                // BFIX (audit 2026-05-19): теперь overlay = .modal.active (см. render template).
                if (e.target.classList.contains('modal') && e.target.classList.contains('active')) {
                    this._close();
                }
            }

            _close() {
                this.open = false;
                this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
            }

            render() {
                const html = window.litHtml;
                if (!this.open) return html``;
                // BFIX (audit 2026-05-19): использовать .modal.active (overlay из modal.css)
                // как outer wrapper и .modal-dialog (inner dialog) — соответствует CSS conventions.
                // Раньше outer был .modal-overlay (без CSS) → не было fixed-position → modal плыл в normal flow.
                return html`
                    <div class="modal active modal-overlay-wrapper" @click=${this._onBackdropClick.bind(this)}>
                        <div
                            class="modal-dialog modal-${this.size}"
                            role="dialog"
                            aria-modal="true"
                            aria-label=${this.title}
                        >
                            <header class="modal-header">
                                <h2 class="modal-title">${this.title}</h2>
                                <button
                                    class="modal-close"
                                    @click=${this._close.bind(this)}
                                    aria-label="Закрыть"
                                    type="button"
                                >
                                    <img src="../shared/icons/cross.svg" width="16" height="16" alt="">
                                </button>
                            </header>
                            <main class="modal-body"><slot></slot></main>
                            <footer class="modal-footer"><slot name="footer"></slot></footer>
                        </div>
                    </div>
                `;
            }
        }
        customElements.define('app-modal', AppModal);
    }

    // Late-binding: handles cold (Lit pending) и warm (Lit ready) loads.
    // Test environment (vitest setup-lit.js) sets __LIT_LOADED__ перед import → defines immediately.
    if (window.__LIT_LOADED__) defineAppModal();
    else window.addEventListener('lit-ready', defineAppModal, { once: true });
})();
