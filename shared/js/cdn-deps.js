// shared/js/cdn-deps.js — ES module (loaded via <script type="module">)
//
// Phase 24 SIG-01: pinned @preact/signals-core@1.14.1 через jsDelivr ESM bundle.
// Phase 25 LIT-01: pinned lit@3.3.2 + 4 directives (repeat, classMap, ifDefined, styleMap).
// Re-exports на window для vanilla JS consumers (Toast/Utils/EventManager pattern).
//
// SRI hashes для @preact/signals-core@1.14.1/+esm:
//   curl -sL 'https://cdn.jsdelivr.net/npm/@preact/signals-core@1.14.1/+esm' \
//     | openssl dgst -sha384 -binary | openssl base64 -A
// Computed (verified deterministic 3x, 2026-05-07):
//   sha384-QjwLundxB4NaHWOfxQoy8G+BY7T7kjRSxeKIjdPAUQ76EitE8bUlehJxnQEJquiL
//
// SRI hashes для Lit @3.3.2 + 4 directives (Phase 25 LIT-01):
//   curl -sL '<URL>' | openssl dgst -sha384 -binary | openssl base64 -A
// Computed (verified deterministic 3x, 2026-05-07):
//   lit@3.3.2/+esm                                  → sha384-cdYhdOlBc0MtESQfAGUIQ6Mf8mJZZ9E9VOP6SAR7sOvPVvRwQlwQ8UR6AjsGDSW3
//   lit@3.3.2/directives/repeat.js/+esm             → sha384-/YOimVOt6Bq+nJVuTUHWt8a0+2GkUKsKQKq9P9jNkKqsupthdkM6WWQaaVIlnig/
//   lit@3.3.2/directives/class-map.js/+esm          → sha384-wgqcWx+Dzs2/x1d1yYLKO34rUT5WhUT+OSqnt51rzc/Hi6CBs3tTpstly4/Hwv2y
//   lit@3.3.2/directives/if-defined.js/+esm         → sha384-sChJXbOWDzAc/w2cKkZyzzTmyVLtLgALn0PCewYcW4Nv4WHOMwANhSAqDFQyu3Iq
//   lit@3.3.2/directives/style-map.js/+esm          → sha384-WO+CQNc5o8u/05JkylStFXt6f895hAovGF97PqyaWgflx6csiESfjnPzUJUrNAfk
//
// CSP requirement: script-src должен содержать https://cdn.jsdelivr.net + все sha384 hashes
// (signals + Lit core + 4 directives). connect-src — https://cdn.jsdelivr.net.
//
// Browser floor: Safari/iOS 17.2+ (per milestone) — native ES module dynamic import everywhere.
//
// FLOATING VERSIONS ЗАПРЕЩЕНЫ — `lit@3` или `lit@3.x` позволят jsDelivr silently swap bytes
// между dev/prod (Pitfall #11 from STACK.md, Pitfall E from RESEARCH.md).
//
// Late-binding consumers слушают `signals-ready` / `lit-ready` event на window:
//   window.addEventListener('signals-ready', () => { /* signals доступны */ });
//   window.addEventListener('lit-ready', () => { /* Lit + 4 directives доступны */ });
// Eager consumers могут проверить window.__SIGNALS_LOADED__ / window.__LIT_LOADED__ markers.

const SIGNALS_URL = 'https://cdn.jsdelivr.net/npm/@preact/signals-core@1.14.1/+esm';

const LIT_URL = 'https://cdn.jsdelivr.net/npm/lit@3.3.2/+esm';
const LIT_REPEAT_URL = 'https://cdn.jsdelivr.net/npm/lit@3.3.2/directives/repeat.js/+esm';
const LIT_CLASS_MAP_URL = 'https://cdn.jsdelivr.net/npm/lit@3.3.2/directives/class-map.js/+esm';
const LIT_IF_DEFINED_URL = 'https://cdn.jsdelivr.net/npm/lit@3.3.2/directives/if-defined.js/+esm';
const LIT_STYLE_MAP_URL = 'https://cdn.jsdelivr.net/npm/lit@3.3.2/directives/style-map.js/+esm';

// Phase 24 SIG-01: signals
try {
    const { signal, computed, effect, batch, untracked } = await import(SIGNALS_URL);

    // Re-export to window для vanilla JS consumers
    window.signal = signal;
    window.computed = computed;
    window.effect = effect;
    window.batch = batch;
    window.untracked = untracked;

    // Loading verification marker
    window.__SIGNALS_LOADED__ = true;

    // Custom event для late-binding consumers
    window.dispatchEvent(new CustomEvent('signals-ready'));
} catch (e) {
    console.error('[cdn-deps] Failed to load @preact/signals-core:', e);
    window.__SIGNALS_LOADED__ = false;
}

// Phase 25 LIT-01: Lit core + 4 directives (parallel — Promise.all для скорости)
try {
    const [
        { LitElement, html, css, render },
        { repeat },
        { classMap },
        { ifDefined },
        { styleMap }
    ] = await Promise.all([
        import(LIT_URL),
        import(LIT_REPEAT_URL),
        import(LIT_CLASS_MAP_URL),
        import(LIT_IF_DEFINED_URL),
        import(LIT_STYLE_MAP_URL)
    ]);

    // Re-export to window — namespaced (collision-safe per RESEARCH Open Q #1):
    // — `litHtml` НЕ `html` (избегаем коллизии с потенциальными user defines)
    window.LitElement = LitElement;
    window.litHtml = html;
    window.litCss = css;
    window.litRender = render;  // Phase 46 LIT-CONT-01: render() для standalone Lit templates (app-card grid в admin renderTeams)
    window.litRepeat = repeat;
    window.litClassMap = classMap;
    window.litIfDefined = ifDefined;
    window.litStyleMap = styleMap;

    // Loading verification marker
    window.__LIT_LOADED__ = true;

    // Custom event для late-binding consumers
    window.dispatchEvent(new CustomEvent('lit-ready'));
} catch (e) {
    console.error('[cdn-deps] Failed to load Lit:', e);
    window.__LIT_LOADED__ = false;
}
