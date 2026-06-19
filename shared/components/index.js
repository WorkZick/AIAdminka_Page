// shared/components/index.js
//
// Phase 25 LIT-02..05: aggregator imports all generic Lit components.
// Loaded в каждом module's index.html через:
//   <script type="module" src="../shared/components/index.js"></script>
// AFTER cdn-deps.js (которое регистрирует window.LitElement / window.litHtml)
// Late-binding в каждом компоненте обрабатывает порядок (cold/warm load).
//
// Reference: docs/lit-components-conventions.md §9 (Index aggregator).

import './app-card/app-card.js';
import './app-modal/app-modal.js';
import './app-form-dropdown/app-form-dropdown.js';
import './app-table/app-table.js';
