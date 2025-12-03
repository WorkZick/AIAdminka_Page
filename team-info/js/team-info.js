// Team Info - Modern Interface
const teamInfo = {
    data: [],
    currentEmployeeId: null,
    sortField: null,
    sortDirection: 'asc',
    teamName: 'Vadim team',
    sidebarCollapsed: false,
    formChanged: false,
    originalFormData: null,
    tempImageData: null,
    currentFormStatus: 'Работает',
    isDeleteMode: false,
    navigationStack: [], // Stack for navigation history
    cropSettings: {
        scale: 1,
        posX: 0,
        posY: 0
    },

    async init() {
        try {
            this.data = await storage.loadData();
            this.loadTeamName();
            this.loadSidebarState();
            this.setupTextareaAutoResize();
            this.render();
            this.updateStats();
            console.log('✅ Team Info loaded');
        } catch (error) {
            console.error('Init error:', error);
        }
    },

    setupTextareaAutoResize() {
        const textarea = document.getElementById('formComment');
        if (!textarea) return;

        const autoResize = () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        };

        textarea.addEventListener('input', autoResize);
        textarea.addEventListener('change', autoResize);
    },

    loadSidebarState() {
        const collapsed = localStorage.getItem('sidebar-collapsed') === 'true';
        this.sidebarCollapsed = collapsed;
        if (collapsed) {
            document.getElementById('sidebar').classList.add('collapsed');
        }
    },

    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        const sidebar = document.getElementById('sidebar');

        if (this.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }

        localStorage.setItem('sidebar-collapsed', this.sidebarCollapsed);
    },

    loadTeamName() {
        const savedName = localStorage.getItem('team-name');
        if (savedName) {
            this.teamName = savedName;
        }
        // Update all team name displays
        const teamNameElement = document.querySelector('.team-name');
        if (teamNameElement) {
            teamNameElement.childNodes[0].textContent = this.teamName + ' ';
        }
        const cardTeamName = document.getElementById('cardTeamName');
        if (cardTeamName) {
            cardTeamName.textContent = this.teamName;
        }
        const formTeamName = document.getElementById('formTeamName');
        if (formTeamName) {
            formTeamName.textContent = this.teamName;
        }
    },

    saveTeamName(name) {
        this.teamName = name;
        localStorage.setItem('team-name', name);
        // Update all team name displays
        const teamNameElement = document.querySelector('.team-name');
        if (teamNameElement) {
            teamNameElement.childNodes[0].textContent = name + ' ';
        }
        const cardTeamName = document.getElementById('cardTeamName');
        if (cardTeamName) {
            cardTeamName.textContent = name;
        }
        const formTeamName = document.getElementById('formTeamName');
        if (formTeamName) {
            formTeamName.textContent = name;
        }
    },

    editTeamName() {
        const newName = prompt('Введите название команды:', this.teamName);
        if (newName && newName.trim()) {
            this.saveTeamName(newName.trim());
        }
    },

    render() {
        const tbody = document.getElementById('employeesTableBody');
        const emptyState = document.getElementById('emptyState');
        const table = document.querySelector('.employees-table');

        if (this.data.length === 0) {
            table.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        table.style.display = 'table';
        emptyState.style.display = 'none';

        // Clear tbody and build rows with safe event listeners
        tbody.innerHTML = '';

        this.data.forEach(employee => {
            const statusClass = this.getStatusClass(employee.status || 'Работает');
            const statusText = employee.status || 'Работает';
            const reddyId = employee.reddyId || employee.predefinedFields?.['Reddy'] || '';
            const birthday = employee.birthday ? this.formatDate(employee.birthday) : '';
            const crmLogin = employee.crmLogin || '';
            const avatar = employee.avatar || '';
            const isValidAvatar = this.isValidImageUrl(avatar);
            const formattedName = this.formatFullNameForTable(employee.fullName || '');

            const tr = document.createElement('tr');
            tr.className = this.currentEmployeeId === employee.id ? 'selected' : '';
            tr.dataset.employeeId = employee.id;
            tr.addEventListener('click', () => this.openCard(employee.id));

            tr.innerHTML = `
                <td>
                    <span class="status-badge ${this.escapeHtml(statusClass)}">${this.escapeHtml(statusText)}</span>
                </td>
                <td>
                    <div class="employee-info">
                        <div class="employee-avatar"></div>
                    </div>
                </td>
                <td><div class="employee-name">${formattedName}</div></td>
                <td>${this.escapeHtml(employee.position || '')}</td>
                <td>${this.escapeHtml(crmLogin)}</td>
                <td>${this.escapeHtml(reddyId)}</td>
                <td>${birthday}</td>
                <td>
                    <svg class="row-arrow" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </td>
            `;

            // Safely set avatar image
            if (isValidAvatar) {
                const avatarDiv = tr.querySelector('.employee-avatar');
                const img = document.createElement('img');
                img.src = avatar;
                img.alt = '';
                avatarDiv.appendChild(img);
            }

            tbody.appendChild(tr);
        });
    },

    getStatusClass(status) {
        const statusMap = {
            'Работает': 'green',
            'В отпуске': 'yellow',
            'Командировка': 'blue',
            'Уволен': 'red',
            'Болеет': 'purple'
        };
        return statusMap[status] || 'green';
    },

    formatFullNameForTable(fullName) {
        if (!fullName) return '';

        const parts = fullName.trim().split(/\s+/);
        if (parts.length === 0) return '';
        if (parts.length === 1) return this.escapeHtml(parts[0]);
        if (parts.length === 2) return this.escapeHtml(parts.join(' '));

        // Фамилия Имя на первой строке, Отчество на второй
        const lastName = parts[0];
        const firstName = parts[1];
        const patronymic = parts.slice(2).join(' ');

        return `${this.escapeHtml(lastName)} ${this.escapeHtml(firstName)}<br>${this.escapeHtml(patronymic)}`;
    },

    filterTable() {
        const search = document.getElementById('searchInput').value.toLowerCase();
        const rows = document.querySelectorAll('.employees-table tbody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(search) ? '' : 'none';
        });
    },

    sortBy(field) {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }

        this.data.sort((a, b) => {
            let aVal, bVal;

            if (field === 'name') {
                aVal = a.fullName || '';
                bVal = b.fullName || '';
            } else if (field === 'status') {
                aVal = a.status || 'Работает';
                bVal = b.status || 'Работает';
            }

            if (this.sortDirection === 'asc') {
                return aVal.localeCompare(bVal);
            } else {
                return bVal.localeCompare(aVal);
            }
        });

        this.render();
    },

    pushNavigation(view, employeeId = null) {
        this.navigationStack.push({ view, employeeId });
    },

    popNavigation() {
        return this.navigationStack.pop();
    },

    getCurrentView() {
        if (this.navigationStack.length === 0) return 'stats';
        return this.navigationStack[this.navigationStack.length - 1].view;
    },

    openCard(id) {
        // Check if clicking on already opened card - toggle behavior
        const employeeCard = document.getElementById('employeeCard');
        if (this.currentEmployeeId === id && employeeCard.style.display === 'flex') {
            // Close the card and return to stats
            this.closeCard();
            return;
        }

        // Check if form is open and has changes
        const form = document.getElementById('employeeForm');
        if (form.style.display === 'flex' && this.formChanged) {
            const confirmMsg = this.currentEmployeeId
                ? 'У вас есть несохраненные изменения. Закрыть форму без сохранения?'
                : 'Вы не завершили добавление сотрудника. Закрыть форму без сохранения?';

            if (!confirm(confirmMsg)) {
                return;
            }

            // Close form
            form.style.display = 'none';
            this.formChanged = false;
            this.originalFormData = null;
        } else if (form.style.display === 'flex') {
            // No changes, just close
            form.style.display = 'none';
            this.formChanged = false;
            this.originalFormData = null;
        }

        this.currentEmployeeId = id;
        const employee = this.data.find(e => e.id === id);
        if (!employee) return;

        this.render();

        const statsPanel = document.getElementById('statsPanel');

        statsPanel.style.display = 'none';
        employeeCard.style.display = 'flex';

        // Add to navigation stack
        this.pushNavigation('card', id);

        document.getElementById('cardTeamName').textContent = this.teamName;
        document.getElementById('cardName').textContent = employee.fullName || '';
        document.getElementById('cardPosition').textContent = employee.position || '';

        const currentStatus = employee.status || 'Работает';
        const statusClass = this.getStatusClass(currentStatus);
        const statusText = document.getElementById('cardStatusText');
        statusText.textContent = currentStatus;
        statusText.className = `status-badge ${statusClass}`;

        // Set avatar with URL validation
        const cardAvatar = document.getElementById('cardAvatar');
        if (employee.avatar && this.isValidImageUrl(employee.avatar)) {
            cardAvatar.src = employee.avatar;
            cardAvatar.style.display = 'block';
        } else {
            cardAvatar.src = '';
            cardAvatar.style.display = 'none';
        }

        const cardBody = document.getElementById('cardBody');
        cardBody.innerHTML = this.generateCardInfo(employee);
    },

    toggleStatusDropdown() {
        const dropdown = document.getElementById('cardStatusDropdown');
        const isVisible = dropdown.style.display === 'flex';
        dropdown.style.display = isVisible ? 'none' : 'flex';
    },

    toggleFormStatusDropdown() {
        const dropdown = document.getElementById('formStatusDropdown');
        const isVisible = dropdown.style.display === 'flex';
        dropdown.style.display = isVisible ? 'none' : 'flex';
    },

    changeFormStatus(newStatus) {
        this.currentFormStatus = newStatus;
        const statusClass = this.getStatusClass(newStatus);
        const statusText = document.getElementById('formStatusText');
        statusText.textContent = newStatus;
        statusText.className = `status-badge ${statusClass}`;

        // Hide dropdown
        document.getElementById('formStatusDropdown').style.display = 'none';

        // Trigger form change detection
        this.onFormChange();
    },

    async changeStatus(newStatus) {
        if (!this.currentEmployeeId) return;

        const employee = this.data.find(e => e.id === this.currentEmployeeId);
        if (!employee) return;

        employee.status = newStatus;
        employee.updatedAt = new Date().toISOString();

        if (await storage.saveData(this.data)) {
            // Update badge
            const statusClass = this.getStatusClass(newStatus);
            const statusText = document.getElementById('cardStatusText');
            statusText.textContent = newStatus;
            statusText.className = `status-badge ${statusClass}`;

            // Hide dropdown
            document.getElementById('cardStatusDropdown').style.display = 'none';

            this.render();
            this.updateStats();
        } else {
            alert('Ошибка сохранения статуса');
        }
    },

    generateCardInfo(employee) {
        const fields = [
            { label: 'Reddy ID', value: employee.reddyId || employee.predefinedFields?.['Reddy'] || '' },
            { label: 'Рабочий Telegram', value: employee.corpTelegram || employee.predefinedFields?.['Корп. Telegram'] || '' },
            { label: 'Личный Telegram', value: employee.personalTelegram || '' },
            { label: 'День рождения', value: employee.birthday ? this.formatDate(employee.birthday) : '' },
            { label: 'Рабочая почта', value: employee.corpEmail || employee.predefinedFields?.['Корп. e-mail'] || '' },
            { label: 'Личная почта', value: employee.personalEmail || '' },
            { label: 'Рабочий телефон', value: employee.corpPhone || employee.predefinedFields?.['Корп. телефон'] || '' },
            { label: 'Личный телефон', value: employee.personalPhone || '' },
            { label: 'Офис', value: employee.office || '' },
            { label: 'Начало работы', value: employee.startDate ? this.formatDate(employee.startDate) : '' },
            { label: 'Компания', value: employee.company || '' },
            { label: 'Логин CRM', value: employee.crmLogin || '' },
            { label: 'Примечание', value: employee.comment || '' }
        ];

        let html = '';

        fields.forEach(field => {
            if (field.value || field.label === 'Примечание') {
                const isComment = field.label === 'Примечание';

                if (isComment) {
                    const placeholder = field.value ? '' : field.label;
                    const valueText = field.value ? this.escapeHtml(field.value) : placeholder;
                    const valueClass = field.value ? 'info-value textarea-style' : 'info-value textarea-style placeholder';

                    html += `
                        <div class="info-group vertical">
                            <div class="${valueClass}">${valueText}</div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="info-group">
                            <div class="info-label">${field.label}:</div>
                            <div class="info-value">${this.escapeHtml(field.value)}</div>
                        </div>
                    `;
                }
            }
        });

        return html;
    },

    closeCard() {
        const employeeCard = document.getElementById('employeeCard');
        const statsPanel = document.getElementById('statsPanel');

        employeeCard.style.display = 'none';

        // Pop current card from navigation
        this.popNavigation();

        // Show stats panel (always return to stats when closing card)
        statsPanel.style.display = 'flex';

        this.currentEmployeeId = null;
        this.render();
    },

    updateStats() {
        const total = this.data.length;
        const working = this.data.filter(e => (e.status || 'Работает') === 'Работает').length;
        const sick = this.data.filter(e => e.status === 'Болеет').length;
        const leave = this.data.filter(e => e.status === 'В отпуске').length;
        const trip = this.data.filter(e => e.status === 'Командировка').length;
        const fired = this.data.filter(e => e.status === 'Уволен').length;

        document.getElementById('totalCount').textContent = total;
        document.getElementById('workingCount').textContent = working;
        document.getElementById('sickCount').textContent = sick;
        document.getElementById('leaveCount').textContent = leave;
        document.getElementById('tripCount').textContent = trip;
        document.getElementById('firedCount').textContent = fired;
    },

    showAddModal() {
        // Hide stats and card
        document.getElementById('statsPanel').style.display = 'none';
        document.getElementById('employeeCard').style.display = 'none';

        // Show form
        const form = document.getElementById('employeeForm');
        form.style.display = 'flex';

        // Add to navigation stack
        this.pushNavigation('form', null);

        // Reset template mode
        this.isTemplateMode = false;

        // Show template selector (only when adding)
        document.getElementById('formTemplateSelector').style.display = 'flex';

        // Hide template fields container
        document.getElementById('templateFieldsContainer').style.display = 'none';

        // Show form body
        document.querySelector('.form-body').style.display = 'block';

        // Remove any field toggle buttons from previous template mode
        const toggleBtns = document.querySelectorAll('.field-toggle-btn');
        toggleBtns.forEach(btn => btn.remove());

        // Remove dynamically added template fields first
        const dynamicFields = document.querySelectorAll('.form-body .form-group-inline');
        dynamicFields.forEach(group => {
            const input = group.querySelector('input, textarea');
            if (input && input.id.startsWith('templateField_')) {
                group.remove();
            }
        });

        // Show all default fields initially
        const formGroups = document.querySelectorAll('.form-body .form-group-inline');
        formGroups.forEach(group => {
            group.classList.remove('field-disabled');
            group.style.display = 'flex';
        });

        // Load template list (will auto-select and apply default template if exists)
        // This will hide default fields and add template fields if needed
        this.updateTemplateList();

        // Reset form
        this.currentEmployeeId = null;
        this.currentAvatar = null;
        document.getElementById('formTeamName').textContent = this.teamName;
        document.getElementById('formSaveBtnText').textContent = 'Добавить сотрудника';
        document.getElementById('formDeleteBtn').style.display = 'none';

        document.getElementById('formFullName').value = '';
        document.getElementById('formPosition').value = '';

        // Set status badge
        this.currentFormStatus = 'Работает';
        const statusText = document.getElementById('formStatusText');
        statusText.textContent = 'Работает';
        statusText.className = 'status-badge green';
        document.getElementById('formReddyId').value = '';
        document.getElementById('formCorpTelegram').value = '';
        document.getElementById('formPersonalTelegram').value = '';
        document.getElementById('formBirthday').value = '';
        document.getElementById('formCorpEmail').value = '';
        document.getElementById('formPersonalEmail').value = '';
        document.getElementById('formCorpPhone').value = '';
        document.getElementById('formPersonalPhone').value = '';
        document.getElementById('formOffice').value = '';
        document.getElementById('formStartDate').value = '';
        document.getElementById('formCompany').value = '';
        document.getElementById('formCrmLogin').value = '';
        document.getElementById('formComment').value = '';

        // Reset avatar
        const formAvatar = document.getElementById('formAvatar');
        const placeholder = document.querySelector('.form-avatar-placeholder');
        formAvatar.style.display = 'none';
        if (placeholder) placeholder.style.display = 'block';

        // Reset change tracking
        this.formChanged = false;
        this.originalFormData = this.getFormData();
        this.attachFormChangeListeners();
        this.attachAutoResizeListeners();

        document.getElementById('formFullName').focus();
    },

    handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.showCropModal(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    },

    showCropModal(imageData) {
        this.tempImageData = imageData;
        this.cropSettings = { scale: 1, posX: 0, posY: 0 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };

        const cropImage = document.getElementById('cropImage');
        const cropPreview = document.getElementById('cropPreview');
        cropImage.src = imageData;

        cropImage.onload = () => {
            this.updateCropPreview();
        };

        // Mouse drag handlers
        const handleMouseDown = (e) => {
            this.isDragging = true;
            this.dragStart = {
                x: e.clientX - this.cropSettings.posX,
                y: e.clientY - this.cropSettings.posY
            };
            cropPreview.style.cursor = 'grabbing';
        };

        const handleMouseMove = (e) => {
            if (!this.isDragging) return;

            this.cropSettings.posX = e.clientX - this.dragStart.x;
            this.cropSettings.posY = e.clientY - this.dragStart.y;
            this.updateCropPreview();
        };

        const handleMouseUp = () => {
            this.isDragging = false;
            cropPreview.style.cursor = 'move';
        };

        // Wheel zoom handler
        const handleWheel = (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.cropSettings.scale = Math.max(0.5, Math.min(3, this.cropSettings.scale + delta));
            this.updateCropPreview();
        };

        // Remove old listeners if any
        cropPreview.onmousedown = null;
        cropPreview.onmousemove = null;
        cropPreview.onmouseup = null;
        cropPreview.onwheel = null;

        // Add new listeners
        cropPreview.onmousedown = handleMouseDown;
        document.onmousemove = handleMouseMove;
        document.onmouseup = handleMouseUp;
        cropPreview.onwheel = handleWheel;

        document.getElementById('cropModal').classList.add('active');
    },

    updateCropPreview() {
        const cropImage = document.getElementById('cropImage');
        const cropPreview = document.getElementById('cropPreview');

        if (!cropImage.complete) return;

        const scale = this.cropSettings.scale;
        const translateX = this.cropSettings.posX;
        const translateY = this.cropSettings.posY;

        // Calculate initial size to cover container (like background-size: cover)
        const previewWidth = cropPreview.clientWidth;
        const previewHeight = cropPreview.clientHeight;
        const imgWidth = cropImage.naturalWidth;
        const imgHeight = cropImage.naturalHeight;

        const scaleToFit = Math.max(
            previewWidth / imgWidth,
            previewHeight / imgHeight
        );

        // Set base size to cover the container
        cropImage.style.width = imgWidth * scaleToFit + 'px';
        cropImage.style.height = imgHeight * scaleToFit + 'px';

        // Apply transform: center image + user offset + user scale
        cropImage.style.transform = `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${scale})`;
    },

    closeCropModal() {
        document.getElementById('cropModal').classList.remove('active');
        this.tempImageData = null;
        this.cropSettings = { scale: 1, posX: 0, posY: 0 };
        this.isDragging = false;

        // Remove event listeners
        const cropPreview = document.getElementById('cropPreview');
        cropPreview.onmousedown = null;
        cropPreview.onwheel = null;
        document.onmousemove = null;
        document.onmouseup = null;

        document.getElementById('formAvatarInput').value = '';
    },

    applyCrop() {
        const cropImage = document.getElementById('cropImage');
        const cropPreview = document.getElementById('cropPreview');

        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.onload = () => {
            const previewWidth = cropPreview.clientWidth;
            const previewHeight = cropPreview.clientHeight;

            const scale = this.cropSettings.scale;
            const translateX = this.cropSettings.posX;
            const translateY = this.cropSettings.posY;

            const imgWidth = img.width;
            const imgHeight = img.height;

            // Calculate scale to cover preview
            const scaleToFit = Math.max(
                previewWidth / imgWidth,
                previewHeight / imgHeight
            );

            // Calculate displayed size in pixels
            const displayedWidth = imgWidth * scaleToFit * scale;
            const displayedHeight = imgHeight * scaleToFit * scale;

            // Calculate where image is positioned in preview (top-left corner)
            const imgLeft = previewWidth / 2 - displayedWidth / 2 + translateX;
            const imgTop = previewHeight / 2 - displayedHeight / 2 + translateY;

            // Calculate what portion of original image is visible in preview
            // If image extends beyond preview bounds, we crop to preview bounds
            const visibleLeft = Math.max(0, -imgLeft);
            const visibleTop = Math.max(0, -imgTop);
            const visibleRight = Math.min(displayedWidth, previewWidth - imgLeft);
            const visibleBottom = Math.min(displayedHeight, previewHeight - imgTop);

            const visibleWidth = visibleRight - visibleLeft;
            const visibleHeight = visibleBottom - visibleTop;

            // Convert visible area back to original image coordinates
            const sourceX = (visibleLeft / displayedWidth) * imgWidth;
            const sourceY = (visibleTop / displayedHeight) * imgHeight;
            const sourceWidth = (visibleWidth / displayedWidth) * imgWidth;
            const sourceHeight = (visibleHeight / displayedHeight) * imgHeight;

            // Draw the visible portion to fill entire canvas (stretching to square)
            ctx.drawImage(
                img,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                0,
                0,
                canvas.width,
                canvas.height
            );

            this.currentAvatar = canvas.toDataURL('image/jpeg', 0.9);

            const formAvatar = document.getElementById('formAvatar');
            const placeholder = document.querySelector('.form-avatar-placeholder');
            formAvatar.src = this.currentAvatar;
            formAvatar.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';

            this.closeCropModal();
        };
        img.src = this.tempImageData;
    },

    editFromCard() {
        if (this.currentEmployeeId) {
            this.showEditForm(this.currentEmployeeId);
        }
    },

    showEditForm(id) {
        const employee = this.data.find(e => e.id === id);
        if (!employee) return;

        // Hide card
        document.getElementById('employeeCard').style.display = 'none';

        // Show form
        const form = document.getElementById('employeeForm');
        form.style.display = 'flex';

        // Add to navigation stack
        this.pushNavigation('form', id);

        // Hide template selector (only for adding)
        document.getElementById('formTemplateSelector').style.display = 'none';

        // Fill form with employee data
        this.currentEmployeeId = id;
        this.currentAvatar = employee.avatar || null;
        document.getElementById('formTeamName').textContent = this.teamName;
        document.getElementById('formSaveBtnText').textContent = 'Сохранить';
        document.getElementById('formDeleteBtn').style.display = 'none';

        document.getElementById('formFullName').value = employee.fullName || '';
        document.getElementById('formPosition').value = employee.position || '';

        // Set status badge
        this.currentFormStatus = employee.status || 'Работает';
        const statusClass = this.getStatusClass(this.currentFormStatus);
        const statusText = document.getElementById('formStatusText');
        statusText.textContent = this.currentFormStatus;
        statusText.className = `status-badge ${statusClass}`;
        document.getElementById('formReddyId').value = employee.reddyId || employee.predefinedFields?.['Reddy'] || '';
        document.getElementById('formCorpTelegram').value = employee.corpTelegram || employee.predefinedFields?.['Корп. Telegram'] || '';
        document.getElementById('formPersonalTelegram').value = employee.personalTelegram || '';
        document.getElementById('formBirthday').value = employee.birthday || '';
        document.getElementById('formCorpEmail').value = employee.corpEmail || employee.predefinedFields?.['Корп. e-mail'] || '';
        document.getElementById('formPersonalEmail').value = employee.personalEmail || '';
        document.getElementById('formCorpPhone').value = employee.corpPhone || employee.predefinedFields?.['Корп. телефон'] || '';
        document.getElementById('formPersonalPhone').value = employee.personalPhone || '';
        document.getElementById('formOffice').value = employee.office || '';
        document.getElementById('formStartDate').value = employee.startDate || '';
        document.getElementById('formCompany').value = employee.company || '';
        document.getElementById('formCrmLogin').value = employee.crmLogin || '';
        document.getElementById('formComment').value = employee.comment || '';

        // Set avatar
        const formAvatar = document.getElementById('formAvatar');
        const placeholder = document.querySelector('.form-avatar-placeholder');
        if (employee.avatar) {
            formAvatar.src = employee.avatar;
            formAvatar.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        } else {
            formAvatar.style.display = 'none';
            if (placeholder) placeholder.style.display = 'block';
        }

        // Reset change tracking
        this.formChanged = false;
        this.originalFormData = this.getFormData();
        this.attachFormChangeListeners();
        this.attachAutoResizeListeners();
    },

    closeForm() {
        const employeeId = this.currentEmployeeId;
        document.getElementById('employeeForm').style.display = 'none';
        this.formChanged = false;
        this.originalFormData = null;

        // Reset template mode
        this.isTemplateMode = false;
        this.editingTemplateId = null;

        // Enable avatar upload back
        const formAvatar = document.querySelector('.form-avatar');
        if (formAvatar) {
            formAvatar.classList.remove('disabled');
            formAvatar.style.pointerEvents = 'auto';
        }

        // Enable form fields
        const fullNameInput = document.getElementById('formFullName');
        const positionInput = document.getElementById('formPosition');
        const statusBadge = document.getElementById('formStatusBadge');

        fullNameInput.classList.remove('disabled');
        positionInput.classList.remove('disabled');
        statusBadge.classList.remove('disabled');

        fullNameInput.readOnly = false;
        positionInput.readOnly = false;

        // Hide template fields container
        document.getElementById('templateFieldsContainer').style.display = 'none';

        // Show form body
        document.querySelector('.form-body').style.display = 'block';

        // Remove any field toggle buttons
        const toggleBtns = document.querySelectorAll('.field-toggle-btn');
        toggleBtns.forEach(btn => btn.remove());

        // Remove disabled state from fields and show all default fields
        const formGroups = document.querySelectorAll('.form-body .form-group-inline');
        formGroups.forEach(group => {
            group.classList.remove('field-disabled');
            group.style.display = 'flex';
        });

        // Remove dynamically added template fields
        const dynamicFields = document.querySelectorAll('.form-body .form-group-inline');
        dynamicFields.forEach(group => {
            const input = group.querySelector('input, textarea');
            if (input && input.id.startsWith('templateField_')) {
                group.remove();
            }
        });

        // Pop current form from navigation
        this.popNavigation();

        // Navigate to previous view from stack
        const previousView = this.navigationStack.length > 0
            ? this.navigationStack[this.navigationStack.length - 1]
            : null;

        if (previousView && previousView.view === 'card' && previousView.employeeId) {
            // Return to employee card (without adding to stack again)
            this.currentEmployeeId = previousView.employeeId;
            const employee = this.data.find(e => e.id === previousView.employeeId);

            if (employee) {
                this.render();

                const employeeCard = document.getElementById('employeeCard');
                const statsPanel = document.getElementById('statsPanel');

                statsPanel.style.display = 'none';
                employeeCard.style.display = 'flex';

                document.getElementById('cardTeamName').textContent = this.teamName;
                document.getElementById('cardName').textContent = employee.fullName || '';
                document.getElementById('cardPosition').textContent = employee.position || '';

                const currentStatus = employee.status || 'Работает';
                const statusClass = this.getStatusClass(currentStatus);
                const statusText = document.getElementById('cardStatusText');
                statusText.textContent = currentStatus;
                statusText.className = `status-badge ${statusClass}`;

                // Set avatar with URL validation
                const cardAvatar = document.getElementById('cardAvatar');
                if (employee.avatar && this.isValidImageUrl(employee.avatar)) {
                    cardAvatar.src = employee.avatar;
                    cardAvatar.style.display = 'block';
                } else {
                    cardAvatar.src = '';
                    cardAvatar.style.display = 'none';
                }

                const cardBody = document.getElementById('cardBody');
                cardBody.innerHTML = this.generateCardInfo(employee);
            } else {
                // Employee not found, go to stats
                document.getElementById('statsPanel').style.display = 'flex';
                this.currentEmployeeId = null;
            }
        } else {
            // Return to stats panel
            document.getElementById('statsPanel').style.display = 'flex';
            this.currentEmployeeId = null;
        }
        this.render();
    },

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
            // Find and select default template
            const templates = JSON.parse(localStorage.getItem('teamInfoTemplates') || '{}');
            const defaultTemplate = Object.values(templates).find(t => t.isDefault);
            templateSelect.value = defaultTemplate ? defaultTemplate.id : '';
        }
    },

    showDeleteTemplateDialog() {
        const templates = JSON.parse(localStorage.getItem('teamInfoTemplates') || '{}');
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
            // If deleting current template, clear currentTemplateId
            if (this.currentTemplateId === templateToDelete.id) {
                this.currentTemplateId = undefined;
            }
            delete templates[templateToDelete.id];
            localStorage.setItem('teamInfoTemplates', JSON.stringify(templates));
            this.updateTemplateList();
            alert('Шаблон удален!');
        } else {
            this.restoreTemplateSelection();
        }
    },

    showRenameTemplateDialog() {
        const templates = JSON.parse(localStorage.getItem('teamInfoTemplates') || '{}');
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

        const makeDefault = confirm('Установить этот шаблон как основной?\n(Основной шаблон будет автоматически выбран при добавлении сотрудника)');

        // Remove default flag from all templates
        if (makeDefault) {
            Object.values(templates).forEach(t => {
                t.isDefault = false;
            });
        }

        templates[templateToRename.id].name = newName.trim();
        templates[templateToRename.id].isDefault = makeDefault;

        localStorage.setItem('teamInfoTemplates', JSON.stringify(templates));
        this.updateTemplateList();
        alert('Шаблон обновлен!');
    },

    showEditTemplateDialog() {
        const templates = JSON.parse(localStorage.getItem('teamInfoTemplates') || '{}');
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

        // Enter template edit mode
        this.isTemplateMode = true;
        this.editingTemplateId = templateToEdit.id;
        this.showTemplateEditor(templateToEdit);
    },

    showTemplateEditor(existingTemplate = null) {
        // Hide template selector
        document.getElementById('formTemplateSelector').style.display = 'none';

        // Change button text
        document.getElementById('formSaveBtnText').textContent = 'Сохранить шаблон';

        // Clear and disable form fields
        const fullNameInput = document.getElementById('formFullName');
        const positionInput = document.getElementById('formPosition');
        const statusBadge = document.getElementById('formStatusBadge');

        fullNameInput.value = 'Ф.И.О.';
        positionInput.value = 'Должность';

        fullNameInput.classList.add('disabled');
        positionInput.classList.add('disabled');
        statusBadge.classList.add('disabled');

        fullNameInput.readOnly = true;
        positionInput.readOnly = true;

        // Disable avatar upload
        const formAvatar = document.querySelector('.form-avatar');
        if (formAvatar) {
            formAvatar.classList.add('disabled');
            formAvatar.style.pointerEvents = 'none';
        }

        // Hide all default form fields (keep only photo, name, position, status)
        document.querySelector('.form-body').style.display = 'none';

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
                        <input type="text" class="template-field-input" placeholder="Название поля" value="${field.label}"
                            onchange="teamInfo.updateTemplateFieldLabel('${field.id}', this.value)">
                        <select class="template-field-type" onchange="teamInfo.updateTemplateFieldType('${field.id}', this.value)">
                            <option value="text" ${field.type === 'text' ? 'selected' : ''}>Текст</option>
                            <option value="email" ${field.type === 'email' ? 'selected' : ''}>Email</option>
                            <option value="tel" ${field.type === 'tel' ? 'selected' : ''}>Телефон</option>
                            <option value="date" ${field.type === 'date' ? 'selected' : ''}>Дата</option>
                            <option value="textarea" ${field.type === 'textarea' ? 'selected' : ''}>Текстовая область</option>
                        </select>
                        <button class="template-field-remove" onclick="teamInfo.removeTemplateField('${field.id}')">
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
                    onchange="teamInfo.updateTemplateFieldLabel('${fieldId}', this.value)">
                <select class="template-field-type" onchange="teamInfo.updateTemplateFieldType('${fieldId}', this.value)">
                    <option value="text">Текст</option>
                    <option value="email">Email</option>
                    <option value="tel">Телефон</option>
                    <option value="date">Дата</option>
                    <option value="textarea">Текстовая область</option>
                </select>
                <button class="template-field-remove" onclick="teamInfo.removeTemplateField('${fieldId}')">
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

        // Get templates from localStorage
        const savedTemplates = JSON.parse(localStorage.getItem('teamInfoTemplates') || '{}');
        const template = savedTemplates[templateId];

        if (template && template.fields) {
            // First, remove all previously added dynamic template fields
            const allGroups = document.querySelectorAll('.form-body .form-group-inline');
            allGroups.forEach(group => {
                const input = group.querySelector('input, textarea');
                if (input && input.id.startsWith('templateField_')) {
                    group.remove();
                }
            });

            // Then hide all remaining default form fields
            const defaultGroups = document.querySelectorAll('.form-body .form-group-inline');
            defaultGroups.forEach(group => {
                group.style.display = 'none';
            });

            // Finally, create dynamic fields from template
            template.fields.forEach(field => {
                const fieldHtml = `
                    <div class="form-group-inline">
                        <label>${field.label}:</label>
                        ${field.type === 'textarea'
                            ? `<textarea id="${field.id}" placeholder="${field.label}"></textarea>`
                            : `<input type="${field.type}" id="${field.id}" placeholder="${field.label}">`
                        }
                    </div>
                `;

                document.querySelector('.form-body').insertAdjacentHTML('beforeend', fieldHtml);
            });
        }
    },

    saveTemplate() {
        // Validate that all fields have labels
        const invalidFields = this.templateFields.filter(f => !f.label.trim());
        if (invalidFields.length > 0) {
            alert('Все поля должны иметь название');
            return;
        }

        if (this.templateFields.length === 0) {
            alert('Добавьте хотя бы одно поле для шаблона');
            return;
        }

        // Get templates from localStorage
        const templates = JSON.parse(localStorage.getItem('teamInfoTemplates') || '{}');

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

        localStorage.setItem('teamInfoTemplates', JSON.stringify(templates));

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

        fullNameInput.classList.remove('disabled');
        positionInput.classList.remove('disabled');
        statusBadge.classList.remove('disabled');

        fullNameInput.readOnly = false;
        positionInput.readOnly = false;

        // Close form and refresh template list
        this.closeForm();
        this.updateTemplateList();

        alert('Шаблон сохранен!');
    },

    updateTemplateList() {
        const templateSelect = document.getElementById('templateSelect');
        const templates = JSON.parse(localStorage.getItem('teamInfoTemplates') || '{}');

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
            // Apply default template automatically
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

    async saveFromForm() {
        // Check if we're in template mode
        if (this.isTemplateMode) {
            this.saveTemplate();
            return;
        }

        const fullName = document.getElementById('formFullName').value.trim();
        const position = document.getElementById('formPosition').value.trim();
        const status = this.currentFormStatus || 'Работает';

        // Get values from default fields (only if they exist and are visible)
        const getFieldValue = (id) => {
            const el = document.getElementById(id);
            return (el && el.offsetParent !== null) ? el.value.trim() : '';
        };

        const reddyId = getFieldValue('formReddyId');
        const corpTelegram = getFieldValue('formCorpTelegram');
        const personalTelegram = getFieldValue('formPersonalTelegram');
        const birthday = getFieldValue('formBirthday');
        const corpEmail = getFieldValue('formCorpEmail');
        const personalEmail = getFieldValue('formPersonalEmail');
        const corpPhone = getFieldValue('formCorpPhone');
        const personalPhone = getFieldValue('formPersonalPhone');
        const office = getFieldValue('formOffice');
        const startDate = getFieldValue('formStartDate');
        const company = getFieldValue('formCompany');
        const crmLogin = getFieldValue('formCrmLogin');
        const comment = getFieldValue('formComment');

        // Collect custom template fields
        const customFields = {};
        const templateFields = document.querySelectorAll('.form-body .form-group-inline');
        templateFields.forEach(group => {
            const input = group.querySelector('input, textarea');
            const label = group.querySelector('label');
            if (input && input.id.startsWith('templateField_') && label) {
                const value = input.value.trim();
                if (value) {
                    customFields[label.textContent.replace(':', '')] = value;
                }
            }
        });

        if (!fullName) {
            alert('Введите ФИО');
            return;
        }

        if (!position) {
            alert('Введите должность');
            return;
        }

        const employeeData = {
            fullName,
            position,
            status,
            reddyId,
            corpTelegram,
            personalTelegram,
            birthday,
            corpEmail,
            personalEmail,
            corpPhone,
            personalPhone,
            office,
            startDate,
            company,
            crmLogin,
            comment,
            avatar: this.currentAvatar || '',
            predefinedFields: {},
            customFields: customFields
        };

        // Store in predefinedFields for compatibility
        if (reddyId) employeeData.predefinedFields['Reddy'] = reddyId;
        if (corpTelegram) employeeData.predefinedFields['Корп. Telegram'] = corpTelegram;
        if (corpEmail) employeeData.predefinedFields['Корп. e-mail'] = corpEmail;
        if (corpPhone) employeeData.predefinedFields['Корп. телефон'] = corpPhone;

        // Add custom fields to predefinedFields as well
        Object.entries(customFields).forEach(([key, value]) => {
            employeeData.predefinedFields[key] = value;
        });

        if (this.currentEmployeeId) {
            // Edit existing
            const employee = this.data.find(e => e.id === this.currentEmployeeId);
            if (employee) {
                Object.assign(employee, employeeData);
                employee.updatedAt = new Date().toISOString();

                if (await storage.saveData(this.data)) {
                    const employeeId = this.currentEmployeeId;
                    document.getElementById('employeeForm').style.display = 'none';
                    this.formChanged = false;
                    this.originalFormData = null;
                    this.render();
                    this.updateStats();
                    this.openCard(employeeId);
                    alert('Сотрудник обновлен!');
                } else {
                    alert('Ошибка сохранения');
                }
            }
        } else {
            // Add new
            employeeData.id = Date.now();
            employeeData.createdAt = new Date().toISOString();

            this.data.unshift(employeeData);

            if (await storage.saveData(this.data)) {
                const newEmployeeId = employeeData.id;
                document.getElementById('employeeForm').style.display = 'none';
                this.formChanged = false;
                this.originalFormData = null;
                this.render();
                this.updateStats();
                this.openCard(newEmployeeId);
                alert('Сотрудник добавлен!');
            } else {
                alert('Ошибка сохранения');
            }
        }
    },

    async deleteFromForm() {
        if (!this.currentEmployeeId) return;

        const employee = this.data.find(e => e.id === this.currentEmployeeId);
        if (employee && confirm(`Удалить "${employee.fullName}"?`)) {
            this.data = this.data.filter(e => e.id !== this.currentEmployeeId);

            if (await storage.saveData(this.data)) {
                this.closeForm();
                this.render();
                this.updateStats();
                alert('Сотрудник удален!');
            } else {
                alert('Ошибка удаления');
            }
        }
    },

    async deleteFromCard() {
        if (!this.currentEmployeeId) return;

        const employee = this.data.find(e => e.id === this.currentEmployeeId);
        if (employee && confirm(`Удалить "${employee.fullName}"?`)) {
            this.data = this.data.filter(e => e.id !== this.currentEmployeeId);

            if (await storage.saveData(this.data)) {
                this.closeCard();
                this.render();
                this.updateStats();
                alert('Сотрудник удален!');
            } else {
                alert('Ошибка удаления');
            }
        }
    },

    async exportJSON() {
        if (this.data.length === 0) {
            alert('Нет данных для экспорта');
            return;
        }

        if (await storage.exportToFile(this.data)) {
            alert(`Экспортировано ${this.data.length} сотрудников!`);
        } else {
            alert('Ошибка экспорта');
        }
    },

    showImportDialog() {
        document.getElementById('importModal').classList.add('active');

        const fileInput = document.getElementById('importFileInput');
        const preview = document.getElementById('importPreview');
        const importBtn = document.getElementById('importBtn');

        fileInput.value = '';
        preview.style.display = 'none';
        importBtn.disabled = true;

        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file && file.type === 'application/json') {
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    const count = (data.data && data.data.length) || (Array.isArray(data) ? data.length : 0);

                    if (count > 0) {
                        preview.innerHTML = `✅ Готов к импорту: ${count} записей`;
                        preview.style.display = 'block';
                        importBtn.disabled = false;
                    } else {
                        preview.innerHTML = '⚠️ Нет данных';
                        preview.style.display = 'block';
                    }
                } catch (error) {
                    preview.innerHTML = '❌ Неверный формат';
                    preview.style.display = 'block';
                }
            }
        };
    },

    closeImportDialog() {
        document.getElementById('importModal').classList.remove('active');
    },

    async importData() {
        const file = document.getElementById('importFileInput').files[0];
        if (!file) return;

        if (confirm('Заменить всех сотрудников?')) {
            try {
                this.data = await storage.importFromFile(file);
                await storage.saveData(this.data);
                this.render();
                this.updateStats();
                this.closeImportDialog();
                alert(`Импортировано ${this.data.length} сотрудников!`);
            } catch (error) {
                alert('Ошибка импорта: ' + error.message);
            }
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    },

    // Validate URL for safe usage in img src
    isValidImageUrl(url) {
        if (!url) return false;
        // Allow data URLs and http/https URLs only
        return url.startsWith('data:image/') ||
               url.startsWith('http://') ||
               url.startsWith('https://');
    },

    formatDate(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    getFormData() {
        return {
            fullName: document.getElementById('formFullName').value,
            position: document.getElementById('formPosition').value,
            status: this.currentFormStatus || 'Работает',
            reddyId: document.getElementById('formReddyId').value,
            corpTelegram: document.getElementById('formCorpTelegram').value,
            personalTelegram: document.getElementById('formPersonalTelegram').value,
            birthday: document.getElementById('formBirthday').value,
            corpEmail: document.getElementById('formCorpEmail').value,
            personalEmail: document.getElementById('formPersonalEmail').value,
            corpPhone: document.getElementById('formCorpPhone').value,
            personalPhone: document.getElementById('formPersonalPhone').value,
            office: document.getElementById('formOffice').value,
            startDate: document.getElementById('formStartDate').value,
            company: document.getElementById('formCompany').value,
            crmLogin: document.getElementById('formCrmLogin').value,
            comment: document.getElementById('formComment').value
        };
    },

    attachFormChangeListeners() {
        const formFields = [
            'formFullName', 'formPosition', 'formReddyId',
            'formCorpTelegram', 'formPersonalTelegram', 'formBirthday',
            'formCorpEmail', 'formPersonalEmail', 'formCorpPhone',
            'formPersonalPhone', 'formOffice', 'formStartDate',
            'formCompany', 'formCrmLogin', 'formComment'
        ];

        formFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.removeEventListener('input', this.onFormChange.bind(this));
                field.addEventListener('input', this.onFormChange.bind(this));
            }
        });
    },

    onFormChange() {
        const currentData = this.getFormData();
        const hasChanges = JSON.stringify(currentData) !== JSON.stringify(this.originalFormData);
        this.formChanged = hasChanges;
    },

    attachAutoResizeListeners() {
        const autoResize = (textarea) => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        };

        const fullNameField = document.getElementById('formFullName');
        const positionField = document.getElementById('formPosition');

        if (fullNameField) {
            fullNameField.addEventListener('input', () => autoResize(fullNameField));
            // Initial resize
            autoResize(fullNameField);
        }

        if (positionField) {
            positionField.addEventListener('input', () => autoResize(positionField));
            // Initial resize
            autoResize(positionField);
        }
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await teamInfo.init();
        console.log('✅ Team Info initialized successfully');
    } catch (error) {
        console.error('❌ Loading error:', error);
    }
});

