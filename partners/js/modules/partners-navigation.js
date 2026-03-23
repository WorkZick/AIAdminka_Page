// Partners Navigation - partner selection, card display, status management
const PartnersNavigation = {
    // Cached DOM refs for card panel (initialized lazily)
    _cardRefs: null,
    _getCardRefs() {
        if (!this._cardRefs) {
            this._cardRefs = {
                hintPanel: document.getElementById('hintPanel'),
                partnerCard: document.getElementById('partnerCard'),
                partnerForm: document.getElementById('partnerForm'),
                cardAvatar: document.getElementById('cardAvatar'),
                cardAvatarPlaceholder: document.getElementById('cardAvatarPlaceholder'),
                cardFullName: document.getElementById('cardFullName'),
                cardPosition: document.getElementById('cardPosition'),
                cardStatusText: document.getElementById('cardStatusText'),
                cardBody: document.getElementById('cardBody')
            };
        }
        return this._cardRefs;
    },

    selectPartner(id) {
        if (PartnersState.selectedPartnerId === id) {
            PartnersNavigation.deselectPartner();
            return;
        }

        const oldId = PartnersState.selectedPartnerId;
        PartnersState.selectedPartnerId = id;
        PartnersRenderer.updateSelection(id, oldId);
        PartnersNavigation.showPartnerCard(id);
    },

    deselectPartner() {
        const oldId = PartnersState.selectedPartnerId;
        PartnersState.selectedPartnerId = null;
        PartnersRenderer.updateSelection(null, oldId);
        PartnersNavigation.showHintPanel();
    },

    closeCard() {
        PartnersNavigation.deselectPartner();
    },

    showHintPanel() {
        const r = this._getCardRefs();
        r.hintPanel.classList.remove('hidden');
        r.partnerCard.classList.add('hidden');
        r.partnerForm.classList.add('hidden');
    },

    showPartnerCard(id) {
        const partners = PartnersState.getPartners();
        const partner = partners.find(p => p.id === id);
        if (!partner) return;

        const r = this._getCardRefs();
        r.hintPanel.classList.add('hidden');
        r.partnerCard.classList.remove('hidden');
        r.partnerForm.classList.add('hidden');

        // Используем avatarFileId для получения URL из Google Drive
        const avatarUrl = partner.avatarFileId ? CloudStorage.getImageUrl(partner.avatarFileId) : '';
        if (avatarUrl) {
            r.cardAvatar.src = avatarUrl;
            r.cardAvatar.classList.remove('hidden');
            if (r.cardAvatarPlaceholder) r.cardAvatarPlaceholder.classList.add('hidden');
        } else {
            r.cardAvatar.src = '';
            r.cardAvatar.classList.add('hidden');
            if (r.cardAvatarPlaceholder) r.cardAvatarPlaceholder.classList.remove('hidden');
        }

        r.cardFullName.textContent = partner.subagent || '-';
        r.cardPosition.textContent = partner.subagentId || '-';

        const status = partner.status || 'Открыт';
        r.cardStatusText.textContent = status;
        r.cardStatusText.className = 'status-badge ' + PartnersUtils.getStatusColor(status);

        r.cardBody.innerHTML = PartnersNavigation.generateCardInfo(partner);
    },

    generateCardInfo(partner) {
        let html = '';

        html += `
            <div class="counters-info">
                <div class="counter-item">
                    <span class="counter-label">DEP</span>
                    <span class="counter-value">${partner.dep || 0}</span>
                </div>
                <div class="counter-item">
                    <span class="counter-label">WITH</span>
                    <span class="counter-value">${partner.with || 0}</span>
                </div>
                <div class="counter-item">
                    <span class="counter-label">COMP</span>
                    <span class="counter-value">${partner.comp || 0}</span>
                </div>
            </div>
        `;

        html += `
            <div class="info-group">
                <span class="info-label">Метод:</span>
                <span class="info-value">${PartnersUtils.escapeHtml(partner.method || '-')}</span>
            </div>
        `;

        if (partner.customFields) {
            Object.entries(partner.customFields).forEach(([label, value]) => {
                if (value) {
                    html += `
                        <div class="info-group">
                            <span class="info-label">${PartnersUtils.escapeHtml(label)}:</span>
                            <span class="info-value">${PartnersUtils.escapeHtml(value)}</span>
                        </div>
                    `;
                }
            });
        }

        return html;
    },

    _toggleDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;
        // Close other status dropdowns
        document.querySelectorAll('.dropdown-wrap--status .dropdown-menu:not(.hidden)').forEach(m => {
            if (m !== dropdown) m.classList.add('hidden');
        });
        dropdown.classList.toggle('hidden');
    },

    _closeDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) dropdown.classList.add('hidden');
    },

    _updateStatusBadge(textId, status) {
        const statusText = document.getElementById(textId);
        statusText.textContent = status;
        statusText.className = 'status-badge ' + PartnersUtils.getStatusColor(status);
    },

    toggleStatusDropdown() {
        this._toggleDropdown('cardStatusDropdown');
    },

    async changeStatus(status) {
        if (!PartnersState.selectedPartnerId) return;

        const partners = PartnersState.getPartners();
        const partner = partners.find(p => p.id === PartnersState.selectedPartnerId);
        if (!partner) return;

        try {
            partner.status = status;
            await CloudStorage.updatePartner(PartnersState.selectedPartnerId, partner);

            const index = PartnersState.cachedPartners.findIndex(p => p.id === PartnersState.selectedPartnerId);
            if (index !== -1) {
                PartnersState.cachedPartners[index].status = status;
            }

            this._updateStatusBadge('cardStatusText', status);
            this._closeDropdown('cardStatusDropdown');
            PartnersRenderer.render();
        } catch (error) {
            PartnersUtils.showError('Ошибка обновления статуса: ' + error.message);
        }
    },

    toggleFormStatusDropdown() {
        this._toggleDropdown('formStatusDropdown');
    },

    changeFormStatus(status) {
        PartnersState.formStatus = status;
        this._updateStatusBadge('formStatusText', status);
        this._closeDropdown('formStatusDropdown');
    }
};
