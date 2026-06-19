// shared/components/app-form-dropdown/app-form-dropdown.js
//
// <app-form-dropdown> — Lit Web Component замена DropdownHelper proxies.
// Light DOM компонент с baked-in BFIX-15 touchend handling (Phase 21 ported).
//
// Reuses: .dropdown-wrap / .dropdown-trigger / .dropdown-menu / .dropdown-item
//         из shared/css/components/dropdown.css (@layer shared).
//
// Properties:
//   value (String, reflect)        — выбранное значение
//   options (Array)                — [{value, label, group?}, ...]
//   placeholder (String)           — текст когда value пустой
//   disabled (Boolean, reflect)    — отключает trigger
//   _open (Boolean, state)         — internal: открыто/закрыто меню
//
// Events:
//   change — CustomEvent с detail: {value, label}, bubbles+composed
//
// BFIX-15 (Phase 21 ported): @touchend handler вызывает e.preventDefault()
// для предотвращения iOS/Android double-fire (touchend → synthetic click ~300ms).
//
// Pitfall enforcement:
//   #1: static properties (NOT декораторы)
//   #C / #4: disconnectedCallback убирает document click listener
//   #11: дубль-папка (SimpleAIAdminka mirror)

(function () {
    'use strict';

    function defineAppFormDropdown() {
        class AppFormDropdown extends window.LitElement {
            static properties = {
                value: { type: String, reflect: true },
                options: { type: Array },
                placeholder: { type: String },
                disabled: { type: Boolean, reflect: true },
                _open: { type: Boolean, state: true }
            };

            // MUST: Light DOM (re-use dropdown.css @layer shared classes)
            createRenderRoot() { return this; }

            constructor() {
                super();
                this.value = '';
                this.options = [];
                this.placeholder = 'Выберите...';
                this.disabled = false;
                this._open = false;
                // bound handler — нужен ОДИН и тот же reference для add+remove
                this._outsideClickHandler = this._onOutsideClick.bind(this);
            }

            connectedCallback() {
                super.connectedCallback();
                document.addEventListener('click', this._outsideClickHandler);
            }

            disconnectedCallback() {
                super.disconnectedCallback();
                // Pitfall C — убираем global listener при unmount (memory leak prevention)
                document.removeEventListener('click', this._outsideClickHandler);
            }

            _onOutsideClick(e) {
                if (this._open && !this.contains(e.target)) {
                    this._open = false;
                }
            }

            _onTriggerClick(e) {
                if (this.disabled) return;
                // BFIX-15: prevent default on touchend (предотвращает touchend→click double-fire on mobile)
                if (e && e.type === 'touchend' && typeof e.preventDefault === 'function') {
                    e.preventDefault();
                }
                this._open = !this._open;
            }

            _onSelect(option) {
                if (this.disabled) return;
                this.value = option.value;
                this._open = false;
                this.dispatchEvent(new CustomEvent('change', {
                    detail: { value: option.value, label: option.label },
                    bubbles: true,
                    composed: true
                }));
            }

            render() {
                const html = window.litHtml;
                const opts = Array.isArray(this.options) ? this.options : [];
                const selected = opts.find(o => o.value === this.value);
                const label = selected ? selected.label : this.placeholder;
                const isPlaceholder = !selected;
                return html`
                    <div class="dropdown-wrap dropdown-wrap--form ${this._open ? 'dropdown-wrap--open' : ''}">
                        <button
                            type="button"
                            class="dropdown-trigger dropdown-trigger--form ${isPlaceholder ? 'placeholder' : ''}"
                            ?disabled=${this.disabled}
                            @click=${this._onTriggerClick}
                            @touchend=${this._onTriggerClick}
                        >
                            <span>${label}</span>
                        </button>
                        <div class="dropdown-menu ${this._open ? '' : 'hidden'}">
                            ${opts.map(opt => html`
                                <div
                                    class="dropdown-item ${opt.value === this.value ? 'active' : ''}"
                                    @click=${() => this._onSelect(opt)}
                                >
                                    ${opt.label}
                                </div>
                            `)}
                        </div>
                    </div>
                `;
            }
        }
        customElements.define('app-form-dropdown', AppFormDropdown);
    }

    // Late-binding: handles cold (Lit not yet loaded) and warm (already loaded) cases
    if (window.__LIT_LOADED__) defineAppFormDropdown();
    else window.addEventListener('lit-ready', defineAppFormDropdown, { once: true });
})();
