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
            this.render();
            this.updateStats();
            console.log('✅ Team Info loaded');
        } catch (error) {
            console.error('Init error:', error);
        }
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

        tbody.innerHTML = this.data.map(employee => {
            const statusClass = this.getStatusClass(employee.status || 'Работает');
            const statusText = employee.status || 'Работает';
            const reddyId = employee.reddyId || employee.predefinedFields?.['Reddy'] || '';
            const birthday = employee.birthday ? this.formatDate(employee.birthday) : '';
            const crmLogin = employee.crmLogin || '';
            const avatar = employee.avatar || '';
            const formattedName = this.formatFullNameForTable(employee.fullName || '');

            return `
                <tr onclick="teamInfo.openCard(${employee.id})" class="${this.currentEmployeeId === employee.id ? 'selected' : ''}">
                    <td>
                        <div class="status-cell">
                            <span class="status-badge ${statusClass}">${this.escapeHtml(statusText)}</span>
                            <svg class="status-dropdown-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                    </td>
                    <td>
                        <div class="employee-info">
                            <div class="employee-avatar">
                                ${avatar ? `<img src="${avatar}" alt="">` : ''}
                            </div>
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
                </tr>
            `;
        }).join('');
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

    openCard(id) {
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

        const employeeCard = document.getElementById('employeeCard');
        const statsPanel = document.getElementById('statsPanel');

        statsPanel.style.display = 'none';
        employeeCard.style.display = 'flex';

        document.getElementById('cardTeamName').textContent = this.teamName;
        document.getElementById('cardName').textContent = employee.fullName || '';
        document.getElementById('cardPosition').textContent = employee.position || '';

        const statusSelect = document.getElementById('cardStatusSelect');
        statusSelect.value = employee.status || 'Работает';

        const cardAvatar = document.getElementById('cardAvatar');
        if (employee.avatar) {
            cardAvatar.src = employee.avatar;
            cardAvatar.style.display = 'block';
        } else {
            cardAvatar.style.display = 'none';
        }

        const cardBody = document.getElementById('cardBody');
        cardBody.innerHTML = this.generateCardInfo(employee);
    },

    async updateStatus() {
        if (!this.currentEmployeeId) return;

        const employee = this.data.find(e => e.id === this.currentEmployeeId);
        if (!employee) return;

        const newStatus = document.getElementById('cardStatusSelect').value;
        employee.status = newStatus;
        employee.updatedAt = new Date().toISOString();

        if (await storage.saveData(this.data)) {
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

        // Reset form
        this.currentEmployeeId = null;
        this.currentAvatar = null;
        document.getElementById('formTeamName').textContent = this.teamName;
        document.getElementById('formSaveBtn').textContent = 'Сохранить';
        document.getElementById('formDeleteBtn').style.display = 'none';

        document.getElementById('formFullName').value = '';
        document.getElementById('formPosition').value = '';
        document.getElementById('formStatus').value = 'Работает';
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
        formAvatar.style.display = 'none';

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
            formAvatar.src = this.currentAvatar;
            formAvatar.style.display = 'block';

            this.closeCropModal();
        };
        img.src = this.tempImageData;
    },

    showEditModal(id) {
        const employee = this.data.find(e => e.id === id);
        if (!employee) return;

        this.currentEmployeeId = id;
        document.getElementById('modalTitle').textContent = 'Редактировать сотрудника';
        document.getElementById('saveEmployeeBtn').textContent = 'Сохранить изменения';

        document.getElementById('fullNameInput').value = employee.fullName || '';
        document.getElementById('positionInput').value = employee.position || '';
        document.getElementById('statusSelect').value = employee.status || 'Работает';
        document.getElementById('reddyInput').value = employee.reddyId || employee.predefinedFields?.['Reddy'] || '';
        document.getElementById('corpTelegramInput').value = employee.corpTelegram || employee.predefinedFields?.['Корп. Telegram'] || '';
        document.getElementById('personalTelegramInput').value = employee.personalTelegram || '';
        document.getElementById('birthdayInput').value = employee.birthday || '';
        document.getElementById('corpEmailInput').value = employee.corpEmail || employee.predefinedFields?.['Корп. e-mail'] || '';
        document.getElementById('personalEmailInput').value = employee.personalEmail || '';
        document.getElementById('corpPhoneInput').value = employee.corpPhone || employee.predefinedFields?.['Корп. телефон'] || '';
        document.getElementById('personalPhoneInput').value = employee.personalPhone || '';
        document.getElementById('officeInput').value = employee.office || '';
        document.getElementById('startDateInput').value = employee.startDate || '';
        document.getElementById('companyInput').value = employee.company || '';
        document.getElementById('crmLoginInput').value = employee.crmLogin || '';
        document.getElementById('commentInput').value = employee.comment || '';

        document.getElementById('employeeModal').classList.add('active');
        document.getElementById('fullNameInput').focus();
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

        // Fill form with employee data
        this.currentEmployeeId = id;
        this.currentAvatar = employee.avatar || null;
        document.getElementById('formTeamName').textContent = this.teamName;
        document.getElementById('formSaveBtn').textContent = 'Сохранить';
        document.getElementById('formDeleteBtn').style.display = 'block';

        document.getElementById('formFullName').value = employee.fullName || '';
        document.getElementById('formPosition').value = employee.position || '';
        document.getElementById('formStatus').value = employee.status || 'Работает';
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
        if (employee.avatar) {
            formAvatar.src = employee.avatar;
            formAvatar.style.display = 'block';
        } else {
            formAvatar.style.display = 'none';
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

        if (employeeId) {
            // Return to employee card
            this.openCard(employeeId);
        } else {
            // Return to stats panel
            document.getElementById('statsPanel').style.display = 'flex';
            this.currentEmployeeId = null;
        }
        this.render();
    },

    async saveFromForm() {
        const fullName = document.getElementById('formFullName').value.trim();
        const position = document.getElementById('formPosition').value.trim();
        const status = document.getElementById('formStatus').value;
        const reddyId = document.getElementById('formReddyId').value.trim();
        const corpTelegram = document.getElementById('formCorpTelegram').value.trim();
        const personalTelegram = document.getElementById('formPersonalTelegram').value.trim();
        const birthday = document.getElementById('formBirthday').value;
        const corpEmail = document.getElementById('formCorpEmail').value.trim();
        const personalEmail = document.getElementById('formPersonalEmail').value.trim();
        const corpPhone = document.getElementById('formCorpPhone').value.trim();
        const personalPhone = document.getElementById('formPersonalPhone').value.trim();
        const office = document.getElementById('formOffice').value.trim();
        const startDate = document.getElementById('formStartDate').value;
        const company = document.getElementById('formCompany').value.trim();
        const crmLogin = document.getElementById('formCrmLogin').value.trim();
        const comment = document.getElementById('formComment').value.trim();

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
            predefinedFields: {}
        };

        // Store in predefinedFields for compatibility
        if (reddyId) employeeData.predefinedFields['Reddy'] = reddyId;
        if (corpTelegram) employeeData.predefinedFields['Корп. Telegram'] = corpTelegram;
        if (corpEmail) employeeData.predefinedFields['Корп. e-mail'] = corpEmail;
        if (corpPhone) employeeData.predefinedFields['Корп. телефон'] = corpPhone;

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

    closeEmployeeModal() {
        document.getElementById('employeeModal').classList.remove('active');
    },

    async saveEmployee() {
        const fullName = document.getElementById('fullNameInput').value.trim();
        const position = document.getElementById('positionInput').value.trim();
        const status = document.getElementById('statusSelect').value;
        const reddyId = document.getElementById('reddyInput').value.trim();
        const corpTelegram = document.getElementById('corpTelegramInput').value.trim();
        const personalTelegram = document.getElementById('personalTelegramInput').value.trim();
        const birthday = document.getElementById('birthdayInput').value;
        const corpEmail = document.getElementById('corpEmailInput').value.trim();
        const personalEmail = document.getElementById('personalEmailInput').value.trim();
        const corpPhone = document.getElementById('corpPhoneInput').value.trim();
        const personalPhone = document.getElementById('personalPhoneInput').value.trim();
        const office = document.getElementById('officeInput').value.trim();
        const startDate = document.getElementById('startDateInput').value;
        const company = document.getElementById('companyInput').value.trim();
        const crmLogin = document.getElementById('crmLoginInput').value.trim();
        const comment = document.getElementById('commentInput').value.trim();

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
            predefinedFields: {}
        };

        // Store in predefinedFields for compatibility
        if (reddyId) employeeData.predefinedFields['Reddy'] = reddyId;
        if (corpTelegram) employeeData.predefinedFields['Корп. Telegram'] = corpTelegram;
        if (corpEmail) employeeData.predefinedFields['Корп. e-mail'] = corpEmail;
        if (corpPhone) employeeData.predefinedFields['Корп. телефон'] = corpPhone;

        if (this.currentEmployeeId) {
            // Edit existing
            const employee = this.data.find(e => e.id === this.currentEmployeeId);
            if (employee) {
                Object.assign(employee, employeeData);
                employee.updatedAt = new Date().toISOString();

                if (await storage.saveData(this.data)) {
                    this.closeEmployeeModal();
                    this.render();
                    this.updateStats();
                    if (this.currentEmployeeId && document.getElementById('employeeCard').style.display !== 'none') {
                        this.openCard(this.currentEmployeeId);
                    }
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
                this.closeEmployeeModal();
                this.render();
                this.updateStats();
                alert('Сотрудник добавлен!');
            } else {
                alert('Ошибка сохранения');
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
            status: document.getElementById('formStatus').value,
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
            'formFullName', 'formPosition', 'formStatus', 'formReddyId',
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
        if (document.getElementById('employeeModal').classList.contains('active')) {
            teamInfo.closeEmployeeModal();
        }
        if (document.getElementById('importModal').classList.contains('active')) {
            teamInfo.closeImportDialog();
        }
        if (document.getElementById('employeeCard').style.display !== 'none') {
            teamInfo.closeCard();
        }
    }
});

// Close modals on backdrop click
document.getElementById('employeeModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        teamInfo.closeEmployeeModal();
    }
});

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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    teamInfo.init();
});

console.log('✅ Team Info script loaded');
