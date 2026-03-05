/* onboarding-source.js — Google Sheets lead import (multi-source) */

const OnboardingSource = (() => {
    'use strict';

    const _syncIntervals = {};
    let _editingSourceId = null;
    let _isSyncing = false;
    let _settingsCache = null;
    let _conditionsCache = null;

    const COLUMN_MAP = {
        'фио': 'contact_name',
        'имя': 'contact_name',
        'телефон': 'phone',
        'phone': 'phone',
        'email': 'email',
        'почта': 'email',
        'telegram': 'tg_username',
        'телеграм': 'tg_username',
        'тг': 'tg_username',
        'страна': 'geo_country',
        'country': 'geo_country',
        'дата обращения': 'lead_date',
        'дата': 'lead_date',
        'date': 'lead_date'
    };

    const COUNTRY_MAP = {
        'казахстан': 'kz', 'kz': 'kz', 'kazakhstan': 'kz',
        'узбекистан': 'uz', 'uz': 'uz', 'uzbekistan': 'uz',
        'кыргызстан': 'kg', 'kg': 'kg', 'kyrgyzstan': 'kg'
    };

    // ── Init / Destroy ──

    async function init() {
        // Show loading in sync bar while fetching settings
        const bar = document.getElementById('sourceSyncBar');
        if (bar) {
            bar.classList.remove('hidden');
            _updateSyncBar('syncing', 'Загрузка настроек...');
        }
        try {
            // Условия — общие на команду, грузим без кеша для актуальности
            const result = await CloudStorage.getOnboardingSettings(false);
            _settingsCache = result.sources || { sources: [] };
            if (!_settingsCache.sources) _settingsCache.sources = [];
            _conditionsCache = result.conditions || { sheetUrl: '', sheetId: '', conditions: [], lastSyncTime: '', lastSyncStatus: '' };
            // Init roles from same API response
            if (result.roleConfig) OnboardingRoles.initFromConfig(result.roleConfig);
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'loadSettings' });
            _settingsCache = { sources: [] };
            _conditionsCache = { sheetUrl: '', sheetId: '', conditions: [], lastSyncTime: '', lastSyncStatus: '' };
            OnboardingRoles.initFromConfig(null);
        }
        _settingsCache.sources.forEach(src => {
            if (src.sheetId && src.syncIntervalMinutes > 0) _startPeriodicSync(src);
        });
        updateSyncBarVisibility();
    }

    function destroy() {
        _stopAllSyncs();
        _settingsCache = null;
        _conditionsCache = null;
    }

    // ── Settings ──

    function _getSettings() {
        return _settingsCache || { sources: [] };
    }

    async function _saveSettingsToApi(settings) {
        _settingsCache = settings;
        try {
            await CloudStorage.postApi('saveOnboardingSourceSettings', { settings });
            CloudStorage.clearCache('onboardingSettings');
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'saveSourceSettings' });
        }
    }

    function _extractSheetId(url) {
        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : null;
    }

    function _getSource(settings, id) {
        return settings.sources.find(s => s.id === id);
    }

    // ── Modal: List View ──

    function openSettings() {
        _editingSourceId = null;
        _renderSourceList();
        const modal = document.getElementById('sourceSettingsModal');
        if (modal) modal.classList.add('active');
    }

    function _renderSourceList() {
        const settings = _getSettings();
        const listView = document.getElementById('sourceListView');
        const editView = document.getElementById('sourceEditView');
        const listFooter = document.getElementById('sourceListFooter');
        const editFooter = document.getElementById('sourceEditFooter');
        if (!listView || !editView) return;

        listView.classList.remove('hidden');
        editView.classList.add('hidden');
        if (listFooter) listFooter.classList.remove('hidden');
        if (editFooter) editFooter.classList.add('hidden');

        // Update modal title
        const title = document.querySelector('#sourceSettingsModal .modal-title');
        if (title) title.textContent = 'Источники лидов';

        const listContainer = document.getElementById('sourceListItems');
        if (!listContainer) return;

        if (settings.sources.length === 0) {
            listContainer.innerHTML = '<div class="source-empty">Нет источников</div>';
            return;
        }

        listContainer.innerHTML = settings.sources.map(src => {
            const syncLabel = src.syncIntervalMinutes > 0 ? `${src.syncIntervalMinutes} мин` : 'вручную';
            const count = src.importedCount || 0;
            const statusDot = src.lastSyncStatus === 'error' ? ' source-item-error' : '';
            return `<div class="source-item${statusDot}" data-source-id="${Utils.escapeHtml(src.id)}">
                <div class="source-item-info">
                    <span class="source-item-name">${Utils.escapeHtml(src.name)}</span>
                    <span class="source-item-meta">${Utils.escapeHtml(syncLabel)} · ${count} ${_pluralLeads(count)}</span>
                </div>
                <button class="btn btn-primary btn-sm source-item-edit" data-action="onb-editSource" data-value="${Utils.escapeHtml(src.id)}">&#9881;</button>
            </div>`;
        }).join('');
    }

    function showList() {
        _editingSourceId = null;
        _renderSourceList();
    }

    // ── Modal: Edit View ──

    function showEditForm(sourceId) {
        _editingSourceId = sourceId || null;
        const settings = _getSettings();
        const source = sourceId ? _getSource(settings, sourceId) : null;

        const listView = document.getElementById('sourceListView');
        const editView = document.getElementById('sourceEditView');
        const listFooter = document.getElementById('sourceListFooter');
        const editFooter = document.getElementById('sourceEditFooter');
        if (!listView || !editView) return;

        listView.classList.add('hidden');
        editView.classList.remove('hidden');
        if (listFooter) listFooter.classList.add('hidden');
        if (editFooter) editFooter.classList.remove('hidden');

        // Update modal title
        const title = document.querySelector('#sourceSettingsModal .modal-title');
        if (title) title.textContent = source ? 'Редактировать источник' : 'Добавить источник';

        const nameInput = document.getElementById('sourceEditName');
        const urlInput = document.getElementById('sourceEditUrl');
        const intervalSelect = document.getElementById('sourceEditInterval');
        const deleteBtn = document.getElementById('btnDeleteSource');

        if (nameInput) nameInput.value = source ? source.name : '';
        if (urlInput) urlInput.value = source ? (source.sheetUrl || '') : '';
        if (intervalSelect) intervalSelect.value = source ? String(source.syncIntervalMinutes ?? 5) : '5';
        if (deleteBtn) deleteBtn.classList.toggle('hidden', !source);
    }

    async function saveSource() {
        const nameInput = document.getElementById('sourceEditName');
        const urlInput = document.getElementById('sourceEditUrl');
        const intervalSelect = document.getElementById('sourceEditInterval');

        const name = (nameInput ? nameInput.value : '').trim();
        const url = (urlInput ? urlInput.value : '').trim();
        const interval = parseInt(intervalSelect ? intervalSelect.value : '5', 10);

        if (!name) {
            Toast.error('Укажите название источника');
            return;
        }
        if (!url) {
            Toast.error('Укажите URL таблицы');
            return;
        }
        const sheetId = _extractSheetId(url);
        if (!sheetId) {
            Toast.error('Неверный формат URL Google Таблицы');
            return;
        }

        const btn = document.querySelector('[data-action="onb-saveSource"]');
        if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }

        try {
            const settings = _getSettings();

            if (_editingSourceId) {
                // Edit existing
                const source = _getSource(settings, _editingSourceId);
                if (!source) return;

                const sheetChanged = source.sheetId !== sheetId;
                source.name = name;
                source.sheetUrl = url;
                source.sheetId = sheetId;
                source.syncIntervalMinutes = interval;
                if (sheetChanged) {
                    source.importedRowHashes = [];
                    source.importedCount = 0;
                    source.lastSyncTime = '';
                    source.lastSyncStatus = '';
                }

                _stopPeriodicSync(source.id);
                if (interval > 0) _startPeriodicSync(source);
            } else {
                // Add new
                const source = {
                    id: 'src_' + Date.now(),
                    name,
                    sheetUrl: url,
                    sheetId,
                    syncIntervalMinutes: interval,
                    importedRowHashes: [],
                    importedCount: 0,
                    lastSyncTime: '',
                    lastSyncStatus: ''
                };
                settings.sources.push(source);

                if (interval > 0) _startPeriodicSync(source);
                _editingSourceId = source.id;
            }

            await _saveSettingsToApi(settings);
            updateSyncBarVisibility();
            Toast.success('Источник сохранён');

            // Sync immediately (guarded)
            const savedSource = _getSource(settings, _editingSourceId);
            if (savedSource && !_isSyncing) {
                _isSyncing = true;
                _doSync(savedSource).finally(() => { _isSyncing = false; });
            }

            // Back to list
            _editingSourceId = null;
            _renderSourceList();
        } finally {
            if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
        }
    }

    async function deleteSource(sourceId) {
        const settings = _getSettings();
        const idx = settings.sources.findIndex(s => s.id === sourceId);
        if (idx === -1) return;

        const btn = document.getElementById('btnDeleteSource');
        if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }

        try {
            _stopPeriodicSync(sourceId);
            settings.sources.splice(idx, 1);
            await _saveSettingsToApi(settings);
            updateSyncBarVisibility();
            Toast.success('Источник удалён');

            _editingSourceId = null;
            _renderSourceList();
        } finally {
            if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
        }
    }

    // ── Sync Bar ──

    function updateSyncBarVisibility() {
        const settings = _getSettings();
        const condData = _getConditionsData();
        const bar = document.getElementById('sourceSyncBar');
        if (!bar) return;

        const myRole = OnboardingState.get('userRole');
        const hasSources = settings.sources.length > 0;
        const hasConds = condData.conditions && condData.conditions.length > 0;

        if ((!hasSources && !hasConds) || myRole === 'executor') {
            bar.classList.add('hidden');
            return;
        }

        bar.classList.remove('hidden');

        const parts = [];
        if (hasSources) {
            const count = settings.sources.length;
            const lastTimes = settings.sources.filter(s => s.lastSyncTime).map(s => new Date(s.lastSyncTime).getTime());
            const lastSync = lastTimes.length > 0 ? _formatDateTime(new Date(Math.max(...lastTimes)).toISOString()) : null;
            let srcText = `Источников: ${count}`;
            if (lastSync) srcText += ` (синхр.: ${lastSync})`;
            parts.push(srcText);
        }
        if (hasConds) {
            parts.push(`Условий: ${condData.conditions.length}`);
        }
        _updateSyncBar('idle', parts.join(' · '));
    }

    function _updateSyncBar(status, message) {
        const textEl = document.getElementById('sourceSyncText');
        const btn = document.getElementById('btnSyncNow');
        if (!textEl) return;

        textEl.textContent = message;
        textEl.className = 'source-sync-text' + (status === 'syncing' ? ' syncing' : status === 'error' ? ' error' : '');
        if (btn) btn.disabled = status === 'syncing';
    }

    // ── Periodic Sync ──

    function _startPeriodicSync(source) {
        _stopPeriodicSync(source.id);
        if (source.syncIntervalMinutes <= 0) return;
        _syncIntervals[source.id] = setInterval(async () => {
            if (_isSyncing) return;
            _isSyncing = true;
            try {
                const settings = _getSettings();
                const src = _getSource(settings, source.id);
                if (src) await _doSync(src);
            } finally {
                _isSyncing = false;
            }
        }, source.syncIntervalMinutes * 60 * 1000);
    }

    function _stopPeriodicSync(sourceId) {
        if (_syncIntervals[sourceId]) {
            clearInterval(_syncIntervals[sourceId]);
            delete _syncIntervals[sourceId];
        }
    }

    function _stopAllSyncs() {
        Object.keys(_syncIntervals).forEach(id => _stopPeriodicSync(id));
    }

    async function syncNow() {
        if (_isSyncing) return;
        _isSyncing = true;
        try {
            const settings = _getSettings();
            for (const source of settings.sources) {
                await _doSync(source);
            }
        } finally {
            _isSyncing = false;
        }
    }

    async function _doSync(source) {
        if (!source || !source.sheetId) return;

        _updateSyncBar('syncing', `Синхронизация «${source.name}»...`);

        try {
            const table = await _fetchSheet(source.sheetId);
            const { headers, rows } = _parseTable(table);

            if (!headers.length) {
                _updateSyncBar('error', `«${source.name}»: не найдены заголовки`);
                _updateSourceStatus(source.id, 'error');
                return;
            }

            // Re-read hashes from cache (latest state)
            const freshSettings = _getSettings();
            const freshSource = _getSource(freshSettings, source.id);
            const hashes = new Set(freshSource ? freshSource.importedRowHashes || [] : []);
            let imported = 0;

            for (const row of rows) {
                const lead = _mapRowToLead(row, headers);
                if (!lead.contact_name && !lead.phone && !lead.tg_username && !lead.email) continue;

                const hash = _hashLead(lead);
                if (hashes.has(hash)) continue;

                // Secondary dedup: check existing requests
                if (_isDuplicateRequest(lead)) {
                    hashes.add(hash);
                    continue;
                }

                lead.lead_source_name = source.name;
                PartnerOnboarding.createRequestFromImport(lead);
                hashes.add(hash);
                imported++;
            }

            // Save updated source data
            const settings = _getSettings();
            const src = _getSource(settings, source.id);
            if (src) {
                src.importedRowHashes = Array.from(hashes);
                src.importedCount = (src.importedCount || 0) + imported;
                src.lastSyncTime = new Date().toISOString();
                src.lastSyncStatus = 'success';
                _saveSettingsToApi(settings);
            }

            if (imported > 0) {
                OnboardingList.applyFilters();
                Toast.success(`«${source.name}»: +${imported} ${_pluralLeads(imported)}`);
            }

            updateSyncBarVisibility();

        } catch (err) {
            const msg = err.message || 'Неизвестная ошибка';
            _updateSourceStatus(source.id, 'error');
            _updateSyncBar('error', `«${source.name}»: ${msg}`);
            Toast.error(`«${source.name}»: ${msg}`);
        }
    }

    function _updateSourceStatus(sourceId, status) {
        const settings = _getSettings();
        const src = _getSource(settings, sourceId);
        if (src) {
            src.lastSyncStatus = status;
            _saveSettingsToApi(settings);
        }
    }

    // ── Fetch & Parse ──

    async function _fetchSheet(sheetId) {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
        let response;
        try {
            response = await fetch(url);
        } catch {
            throw new Error('Не удалось подключиться к таблице');
        }
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Таблица не доступна. Проверьте доступ');
            }
            throw new Error('Ошибка HTTP ' + response.status);
        }
        const text = await response.text();
        return _parseGvizResponse(text);
    }

    function _parseGvizResponse(text) {
        const match = text.match(/google\.visualization\.Query\.setResponse\((.+)\);?\s*$/s);
        if (!match) throw new Error('Неверный формат ответа');
        let json;
        try {
            json = JSON.parse(match[1]);
        } catch {
            throw new Error('Неверный формат ответа');
        }
        if (json.status === 'error') {
            throw new Error(json.errors?.[0]?.detailed_message || 'Ошибка таблицы');
        }
        return json.table;
    }

    function _parseTable(table) {
        if (!table || !table.cols || !table.rows) return { headers: [], rows: [] };

        const headers = table.cols.map(col => {
            const label = (col.label || '').trim().toLowerCase();
            return COLUMN_MAP[label] || null;
        });

        const rows = table.rows.map(row => row.c || []);
        return { headers, rows };
    }

    function _mapRowToLead(rowCells, headers) {
        const lead = {};
        headers.forEach((fieldId, idx) => {
            if (!fieldId) return;
            const cell = rowCells[idx];
            if (!cell) return;

            if (fieldId === 'lead_date') {
                lead[fieldId] = _parseDate(cell);
            } else if (fieldId === 'geo_country') {
                const raw = String(cell.v || cell.f || '').trim();
                lead[fieldId] = COUNTRY_MAP[raw.toLowerCase()] || raw;
            } else {
                lead[fieldId] = String(cell.v ?? cell.f ?? '').trim();
            }
        });
        return lead;
    }

    // ── Deduplication ──

    function _hashLead(lead) {
        const parts = [
            lead.contact_name || '',
            lead.phone || '',
            lead.email || '',
            lead.tg_username || '',
            lead.geo_country || '',
            lead.lead_date || ''
        ];
        const raw = parts.join('|').toLowerCase();
        let hash = 5381;
        for (let i = 0; i < raw.length; i++) {
            hash = ((hash << 5) + hash) + raw.charCodeAt(i);
            hash = hash & hash;
        }
        return 'h' + Math.abs(hash).toString(36);
    }

    function _isDuplicateRequest(lead) {
        const requests = OnboardingState.get('requests') || [];
        const fields = ['contact_name', 'phone', 'email', 'tg_username'];
        const nonEmpty = fields.filter(f => lead[f]);
        if (nonEmpty.length === 0) return false;
        return requests.some(r => {
            const d = (r.stageData && r.stageData[1]) || {};
            return nonEmpty.every(f => d[f] === lead[f]);
        });
    }

    // ── Helpers ──

    function _parseDate(cell) {
        if (!cell) return '';
        if (cell.v && typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
            const m = cell.v.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+)(?:,(\d+))?)?\)/);
            if (m) {
                const d = new Date(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
                return d.toISOString();
            }
        }
        const raw = cell.f || cell.v;
        if (raw) {
            const d = new Date(raw);
            if (!isNaN(d)) return d.toISOString();
        }
        return '';
    }

    function _formatDateTime(dateStr) {
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${dd}.${mm}.${yy} ${hh}:${min}`;
    }

    function _pluralLeads(n) {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return 'лид';
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'лида';
        return 'лидов';
    }

    function _getEditingId() {
        return _editingSourceId;
    }

    // ══════════════════════════════════════════════════
    //  CONDITIONS — условия из Google Sheets
    // ══════════════════════════════════════════════════

    const CONDITIONS_COLUMN_MAP = {
        'страна': 'condition_country',
        'country': 'condition_country',
        'тип метода': 'method_type',
        'тип': 'method_type',
        'method type': 'method_type',
        'название метода': 'method_name',
        'метод': 'method_name',
        'method name': 'method_name',
        'пополнения': 'deal_1',
        'deposits': 'deal_1',
        'выводы': 'deal_2',
        'withdrawals': 'deal_2',
        'компенсация': 'deal_3',
        'compensation': 'deal_3',
        'способ предоплаты': 'prepayment_method',
        'prepayment method': 'prepayment_method',
        'сумма предоплаты': 'prepayment_amount',
        'prepayment amount': 'prepayment_amount'
    };

    function _getConditionsData() {
        return _conditionsCache || { sheetUrl: '', sheetId: '', conditions: [], lastSyncTime: '', lastSyncStatus: '' };
    }

    async function _saveConditionsToApi(data) {
        _conditionsCache = data;
        try {
            await CloudStorage.postApi('saveOnboardingConditions', { data: data });
            CloudStorage.clearCache('onboardingSettings');
        } catch (e) {
            ErrorHandler.handle(e, { module: 'partner-onboarding', action: 'saveConditions' });
        }
    }

    function openConditionsSettings() {
        const data = _getConditionsData();
        const hasUrl = !!data.sheetUrl;

        _toggleConditionsMode(hasUrl ? 'view' : 'edit', data);
        _renderConditionsStatus(data);

        const modal = document.getElementById('conditionsModal');
        if (modal) modal.classList.add('active');
    }

    function editConditionsUrl() {
        const data = _getConditionsData();
        _toggleConditionsMode('edit', data);
    }

    function _toggleConditionsMode(mode, data) {
        const viewMode = document.getElementById('conditionsViewMode');
        const editMode = document.getElementById('conditionsEditMode');
        const saveBtn = document.getElementById('conditionsSaveBtn');
        if (!viewMode || !editMode) return;

        if (mode === 'view') {
            viewMode.classList.remove('hidden');
            editMode.classList.add('hidden');
            if (saveBtn) saveBtn.classList.add('hidden');

            const link = document.getElementById('conditionsLink');
            if (link && data && data.sheetUrl) {
                link.href = data.sheetUrl;
                link.textContent = 'Открыть таблицу условий';
            }
        } else {
            viewMode.classList.add('hidden');
            editMode.classList.remove('hidden');
            if (saveBtn) saveBtn.classList.remove('hidden');

            const urlInput = document.getElementById('conditionsUrl');
            if (urlInput) urlInput.value = (data && data.sheetUrl) || '';
        }
    }

    async function clearConditions() {
        await _saveConditionsToApi({ sheetUrl: '', sheetId: '', conditions: [], lastSyncTime: '', lastSyncStatus: '' });
        _renderConditionsStatus({ conditions: [] });
        updateSyncBarVisibility();
        _toggleConditionsMode('edit', { sheetUrl: '' });
        Toast.success('Условия удалены');
    }

    function _renderConditionsStatus(data) {
        const el = document.getElementById('conditionsStatus');
        if (!el) return;
        if (!data.conditions || data.conditions.length === 0) {
            el.classList.add('hidden');
            return;
        }
        el.classList.remove('hidden');
        const count = data.conditions.length;
        const countries = new Set(data.conditions.map(c => c.condition_country).filter(Boolean));
        const types = new Set(data.conditions.map(c => c.method_type).filter(Boolean));
        const timeStr = data.lastSyncTime ? _formatDateTime(data.lastSyncTime) : '';
        const parts = [`<span class="conditions-status-count">${count}</span> ${_pluralConditions(count)}`];
        if (countries.size) parts.push(`Стран: ${countries.size}`);
        parts.push(`Типов: ${types.size}`);
        el.innerHTML = `<div class="conditions-status-row"><div>${parts.join(' · ')}</div><button class="conditions-delete-btn" data-action="onb-clearConditions" title="Удалить условия"><img src="../shared/icons/cross.svg" width="14" height="14" alt="Удалить"></button></div>` +
            (timeStr ? `<div class="conditions-status-time">Синхронизация: ${Utils.escapeHtml(timeStr)}</div>` : '');
    }

    function _pluralConditions(n) {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return 'условие';
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'условия';
        return 'условий';
    }

    async function saveConditionsUrl() {
        const urlInput = document.getElementById('conditionsUrl');
        const url = (urlInput ? urlInput.value : '').trim();

        if (!url) {
            // Clear conditions
            _saveConditionsToApi({ sheetUrl: '', sheetId: '', conditions: [], lastSyncTime: '', lastSyncStatus: '' });
            _renderConditionsStatus({ conditions: [] });
            updateSyncBarVisibility();
            Toast.success('Условия очищены');
            return;
        }

        const sheetId = _extractSheetId(url);
        if (!sheetId) {
            Toast.error('Неверный формат URL Google Таблицы');
            return;
        }

        const btn = document.querySelector('[data-action="onb-saveConditions"]');
        if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }

        try {
            const table = await _fetchSheet(sheetId);
            const conditions = _parseConditionsTable(table);

            const data = {
                sheetUrl: url,
                sheetId: sheetId,
                conditions: conditions,
                lastSyncTime: new Date().toISOString(),
                lastSyncStatus: 'success'
            };

            await _saveConditionsToApi(data);
            _renderConditionsStatus(data);
            updateSyncBarVisibility();

            if (conditions.length === 0) {
                Toast.warning('Таблица сохранена, но условия пока пусты. Убедитесь что есть колонки: Тип метода, Название метода, и хотя бы одна заполненная строка');
            } else {
                Toast.success(`Загружено ${conditions.length} ${_pluralConditions(conditions.length)}`);
            }

            _toggleConditionsMode('view', data);

        } catch (err) {
            Toast.error(err.message || 'Ошибка загрузки');
        } finally {
            if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
        }
    }

    function _parseConditionsTable(table) {
        if (!table || !table.cols || !table.rows) return [];

        const headers = table.cols.map(col => {
            const label = (col.label || '').trim().toLowerCase();
            return CONDITIONS_COLUMN_MAP[label] || null;
        });

        // Must have at least method_type and method_name
        if (!headers.includes('method_type') || !headers.includes('method_name')) return [];

        const conditions = [];
        for (const row of table.rows) {
            const cells = row.c || [];
            const entry = {};
            headers.forEach((fieldId, idx) => {
                if (!fieldId) return;
                const cell = cells[idx];
                const raw = cell ? (cell.f && cell.f !== '' ? cell.f : (cell.v != null ? cell.v : '')) : '';
                entry[fieldId] = String(raw).trim();
            });
            if (entry.method_type && entry.method_name) {
                conditions.push(entry);
            }
        }
        return conditions;
    }

    // ── Conditions Getters ──

    function hasConditions() {
        const data = _getConditionsData();
        return data.conditions && data.conditions.length > 0;
    }

    function getConditions() {
        const data = _getConditionsData();
        return data.conditions || [];
    }

    function getCountries() {
        const conditions = getConditions();
        const seen = new Set();
        return conditions.reduce((acc, c) => {
            if (c.condition_country && !seen.has(c.condition_country)) {
                seen.add(c.condition_country);
                acc.push({ value: c.condition_country, label: c.condition_country });
            }
            return acc;
        }, []);
    }

    function getMethodTypes(country) {
        const conditions = getConditions();
        const filtered = country ? conditions.filter(c => c.condition_country === country) : conditions;
        const seen = new Set();
        return filtered.reduce((acc, c) => {
            if (c.method_type && !seen.has(c.method_type)) {
                seen.add(c.method_type);
                acc.push({ value: c.method_type, label: c.method_type });
            }
            return acc;
        }, []);
    }

    function getMethodNames(country, methodType) {
        const conditions = getConditions();
        const filtered = conditions.filter(c =>
            (!country || c.condition_country === country) &&
            c.method_type === methodType
        );
        const seen = new Set();
        return filtered.reduce((acc, c) => {
            if (c.method_name && !seen.has(c.method_name)) {
                seen.add(c.method_name);
                acc.push({ value: c.method_name, label: c.method_name });
            }
            return acc;
        }, []);
    }

    function getCondition(country, methodType, methodName) {
        const conditions = getConditions();
        return conditions.find(c =>
            (!country || c.condition_country === country) &&
            c.method_type === methodType &&
            c.method_name === methodName
        ) || null;
    }

    return {
        init, destroy,
        openSettings, showList, showEditForm, saveSource, deleteSource,
        syncNow, updateSyncBarVisibility, _getEditingId,
        openConditionsSettings, saveConditionsUrl, editConditionsUrl, clearConditions,
        hasConditions, getConditions, getCountries, getMethodTypes, getMethodNames, getCondition
    };
})();
