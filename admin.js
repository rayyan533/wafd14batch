/**
 * WAFD FRIENDS 14 BATCH - Admin Portal & Dashboard Controller
 */

const AdminApp = {
  token: localStorage.getItem('wafd_admin_token') || null,
  user: JSON.parse(localStorage.getItem('wafd_admin_user') || 'null'),
  currentTab: 'overview',
  studentsCache: [],

  init() {
    this.checkAuthStatus();
    this.bindEvents();
  },

  getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  },

  async checkAuthStatus() {
    try {
      const res = await fetch('/api/auth/me', {
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (data.authenticated) {
        this.user = data.user;
        this.updateAuthUI(true);
      } else {
        this.user = null;
        this.token = null;
        localStorage.removeItem('wafd_admin_token');
        localStorage.removeItem('wafd_admin_user');
        this.updateAuthUI(false);
      }
    } catch (err) {
      console.warn('Auth check error:', err);
      this.updateAuthUI(false);
    }
  },

  updateAuthUI(isLoggedIn) {
    const adminNavBtn = document.getElementById('admin-nav-btn');
    const adminDashboardView = document.getElementById('admin-dashboard-view');
    const publicMainView = document.getElementById('public-main-view');
    const adminBadge = document.getElementById('admin-user-badge');

    if (adminNavBtn) {
      if (isLoggedIn) {
        adminNavBtn.innerHTML = `
          <i data-lucide="shield-check" class="w-4 h-4 text-emerald-400"></i>
          <span>Admin Portal</span>
        `;
        adminNavBtn.classList.remove('bg-emerald-700', 'hover:bg-emerald-800');
        adminNavBtn.classList.add('bg-amber-600', 'hover:bg-amber-700');
      } else {
        adminNavBtn.innerHTML = `
          <i data-lucide="lock" class="w-4 h-4 text-amber-300"></i>
          <span>Admin Login</span>
        `;
        adminNavBtn.classList.remove('bg-amber-600', 'hover:bg-amber-700');
        adminNavBtn.classList.add('bg-emerald-700', 'hover:bg-emerald-800');
      }
      if (window.lucide) lucide.createIcons();
    }

    if (adminBadge && this.user) {
      adminBadge.textContent = `${this.user.username} (${this.user.role})`;
    }
    const currentUsernameDisplay = document.getElementById('current-admin-username-display');
    if (currentUsernameDisplay && this.user) {
      currentUsernameDisplay.textContent = this.user.username;
    }
    const newUsernameInput = document.getElementById('new-username');
    if (newUsernameInput && this.user && !newUsernameInput.value) {
      newUsernameInput.value = this.user.username;
    }
  },

  showLoginModal() {
    if (this.user) {
      this.openDashboard();
      return;
    }
    const modal = document.getElementById('admin-login-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      const userInput = document.getElementById('admin-username');
      if (userInput) userInput.focus();
    }
  },

  hideLoginModal() {
    const modal = document.getElementById('admin-login-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      const errBox = document.getElementById('login-error-msg');
      if (errBox) errBox.classList.add('hidden');
    }
  },

  async handleLogin(e) {
    if (e) e.preventDefault();
    const usernameInput = document.getElementById('admin-username');
    const passwordInput = document.getElementById('admin-password');
    const errBox = document.getElementById('login-error-msg');
    const btn = document.getElementById('login-submit-btn');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
      if (errBox) {
        errBox.textContent = 'Please enter both username and password';
        errBox.classList.remove('hidden');
      }
      return;
    }

    if (btn) btn.disabled = true;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('wafd_admin_token', data.token);
        localStorage.setItem('wafd_admin_user', JSON.stringify(data.user));

        this.hideLoginModal();
        this.updateAuthUI(true);
        App.showToast('Login successful! Welcome to WAFD Admin Dashboard.', 'success');
        this.openDashboard();
      } else {
        if (errBox) {
          errBox.textContent = data.error || 'Invalid credentials';
          errBox.classList.remove('hidden');
        }
      }
    } catch (err) {
      if (errBox) {
        errBox.textContent = 'Connection error. Please try again.';
        errBox.classList.remove('hidden');
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async handleLogout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
    } catch (err) {
      console.warn('Logout error:', err);
    }
    this.token = null;
    this.user = null;
    localStorage.removeItem('wafd_admin_token');
    localStorage.removeItem('wafd_admin_user');
    this.updateAuthUI(false);
    this.closeDashboard();
    App.showToast('Logged out securely.', 'info');
  },

  openDashboard() {
    if (!this.user) {
      this.showLoginModal();
      return;
    }
    const publicView = document.getElementById('public-main-view');
    const adminView = document.getElementById('admin-dashboard-view');
    if (publicView) publicView.classList.add('hidden');
    if (adminView) {
      adminView.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    this.switchTab(this.currentTab || 'overview');
  },

  closeDashboard() {
    const publicView = document.getElementById('public-main-view');
    const adminView = document.getElementById('admin-dashboard-view');
    if (adminView) adminView.classList.add('hidden');
    if (publicView) publicView.classList.remove('hidden');
    // Refresh public view to reflect any changes made
    if (window.App && typeof App.loadPublicData === 'function') {
      App.loadPublicData();
      App.loadStudents();
    }
  },

  switchTab(tabName) {
    this.currentTab = tabName;
    const tabBtns = document.querySelectorAll('.admin-tab-btn');
    const tabPanes = document.querySelectorAll('.admin-tab-pane');

    tabBtns.forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('bg-emerald-700', 'text-white', 'shadow-sm');
        btn.classList.remove('text-slate-600', 'hover:bg-slate-100');
      } else {
        btn.classList.remove('bg-emerald-700', 'text-white', 'shadow-sm');
        btn.classList.add('text-slate-600', 'hover:bg-slate-100');
      }
    });

    tabPanes.forEach(pane => {
      if (pane.id === `tab-${tabName}`) {
        pane.classList.remove('hidden');
        pane.classList.add('animate-fade-in');
      } else {
        pane.classList.add('hidden');
      }
    });

    if (window.lucide) lucide.createIcons();

    // Trigger specific tab data loaders
    if (tabName === 'overview') this.loadOverviewStats();
    if (tabName === 'students') this.loadAdminStudents();
    if (tabName === 'leadership') this.loadAdminLeadership();
    if (tabName === 'settings') this.loadAdminSettings();
    if (tabName === 'sections') this.loadAdminSections();
    if (tabName === 'announcements') this.loadAdminAnnouncements();
  },

  // ----------------------------------------------------
  // OVERVIEW TAB
  // ----------------------------------------------------
  async loadOverviewStats() {
    try {
      const res = await fetch('/api/admin/stats', { headers: this.getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) return;

      const stats = data.stats;
      document.getElementById('stat-total-students').textContent = stats.total_students;
      document.getElementById('stat-total-leaders').textContent = stats.total_roles;
      document.getElementById('stat-assigned-leaders').textContent = stats.assigned_roles;
      document.getElementById('stat-announcements').textContent = stats.total_announcements;

      // Render recent activity logs
      const logContainer = document.getElementById('admin-activity-logs');
      if (logContainer) {
        if (!stats.recent_logs || stats.recent_logs.length === 0) {
          logContainer.innerHTML = '<p class="text-sm text-slate-400 py-3">No activity logged yet.</p>';
        } else {
          logContainer.innerHTML = stats.recent_logs.map(log => `
            <div class="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
              <div class="w-2 h-2 rounded-full bg-emerald-500 mt-2"></div>
              <div class="flex-1">
                <div class="flex items-center justify-between">
                  <span class="font-medium text-slate-800 text-sm">${log.action}</span>
                  <span class="text-xs text-slate-400">${new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5">${log.details || ''}</p>
              </div>
            </div>
          `).join('');
        }
      }

      // Render room breakdown badges
      const roomBreakdown = document.getElementById('admin-room-breakdown');
      if (roomBreakdown && stats.room_distribution) {
        roomBreakdown.innerHTML = stats.room_distribution.map(r => `
          <div class="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-700">${r.room_no || 'Unassigned'}</span>
            <span class="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">${r.count}</span>
          </div>
        `).join('');
      }

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.warn('Error loading admin overview stats:', err);
    }
  },

  // ----------------------------------------------------
  // SETTINGS TAB
  // ----------------------------------------------------
  async loadAdminSettings() {
    try {
      const res = await fetch('/api/public-info');
      const data = await res.json();
      if (!data.success) return;

      const s = data.settings;
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
      };

      setVal('setting-website-name', s.website_name);
      setVal('setting-class-name', s.class_name);
      setVal('setting-usthad-name', s.usthad_name);
      setVal('setting-usthad-title', s.usthad_title);
      setVal('setting-usthad-message', s.usthad_message);
      setVal('setting-phone-call-day', s.phone_call_day);
      setVal('setting-phone-call-time', s.phone_call_time);
      setVal('setting-phone-guidelines', s.phone_call_guidelines);
      setVal('setting-campus360-url', s.campus360_url || 'https://darulfalah.in/campus360/index.php');
      setVal('setting-silah-url', s.silah_app_url);
      setVal('setting-batch-motto', s.batch_motto);
      setVal('setting-notification-banner', s.notification_banner);
      setVal('setting-about-text', s.about_text);
    } catch (err) {
      console.warn('Error loading settings:', err);
    }
  },

  async saveSettings(e) {
    if (e) e.preventDefault();
    const getVal = id => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    const payload = {
      website_name: getVal('setting-website-name'),
      class_name: getVal('setting-class-name'),
      usthad_name: getVal('setting-usthad-name'),
      usthad_title: getVal('setting-usthad-title'),
      usthad_message: getVal('setting-usthad-message'),
      phone_call_day: getVal('setting-phone-call-day'),
      phone_call_time: getVal('setting-phone-call-time'),
      phone_call_guidelines: getVal('setting-phone-guidelines'),
      campus360_url: getVal('setting-campus360-url') || 'https://darulfalah.in/campus360/index.php',
      silah_app_url: getVal('setting-silah-url'),
      batch_motto: getVal('setting-batch-motto'),
      notification_banner: getVal('setting-notification-banner'),
      about_text: getVal('setting-about-text')
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        window.WAFD_SETTINGS = data.settings;
        App.showToast('Class information & homepage settings updated successfully!', 'success');
        // Refresh public homepage elements
        App.loadPublicData();
      } else {
        App.showToast(data.error || 'Failed to update settings', 'error');
      }
    } catch (err) {
      App.showToast('Error saving settings', 'error');
    }
  },

  // ----------------------------------------------------
  // STUDENTS TAB (CRUD)
  // ----------------------------------------------------
  async loadAdminStudents() {
    try {
      const search = (document.getElementById('admin-student-search')?.value || '').trim();
      const res = await fetch(`/api/students?q=${encodeURIComponent(search)}&sort=adm_asc`);
      const data = await res.json();
      if (!data.success) return;

      this.studentsCache = data.students;
      const countEl = document.getElementById('admin-student-count-badge');
      if (countEl) countEl.textContent = `${data.count} Total Students`;

      const tbody = document.getElementById('admin-students-table-body');
      if (!tbody) return;

      if (data.students.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-8 text-slate-400">
              No students found. Click "Add New Student" above.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = data.students.map(st => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
          <td class="py-3 px-4 font-mono font-bold text-emerald-700">#${st.admission_no}</td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style="background-color: ${st.avatar_color || '#059669'}">
                ${st.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <span class="font-semibold text-slate-800 text-sm block">${st.name}</span>
                ${st.leadership_roles ? `<span class="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 mt-0.5">${st.leadership_roles}</span>` : ''}
              </div>
            </div>
          </td>
          <td class="py-3 px-4 text-xs text-slate-600">${st.room_no || '—'}</td>
          <td class="py-3 px-4 text-xs font-semibold text-slate-700">${st.blood_group || '—'}</td>
          <td class="py-3 px-4 text-xs text-slate-600 font-mono">${st.phone || '—'}</td>
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="AdminApp.openEditStudentModal(${st.id})" class="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition" title="Edit Student">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
              <button onclick="AdminApp.deleteStudent(${st.id}, '${st.name}', '${st.admission_no}')" class="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition" title="Delete Student">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.warn('Error loading admin students:', err);
    }
  },

  openAddStudentModal() {
    document.getElementById('student-modal-title').textContent = 'Add New Student';
    document.getElementById('student-id-field').value = '';
    document.getElementById('student-adm-field').value = '';
    document.getElementById('student-name-field').value = '';
    document.getElementById('student-room-field').value = '';
    document.getElementById('student-blood-field').value = '';
    document.getElementById('student-phone-field').value = '';
    document.getElementById('student-notes-field').value = '';

    const modal = document.getElementById('student-form-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.getElementById('student-adm-field').focus();
    }
  },

  openEditStudentModal(studentId) {
    const st = this.studentsCache.find(s => s.id === studentId);
    if (!st) return;

    document.getElementById('student-modal-title').textContent = `Edit Student: ${st.name}`;
    document.getElementById('student-id-field').value = st.id;
    document.getElementById('student-adm-field').value = st.admission_no;
    document.getElementById('student-name-field').value = st.name;
    document.getElementById('student-room-field').value = st.room_no || '';
    document.getElementById('student-blood-field').value = st.blood_group || '';
    document.getElementById('student-phone-field').value = st.phone || '';
    document.getElementById('student-notes-field').value = st.notes || '';

    const modal = document.getElementById('student-form-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  },

  closeStudentModal() {
    const modal = document.getElementById('student-form-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  async saveStudent(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('student-id-field').value;
    const admission_no = document.getElementById('student-adm-field').value.trim();
    const name = document.getElementById('student-name-field').value.trim();
    const room_no = document.getElementById('student-room-field').value.trim();
    const blood_group = document.getElementById('student-blood-field').value.trim();
    const phone = document.getElementById('student-phone-field').value.trim();
    const notes = document.getElementById('student-notes-field').value.trim();

    if (!admission_no || !name) {
      App.showToast('Admission Number and Name are required.', 'error');
      return;
    }

    const payload = { admission_no, name, room_no, blood_group, phone, notes };
    const isEdit = Boolean(id);
    const url = isEdit ? `/api/students/${id}` : '/api/students';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        this.closeStudentModal();
        App.showToast(isEdit ? 'Student updated successfully!' : 'Student added successfully!', 'success');
        this.loadAdminStudents();
        this.loadOverviewStats();
        // Automatically refresh homepage student directory and counters
        App.loadStudents();
        App.loadPublicData();
      } else {
        App.showToast(data.error || 'Failed to save student', 'error');
      }
    } catch (err) {
      App.showToast('Network error while saving student', 'error');
    }
  },

  async deleteStudent(studentId, name, adm) {
    if (!confirm(`Are you sure you want to remove student "${name}" (Adm: ${adm})?\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        App.showToast(`Student #${adm} removed.`, 'info');
        this.loadAdminStudents();
        this.loadOverviewStats();
        App.loadStudents();
        App.loadPublicData();
      } else {
        App.showToast(data.error || 'Failed to delete student', 'error');
      }
    } catch (err) {
      App.showToast('Network error while deleting student', 'error');
    }
  },

  // ----------------------------------------------------
  // LEADERSHIP TAB (Assign & Manage Positions)
  // ----------------------------------------------------
  async loadAdminLeadership() {
    try {
      const [roleRes, stRes] = await Promise.all([
        fetch('/api/leadership'),
        fetch('/api/students?sort=name_asc')
      ]);
      const roleData = await roleRes.json();
      const stData = await stRes.json();

      if (!roleData.success) return;

      const roles = roleData.roles;
      const students = stData.students || [];
      const container = document.getElementById('admin-leadership-list');
      if (!container) return;

      // Populate student options for assignment dropdown
      const studentOptions = students.map(s => `<option value="${s.id}">${s.name} (Adm: #${s.admission_no})</option>`).join('');

      container.innerHTML = roles.map((r, idx) => {
        const assignedDisplay = r.assigned_name || (r.assigned_student_id ? 'Assigned' : '<span class="text-amber-600 italic">Unassigned (Vacant)</span>');
        return `
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div class="flex items-start gap-3">
                <span class="w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center mt-0.5">
                  ${idx + 1}
                </span>
                <div>
                  <div class="flex items-center gap-2">
                    <h4 class="font-bold text-slate-800 text-base">${r.title}</h4>
                    <span class="text-xs px-2 py-0.5 rounded-full badge-${r.badge_color || 'emerald'} font-medium">
                      ${r.badge_color || 'emerald'}
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 mt-0.5">${r.description || 'Class leadership responsibility.'}</p>
                  <div class="mt-2 text-sm flex items-center gap-2">
                    <span class="text-slate-500 text-xs">Currently Assigned to:</span>
                    <strong class="text-slate-800 font-semibold">${assignedDisplay}</strong>
                    ${r.admission_no ? `<span class="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">#${r.admission_no}</span>` : ''}
                  </div>
                </div>
              </div>

              <!-- Action Controls -->
              <div class="flex items-center gap-2 self-end md:self-center">
                <button onclick="AdminApp.openAssignLeaderModal(${r.id}, '${encodeURIComponent(r.title)}', ${r.assigned_student_id || 'null'}, '${encodeURIComponent(r.assigned_name || '')}', '${r.badge_color || 'emerald'}', '${encodeURIComponent(r.description || '')}')" class="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition flex items-center gap-1.5">
                  <i data-lucide="user-check" class="w-3.5 h-3.5"></i>
                  <span>Assign / Edit</span>
                </button>
                <button onclick="AdminApp.deleteLeadershipRole(${r.id}, '${encodeURIComponent(r.title)}')" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Remove Position">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.warn('Error loading admin leadership:', err);
    }
  },

  openAddPositionModal() {
    document.getElementById('pos-modal-title').textContent = 'Add New Leadership Position';
    document.getElementById('pos-id-field').value = '';
    document.getElementById('pos-title-field').value = '';
    document.getElementById('pos-desc-field').value = '';
    document.getElementById('pos-badge-field').value = 'emerald';
    document.getElementById('pos-student-select').value = '';
    document.getElementById('pos-custom-name').value = '';

    this.populateStudentDropdownForPosition();

    const modal = document.getElementById('position-form-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.getElementById('pos-title-field').focus();
    }
  },

  async populateStudentDropdownForPosition(selectedId = null) {
    try {
      const res = await fetch('/api/students?sort=name_asc');
      const data = await res.json();
      const select = document.getElementById('pos-student-select');
      if (!select) return;

      select.innerHTML = `
        <option value="">-- Select from Enrolled Students (Optional) --</option>
        ${(data.students || []).map(s => `<option value="${s.id}" ${selectedId === s.id ? 'selected' : ''}>${s.name} (Adm #${s.admission_no})</option>`).join('')}
      `;
    } catch (err) {
      console.warn('Error loading student dropdown:', err);
    }
  },

  openAssignLeaderModal(roleId, titleEnc, currentStudentId, assignedNameEnc, badgeColor, descEnc) {
    const title = decodeURIComponent(titleEnc);
    const assignedName = decodeURIComponent(assignedNameEnc);
    const desc = decodeURIComponent(descEnc);

    document.getElementById('pos-modal-title').textContent = `Manage Position: ${title}`;
    document.getElementById('pos-id-field').value = roleId;
    document.getElementById('pos-title-field').value = title;
    document.getElementById('pos-desc-field').value = desc;
    document.getElementById('pos-badge-field').value = badgeColor || 'emerald';
    document.getElementById('pos-custom-name').value = assignedName || '';

    this.populateStudentDropdownForPosition(currentStudentId);

    const modal = document.getElementById('position-form-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  },

  closePositionModal() {
    const modal = document.getElementById('position-form-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  async savePosition(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('pos-id-field').value;
    const title = document.getElementById('pos-title-field').value.trim();
    const desc = document.getElementById('pos-desc-field').value.trim();
    const badge_color = document.getElementById('pos-badge-field').value;
    const studentSelect = document.getElementById('pos-student-select');
    const assigned_student_id = studentSelect.value ? parseInt(studentSelect.value, 10) : null;
    let assigned_name = document.getElementById('pos-custom-name').value.trim();

    if (!title) {
      App.showToast('Position title is required', 'error');
      return;
    }

    if (assigned_student_id && !assigned_name) {
      // Pick name from selected option
      const selectedOption = studentSelect.options[studentSelect.selectedIndex];
      if (selectedOption) {
        assigned_name = selectedOption.text.split('(')[0].trim();
      }
    }

    const payload = {
      title,
      description: desc,
      badge_color,
      assigned_student_id,
      assigned_name
    };

    const isEdit = Boolean(id);
    const url = isEdit ? `/api/leadership/${id}` : '/api/leadership';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.closePositionModal();
        App.showToast(isEdit ? 'Position updated!' : 'Position created!', 'success');
        this.loadAdminLeadership();
        this.loadOverviewStats();
        // Update homepage leadership section live
        App.loadPublicData();
      } else {
        App.showToast(data.error || 'Failed to save position', 'error');
      }
    } catch (err) {
      App.showToast('Network error while saving position', 'error');
    }
  },

  async deleteLeadershipRole(roleId, titleEnc) {
    const title = decodeURIComponent(titleEnc);
    if (!confirm(`Are you sure you want to remove the position "${title}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/leadership/${roleId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        App.showToast(`Position "${title}" removed.`, 'info');
        this.loadAdminLeadership();
        this.loadOverviewStats();
        App.loadPublicData();
      } else {
        App.showToast(data.error || 'Failed to remove position', 'error');
      }
    } catch (err) {
      App.showToast('Network error while removing position', 'error');
    }
  },

  // ----------------------------------------------------
  // ANNOUNCEMENTS TAB
  // ----------------------------------------------------
  async loadAdminAnnouncements() {
    try {
      const res = await fetch('/api/announcements');
      const data = await res.json();
      if (!data.success) return;

      const container = document.getElementById('admin-announcements-list');
      if (!container) return;

      if (data.announcements.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-400 py-6 text-center">No announcements yet. Post one above!</p>';
        return;
      }

      container.innerHTML = data.announcements.map(a => `
        <div class="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${a.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}">
                ${a.priority.toUpperCase()}
              </span>
              <h4 class="font-bold text-slate-800 text-sm">${a.title}</h4>
              <span class="text-xs text-slate-400 ml-auto font-mono">${a.date}</span>
            </div>
            <p class="text-xs text-slate-600 mt-2 leading-relaxed">${a.message}</p>
          </div>
          <button onclick="AdminApp.deleteAnnouncement(${a.id})" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      `).join('');

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.warn('Error loading announcements:', err);
    }
  },

  async postAnnouncement(e) {
    if (e) e.preventDefault();
    const title = document.getElementById('ann-title-input').value.trim();
    const message = document.getElementById('ann-message-input').value.trim();
    const priority = document.getElementById('ann-priority-input').value;

    if (!title || !message) {
      App.showToast('Please provide both title and announcement message.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ title, message, priority })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        document.getElementById('ann-title-input').value = '';
        document.getElementById('ann-message-input').value = '';
        App.showToast('Announcement published live!', 'success');
        this.loadAdminAnnouncements();
        App.loadPublicData();
      } else {
        App.showToast(data.error || 'Failed to post announcement', 'error');
      }
    } catch (err) {
      App.showToast('Network error posting announcement', 'error');
    }
  },

  async deleteAnnouncement(id) {
    if (!confirm('Delete this announcement?')) return;
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        App.showToast('Announcement deleted.', 'info');
        this.loadAdminAnnouncements();
        App.loadPublicData();
      }
    } catch (err) {
      App.showToast('Network error', 'error');
    }
  },

  // ----------------------------------------------------
  // CUSTOM SECTIONS TAB
  // ----------------------------------------------------
  async loadAdminSections() {
    try {
      const res = await fetch('/api/sections');
      const data = await res.json();
      if (!data.success) return;

      const container = document.getElementById('admin-sections-list');
      if (!container) return;

      if (data.sections.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-400 py-6 text-center">No custom sections created yet. Add one above!</p>';
        return;
      }

      container.innerHTML = data.sections.map(s => `
        <div class="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Icon: ${s.icon}
              </span>
              <h4 class="font-bold text-slate-800 text-sm">${s.title}</h4>
              ${s.subtitle ? `<span class="text-xs text-slate-400">(${s.subtitle})</span>` : ''}
              <span class="text-xs px-2 py-0.5 rounded-full ${s.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'} ml-auto font-medium">
                ${s.is_active ? 'Active on Homepage' : 'Hidden'}
              </span>
            </div>
            <p class="text-xs text-slate-600 mt-2 leading-relaxed">${s.content}</p>
          </div>
          <button onclick="AdminApp.deleteSection(${s.id})" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete Section">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      `).join('');

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.warn('Error loading custom sections:', err);
    }
  },

  async addCustomSection(e) {
    if (e) e.preventDefault();
    const title = document.getElementById('sec-title-input').value.trim();
    const subtitle = document.getElementById('sec-subtitle-input').value.trim();
    const content = document.getElementById('sec-content-input').value.trim();
    const icon = document.getElementById('sec-icon-input').value;

    if (!title || !content) {
      App.showToast('Section title and content are required.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/sections', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ title, subtitle, content, icon, is_active: 1 })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        document.getElementById('sec-title-input').value = '';
        document.getElementById('sec-subtitle-input').value = '';
        document.getElementById('sec-content-input').value = '';
        App.showToast('New section added to homepage!', 'success');
        this.loadAdminSections();
        App.loadPublicData();
      } else {
        App.showToast(data.error || 'Failed to add section', 'error');
      }
    } catch (err) {
      App.showToast('Network error adding section', 'error');
    }
  },

  async deleteSection(id) {
    if (!confirm('Remove this custom section?')) return;
    try {
      const res = await fetch(`/api/sections/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        App.showToast('Section removed.', 'info');
        this.loadAdminSections();
        App.loadPublicData();
      }
    } catch (err) {
      App.showToast('Network error', 'error');
    }
  },

  // ----------------------------------------------------
  // UPDATE ADMIN CREDENTIALS (USERNAME AND PASSWORD)
  // ----------------------------------------------------
  async handleUpdateCredentials(e) {
    if (e) e.preventDefault();
    const curPass = (document.getElementById('cur-password')?.value || '').trim();
    const newUsername = (document.getElementById('new-username')?.value || '').trim();
    const newPass = (document.getElementById('new-password')?.value || '').trim();
    const confPass = (document.getElementById('conf-password')?.value || '').trim();

    if (!curPass) {
      App.showToast('Current password is required to authorize changes.', 'error');
      return;
    }

    if (!newUsername && !newPass) {
      App.showToast('Please enter a new username or new password to update.', 'error');
      return;
    }

    if (newUsername && newUsername.length < 3) {
      App.showToast('Username must be at least 3 characters long.', 'error');
      return;
    }

    if (newPass) {
      if (newPass.length < 6) {
        App.showToast('New password must be at least 6 characters long.', 'error');
        return;
      }
      if (newPass !== confPass) {
        App.showToast('New passwords do not match.', 'error');
        return;
      }
    }

    try {
      const res = await fetch('/api/auth/update-credentials', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          current_password: curPass,
          new_username: newUsername,
          new_password: newPass
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.user) {
          this.user = data.user;
          localStorage.setItem('wafd_admin_user', JSON.stringify(data.user));
          this.updateAuthUI(true);
        }
        document.getElementById('cur-password').value = '';
        if (document.getElementById('new-password')) document.getElementById('new-password').value = '';
        if (document.getElementById('conf-password')) document.getElementById('conf-password').value = '';
        App.showToast(data.message || 'Admin credentials updated successfully!', 'success');
      } else {
        App.showToast(data.error || 'Failed to update credentials', 'error');
      }
    } catch (err) {
      App.showToast('Network error while updating credentials', 'error');
    }
  },

  // ----------------------------------------------------
  // EVENT BINDINGS
  // ----------------------------------------------------
  bindEvents() {
    // Navigation toggle button
    const adminNavBtn = document.getElementById('admin-nav-btn');
    if (adminNavBtn) {
      adminNavBtn.addEventListener('click', () => {
        if (this.user) {
          const adminView = document.getElementById('admin-dashboard-view');
          if (adminView && !adminView.classList.contains('hidden')) {
            this.closeDashboard();
          } else {
            this.openDashboard();
          }
        } else {
          this.showLoginModal();
        }
      });
    }

    // Modal close triggers
    const modalCloseBtn = document.getElementById('close-login-modal');
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', () => this.hideLoginModal());
    }

    // Login Form
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', e => this.handleLogin(e));
    }

    // Logout
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Exit Dashboard to Home
    const exitDashboardBtn = document.getElementById('exit-dashboard-btn');
    if (exitDashboardBtn) {
      exitDashboardBtn.addEventListener('click', () => this.closeDashboard());
    }

    // Tab buttons
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab) this.switchTab(tab);
      });
    });

    // Settings Form
    const settingsForm = document.getElementById('class-settings-form');
    if (settingsForm) {
      settingsForm.addEventListener('submit', e => this.saveSettings(e));
    }

    // Student Search in Admin
    const studentSearchInput = document.getElementById('admin-student-search');
    if (studentSearchInput) {
      let debounceTimer;
      studentSearchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.loadAdminStudents(), 250);
      });
    }

    // Student Form
    const studentForm = document.getElementById('student-modal-form');
    if (studentForm) {
      studentForm.addEventListener('submit', e => this.saveStudent(e));
    }

    // Position Form
    const positionForm = document.getElementById('position-modal-form');
    if (positionForm) {
      positionForm.addEventListener('submit', e => this.savePosition(e));
    }

    // Announcement Form
    const annForm = document.getElementById('admin-announcement-form');
    if (annForm) {
      annForm.addEventListener('submit', e => this.postAnnouncement(e));
    }

    // Section Form
    const secForm = document.getElementById('admin-section-form');
    if (secForm) {
      secForm.addEventListener('submit', e => this.addCustomSection(e));
    }

    // Change Credentials (Username & Password) Form
    const passForm = document.getElementById('change-password-form');
    if (passForm) {
      passForm.addEventListener('submit', e => this.handleUpdateCredentials(e));
    }
  }
};

window.AdminApp = AdminApp;
