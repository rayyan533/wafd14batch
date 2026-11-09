/**
 * WAFD FRIENDS 14 BATCH - Main Public Frontend Application
 */

const App = {
  viewMode: localStorage.getItem('wafd_view_mode') || 'cards', // 'cards' | 'table'
  currentSort: 'adm_asc',
  selectedRoom: '',
  selectedBlood: '',
  searchQuery: '',
  students: [],
  settings: {},
  phoneCountdownTimer: null,

  async init() {
    this.bindEvents();
    await this.loadPublicData();
    await this.loadStudents();
    if (window.AdminApp) {
      AdminApp.init();
    }
  },

  // ----------------------------------------------------
  // LOAD PUBLIC DATA (Class info, Usthad, Leadership, Sections)
  // ----------------------------------------------------
  async loadPublicData() {
    try {
      const res = await fetch('/api/public-info');
      const data = await res.json();
      if (!data.success) return;

      this.settings = data.settings;
      window.WAFD_SETTINGS = data.settings;

      // Update all brand & class header texts across document
      document.title = `${this.settings.website_name || 'WAFD FRIENDS 14 BATCH'} - Class Portal`;

      const setText = (selector, val) => {
        document.querySelectorAll(selector).forEach(el => {
          el.textContent = val || '';
        });
      };

      setText('.val-website-name', this.settings.website_name || 'WAFD FRIENDS 14 BATCH');
      setText('.val-class-name', this.settings.class_name || 'WAFD');
      setText('.val-batch-year', this.settings.batch_year || '14th Batch');
      setText('.val-usthad-name', this.settings.usthad_name || 'Muhammed Haithami');
      setText('.val-usthad-title', this.settings.usthad_title || 'Respected Class Usthad');
      setText('.val-usthad-message', this.settings.usthad_message || 'Guided by knowledge, united in brotherhood and character.');
      setText('.val-phone-day', this.settings.phone_call_day || 'Sunday');
      setText('.val-phone-time', this.settings.phone_call_time || '04:00 PM – 06:30 PM');
      setText('.val-phone-guidelines', this.settings.phone_call_guidelines || 'Calls permitted exclusively on the designated day.');
      setText('.val-total-students', data.total_students);
      setText('.val-total-leaders', data.leadership_roles.length);

      // Notification banner
      const banner = document.getElementById('public-notification-banner');
      if (banner) {
        if (this.settings.notification_banner) {
          banner.querySelector('#banner-text').textContent = this.settings.notification_banner;
          banner.classList.remove('hidden');
        } else {
          banner.classList.add('hidden');
        }
      }

      // Calculate Phone Call Day Countdown
      this.updatePhoneDayBadge(this.settings.phone_call_day || 'Sunday');

      // Render Leadership Team
      this.renderLeadershipTeam(data.leadership_roles);

      // Render Custom Sections
      this.renderCustomSections(data.custom_sections);

      // Render Announcements
      this.renderAnnouncements(data.announcements);

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.warn('Error loading public info:', err);
    }
  },

  // ----------------------------------------------------
  // PHONE CALL DAY CALCULATOR
  // ----------------------------------------------------
  updatePhoneDayBadge(dayName) {
    const badge = document.getElementById('phone-day-status-pill');
    const countdownEl = document.getElementById('phone-day-countdown');
    if (!badge && !countdownEl) return;

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetIdx = days.indexOf(dayName.toLowerCase().trim());
    if (targetIdx === -1) return;

    const now = new Date();
    const currentDayIdx = now.getDay();

    let diff = targetIdx - currentDayIdx;
    if (diff < 0) diff += 7;

    if (badge) {
      if (diff === 0) {
        badge.innerHTML = `<span class="pulse-badge pr-2"></span> <strong>TODAY is Phone Call Day!</strong>`;
        badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-sm';
      } else if (diff === 1) {
        badge.innerHTML = `<i data-lucide="phone-call" class="w-3.5 h-3.5"></i> Tomorrow is Phone Call Day`;
        badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200';
      } else {
        badge.innerHTML = `<i data-lucide="calendar" class="w-3.5 h-3.5"></i> ${diff} days until ${dayName}`;
        badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200';
      }
    }

    if (countdownEl) {
      if (diff === 0) {
        countdownEl.textContent = 'Active Today! Follow prescribed timing.';
      } else {
        countdownEl.textContent = `Next session in ${diff} day${diff > 1 ? 's' : ''} (${dayName})`;
      }
    }

    this.startPhoneCountdown(dayName);
  },

  startPhoneCountdown(dayName) {
    if (this.phoneCountdownTimer) clearInterval(this.phoneCountdownTimer);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetIdx = days.indexOf(dayName.toLowerCase().trim());
    if (targetIdx === -1) return;

    const updateClock = () => {
      const now = new Date();
      const currentDayIdx = now.getDay();
      let diffDays = targetIdx - currentDayIdx;
      if (diffDays < 0) diffDays += 7;

      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + diffDays);
      targetDate.setHours(16, 0, 0, 0);

      let deltaMs = targetDate.getTime() - now.getTime();
      if (deltaMs < 0) {
        targetDate.setDate(targetDate.getDate() + 7);
        deltaMs = targetDate.getTime() - now.getTime();
      }

      const totalSecs = Math.max(0, Math.floor(deltaMs / 1000));
      const d = Math.floor(totalSecs / 86400);
      const h = Math.floor((totalSecs % 86400) / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };

      setVal('cd-days', `${d}d`);
      setVal('cd-hours', `${String(h).padStart(2, '0')}h`);
      setVal('cd-mins', `${String(m).padStart(2, '0')}m`);
      setVal('cd-secs', `${String(s).padStart(2, '0')}s`);
    };

    updateClock();
    this.phoneCountdownTimer = setInterval(updateClock, 1000);
  },

  // ----------------------------------------------------
  // RENDER LEADERSHIP TEAM
  // ----------------------------------------------------
  renderLeadershipTeam(roles) {
    const grid = document.getElementById('leadership-grid');
    if (!grid) return;

    if (!roles || roles.length === 0) {
      grid.innerHTML = '<p class="text-center text-slate-400 col-span-full py-8">No leadership roles listed.</p>';
      return;
    }

    grid.innerHTML = roles.map(r => {
      const assignedName = r.assigned_name || (r.assigned_student_id ? 'Assigned' : 'To be assigned');
      const isUnassigned = !r.assigned_name && !r.assigned_student_id;
      const initial = assignedName ? assignedName.charAt(0).toUpperCase() : '?';

      return `
        <div class="glass-panel p-5 rounded-2xl shadow-sm border border-slate-200/80 card-hover-effect flex flex-col justify-between relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 w-16 h-16 bg-gradient-to-br from-emerald-100/50 to-transparent rounded-full pointer-events-none group-hover:scale-125 transition-transform duration-300"></div>
          <div>
            <div class="flex items-center justify-between gap-2 mb-3">
              <span class="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full badge-${r.badge_color || 'emerald'}">
                ${r.title}
              </span>
              ${r.admission_no ? `<span class="text-xs font-mono font-bold text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-200">#${r.admission_no}</span>` : ''}
            </div>

            <div class="flex items-center gap-3.5 my-2">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-white shadow-sm flex-shrink-0" style="background-color: ${isUnassigned ? '#94a3b8' : (r.avatar_color || '#047857')}">
                ${initial}
              </div>
              <div class="overflow-hidden">
                <h4 class="font-bold text-slate-900 text-base truncate ${isUnassigned ? 'italic text-slate-400 font-normal' : ''}">
                  ${assignedName}
                </h4>
                <p class="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <i data-lucide="shield" class="w-3 h-3 text-emerald-600"></i>
                  <span class="truncate">${r.title}</span>
                </p>
              </div>
            </div>

            <p class="text-xs text-slate-600 mt-2.5 leading-relaxed line-clamp-2">
              ${r.description || 'Dedicated to upholding batch values, unity, and excellence.'}
            </p>
          </div>

          ${r.room_no ? `
            <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span class="flex items-center gap-1"><i data-lucide="home" class="w-3 h-3 text-slate-400"></i> ${r.room_no}</span>
              <span class="text-emerald-600 font-semibold text-[11px]">Active Leader</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  },

  // ----------------------------------------------------
  // RENDER CUSTOM SECTIONS
  // ----------------------------------------------------
  renderCustomSections(sections) {
    const container = document.getElementById('custom-sections-container');
    if (!container) return;

    if (!sections || sections.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = sections.map(s => `
      <section class="py-10 border-t border-slate-200/80">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="glass-panel rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm relative overflow-hidden">
            <div class="absolute right-0 bottom-0 translate-x-10 translate-y-10 w-64 h-64 bg-emerald-50 rounded-full blur-3xl pointer-events-none"></div>
            <div class="max-w-3xl">
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-3">
                <i data-lucide="${s.icon || 'sparkles'}" class="w-3.5 h-3.5"></i>
                <span>${s.subtitle || 'Batch Highlight'}</span>
              </div>
              <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">${s.title}</h2>
              <p class="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed whitespace-pre-line">${s.content}</p>
            </div>
          </div>
        </div>
      </section>
    `).join('');
  },

  // ----------------------------------------------------
  // RENDER ANNOUNCEMENTS
  // ----------------------------------------------------
  renderAnnouncements(announcements) {
    const container = document.getElementById('public-announcements-list');
    if (!container) return;

    if (!announcements || announcements.length === 0) {
      container.innerHTML = '<p class="text-center text-xs text-slate-400 py-3">No active notifications.</p>';
      return;
    }

    container.innerHTML = announcements.map(a => `
      <div class="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-left">
        <div class="p-2 rounded-lg ${a.priority === 'urgent' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'} flex-shrink-0 mt-0.5">
          <i data-lucide="${a.priority === 'urgent' ? 'alert-circle' : 'bell'}" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <h5 class="text-sm font-bold text-slate-900 truncate">${a.title}</h5>
            <span class="text-[11px] text-slate-400 font-mono">${a.date}</span>
          </div>
          <p class="text-xs text-slate-600 mt-1 leading-relaxed">${a.message}</p>
        </div>
      </div>
    `).join('');
  },

  // ----------------------------------------------------
  // LOAD STUDENTS (Public Directory)
  // ----------------------------------------------------
  async loadStudents() {
    try {
      let url = `/api/students?sort=${this.currentSort}`;
      if (this.searchQuery) url += `&q=${encodeURIComponent(this.searchQuery)}`;
      if (this.selectedRoom) url += `&room=${encodeURIComponent(this.selectedRoom)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (!data.success) return;

      let list = data.students || [];
      if (this.selectedBlood) {
        list = list.filter(s => (s.blood_group || '').trim().toLowerCase() === this.selectedBlood.trim().toLowerCase());
      }
      this.students = list;

      const countBadge = document.getElementById('directory-count-badge');
      if (countBadge) {
        countBadge.textContent = `${list.length} Students Found`;
      }

      this.renderStudents();
      this.populateRoomFilter(data.students);

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.warn('Error loading students:', err);
    }
  },

  exportStudentsCSV() {
    if (!this.students || this.students.length === 0) {
      this.showToast('No student records to export.', 'error');
      return;
    }
    const headers = ['Admission No', 'Name', 'Room', 'Blood Group', 'Phone', 'Leadership Roles', 'Notes'];
    const rows = this.students.map(s => [
      `"${s.admission_no}"`,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${s.room_no || ''}"`,
      `"${s.blood_group || ''}"`,
      `"${s.phone || ''}"`,
      `"${(s.leadership_roles || '').replace(/"/g, '""')}"`,
      `"${(s.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `WAFD_14_Batch_Students_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('Student directory exported to CSV!', 'success');
  },

  populateRoomFilter(students) {
    const select = document.getElementById('filter-room-select');
    if (!select) return;

    const currentVal = select.value;
    const rooms = new Set();
    students.forEach(s => {
      if (s.room_no) rooms.add(s.room_no);
    });

    const sortedRooms = Array.from(rooms).sort();
    select.innerHTML = `
      <option value="">All Rooms</option>
      ${sortedRooms.map(r => `<option value="${r}" ${r === currentVal ? 'selected' : ''}>${r}</option>`).join('')}
    `;
  },

  renderStudents() {
    const cardContainer = document.getElementById('students-cards-container');
    const tableContainer = document.getElementById('students-table-container');
    const tbody = document.getElementById('students-table-body');
    const emptyState = document.getElementById('students-empty-state');

    if (!cardContainer || !tableContainer) return;

    if (this.students.length === 0) {
      cardContainer.classList.add('hidden');
      tableContainer.classList.add('hidden');
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    if (this.viewMode === 'cards') {
      cardContainer.classList.remove('hidden');
      tableContainer.classList.add('hidden');

      cardContainer.innerHTML = this.students.map(st => `
        <div class="glass-panel p-5 rounded-2xl border border-slate-200/90 shadow-sm card-hover-effect flex flex-col justify-between cursor-pointer transition group" onclick="App.openStudentModal(${st.id})">
          <div>
            <div class="flex items-center justify-between mb-3.5">
              <span class="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs inline-flex items-center gap-1.5 hover:bg-emerald-100 transition" title="Click to copy admission number" onclick="App.copyAdm(event, '${st.admission_no}')">
                <span>Adm #${st.admission_no}</span>
                <i data-lucide="copy" class="w-3 h-3 text-emerald-600 opacity-70"></i>
              </span>
              ${st.blood_group ? `
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                  ${st.blood_group}
                </span>
              ` : ''}
            </div>

            <div class="flex items-center gap-3.5 my-2">
              <div class="avatar-circle" style="background-color: ${st.avatar_color || '#047857'}">
                ${st.name.charAt(0).toUpperCase()}
              </div>
              <div class="overflow-hidden">
                <h4 class="font-bold text-slate-900 text-base group-hover:text-emerald-700 transition truncate">${st.name}</h4>
                <p class="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <i data-lucide="map-pin" class="w-3 h-3 text-slate-400"></i>
                  <span>${st.room_no || 'Room Assigned Soon'}</span>
                </p>
              </div>
            </div>

            ${st.leadership_roles ? `
              <div class="mt-3 flex flex-wrap gap-1.5">
                <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  <i data-lucide="award" class="w-3 h-3 text-amber-600"></i>
                  ${st.leadership_roles}
                </span>
              </div>
            ` : ''}

            ${st.notes ? `
              <p class="text-xs text-slate-500 mt-3 line-clamp-2 italic bg-slate-50/70 p-2 rounded-lg border border-slate-100">
                "${st.notes}"
              </p>
            ` : ''}
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-700 font-semibold group-hover:translate-x-0.5 transition-transform">
            <span>View Full Profile</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </div>
        </div>
      `).join('');
    } else {
      cardContainer.classList.add('hidden');
      tableContainer.classList.remove('hidden');

      if (tbody) {
        tbody.innerHTML = this.students.map((st, idx) => `
          <tr class="student-row border-b border-slate-100 cursor-pointer" onclick="App.openStudentModal(${st.id})">
            <td class="py-3 px-4 font-mono font-bold text-emerald-700">#${st.admission_no}</td>
            <td class="py-3 px-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style="background-color: ${st.avatar_color || '#059669'}">
                  ${st.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span class="font-semibold text-slate-800 text-sm block">${st.name}</span>
                  ${st.leadership_roles ? `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 mt-0.5">${st.leadership_roles}</span>` : ''}
                </div>
              </div>
            </td>
            <td class="py-3 px-4 text-xs font-medium text-slate-600">${st.room_no || '—'}</td>
            <td class="py-3 px-4 text-xs font-semibold text-slate-700">${st.blood_group || '—'}</td>
            <td class="py-3 px-4 text-xs text-slate-500 font-mono">${st.phone || '—'}</td>
            <td class="py-3 px-4 text-right">
              <span class="text-xs font-semibold text-emerald-700 hover:underline">Details &rarr;</span>
            </td>
          </tr>
        `).join('');
      }
    }

    if (window.lucide) lucide.createIcons();
  },

  setViewMode(mode) {
    this.viewMode = mode;
    localStorage.setItem('wafd_view_mode', mode);

    const cardBtn = document.getElementById('view-mode-cards');
    const tableBtn = document.getElementById('view-mode-table');

    if (mode === 'cards') {
      cardBtn?.classList.add('bg-emerald-700', 'text-white');
      cardBtn?.classList.remove('text-slate-600', 'bg-white');
      tableBtn?.classList.remove('bg-emerald-700', 'text-white');
      tableBtn?.classList.add('text-slate-600', 'bg-white');
    } else {
      tableBtn?.classList.add('bg-emerald-700', 'text-white');
      tableBtn?.classList.remove('text-slate-600', 'bg-white');
      cardBtn?.classList.remove('bg-emerald-700', 'text-white');
      cardBtn?.classList.add('text-slate-600', 'bg-white');
    }

    this.renderStudents();
  },

  // ----------------------------------------------------
  // STUDENT DETAIL MODAL
  // ----------------------------------------------------
  openStudentModal(studentId) {
    const st = this.students.find(s => s.id === studentId);
    if (!st) return;

    const modal = document.getElementById('student-detail-modal');
    if (!modal) return;

    document.getElementById('modal-student-name').textContent = st.name;
    document.getElementById('modal-student-adm').textContent = `#${st.admission_no}`;
    document.getElementById('modal-student-room').textContent = st.room_no || 'Unassigned';
    document.getElementById('modal-student-blood').textContent = st.blood_group || 'Not recorded';
    document.getElementById('modal-student-phone').textContent = st.phone || 'Available on Phone Call Day';
    document.getElementById('modal-student-notes').textContent = st.notes || 'Enrolled in WAFD 14 Batch under Usthad Muhammed Haithami.';

    const avatar = document.getElementById('modal-student-avatar');
    if (avatar) {
      avatar.style.backgroundColor = st.avatar_color || '#047857';
      avatar.textContent = st.name.charAt(0).toUpperCase();
    }

    const leaderBadge = document.getElementById('modal-student-leadership');
    if (leaderBadge) {
      if (st.leadership_roles) {
        leaderBadge.textContent = st.leadership_roles;
        leaderBadge.classList.remove('hidden');
      } else {
        leaderBadge.classList.add('hidden');
      }
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  },

  closeStudentModal() {
    const modal = document.getElementById('student-detail-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.style.overflow = '';
    }
  },

  copyAdm(e, adm) {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(adm).then(() => {
      this.showToast(`Admission #${adm} copied to clipboard!`, 'info');
    }).catch(() => {
      this.showToast(`Admission #${adm}`, 'info');
    });
  },

  // ----------------------------------------------------
  // TOAST NOTIFICATIONS
  // ----------------------------------------------------
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${icon}" class="w-5 h-5 flex-shrink-0"></i>
      <span class="text-sm font-medium flex-1">${message}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // ----------------------------------------------------
  // BIND EVENTS
  // ----------------------------------------------------
  bindEvents() {
    // Search input with debouncing
    const searchInput = document.getElementById('student-search-input');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchQuery = searchInput.value.trim();
          this.loadStudents();
        }, 200);
      });
    }

    // Sort select
    const sortSelect = document.getElementById('sort-students-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        this.currentSort = sortSelect.value;
        this.loadStudents();
      });
    }

    // Room filter
    const roomSelect = document.getElementById('filter-room-select');
    if (roomSelect) {
      roomSelect.addEventListener('change', () => {
        this.selectedRoom = roomSelect.value;
        this.loadStudents();
      });
    }

    // Blood filter
    const bloodSelect = document.getElementById('filter-blood-select');
    if (bloodSelect) {
      bloodSelect.addEventListener('change', () => {
        this.selectedBlood = bloodSelect.value;
        this.loadStudents();
      });
    }

    // Export CSV button
    const exportCsvBtn = document.getElementById('btn-export-students-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => this.exportStudentsCSV());
    }

    // Mobile Navigation Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileNavMenu = document.getElementById('mobile-nav-menu');
    if (mobileMenuBtn && mobileNavMenu) {
      mobileMenuBtn.addEventListener('click', () => {
        mobileNavMenu.classList.toggle('hidden');
      });
      document.querySelectorAll('.mobile-nav-link').forEach(link => {
        link.addEventListener('click', () => {
          mobileNavMenu.classList.add('hidden');
        });
      });
    }

    // View mode buttons
    const cardBtn = document.getElementById('view-mode-cards');
    const tableBtn = document.getElementById('view-mode-table');
    if (cardBtn) cardBtn.addEventListener('click', () => this.setViewMode('cards'));
    if (tableBtn) tableBtn.addEventListener('click', () => this.setViewMode('table'));

    // Student detail modal close
    const closeStudentBtn = document.getElementById('close-student-detail-modal');
    if (closeStudentBtn) closeStudentBtn.addEventListener('click', () => this.closeStudentModal());

    // Digital Apps direct launch buttons (No Modal - Direct Web Launch)
    const launchCampus360Btn = document.getElementById('btn-launch-campus360');
    if (launchCampus360Btn) {
      launchCampus360Btn.addEventListener('click', (e) => {
        e.preventDefault();
        DigitalApps.openCampus360();
      });
    }

    const launchSilahBtn = document.getElementById('btn-launch-silah');
    if (launchSilahBtn) {
      launchSilahBtn.addEventListener('click', (e) => {
        e.preventDefault();
        DigitalApps.openSilah();
      });
    }

    // Close modals on clicking backdrop
    window.addEventListener('click', (e) => {
      const studentModal = document.getElementById('student-detail-modal');
      const loginModal = document.getElementById('admin-login-modal');
      const silahModal = document.getElementById('silah-embed-modal');
      const studentFormModal = document.getElementById('student-form-modal');
      const posFormModal = document.getElementById('position-form-modal');

      if (e.target === studentModal) this.closeStudentModal();
      if (e.target === loginModal && window.AdminApp) AdminApp.hideLoginModal();
      if (e.target === silahModal) SilahApp.toggleEmbedModal(false);
      if (e.target === studentFormModal && window.AdminApp) AdminApp.closeStudentModal();
      if (e.target === posFormModal && window.AdminApp) AdminApp.closePositionModal();
    });

    // Close modals on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeStudentModal();
        SilahApp.toggleEmbedModal(false);
        if (window.AdminApp) {
          AdminApp.hideLoginModal();
          AdminApp.closeStudentModal();
          AdminApp.closePositionModal();
        }
      }
    });
  }
};

window.App = App;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