// Close modals on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (document.getElementById('cropModal').classList.contains('active')) {
            teamInfo.closeCropModal();
        }
        if (document.getElementById('importModal').classList.contains('active')) {
            teamInfo.closeImportDialog();
        }
        if (document.getElementById('employeeCard').style.display !== 'none') {
            teamInfo.closeCard();
        }
        // Close status dropdowns
        const cardDropdown = document.getElementById('cardStatusDropdown');
        if (cardDropdown && cardDropdown.style.display === 'flex') {
            cardDropdown.style.display = 'none';
        }
        const formDropdown = document.getElementById('formStatusDropdown');
        if (formDropdown && formDropdown.style.display === 'flex') {
            formDropdown.style.display = 'none';
        }
    }
});

// Close status dropdowns on outside click
document.addEventListener('click', (e) => {
    // Card status dropdown
    const cardDropdown = document.getElementById('cardStatusDropdown');
    const cardStatusBadge = document.getElementById('cardStatusBadge');
    if (cardDropdown && cardDropdown.style.display === 'flex') {
        if (!cardDropdown.contains(e.target) && !cardStatusBadge.contains(e.target)) {
            cardDropdown.style.display = 'none';
        }
    }

    // Form status dropdown
    const formDropdown = document.getElementById('formStatusDropdown');
    const formStatusBadge = document.getElementById('formStatusBadge');
    if (formDropdown && formDropdown.style.display === 'flex') {
        if (!formDropdown.contains(e.target) && !formStatusBadge.contains(e.target)) {
            formDropdown.style.display = 'none';
        }
    }
});

// Close modals on backdrop click
document.getElementById('importModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        teamInfo.closeImportDialog();
    }
});

document.getElementById('cropModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        teamInfo.closeCropModal();
    }
});

console.log('✅ Team Info script loaded');
