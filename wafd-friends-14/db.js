const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const { hashPassword } = require('./auth');

const dbPath = path.join(__dirname, 'wafd_class.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys for performance and integrity
db.exec('PRAGMA foreign_keys = ON;');

function initDatabase() {
  // Settings table (key-value store for site and class configuration)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Students table
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admission_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      room_no TEXT DEFAULT '',
      blood_group TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      avatar_color TEXT DEFAULT '#059669',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Leadership roles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS leadership_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      assigned_student_id INTEGER NULL,
      assigned_name TEXT DEFAULT '',
      display_order INTEGER DEFAULT 0,
      badge_color TEXT DEFAULT 'emerald',
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_student_id) REFERENCES students(id) ON DELETE SET NULL
    );
  `);

  // Admins table
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );
  `);

  // Sessions table for token authentication
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES admins(id) ON DELETE CASCADE
    );
  `);

  // Custom sections table
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subtitle TEXT DEFAULT '',
      content TEXT NOT NULL,
      icon TEXT DEFAULT 'sparkles',
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Announcements table
  db.exec(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      priority TEXT DEFAULT 'normal',
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Activity log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      details TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe schema migrations for admin profile and wallpapers
  try { db.exec("ALTER TABLE admins ADD COLUMN display_name TEXT DEFAULT 'Batch Administrator';"); } catch (e) {}
  try { db.exec("ALTER TABLE admins ADD COLUMN avatar_url TEXT DEFAULT '';"); } catch (e) {}
  try { db.exec("ALTER TABLE admins ADD COLUMN email TEXT DEFAULT '';"); } catch (e) {}
  try { db.exec("ALTER TABLE admins ADD COLUMN phone TEXT DEFAULT '';"); } catch (e) {}
  try { db.exec("ALTER TABLE students ADD COLUMN photo_url TEXT DEFAULT '';"); } catch (e) {}

  seedInitialData();
}

function getSetting(key, defaultValue = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function setSetting(key, value) {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(key, value);
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  return settings;
}

function seedInitialData() {
  // Check if settings already seeded
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
  if (existingCount === 0) {
    const defaultSettings = [
      ['website_name', 'WAFD FRIENDS 14 BATCH'],
      ['class_name', 'WAFD'],
      ['batch_year', '14th Batch'],
      ['usthad_name', 'Muhammed Haithami'],
      ['usthad_title', 'Respected Class Usthad'],
      ['usthad_message', 'Guided by knowledge, united in brotherhood, adab, and excellence.'],
      ['phone_call_day', 'Sunday'],
      ['phone_call_time', '04:00 PM – 06:30 PM'],
      ['phone_call_guidelines', 'Calls permitted exclusively on the designated day and slot. Maintain proper etiquette.'],
      ['campus360_url', 'https://darulfalah.in/campus360/index.php'],
      ['silah_app_url', 'https://hostiva.co.in/silah'],
      ['batch_motto', 'United in Knowledge, Friendship & Character'],
      ['notification_banner', '✨ Welcome to WAFD FRIENDS 14 BATCH portal! Phone call day is every Sunday. Stay connected!'],
      ['about_text', 'WAFD 14 Batch represents unity, dedication to Islamic learning, academic brilliance, and lifelong brotherhood under the mentorship of our respected Usthad Muhammed Haithami.']
    ];

    for (const [k, v] of defaultSettings) {
      setSetting(k, v);
    }
  }

  // Ensure campus360_url is present
  if (!getSetting('campus360_url')) {
    setSetting('campus360_url', 'https://darulfalah.in/campus360/index.php');
  }

  // Ensure wallpaper & appearance settings exist
  if (!getSetting('hero_wallpaper')) setSetting('hero_wallpaper', '');
  if (!getSetting('hero_wallpaper_preset')) setSetting('hero_wallpaper_preset', 'emerald-islamic');
  if (!getSetting('hero_overlay_opacity')) setSetting('hero_overlay_opacity', '0.7');
  if (!getSetting('usthad_photo_url')) setSetting('usthad_photo_url', '');
  if (!getSetting('site_wallpaper')) setSetting('site_wallpaper', '');

  // Seed default admin if none exists
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get().count;
  if (adminCount === 0) {
    const { hash, salt } = hashPassword('wafd14@admin');
    db.prepare(`
      INSERT INTO admins (username, password_hash, salt, role)
      VALUES (?, ?, ?, 'admin')
    `).run('admin', hash, salt);
  }

  // Seed students if table empty
  const studentCount = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
  if (studentCount === 0) {
    // Initial 22 admission numbers specified in prompt:
    // 519, 520, 523, 525, 526, 528, 529, 530, 531, 532, 533, 534, 537, 538, 540, 541, 542, 544, 545, 546, 548, 551
    const initialStudents = [
      { adm: '519', name: 'Yazeed Rayyan.p', room: 'Room 1', blood: 'O+', phone: '+91 98460 11519', notes: 'Class Leader & Lab Coordinator' },
      { adm: '520', name: 'Rahil.k', room: 'Room 1', blood: 'A+', phone: '+91 98460 11520', notes: 'Second Leader' },
      { adm: '523', name: 'Muhammed Shibili', room: 'Room 2', blood: 'B+', phone: '+91 98460 11523', notes: 'Class President' },
      { adm: '525', name: 'Sinan', room: 'Room 2', blood: 'AB+', phone: '+91 98460 11525', notes: 'Secretary' },
      { adm: '526', name: 'Munthasir Hamza', room: 'Room 1', blood: 'O+', phone: '+91 98460 11526', notes: '1st Room Leader' },
      { adm: '528', name: 'Ibrahim', room: 'Room 2', blood: 'B+', phone: '+91 98460 11528', notes: 'Room 2nd Leader' },
      { adm: '529', name: 'Hani Polar Bear', room: 'Room 3', blood: 'O-', phone: '+91 98460 11529', notes: 'Library Coordinator' },
      { adm: '530', name: 'Ameen', room: 'Room 3', blood: 'A+', phone: '+91 98460 11530', notes: 'Active Batch Member' },
      { adm: '531', name: 'Bilal', room: 'Room 3', blood: 'O+', phone: '+91 98460 11531', notes: 'Active Batch Member' },
      { adm: '532', name: 'Farhan', room: 'Room 1', blood: 'B+', phone: '+91 98460 11532', notes: 'Active Batch Member' },
      { adm: '533', name: 'Hashim', room: 'Room 2', blood: 'AB+', phone: '+91 98460 11533', notes: 'Active Batch Member' },
      { adm: '534', name: 'Irfan', room: 'Room 3', blood: 'O+', phone: '+91 98460 11534', notes: 'Active Batch Member' },
      { adm: '537', name: 'Jasim', room: 'Room 1', blood: 'A+', phone: '+91 98460 11537', notes: 'Active Batch Member' },
      { adm: '538', name: 'Luqman', room: 'Room 2', blood: 'B+', phone: '+91 98460 11538', notes: 'Active Batch Member' },
      { adm: '540', name: 'Nabeel', room: 'Room 3', blood: 'O+', phone: '+91 98460 11540', notes: 'Active Batch Member' },
      { adm: '541', name: 'Rayan Ahmed', room: 'Room 1', blood: 'AB-', phone: '+91 98460 11541', notes: 'Active Batch Member' },
      { adm: '542', name: 'Salman Faris', room: 'Room 2', blood: 'A+', phone: '+91 98460 11542', notes: 'Active Batch Member' },
      { adm: '544', name: 'Thameem', room: 'Room 3', blood: 'B+', phone: '+91 98460 11544', notes: 'Active Batch Member' },
      { adm: '545', name: 'Umar Mukhtar', room: 'Room 1', blood: 'O+', phone: '+91 98460 11545', notes: 'Active Batch Member' },
      { adm: '546', name: 'Wasim', room: 'Room 2', blood: 'A+', phone: '+91 98460 11546', notes: 'Active Batch Member' },
      { adm: '548', name: 'Zakariya', room: 'Room 3', blood: 'B+', phone: '+91 98460 11548', notes: 'Active Batch Member' },
      { adm: '551', name: 'Ziyad', room: 'Room 1', blood: 'O+', phone: '+91 98460 11551', notes: 'Active Batch Member' }
    ];

    const colors = ['#059669', '#0284c7', '#7c3aed', '#d97706', '#dc2626', '#0d9488', '#4f46e5', '#ca8a04'];
    const insertStudent = db.prepare(`
      INSERT INTO students (admission_no, name, room_no, blood_group, phone, notes, avatar_color)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    initialStudents.forEach((st, idx) => {
      insertStudent.run(st.adm, st.name, st.room, st.blood, st.phone, st.notes, colors[idx % colors.length]);
    });
  }

  // Seed Leadership roles if table empty
  const leadershipCount = db.prepare('SELECT COUNT(*) as count FROM leadership_roles').get().count;
  if (leadershipCount === 0) {
    // 10 positions explicitly requested:
    // 1. Class Leader : Yazeed Rayyan.p
    // 2. Second Leader : Rahil.k
    // 3. Class President : muhammed shibili 
    // 4. Secretary : sinan 
    // 5. Joint Secretary : 
    // 6. Vice President :
    // 7. 1st Room Leader : Munthasir hamza
    // 8. room 2nd leader : ibrahim                          
    // 9. Library Coordinator : Hani polar bear 
    // 10. Lab Coordinator : Yazeed Rayyan
    const defaultRoles = [
      { title: 'Class Leader', student_name: 'Yazeed Rayyan.p', order: 1, badge: 'emerald', desc: 'Overall class discipline, coordination with Usthad, and batch representative.' },
      { title: 'Second Leader', student_name: 'Rahil.k', order: 2, badge: 'teal', desc: 'Assists Class Leader, oversees batch tasks and daily check-ins.' },
      { title: 'Class President', student_name: 'muhammed shibili', order: 3, badge: 'blue', desc: 'Presides over batch assemblies, councils, and student welfare initiatives.' },
      { title: 'Secretary', student_name: 'sinan', order: 4, badge: 'indigo', desc: 'Official documentation, meeting minutes, class records and notifications.' },
      { title: 'Joint Secretary', student_name: '', order: 5, badge: 'purple', desc: 'Assists secretary with communications and program management.' },
      { title: 'Vice President', student_name: '', order: 6, badge: 'violet', desc: 'Supports the President in class affairs and batch programs.' },
      { title: '1st Room Leader', student_name: 'Munthasir hamza', order: 7, badge: 'amber', desc: 'Supervises Room 1 cleanliness, discipline, and study schedules.' },
      { title: 'Room 2nd Leader', student_name: 'ibrahim', order: 8, badge: 'orange', desc: 'Supervises Room 2 cleanliness, discipline, and night study hours.' },
      { title: 'Library Coordinator', student_name: 'Hani polar bear', order: 9, badge: 'rose', desc: 'Manages class book collection, borrowing log, and reading periods.' },
      { title: 'Lab Coordinator', student_name: 'Yazeed Rayyan', order: 10, badge: 'cyan', desc: 'Oversees IT/computer lab equipment, practical slots, and technical assets.' }
    ];

    const insertRole = db.prepare(`
      INSERT INTO leadership_roles (title, assigned_student_id, assigned_name, display_order, badge_color, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const r of defaultRoles) {
      let studentId = null;
      if (r.student_name) {
        // Try to match student
        const match = db.prepare('SELECT id, name FROM students WHERE LOWER(name) LIKE ?').get(`%${r.student_name.toLowerCase().trim()}%`);
        if (match) {
          studentId = match.id;
        }
      }
      insertRole.run(r.title, studentId, r.student_name, r.order, r.badge, r.desc);
    }
  }

  // Seed sample announcements
  const announceCount = db.prepare('SELECT COUNT(*) as count FROM announcements').get().count;
  if (announceCount === 0) {
    const insertAnnounce = db.prepare(`
      INSERT INTO announcements (title, message, priority, date)
      VALUES (?, ?, ?, ?)
    `);
    insertAnnounce.run(
      'Sunday Phone Call Day Notice',
      'Phone call window will be open this Sunday from 04:00 PM to 06:30 PM. Please ensure all devices are handled with care and queued on time.',
      'urgent',
      new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    );
    insertAnnounce.run(
      'Special Adab & Fiqh Session with Usthad',
      'Respected Usthad Muhammed Haithami will conduct an exclusive batch circle this Thursday following Asr prayer.',
      'normal',
      new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    );
  }

  // Seed sample custom sections
  const sectionCount = db.prepare('SELECT COUNT(*) as count FROM custom_sections').get().count;
  if (sectionCount === 0) {
    const insertSection = db.prepare(`
      INSERT INTO custom_sections (title, subtitle, content, icon, display_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertSection.run(
      'Phone Call Day Protocols & Etiquette',
      'Weekly Family Call Guidelines',
      'Every Sunday is designated as the official Phone Call Day for WAFD 14 Batch. Students receive dedicated time slots to speak with their families. Strict etiquette is observed: calls are conducted respectfully, within the scheduled window, and returned to safe custody promptly.',
      'phone-call',
      1,
      1
    );
    insertSection.run(
      'Usthad\'s Advisory & Guidance',
      'Words of Wisdom from Usthad Muhammed Haithami',
      '"True knowledge illuminates the heart before the tongue. Let your unity as the 14th Batch be defined by humility, steadfastness in prayer, brotherhood towards one another, and thirst for beneficial ilm."',
      'book-open',
      2,
      1
    );
  }
}

initDatabase();

module.exports = {
  db,
  getSetting,
  setSetting,
  getAllSettings,
  initDatabase
};
