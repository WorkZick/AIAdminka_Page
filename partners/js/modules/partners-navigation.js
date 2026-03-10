// Partners Navigation - partner selection, card display, status management
const PartnersNavigation = {
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
        document.getElementById('hintPanel').classList.remove('hidden');
        document.getElementById('partnerCard').classList.add('hidden');
        document.getElementById('partnerForm').classList.add('hidden');
    },

    showPartnerCard(id) {
        const partners = PartnersState.getPartners();
        const partner = partners.find(p => p.id === id);
        if (!partner) return;

        document.getElementById('hintPanel').classList.add('hidden');
        document.getElementById('partnerCard').classList.remove('hidden');
        document.getElementById('partnerForm').classList.add('hidden');

        const cardAvatar = document.getElementById('cardAvatar');
        const cardAvatarPlaceholder = document.getElementById('cardAvatarPlaceholder');
        // Используем avatarFileId для получения URL из Google Drive
        const avatarUrl = partner.avatarFileId ? CloudStorage.getImageUrl(partner.avatarFileId) : '';
        if (avatarUrl) {
            cardAvatar.src = avatarUrl;
            cardAvatar.classList.remove('hidden');
            if (cardAvatarPlaceholder) cardAvatarPlaceholder.classList.add('hidden');
        } else {
            cardAvatar.src = '';
            cardAvatar.classList.add('hidden');
            if (cardAvatarPlaceholder) cardAvatarPlaceholder.classList.remove('hidden');
        }

        document.getElementById('cardFullName').textContent = partner.subagent || '-';
        document.getElementById('cardPosition').textContent = partner.subagentId || '-';

        const status = partner.status || 'Открыт';
        const statusText = document.getElementById('cardStatusText');
        statusText.textContent = status;
        statusText.className = 'status-badge ' + PartnersUtils.getStatusColor(status);

        const cardBody = document.getElementById('cardBody');
        cardBody.innerHTML = PartnersNavigation.generateCardInfo(partner);
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

    toggleStatusDropdown() {
        const dropdown = document.getElementById('cardStatusDropdown');
        const arrow = document.querySelector('#cardStatusBadge .status-dropdown-icon');
        const isOpen = dropdown.classList.contains('hidden');
        dropdown.classList.toggle('hidden');
        if (arrow) {
            if (isOpen) {
                arrow.classList.add('dropdown-arrow-open');
                arrow.classList.remove('dropdown-arrow-closed');
            } else {
                arrow.classList.add('dropdown-arrow-closed');
                arrow.classList.remove('dropdown-arrow-open');
            }
        }
    },

    async changeStatus(status) {
        if (!PartnersState.selectedPartnerId) return;

        const partners = PartnersState.getPartners();
        const partner = partners.find(p => p.id === PartnersState.selectedPartnerId);
        if (!partner) return;

        try {
            partner.status = status;
            await CloudStorage.updatePartner(PartnersState.selectedPartnerId, partner);

            // Update cache
            const index = PartnersState.cachedPartners.findIndex(p => p.id === PartnersState.selectedPartnerId);
            if (index !== -1) {
                PartnersState.cachedPartners[index].status = status;
            }

            const statusText = document.getElementById('cardStatusText');
            statusText.textContent = status;
            statusText.className = 'status-badge ' + PartnersUtils.getStatusColor(status);

            document.getElementById('cardStatusDropdown').classList.add('hidden');
            const arrow = document.querySelector('#cardStatusBadge .status-dropdown-icon');
            if (arrow) {
                arrow.classList.add('dropdown-arrow-closed');
                arrow.classList.remove('dropdown-arrow-open');
            }

            PartnersRenderer.render();
        } catch (error) {
            PartnersUtils.showError('Ошибка обновления статуса: ' + error.message);
        }
    },

    toggleFormStatusDropdown() {
        const dropdown = document.getElementById('formStatusDropdown');
        const arrow = document.querySelector('#formStatusBadge .status-dropdown-icon');
        const isOpen = dropdown.classList.contains('hidden');
        dropdown.classList.toggle('hidden');
        if (arrow) {
            if (isOpen) {
                arrow.classList.add('dropdown-arrow-open');
                arrow.classList.remove('dropdown-arrow-closed');
            } else {
                arrow.classList.add('dropdown-arrow-closed');
                arrow.classList.remove('dropdown-arrow-open');
            }
        }
    },

    changeFormStatus(status) {
        PartnersState.formStatus = status;
        const statusText = document.getElementById('formStatusText');
        statusText.textContent = status;
        statusText.className = 'status-badge ' + PartnersUtils.getStatusColor(status);

        document.getElementById('formStatusDropdown').classList.add('hidden');
        const arrow = document.querySelector('#formStatusBadge .status-dropdown-icon');
        if (arrow) {
            arrow.classList.add('dropdown-arrow-closed');
            arrow.classList.remove('dropdown-arrow-open');
        }
    }
};
