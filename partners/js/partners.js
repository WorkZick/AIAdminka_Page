// Partners App - Modern UI with Templates (independent from Team Info)
const partnersApp = {
    selectedPartnerId: null,
    editingPartnerId: null,
    sortField: null,
    sortDirection: 'asc',
    pendingImportData: null,

    // Template system
    isTemplateMode: false,
    editingTemplateId: null,
    currentTemplateId: null,
    templateFields: [],

    // Avatar/crop system
    cropData: {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        isDragging: false,
        startX: 0,
        startY: 0,
        originalSrc: null
    },

    // Form status
    formStatus: 'Работает',

    // Initialize
    init() {
        this.render();
        this.updateStats();
        this.setupImportHandler();
        this.setupCropHandlers();
    },

    // Toggle sidebar
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    },

    // Render table
    render() {
        const partnersData = this.getPartners();
        const tbody = document.getElementById('partnersTableBody');
        const emptyState = document.getElementById('emptyState');
        const table = document.querySelector('.partners-table');

        if (partnersData.length === 0) {
            emptyState.style.display = 'block';
            table.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            table.style.display = 'table';

            // Sort data if needed
            let sortedData = [...partnersData];
            if (this.sortField) {
                sortedData.sort((a, b) => {
                    const valA = (a[this.sortField] || '').toLowerCase();
                    const valB = (b[this.sortField] || '').toLowerCase();
                    if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
                    if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
                    return 0;
                });
            }

            tbody.innerHTML = sortedData.map(partner => {
                const statusClass = this.getStatusColor(partner.status || 'Работает');
                const avatar = partner.avatar || '';
                return `
                <tr onclick="partnersApp.selectPartner('${partner.id}')" class="${this.selectedPartnerId === partner.id ? 'selected' : ''}">
                    <td>
                        <div class="counters-cell">
                            <span>${partner.dep || 0}</span>
                            <span>${partner.with || 0}</span>
                            <span>${partner.comp || 0}</span>
                        </div>
                    </td>
                    <td>
                        <div class="partner-avatar">
                            ${avatar ? `<img src="${avatar}" alt="">` : ''}
                        </div>
                    </td>
                    <td>${this.escapeHtml(partner.fullName || '')}</td>
                    <td>${this.escapeHtml(partner.method || '')}</td>
                    <td>${this.escapeHtml(partner.subagent || '')}</td>
                    <td>${this.escapeHtml(partner.subagentId || '')}</td>
                    <td><span class="status-badge ${statusClass}">${this.escapeHtml(partner.status || 'Работает')}</span></td>
                    <td>
                        <img class="row-arrow" src="icons/arrow.svg" width="20" height="20" alt="Открыть" style="transform: rotate(${this.selectedPartnerId === partner.id ? '180deg' : '0deg'}); transition: transform 0.2s ease;">
                    </td>
                </tr>
            `}).join('');
        }

        this.updateStats();
    },

    // Get partners from storage
    getPartners() {
        return StorageManager.getArray('partners-data');
    },

    // Update statistics
    updateStats() {
        const partners = this.getPartners();
        document.getElementById('totalCount').textContent = partners.length;

        // Count unique methods
        const uniqueMethods = new Set(partners.map(p => p.method).filter(Boolean));
        document.getElementById('methodsCount').textContent = uniqueMethods.size;
    },

    // Sort by field
    sortBy(field) {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }
        this.render();
    },

    // Filter table
    filterTable() {
        const searchValue = document.getElementById('searchInput').value.toLowerCase();
        const rows = document.querySelectorAll('.partners-table tbody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchValue) ? '' : 'none';
        });
    },

    // Select partner
    selectPartner(id) {
        if (this.selectedPartnerId === id) {
            this.deselectPartner();
            return;
        }

        this.selectedPartnerId = id;
        this.render();
        this.showPartnerCard(id);
    },

    // Deselect partner
    deselectPartner() {
        this.selectedPartnerId = null;
        this.render();
        this.showStatsPanel();
    },

    // Show stats panel
    showStatsPanel() {
        document.getElementById('statsPanel').style.display = 'flex';
        document.getElementById('partnerCard').style.display = 'none';
        document.getElementById('partnerForm').style.display = 'none';
    },

    // Show partner card
    showPartnerCard(id) {
        const partners = this.getPartners();
        const partner = partners.find(p => p.id === id);
        if (!partner) return;

        document.getElementById('statsPanel').style.display = 'none';
        document.getElementById('partnerCard').style.display = 'flex';
        document.getElementById('partnerForm').style.display = 'none';

        // Set avatar
        const cardAvatar = document.getElementById('cardAvatar');
        if (partner.avatar) {
            cardAvatar.src = partner.avatar;
            cardAvatar.style.display = 'block';
        } else {
            cardAvatar.style.display = 'none';
        }

        // Set name, position, status
        document.getElementById('cardFullName').textContent = partner.fullName || '-';
        document.getElementById('cardPosition').textContent = partner.position || '-';

        // Set status badge
        const status = partner.status || 'Работает';
        const statusText = document.getElementById('cardStatusText');
        statusText.textContent = status;
        statusText.className = 'status-badge ' + this.getStatusColor(status);

        // Generate card body with all fields
        const cardBody = document.getElementById('cardBody');
        cardBody.innerHTML = this.generateCardInfo(partner);
    },

    // Get status color class
    getStatusColor(status) {
        const colors = {
            'Работает': 'green',
            'В отпуске': 'yellow',
            'Командировка': 'blue',
            'Уволен': 'red',
            'Болеет': 'purple'
        };
        return colors[status] || 'green';
    },

    // Generate card info HTML
    generateCardInfo(partner) {
        let html = '';

        // Counters
        html += `
            <div class="info-group counters-info">
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

        // Default fields
        html += `
            <div class="info-group">
                <span class="info-label">Метод:</span>
                <span class="info-value">${this.escapeHtml(partner.method || '-')}</span>
            </div>
            <div class="info-group">
                <span class="info-label">Субагент:</span>
                <span class="info-value">${this.escapeHtml(partner.subagent || '-')}</span>
            </div>
            <div class="info-group">
                <span class="info-label">ID Субагента:</span>
                <span class="info-value">${this.escapeHtml(partner.subagentId || '-')}</span>
            </div>
        `;

        // Custom fields from template
        if (partner.customFields) {
            Object.entries(partner.customFields).forEach(([label, value]) => {
                if (value) {
                    html += `
                        <div class="info-group">
                            <span class="info-label">${this.escapeHtml(label)}:</span>
                            <span class="info-value">${this.escapeHtml(value)}</span>
                        </div>
                    `;
                }
            });
        }

        return html;
    },

    // Toggle status dropdown in card
    toggleStatusDropdown() {
        const dropdown = document.getElementById('cardStatusDropdown');
        dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
    },

    // Change status from card
    changeStatus(status) {
        if (!this.selectedPartnerId) return;

        const partners = this.getPartners();
        const partner = partners.find(p => p.id === this.selectedPartnerId);
        if (!partner) return;

        // Update in storage
        StorageManager.updateItem('partners-data', this.selectedPartnerId, { status });

        // Update UI
        const statusText = document.getElementById('cardStatusText');
        statusText.textContent = status;
        statusText.className = 'status-badge ' + this.getStatusColor(status);

        // Hide dropdown
        document.getElementById('cardStatusDropdown').style.display = 'none';
    },

    // Toggle form status dropdown
    toggleFormStatusDropdown() {
        const dropdown = document.getElementById('formStatusDropdown');
        dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
    },

    // Change form status
    changeFormStatus(status) {
        this.formStatus = status;
        const statusText = document.getElementById('formStatusText');
        statusText.textContent = status;
        statusText.className = 'status-badge ' + this.getStatusColor(status);

        // Hide dropdown
        document.getElementById('formStatusDropdown').style.display = 'none';
    },

    // Show add modal (form on right panel)
    showAddModal() {
        this.editingPartnerId = null;
        this.selectedPartnerId = null;
        this.isTemplateMode = false;
        this.formStatus = 'Работает';
        this.render();

        document.getElementById('statsPanel').style.display = 'none';
        document.getElementById('partnerCard').style.display = 'none';
        document.getElementById('partnerForm').style.display = 'flex';

        document.getElementById('formTitle').textContent = 'Добавить партнера';
        document.getElementById('formSaveBtnText').textContent = 'Добавить партнера';
        document.getElementById('formDeleteBtn').style.display = 'none';

        // Show template selector
        document.getElementById('formTemplateSelector').style.display = 'flex';

        // Hide template fields container
        document.getElementById('templateFieldsContainer').style.display = 'none';

        // Show form body
        document.getElementById('formBody').style.display = 'block';

        // Show partner info section
        document.querySelector('.form-partner-info').style.display = 'flex';

        // Remove dynamically added template fields
        this.removeDynamicFields();

        // Show all default fields
        const formGroups = document.querySelectorAll('#formBody .form-group-inline');
        formGroups.forEach(group => {
            group.style.display = 'flex';
        });

        // Reset header fields visibility (show all by default)
        const formAvatar = document.querySelector('.form-avatar');
        const formFullName = document.getElementById('formFullName');
        const formPosition = document.getElementById('formPosition');
        const formStatusBadge = document.getElementById('formStatusBadge');

        if (formAvatar) formAvatar.style.display = 'flex';
        if (formFullName) formFullName.style.display = 'block';
        if (formPosition) formPosition.style.display = 'block';
        if (formStatusBadge) formStatusBadge.style.display = 'flex';

        // Clear form
        document.getElementById('formFullName').value = '';
        document.getElementById('formPosition').value = '';
        document.getElementById('formDep').value = '';
        document.getElementById('formWith').value = '';
        document.getElementById('formComp').value = '';
        document.getElementById('formMethod').value = '';
        document.getElementById('formSubagent').value = '';
        document.getElementById('formSubagentId').value = '';

        // Reset avatar
        const formAvatarImg = document.getElementById('formAvatar');
        formAvatarImg.src = '';
        formAvatarImg.style.display = 'none';
        document.querySelector('.form-avatar-placeholder').style.display = 'block';

        // Reset status
        const statusText = document.getElementById('formStatusText');
        statusText.textContent = 'Работает';
        statusText.className = 'status-badge green';

        // Load template list and apply default if exists
        this.updateTemplateList();
    },

    // Edit from card
    editFromCard() {
        if (!this.selectedPartnerId) return;

        const partners = this.getPartners();
        const partner = partners.find(p => p.id === this.selectedPartnerId);
        if (!partner) return;

        this.editingPartnerId = this.selectedPartnerId;
        this.isTemplateMode = false;
        this.formStatus = partner.status || 'Работает';

        document.getElementById('statsPanel').style.display = 'none';
        document.getElementById('partnerCard').style.display = 'none';
        document.getElementById('partnerForm').style.display = 'flex';

        document.getElementById('formTitle').textContent = 'Редактировать партнера';
        document.getElementById('formSaveBtnText').textContent = 'Сохранить изменения';

        // Hide template selector when editing
        document.getElementById('formTemplateSelector').style.display = 'none';

        // Hide template fields container
        document.getElementById('templateFieldsContainer').style.display = 'none';

        // Show form body
        document.getElementById('formBody').style.display = 'block';

        // Show partner info section
        document.querySelector('.form-partner-info').style.display = 'flex';

        // Remove dynamically added template fields first
        this.removeDynamicFields();

        // Show all default fields
        const formGroups = document.querySelectorAll('#formBody .form-group-inline');
        formGroups.forEach(group => {
            group.style.display = 'flex';
        });

        // Reset header fields visibility (show all when editing)
        const formAvatarDiv = document.querySelector('.form-avatar');
        const formFullName = document.getElementById('formFullName');
        const formPosition = document.getElementById('formPosition');
        const formStatusBadge = document.getElementById('formStatusBadge');

        if (formAvatarDiv) formAvatarDiv.style.display = 'flex';
        if (formFullName) formFullName.style.display = 'block';
        if (formPosition) formPosition.style.display = 'block';
        if (formStatusBadge) formStatusBadge.style.display = 'flex';

        // Fill form
        document.getElementById('formFullName').value = partner.fullName || '';
        document.getElementById('formPosition').value = partner.position || '';
        document.getElementById('formDep').value = partner.dep || '';
        document.getElementById('formWith').value = partner.with || '';
        document.getElementById('formComp').value = partner.comp || '';
        document.getElementById('formMethod').value = partner.method || '';
        document.getElementById('formSubagent').value = partner.subagent || '';
        document.getElementById('formSubagentId').value = partner.subagentId || '';

        // Set avatar
        const formAvatar = document.getElementById('formAvatar');
        const placeholder = document.querySelector('.form-avatar-placeholder');
        if (partner.avatar) {
            formAvatar.src = partner.avatar;
            formAvatar.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            formAvatar.src = '';
            formAvatar.style.display = 'none';
            placeholder.style.display = 'block';
        }

        // Set status
        const statusText = document.getElementById('formStatusText');
        statusText.textContent = this.formStatus;
        statusText.className = 'status-badge ' + this.getStatusColor(this.formStatus);

        // If partner has custom fields, add them to the form
        if (partner.customFields) {
            Object.entries(partner.customFields).forEach(([label, value]) => {
                const fieldId = 'customField_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                const fieldHtml = `
                    <div class="form-group-inline" data-custom-field="true">
                        <label>${this.escapeHtml(label)}:</label>
                        <input type="text" id="${fieldId}" value="${this.escapeHtml(value)}" data-field-label="${this.escapeHtml(label)}">
                    </div>
                `;
                document.getElementById('formBody').insertAdjacentHTML('beforeend', fieldHtml);
            });
        }
    },

    // Close form
    closeForm() {
        this.editingPartnerId = null;
        this.isTemplateMode = false;
        this.editingTemplateId = null;

        // Hide template fields container
        document.getElementById('templateFieldsContainer').style.display = 'none';

        // Show form body
        document.getElementById('formBody').style.display = 'block';

        // Show partner info section
        document.querySelector('.form-partner-info').style.display = 'flex';

        // Remove dynamically added fields
        this.removeDynamicFields();

        // Show all default fields
        const formGroups = document.querySelectorAll('#formBody .form-group-inline');
        formGroups.forEach(group => {
            group.style.display = 'flex';
        });

        // Reset header fields visibility and remove disabled state
        const formAvatar = document.querySelector('.form-avatar');
        const formFullName = document.getElementById('formFullName');
        const formPosition = document.getElementById('formPosition');
        const formStatusBadge = document.getElementById('formStatusBadge');

        if (formAvatar) {
            formAvatar.style.display = 'flex';
            formAvatar.classList.remove('disabled');
            formAvatar.style.pointerEvents = 'auto';
        }
        if (formFullName) {
            formFullName.style.display = 'block';
            formFullName.classList.remove('disabled');
            formFullName.readOnly = false;
        }
        if (formPosition) {
            formPosition.style.display = 'block';
            formPosition.classList.remove('disabled');
            formPosition.readOnly = false;
        }
        if (formStatusBadge) {
            formStatusBadge.style.display = 'flex';
            formStatusBadge.classList.remove('disabled');
        }

        if (this.selectedPartnerId) {
            this.showPartnerCard(this.selectedPartnerId);
        } else {
            this.showStatsPanel();
        }
    },

    // Remove dynamically added fields
    removeDynamicFields() {
        const dynamicFields = document.querySelectorAll('#formBody .form-group-inline[data-custom-field="true"]');
        dynamicFields.forEach(field => field.remove());

        const templateFields = document.querySelectorAll('#formBody .form-group-inline');
        templateFields.forEach(group => {
            const input = group.querySelector('input, textarea');
            if (input && input.id.startsWith('templateField_')) {
                group.remove();
            }
        });
    },

    // Handle avatar upload
    handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.cropData.originalSrc = e.target.result;
            this.showCropModal(e.target.result);
        };
        reader.readAsDataURL(file);
    },

    // Show crop modal
    showCropModal(imageSrc) {
        const modal = document.getElementById('cropModal');
        const cropImage = document.getElementById('cropImage');

        cropImage.src = imageSrc;
        this.cropData.scale = 1;
        this.cropData.offsetX = 0;
        this.cropData.offsetY = 0;

        modal.classList.add('active');

        // Center image after load
        cropImage.onload = () => {
            this.updateCropTransform();
        };
    },

    // Close crop modal
    closeCropModal() {
        document.getElementById('cropModal').classList.remove('active');
        document.getElementById('formAvatarInput').value = '';
    },

    // Setup crop handlers
    setupCropHandlers() {
        const cropPreview = document.getElementById('cropPreview');
        if (!cropPreview) return;

        // Mouse wheel for zoom
        cropPreview.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.cropData.scale = Math.max(0.5, Math.min(3, this.cropData.scale + delta));
            this.updateCropTransform();
        });

        // Drag for position
        cropPreview.addEventListener('mousedown', (e) => {
            this.cropData.isDragging = true;
            this.cropData.startX = e.clientX - this.cropData.offsetX;
            this.cropData.startY = e.clientY - this.cropData.offsetY;
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.cropData.isDragging) return;
            this.cropData.offsetX = e.clientX - this.cropData.startX;
            this.cropData.offsetY = e.clientY - this.cropData.startY;
            this.updateCropTransform();
        });

        document.addEventListener('mouseup', () => {
            this.cropData.isDragging = false;
        });
    },

    // Update crop transform
    updateCropTransform() {
        const cropImage = document.getElementById('cropImage');
        if (!cropImage) return;

        cropImage.style.transform = `translate(${this.cropData.offsetX}px, ${this.cropData.offsetY}px) scale(${this.cropData.scale})`;
        cropImage.style.left = '50%';
        cropImage.style.top = '50%';
        cropImage.style.marginLeft = `-${cropImage.naturalWidth / 2}px`;
        cropImage.style.marginTop = `-${cropImage.naturalHeight / 2}px`;
    },

    // Apply crop
    applyCrop() {
        const cropPreview = document.getElementById('cropPreview');
        const cropImage = document.getElementById('cropImage');

        // Create canvas to extract cropped image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 200; // Output size

        canvas.width = size;
        canvas.height = size;

        // Calculate crop area
        const previewRect = cropPreview.getBoundingClientRect();
        const imageRect = cropImage.getBoundingClientRect();

        const scaleX = cropImage.naturalWidth / imageRect.width;
        const scaleY = cropImage.naturalHeight / imageRect.height;

        const cropX = (previewRect.left - imageRect.left) * scaleX;
        const cropY = (previewRect.top - imageRect.top) * scaleY;
        const cropWidth = previewRect.width * scaleX;
        const cropHeight = previewRect.height * scaleY;

        ctx.drawImage(
            cropImage,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, size, size
        );

        // Get cropped image data
        const croppedData = canvas.toDataURL('image/jpeg', 0.8);

        // Set avatar preview
        const formAvatar = document.getElementById('formAvatar');
        const placeholder = document.querySelector('.form-avatar-placeholder');
        formAvatar.src = croppedData;
        formAvatar.style.display = 'block';
        placeholder.style.display = 'none';

        this.closeCropModal();
    },

    // Save from form
    saveFromForm() {
        // Check if we're in template mode
        if (this.isTemplateMode) {
            this.saveTemplate();
            return;
        }

        const fullName = document.getElementById('formFullName').value.trim();
        const position = document.getElementById('formPosition').value.trim();
        const dep = parseInt(document.getElementById('formDep').value) || 0;
        const withVal = parseInt(document.getElementById('formWith').value) || 0;
        const comp = parseInt(document.getElementById('formComp').value) || 0;
        const method = document.getElementById('formMethod').value.trim();
        const subagent = document.getElementById('formSubagent').value.trim();
        const subagentId = document.getElementById('formSubagentId').value.trim();
        const avatar = document.getElementById('formAvatar').src || '';

        if (!method || !subagent || !subagentId) {
            alert('Пожалуйста, заполните все обязательные поля (Метод, Субагент, ID Субагента)');
            return;
        }

        // Collect custom fields
        const customFields = {};
        const customFieldInputs = document.querySelectorAll('#formBody input[data-field-label]');
        customFieldInputs.forEach(input => {
            const label = input.getAttribute('data-field-label');
            const value = input.value.trim();
            if (label && value) {
                customFields[label] = value;
            }
        });

        // Also collect template fields
        const templateFieldInputs = document.querySelectorAll('#formBody .form-group-inline');
        templateFieldInputs.forEach(group => {
            const input = group.querySelector('input, textarea');
            const label = group.querySelector('label');
            if (input && input.id.startsWith('templateField_') && label) {
                const value = input.value.trim();
                const labelText = label.textContent.replace(':', '').trim();
                if (value) {
                    customFields[labelText] = value;
                }
            }
        });

        const partnerData = {
            fullName,
            position,
            dep,
            with: withVal,
            comp,
            status: this.formStatus,
            avatar: avatar && avatar !== window.location.href ? avatar : '',
            method,
            subagent,
            subagentId,
            customFields
        };

        if (this.editingPartnerId) {
            // Update existing
            if (StorageManager.updateItem('partners-data', this.editingPartnerId, partnerData)) {
                this.selectedPartnerId = this.editingPartnerId;
                this.editingPartnerId = null;
                this.render();
                this.showPartnerCard(this.selectedPartnerId);
            } else {
                alert('Ошибка при обновлении партнера');
            }
        } else {
            // Add new
            const newPartner = StorageManager.addItem('partners-data', partnerData);
            if (newPartner) {
                this.selectedPartnerId = newPartner.id;
                this.editingPartnerId = null;
                this.render();
                this.showPartnerCard(this.selectedPartnerId);
            } else {
                alert('Ошибка при добавлении партнера');
            }
        }
    },

    // Delete from card
    deleteFromCard() {
        if (!this.selectedPartnerId) return;

        if (confirm('Вы уверены, что хотите удалить этого партнера?')) {
            if (StorageManager.deleteItem('partners-data', this.selectedPartnerId)) {
                this.selectedPartnerId = null;
                this.render();
                this.showStatsPanel();
            } else {
                alert('Ошибка при удалении партнера');
            }
        }
    },

    // Delete from form
    deleteFromForm() {
        if (!this.editingPartnerId) return;

        if (confirm('Вы уверены, что хотите удалить этого партнера?')) {
            if (StorageManager.deleteItem('partners-data', this.editingPartnerId)) {
                this.editingPartnerId = null;
                this.selectedPartnerId = null;
                this.render();
                this.showStatsPanel();
            } else {
                alert('Ошибка при удалении партнера');
            }
        }
    },

    // ==================== TEMPLATE SYSTEM ====================

    handleTemplateChange() {
        const templateSelect = document.getElementById('templateSelect');
        const value = templateSelect.value;

        // Save current template selection before action
        if (!value.includes('_template')) {
            this.currentTemplateId = value;
        }

        if (value === 'add_template') {
            this.isTemplateMode = true;
            this.showTemplateEditor();
        } else if (value === 'delete_template') {
            this.showDeleteTemplateDialog();
        } else if (value === 'rename_template') {
            this.showRenameTemplateDialog();
        } else if (value === 'edit_template') {
            this.showEditTemplateDialog();
        } else if (value) {
            this.currentTemplateId = value;
            this.applyTemplate(value);
        }
    },

    restoreTemplateSelection() {
        const templateSelect = document.getElementById('templateSelect');
        if (this.currentTemplateId !== undefined) {
            templateSelect.value = this.currentTemplateId;
        } else {
            const templates = JSON.parse(localStorage.getItem('partnersTemplates') || '{}');
            const defaultTemplate = Object.values(templates).find(t => t.isDefault);
            templateSelect.value = defaultTemplate ? defaultTemplate.id : '';
        }
    },

    showDeleteTemplateDialog() {
        const templates = JSON.parse(localStorage.getItem('partnersTemplates') || '{}');
        const templateList = Object.values(templates);

        if (templateList.length === 0) {
            alert('Нет шаблонов для удаления');
            this.restoreTemplateSelection();
            return;
        }

        let optionsText = 'Выберите шаблон для удаления:\n\n';
        templateList.forEach((template, index) => {
            optionsText += `${index + 1}. ${template.name}\n`;
        });
        optionsText += '\nВведите номер шаблона:';

        const input = prompt(optionsText);

        if (!input) {
            this.restoreTemplateSelection();
            return;
        }

        const index = parseInt(input) - 1;

        if (isNaN(index) || index < 0 || index >= templateList.length) {
            alert('Неверный номер шаблона');
            this.restoreTemplateSelection();
            return;
        }

        const templateToDelete = templateList[index];

        if (confirm(`Удалить шаблон "${templateToDelete.name}"?`)) {
            if (this.currentTemplateId === templateToDelete.id) {
                this.currentTemplateId = undefined;
            }
            delete templates[templateToDelete.id];
            localStorage.setItem('partnersTemplates', JSON.stringify(templates));
            this.updateTemplateList();
            alert('Шаблон удален!');
        } else {
            this.restoreTemplateSelection();
        }
    },

    showRenameTemplateDialog() {
        const templates = JSON.parse(localStorage.getItem('partnersTemplates') || '{}');
        const templateList = Object.values(templates);

        if (templateList.length === 0) {
            alert('Нет шаблонов для переименования');
            this.restoreTemplateSelection();
            return;
        }

        let optionsText = 'Выберите шаблон для переименования:\n\n';
        templateList.forEach((template, index) => {
            const isDefault = template.isDefault ? ' (основной)' : '';
            optionsText += `${index + 1}. ${template.name}${isDefault}\n`;
        });
        optionsText += '\nВведите номер шаблона:';

        const input = prompt(optionsText);

        if (!input) {
            this.restoreTemplateSelection();
            return;
        }

        const index = parseInt(input) - 1;

        if (isNaN(index) || index < 0 || index >= templateList.length) {
            alert('Неверный номер шаблона');
            this.restoreTemplateSelection();
            return;
        }

        const templateToRename = templateList[index];

        const newName = prompt(`Введите новое название для шаблона "${templateToRename.name}":`, templateToRename.name);

        if (!newName || !newName.trim()) {
            this.restoreTemplateSelection();
            return;
        }

        const makeDefault = confirm('Установить этот шаблон как основной?\n(Основной шаблон будет автоматически выбран при добавлении партнера)');

        if (makeDefault) {
            Object.values(templates).forEach(t => {
                t.isDefault = false;
            });
        }

        templates[templateToRename.id].name = newName.trim();
        templates[templateToRename.id].isDefault = makeDefault;

        localStorage.setItem('partnersTemplates', JSON.stringify(templates));
        this.updateTemplateList();
        alert('Шаблон обновлен!');
    },

    showEditTemplateDialog() {
        const templates = JSON.parse(localStorage.getItem('partnersTemplates') || '{}');
        const templateList = Object.values(templates);

        if (templateList.length === 0) {
            alert('Нет шаблонов для редактирования');
            this.restoreTemplateSelection();
            return;
        }

        let optionsText = 'Выберите шаблон для редактирования:\n\n';
        templateList.forEach((template, index) => {
            const isDefault = template.isDefault ? ' (основной)' : '';
            optionsText += `${index + 1}. ${template.name}${isDefault}\n`;
        });
        optionsText += '\nВведите номер шаблона:';

        const input = prompt(optionsText);

        if (!input) {
            this.restoreTemplateSelection();
            return;
        }

        const index = parseInt(input) - 1;

        if (isNaN(index) || index < 0 || index >= templateList.length) {
            alert('Неверный номер шаблона');
            this.restoreTemplateSelection();
            return;
        }

        const templateToEdit = templateList[index];

        this.isTemplateMode = true;
        this.editingTemplateId = templateToEdit.id;
        this.showTemplateEditor(templateToEdit);
    },

    showTemplateEditor(existingTemplate = null) {
        // Hide template selector
        document.getElementById('formTemplateSelector').style.display = 'none';

        // Change button text
        document.getElementById('formSaveBtnText').textContent = 'Сохранить шаблон';

        // Hide default form fields
        document.getElementById('formBody').style.display = 'none';

        // Show partner info section (as preview, disabled)
        document.querySelector('.form-partner-info').style.display = 'flex';

        // Set preview placeholders
        const fullNameInput = document.getElementById('formFullName');
        const positionInput = document.getElementById('formPosition');
        const statusBadge = document.getElementById('formStatusBadge');
        const formAvatar = document.querySelector('.form-avatar');

        fullNameInput.value = 'Ф.И.О.';
        positionInput.value = 'Должность';

        // Disable inputs
        fullNameInput.classList.add('disabled');
        positionInput.classList.add('disabled');
        if (statusBadge) statusBadge.classList.add('disabled');

        fullNameInput.readOnly = true;
        positionInput.readOnly = true;

        // Disable avatar upload
        if (formAvatar) {
            formAvatar.classList.add('disabled');
            formAvatar.style.pointerEvents = 'none';
        }

        // Show template fields container
        document.getElementById('templateFieldsContainer').style.display = 'block';

        // Clear template fields list
        document.getElementById('templateFieldsList').innerHTML = '';

        // Load existing template fields or initialize empty
        if (existingTemplate && existingTemplate.fields) {
            this.templateFields = existingTemplate.fields.map(f => ({...f}));
            existingTemplate.fields.forEach(field => {
                const fieldHtml = `
                    <div class="template-field-item" data-field-id="${field.id}">
                        <input type="text" class="template-field-input" placeholder="Название поля" value="${this.escapeHtml(field.label)}"
                            onchange="partnersApp.updateTemplateFieldLabel('${field.id}', this.value)">
                        <select class="template-field-type" onchange="partnersApp.updateTemplateFieldType('${field.id}', this.value)">
                            <option value="text" ${field.type === 'text' ? 'selected' : ''}>Текст</option>
                            <option value="email" ${field.type === 'email' ? 'selected' : ''}>Email</option>
                            <option value="tel" ${field.type === 'tel' ? 'selected' : ''}>Телефон</option>
                            <option value="date" ${field.type === 'date' ? 'selected' : ''}>Дата</option>
                            <option value="textarea" ${field.type === 'textarea' ? 'selected' : ''}>Текстовая область</option>
                        </select>
                        <button class="template-field-remove" onclick="partnersApp.removeTemplateField('${field.id}')">
                            <img src="icons/cross.svg" width="16" height="16" alt="Удалить">
                        </button>
                    </div>
                `;
                document.getElementById('templateFieldsList').insertAdjacentHTML('beforeend', fieldHtml);
            });
        } else {
            this.templateFields = [];
        }
    },

    addTemplateField() {
        const fieldId = 'templateField_' + Date.now();

        const field = {
            id: fieldId,
            label: '',
            type: 'text'
        };

        this.templateFields.push(field);

        const fieldHtml = `
            <div class="template-field-item" data-field-id="${fieldId}">
                <input type="text" class="template-field-input" placeholder="Название поля"
                    onchange="partnersApp.updateTemplateFieldLabel('${fieldId}', this.value)">
                <select class="template-field-type" onchange="partnersApp.updateTemplateFieldType('${fieldId}', this.value)">
                    <option value="text">Текст</option>
                    <option value="email">Email</option>
                    <option value="tel">Телефон</option>
                    <option value="date">Дата</option>
                    <option value="textarea">Текстовая область</option>
                </select>
                <button class="template-field-remove" onclick="partnersApp.removeTemplateField('${fieldId}')">
                    <img src="icons/cross.svg" width="16" height="16" alt="Удалить">
                </button>
            </div>
        `;

        document.getElementById('templateFieldsList').insertAdjacentHTML('beforeend', fieldHtml);
    },

    updateTemplateFieldLabel(fieldId, label) {
        const field = this.templateFields.find(f => f.id === fieldId);
        if (field) {
            field.label = label;
        }
    },

    updateTemplateFieldType(fieldId, type) {
        const field = this.templateFields.find(f => f.id === fieldId);
        if (field) {
            field.type = type;
        }
    },

    removeTemplateField(fieldId) {
        this.templateFields = this.templateFields.filter(f => f.id !== fieldId);
        const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (fieldElement) {
            fieldElement.remove();
        }
    },

    applyTemplate(templateId) {
        if (!templateId) return;

        const savedTemplates = JSON.parse(localStorage.getItem('partnersTemplates') || '{}');
        const template = savedTemplates[templateId];

        if (template) {
            // Remove previously added dynamic template fields
            this.removeDynamicFields();

            // Hide default fields except the first 3 (Method, Subagent, SubagentId)
            const defaultGroups = document.querySelectorAll('#formBody .form-group-inline');
            defaultGroups.forEach((group, index) => {
                // Keep first 3 default fields visible
                if (index >= 3) {
                    group.style.display = 'none';
                }
            });

            // Create dynamic fields from template
            if (template.fields) {
                template.fields.forEach(field => {
                    const fieldHtml = `
                        <div class="form-group-inline">
                            <label>${this.escapeHtml(field.label)}:</label>
                            ${field.type === 'textarea'
                                ? `<textarea id="${field.id}" placeholder="${this.escapeHtml(field.label)}" data-field-label="${this.escapeHtml(field.label)}"></textarea>`
                                : `<input type="${field.type}" id="${field.id}" placeholder="${this.escapeHtml(field.label)}" data-field-label="${this.escapeHtml(field.label)}">`
                            }
                        </div>
                    `;

                    document.getElementById('formBody').insertAdjacentHTML('beforeend', fieldHtml);
                });
            }
        }
    },

    saveTemplate() {
        // Validate that all fields have labels (if there are any fields)
        const invalidFields = this.templateFields.filter(f => !f.label.trim());
        if (invalidFields.length > 0) {
            alert('Все поля должны иметь название');
            return;
        }

        const templates = JSON.parse(localStorage.getItem('partnersTemplates') || '{}');

        if (this.editingTemplateId) {
            // Editing existing template
            const template = templates[this.editingTemplateId];
            const templateName = prompt('Введите название шаблона:', template.name);
            if (!templateName || !templateName.trim()) {
                this.editingTemplateId = null;
                return;
            }

            templates[this.editingTemplateId].name = templateName.trim();
            templates[this.editingTemplateId].fields = this.templateFields.map(f => ({
                id: f.id,
                label: f.label,
                type: f.type
            }));
        } else {
            // Creating new template
            const templateName = prompt('Введите название шаблона:');
            if (!templateName || !templateName.trim()) return;

            const templateId = 'template_' + Date.now();
            templates[templateId] = {
                id: templateId,
                name: templateName.trim(),
                fields: this.templateFields.map(f => ({
                    id: f.id,
                    label: f.label,
                    type: f.type
                })),
                createdAt: new Date().toISOString()
            };
        }

        localStorage.setItem('partnersTemplates', JSON.stringify(templates));

        // Reset editing mode
        this.editingTemplateId = null;

        // Enable avatar and fields back
        const formAvatar = document.querySelector('.form-avatar');
        if (formAvatar) {
            formAvatar.classList.remove('disabled');
            formAvatar.style.pointerEvents = 'auto';
        }

        const fullNameInput = document.getElementById('formFullName');
        const positionInput = document.getElementById('formPosition');
        const statusBadge = document.getElementById('formStatusBadge');

        if (fullNameInput) {
            fullNameInput.classList.remove('disabled');
            fullNameInput.readOnly = false;
        }
        if (positionInput) {
            positionInput.classList.remove('disabled');
            positionInput.readOnly = false;
        }
        if (statusBadge) {
            statusBadge.classList.remove('disabled');
        }

        // Show partner info section again
        document.querySelector('.form-partner-info').style.display = 'flex';

        // Close form and refresh template list
        this.closeForm();
        this.updateTemplateList();

        alert('Шаблон сохранен!');
    },

    updateTemplateList() {
        const templateSelect = document.getElementById('templateSelect');
        const templates = JSON.parse(localStorage.getItem('partnersTemplates') || '{}');

        // Clear all options
        templateSelect.innerHTML = '';

        // Find default template
        const defaultTemplate = Object.values(templates).find(t => t.isDefault);

        // Add base "Шаблон" option only if no templates exist or no default template
        if (Object.keys(templates).length === 0 || !defaultTemplate) {
            const baseOption = document.createElement('option');
            baseOption.value = '';
            baseOption.textContent = 'Шаблон';
            templateSelect.appendChild(baseOption);
        }

        Object.values(templates).forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            const isDefault = template.isDefault ? ' (основной)' : '';
            option.textContent = template.name + isDefault;
            templateSelect.appendChild(option);
        });

        // Auto-select and apply default template if exists
        if (defaultTemplate) {
            templateSelect.value = defaultTemplate.id;
            this.currentTemplateId = defaultTemplate.id;
            this.applyTemplate(defaultTemplate.id);
        } else {
            this.currentTemplateId = '';
        }

        const addOption = document.createElement('option');
        addOption.value = 'add_template';
        addOption.textContent = '+ Добавить шаблон';
        templateSelect.appendChild(addOption);

        if (Object.keys(templates).length > 0) {
            const editOption = document.createElement('option');
            editOption.value = 'edit_template';
            editOption.textContent = 'Изменить шаблон';
            templateSelect.appendChild(editOption);

            const renameOption = document.createElement('option');
            renameOption.value = 'rename_template';
            renameOption.textContent = 'Переименовать шаблон';
            templateSelect.appendChild(renameOption);

            const deleteOption = document.createElement('option');
            deleteOption.value = 'delete_template';
            deleteOption.textContent = '- Удалить шаблон';
            templateSelect.appendChild(deleteOption);
        }
    },

    // ==================== EXPORT/IMPORT ====================

    // Export JSON
    exportJSON() {
        const partners = this.getPartners();
        if (partners.length === 0) {
            alert('Нет данных для экспорта');
            return;
        }

        const exportData = {
            type: 'partners-export',
            version: '1.0',
            exportDate: new Date().toISOString(),
            data: partners
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `partners-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // Show import dialog
    showImportDialog() {
        document.getElementById('importModal').classList.add('active');
        document.getElementById('importFileInput').value = '';
        document.getElementById('importPreview').style.display = 'none';
        document.getElementById('importBtn').disabled = true;
        this.pendingImportData = null;
    },

    // Close import dialog
    closeImportDialog() {
        document.getElementById('importModal').classList.remove('active');
        this.pendingImportData = null;
    },

    // Setup import handler
    setupImportHandler() {
        const fileInput = document.getElementById('importFileInput');
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);

                    if (data.type !== 'partners-export' || !Array.isArray(data.data)) {
                        throw new Error('Неверный формат файла');
                    }

                    this.pendingImportData = data.data;

                    const preview = document.getElementById('importPreview');
                    preview.style.display = 'block';
                    preview.innerHTML = `<strong>Найдено партнеров:</strong> ${data.data.length}<br><small>Дата экспорта: ${new Date(data.exportDate).toLocaleString('ru-RU')}</small>`;

                    document.getElementById('importBtn').disabled = false;
                } catch (err) {
                    alert('Ошибка чтения файла: ' + err.message);
                    document.getElementById('importPreview').style.display = 'none';
                    document.getElementById('importBtn').disabled = true;
                }
            };
            reader.readAsText(file);
        });
    },

    // Import data
    importData() {
        if (!this.pendingImportData) return;

        const currentData = this.getPartners();
        const existingIds = new Set(currentData.map(p => p.id));

        let added = 0;
        this.pendingImportData.forEach(partner => {
            if (!existingIds.has(partner.id)) {
                StorageManager.addItem('partners-data', {
                    fullName: partner.fullName,
                    position: partner.position,
                    status: partner.status,
                    avatar: partner.avatar,
                    method: partner.method,
                    subagent: partner.subagent,
                    subagentId: partner.subagentId,
                    customFields: partner.customFields || {}
                });
                added++;
            }
        });

        this.closeImportDialog();
        this.render();
        alert(`Импорт завершен. Добавлено партнеров: ${added}`);
    },

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    partnersApp.init();
});

// Close modals on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (document.getElementById('importModal').classList.contains('active')) {
            partnersApp.closeImportDialog();
        }
        if (document.getElementById('cropModal').classList.contains('active')) {
            partnersApp.closeCropModal();
        }
        // Close status dropdowns
        document.getElementById('cardStatusDropdown').style.display = 'none';
        document.getElementById('formStatusDropdown').style.display = 'none';
    }
});

// Close modals on backdrop click
document.getElementById('importModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        partnersApp.closeImportDialog();
    }
});

document.getElementById('cropModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        partnersApp.closeCropModal();
    }
});

// Close status dropdowns when clicking outside
document.addEventListener('click', (e) => {
    const cardStatusBadge = document.getElementById('cardStatusBadge');
    const cardStatusDropdown = document.getElementById('cardStatusDropdown');
    const formStatusBadge = document.getElementById('formStatusBadge');
    const formStatusDropdown = document.getElementById('formStatusDropdown');

    if (cardStatusBadge && !cardStatusBadge.contains(e.target)) {
        cardStatusDropdown.style.display = 'none';
    }
    if (formStatusBadge && !formStatusBadge.contains(e.target)) {
        formStatusDropdown.style.display = 'none';
    }
});
