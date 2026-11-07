const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const { db, getSetting, setSetting, getAllSettings } = require('./db');
const { verifyPassword, hashPassword, generateSessionToken } = require('./auth');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function parseCookies(request) {
  const list = {};
  const rc = request.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

function getAuthUser(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    const cookies = parseCookies(req);
    token = cookies.wafd_session;
  }

  if (!token) return null;

  try {
    const session = db.prepare(`
      SELECT s.token, s.user_id, a.username, a.role, a.display_name, a.avatar_url, a.email, a.phone
      FROM sessions s 
      JOIN admins a ON s.user_id = a.id 
      WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
    `).get(token);

    return session || null;
  } catch (err) {
    console.error('Session lookup error:', err);
    return null;
  }
}

function logActivity(action, details = '') {
  try {
    db.prepare('INSERT INTO activity_logs (action, details) VALUES (?, ?)').run(action, details);
  } catch (err) {
    console.error('Log error:', err);
  }
}

function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...headers
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) { // 10MB limit for wallpapers and photos
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // ----------------------------------------------------
  // API ROUTING
  // ----------------------------------------------------
  if (pathname.startsWith('/api/')) {
    try {
      // 1. PUBLIC INFO
      if (pathname === '/api/public-info' && req.method === 'GET') {
        const settings = getAllSettings();
        const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
        const leadershipRoles = db.prepare(`
          SELECT l.*, s.admission_no, s.room_no 
          FROM leadership_roles l 
          LEFT JOIN students s ON l.assigned_student_id = s.id 
          ORDER BY l.display_order ASC, l.id ASC
        `).all();
        const announcements = db.prepare('SELECT * FROM announcements ORDER BY id DESC LIMIT 5').all();
        const custom_sections = db.prepare('SELECT * FROM custom_sections WHERE is_active = 1 ORDER BY display_order ASC, id ASC').all();

        return sendJson(res, 200, {
          success: true,
          settings,
          total_students: totalStudents,
          leadership_roles: leadershipRoles,
          announcements,
          custom_sections
        });
      }

      // 2. AUTH: LOGIN
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        const { username, password } = await parseJsonBody(req);
        if (!username || !password) {
          return sendJson(res, 400, { error: 'Username and password are required' });
        }

        const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username.trim());
        if (!admin || !verifyPassword(password, admin.password_hash, admin.salt)) {
          return sendJson(res, 401, { error: 'Invalid username or password' });
        }

        // Generate token valid for 7 days
        const token = generateSessionToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        db.prepare(`
          INSERT INTO sessions (token, user_id, expires_at)
          VALUES (?, ?, ?)
        `).run(token, admin.id, expiresAt);

        db.prepare('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(admin.id);
        logActivity('Admin Login', `User '${admin.username}' logged in successfully.`);

        const cookieHeader = `wafd_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`;

        return sendJson(res, 200, {
          success: true,
          token,
          user: { id: admin.id, username: admin.username, role: admin.role }
        }, { 'Set-Cookie': cookieHeader });
      }

      // 3. AUTH: LOGOUT
      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        const authUser = getAuthUser(req);
        if (authUser) {
          db.prepare('DELETE FROM sessions WHERE token = ?').run(authUser.token);
          logActivity('Admin Logout', `User '${authUser.username}' logged out.`);
        }
        return sendJson(res, 200, { success: true }, {
          'Set-Cookie': 'wafd_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
        });
      }

      // 4. AUTH: ME
      if (pathname === '/api/auth/me' && req.method === 'GET') {
        const authUser = getAuthUser(req);
        if (!authUser) {
          return sendJson(res, 200, { authenticated: false });
        }
        return sendJson(res, 200, {
          authenticated: true,
          user: {
            id: authUser.user_id,
            username: authUser.username,
            role: authUser.role,
            display_name: authUser.display_name || 'Batch Administrator',
            avatar_url: authUser.avatar_url || '',
            email: authUser.email || '',
            phone: authUser.phone || ''
          }
        });
      }

      // 4b. AUTH: UPDATE ADMIN PROFILE (Name, Avatar, Email, Phone)
      if (pathname === '/api/auth/profile' && req.method === 'PUT') {
        const authUser = getAuthUser(req);
        if (!authUser) return sendJson(res, 401, { error: 'Unauthorized. Admin login required.' });

        const body = await parseJsonBody(req);
        const { display_name, avatar_url, email, phone } = body;

        db.prepare(`
          UPDATE admins 
          SET display_name = COALESCE(?, display_name),
              avatar_url = COALESCE(?, avatar_url),
              email = COALESCE(?, email),
              phone = COALESCE(?, phone)
          WHERE id = ?
        `).run(display_name || null, avatar_url !== undefined ? avatar_url : null, email !== undefined ? email : null, phone !== undefined ? phone : null, authUser.user_id);

        const updatedAdmin = db.prepare('SELECT id, username, role, display_name, avatar_url, email, phone FROM admins WHERE id = ?').get(authUser.user_id);
        logActivity('Admin Profile Updated', `Admin profile details updated.`);

        return sendJson(res, 200, { success: true, message: 'Profile updated successfully', user: updatedAdmin });
      }

      // 4c. FILE / WALLPAPER / IMAGE UPLOAD
      if (pathname === '/api/upload' && req.method === 'POST') {
        const authUser = getAuthUser(req);
        if (!authUser) return sendJson(res, 401, { error: 'Unauthorized. Admin login required.' });

        const body = await parseJsonBody(req);
        const { data, filename, type } = body;

        if (!data) {
          return sendJson(res, 400, { error: 'No image data provided' });
        }

        const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let ext = '.jpg';
        let buffer;

        if (matches) {
          const mime = matches[1].toLowerCase();
          if (mime.includes('png')) ext = '.png';
          else if (mime.includes('webp')) ext = '.webp';
          else if (mime.includes('gif')) ext = '.gif';
          else if (mime.includes('svg')) ext = '.svg';
          else ext = '.jpg';
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          buffer = Buffer.from(data, 'base64');
        }

        const prefix = (type || 'upload').replace(/[^a-z0-9_-]/gi, '');
        const cleanName = `${prefix}_${Date.now()}${ext}`;
        const uploadDir = path.join(PUBLIC_DIR, 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const filePath = path.join(uploadDir, cleanName);
        fs.writeFileSync(filePath, buffer);

        const fileUrl = `/uploads/${cleanName}`;
        logActivity('Image Uploaded', `Uploaded ${type || 'image'}: ${cleanName}`);
        return sendJson(res, 200, { success: true, url: fileUrl });
      }

      // 5. AUTH: UPDATE ADMIN CREDENTIALS (USERNAME AND PASSWORD)
      if ((pathname === '/api/auth/update-credentials' || pathname === '/api/auth/change-password') && req.method === 'POST') {
        const authUser = getAuthUser(req);
        if (!authUser) {
          return sendJson(res, 401, { error: 'Unauthorized. Admin login required.' });
        }
        const { current_password, new_username, new_password } = await parseJsonBody(req);
        if (!current_password) {
          return sendJson(res, 400, { error: 'Current password is required to authorize changes' });
        }

        const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(authUser.user_id);
        if (!verifyPassword(current_password, admin.password_hash, admin.salt)) {
          return sendJson(res, 400, { error: 'Current password is incorrect' });
        }

        let updatedUsername = admin.username;
        const changes = [];

        // Check if username change requested
        if (new_username && new_username.trim() && new_username.trim() !== admin.username) {
          const trimmedUsername = new_username.trim();
          if (trimmedUsername.length < 3) {
            return sendJson(res, 400, { error: 'New username must be at least 3 characters' });
          }
          const existing = db.prepare('SELECT id FROM admins WHERE username = ? AND id != ?').get(trimmedUsername, admin.id);
          if (existing) {
            return sendJson(res, 400, { error: `Username "${trimmedUsername}" is already taken` });
          }
          db.prepare('UPDATE admins SET username = ? WHERE id = ?').run(trimmedUsername, admin.id);
          changes.push(`username changed to "${trimmedUsername}"`);
          updatedUsername = trimmedUsername;
        }

        // Check if password change requested
        if (new_password && new_password.trim()) {
          if (new_password.length < 6) {
            return sendJson(res, 400, { error: 'New password must be at least 6 characters' });
          }
          const { hash, salt } = hashPassword(new_password);
          db.prepare('UPDATE admins SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, admin.id);
          changes.push('password updated');
        }

        if (changes.length === 0) {
          return sendJson(res, 400, { error: 'No changes provided. Please enter a new username or new password.' });
        }

        logActivity('Admin Credentials Updated', `User '${admin.username}' updated: ${changes.join(', ')}.`);

        return sendJson(res, 200, {
          success: true,
          message: `Admin credentials updated successfully (${changes.join(', ')}).`,
          user: { id: admin.id, username: updatedUsername, role: admin.role }
        });
      }

      // 6. STUDENTS: GET (Public - with search, filter, and sort)
      if (pathname === '/api/students' && req.method === 'GET') {
        const q = (query.q || '').trim();
        const room = (query.room || '').trim();
        const sort = query.sort || 'adm_asc';

        let sql = `
          SELECT s.*, 
            GROUP_CONCAT(l.title, ', ') as leadership_roles,
            GROUP_CONCAT(l.badge_color, ', ') as leadership_colors
          FROM students s
          LEFT JOIN leadership_roles l ON l.assigned_student_id = s.id
        `;
        const params = [];
        const conditions = [];

        if (q) {
          conditions.push('(s.name LIKE ? OR s.admission_no LIKE ? OR s.phone LIKE ?)');
          params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        if (room) {
          conditions.push('s.room_no = ?');
          params.push(room);
        }

        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' GROUP BY s.id ';

        // Sort order
        if (sort === 'adm_asc') {
          sql += ' ORDER BY CAST(s.admission_no AS INTEGER) ASC, s.admission_no ASC';
        } else if (sort === 'adm_desc') {
          sql += ' ORDER BY CAST(s.admission_no AS INTEGER) DESC, s.admission_no DESC';
        } else if (sort === 'name_asc') {
          sql += ' ORDER BY s.name ASC';
        } else if (sort === 'name_desc') {
          sql += ' ORDER BY s.name DESC';
        } else {
          sql += ' ORDER BY CAST(s.admission_no AS INTEGER) ASC';
        }

        const students = db.prepare(sql).all(...params);
        return sendJson(res, 200, { success: true, count: students.length, students });
      }

      // 7. STUDENTS: CREATE (Admin only)
      if (pathname === '/api/students' && req.method === 'POST') {
        const authUser = getAuthUser(req);
        if (!authUser) return sendJson(res, 401, { error: 'Admin access required' });

        const body = await parseJsonBody(req);
        const { admission_no, name, phone, room_no, blood_group, notes, photo_url } = body;

        if (!admission_no || !name) {
          return sendJson(res, 400, { error: 'Admission Number and Name are required' });
        }

        const existing = db.prepare('SELECT id FROM students WHERE admission_no = ?').get(admission_no.trim());
        if (existing) {
          return sendJson(res, 400, { error: `Admission number ${admission_no} already exists` });
        }

        const colors = ['#059669', '#0284c7', '#7c3aed', '#d97706', '#dc2626', '#0d9488', '#4f46e5', '#ca8a04'];
        const avatar_color = colors[Math.floor(Math.random() * colors.length)];

        const result = db.prepare(`
          INSERT INTO students (admission_no, name, phone, room_no, blood_group, notes, avatar_color, photo_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(admission_no.trim(), name.trim(), phone || '', room_no || '', blood_group || '', notes || '', avatar_color, photo_url || '');

        logActivity('Student Added', `Added student ${name} (Adm: ${admission_no})`);

        return sendJson(res, 201, {
          success: true,
          message: 'Student added successfully',
          student: { id: result.lastInsertRowid, admission_no, name, phone, room_no, blood_group, notes }
        });
      }

      // 8. STUDENTS: UPDATE & DELETE by ID (Admin only)
      const studentIdMatch = pathname.match(/^\/api\/students\/(\d+)$/);
      if (studentIdMatch) {
        const studentId = parseInt(studentIdMatch[1], 10);

        if (req.method === 'GET') {
          const student = db.prepare(`
            SELECT s.*, GROUP_CONCAT(l.title, ', ') as leadership_roles 
            FROM students s 
            LEFT JOIN leadership_roles l ON l.assigned_student_id = s.id 
            WHERE s.id = ?
            GROUP BY s.id
          `).get(studentId);
          if (!student) return sendJson(res, 404, { error: 'Student not found' });
          return sendJson(res, 200, { success: true, student });
        }

        const authUser = getAuthUser(req);
        if (!authUser) return sendJson(res, 401, { error: 'Admin access required' });

        if (req.method === 'PUT') {
          const body = await parseJsonBody(req);
          const { admission_no, name, phone, room_no, blood_group, notes, photo_url } = body;

          if (!admission_no || !name) {
            return sendJson(res, 400, { error: 'Admission Number and Name are required' });
          }

          // Check admission_no unique constraint excluding current student
          const existing = db.prepare('SELECT id FROM students WHERE admission_no = ? AND id != ?').get(admission_no.trim(), studentId);
          if (existing) {
            return sendJson(res, 400, { error: `Admission number ${admission_no} already exists for another student` });
          }

          db.prepare(`
            UPDATE students 
            SET admission_no = ?, name = ?, phone = ?, room_no = ?, blood_group = ?, notes = ?, photo_url = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(admission_no.trim(), name.trim(), phone || '', room_no || '', blood_group || '', notes || '', photo_url !== undefined ? photo_url : '', studentId);

          // Update assigned_name in leadership roles if linked
          db.prepare(`
            UPDATE leadership_roles 
            SET assigned_name = ? 
            WHERE assigned_student_id = ?
          `).run(name.trim(), studentId);

          logActivity('Student Updated', `Updated details for ${name} (Adm: ${admission_no})`);
          return sendJson(res, 200, { success: true, message: 'Student updated successfully' });
        }

        if (req.method === 'DELETE') {
          const student = db.prepare('SELECT name, admission_no FROM students WHERE id = ?').get(studentId);
          if (!student) return sendJson(res, 404, { error: 'Student not found' });

          // Unlink from leadership roles before deletion
          db.prepare('UPDATE leadership_roles SET assigned_student_id = NULL WHERE assigned_student_id = ?').run(studentId);
          db.prepare('DELETE FROM students WHERE id = ?').run(studentId);

          logActivity('Student Deleted', `Deleted student ${student.name} (Adm: ${student.admission_no})`);
          return sendJson(res, 200, { success: true, message: 'Student deleted successfully' });
        }
      }

      // 9. LEADERSHIP ROLES: GET (Public)
      if (pathname === '/api/leadership' && req.method === 'GET') {
        const roles = db.prepare(`
          SELECT l.*, s.name as student_name_from_db, s.admission_no, s.room_no, s.phone, s.avatar_color
          FROM leadership_roles l
          LEFT JOIN students s ON l.assigned_student_id = s.id
          ORDER BY l.display_order ASC, l.id ASC
        `).all();
        return sendJson(res, 200, { success: true, count: roles.length, roles });
      }

      // 10. LEADERSHIP ROLES: CREATE (Admin only)
      if (pathname === '/api/leadership' && req.method === 'POST') {
        const authUser = getAuthUser(req);
        if (!authUser) return sendJson(res, 401, { error: 'Admin access required' });

        const body = await parseJsonBody(req);
        const { title, assigned_student_id, assigned_name, badge_color, description } = body;

        if (!title) return sendJson(res, 400, { error: 'Role title is required' });

        const maxOrder = db.prepare('SELECT MAX(display_order) as m FROM leadership_roles').get().m || 0;

        let finalStudentId = assigned_student_id ? parseInt(assigned_student_id, 10) : null;
        let finalAssignedName = (assigned_name || '').trim();

        if (finalStudentId) {
          const st = db.prepare('SELECT name FROM students WHERE id = ?').get(finalStudentId);
          if (st) finalAssignedName = st.name;
        }

        const result = db.prepare(`
          INSERT INTO leadership_roles (title, assigned_student_id, assigned_name, display_order, badge_color, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(title.trim(), finalStudentId, finalAssignedName, maxOrder + 1, badge_color || 'emerald', description || '');

        logActivity('Leadership Role Created', `Created position: ${title}`);
        return sendJson(res, 201, { success: true, message: 'Position created successfully', id: result.lastInsertRowid });
      }

      // 11. LEADERSHIP ROLES: UPDATE & DELETE by ID (Admin only)
      const roleIdMatch = pathname.match(/^\/api\/leadership\/(\d+)$/);
      if (roleIdMatch) {
        const roleId = parseInt(roleIdMatch[1], 10);
        const authUser = getAuthUser(req);
        if (!authUser) return sendJson(res, 401, { error: 'Admin access required' });

        if (req.method === 'PUT') {
          const body = await parseJsonBody(req);
          const { title, assigned_student_id, assigned_name, badge_color, description, display_order } = body;

          let finalStudentId = assigned_student_id ? parseInt(assigned_student_id, 10) : null;
          let finalAssignedName = (assigned_name || '').trim();

          if (finalStudentId) {
            const st = db.prepare('SELECT name FROM students WHERE id = ?').get(finalStudentId);
            if (st) finalAssignedName = st.name;
          }

          db.prepare(`
            UPDATE leadership_roles
            SET title = COALESCE(?, title),
                assigned_student_id = ?,
                assigned_name = ?,
                badge_color = COALESCE(?, badge_color),
                description = COALESCE(?, description),
                display_order = COALESCE(?, display_order)
            WHERE id = ?
          `).run(
            title ? title.trim() : null,
            finalStudentId,
            finalAssignedName,
            badge_color || null,
            description !== undefined ? description : null,
            display_order !== undefined ? display_order : null,
            roleId
          );

          logActivity('Leadership Role Updated', `Updated role ID ${roleId} (${title || ''})`);
          return sendJson(res, 200, { success: true, message: 'Leadership role updated successfully' });
        }

        if (req.method === 'DELETE') {
          const role = db.prepare('SELECT title FROM leadership_roles WHERE id = ?').get(roleId);
          if (!role) return sendJson(res, 404, { error: 'Leadership role not found' });

          db.prepare('DELETE FROM leadership_roles WHERE id = ?').run(roleId);
          logActivity('Leadership Role Deleted', `Deleted role: ${role.title}`);
          return sendJson(res, 200, { success: true, message: 'Leadership role deleted successfully' });
        }
      }

      // 12. SETTINGS: UPDATE (Admin only)
      if (pathname === '/api/settings' && req.method === 'PUT') {
        const authUser = getAuthUser(req);
        if (!authUser) return sendJson(res, 401, { error: 'Admin access required' });

        const body = await parseJsonBody(req);
        for (const [key, val] of Object.entries(body)) {
          if (typeof val === 'string' || typeof val === 'number') {
            setSetting(key, String(val));
          }
        }

        logActivity('Settings Updated', 'Updated class/homepage information and settings.');
        return sendJson(res, 200, { success: true, settings: getAllSettings() });
      }

      // 13. CUSTOM SECTIONS: GET & POST
      if (pathname === '/api/sections') {
        if (req.method === 'GET') {
          const sections = db.prepare('SELECT * FROM custom_sections ORDER BY display_order ASC, id ASC').all();
          return sendJson(res, 200, { success: true, sections });
        }

        if (req.method === 'POST') {
          const authUser = getAuthUser(req);
          if (!authUser) return sendJson(res, 401, { error: 'Admin access required' });

          const body = await parseJsonBody(req);
          const { title, subtitle, content, icon, is_active } = body;
          if (!title || !content) return sendJson(res, 400, { error: 'Title and content are required' });

          const maxOrder = db.prepare('SELECT MAX(display_order) as m FROM custom_sections').get().m || 0;
          const result = db.prepare(`
            INSERT INTO custom_sections (title, subtitle, content, icon, is_active, display_order)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(title.trim(), subtitle || '', content.trim(), icon || 'sparkles', is_active !== undefined ? is_active : 1, maxOrder + 1);

          logActivity('Section Added', `Added section: ${title}`);
          return sendJson(res, 201, { success: true, id: result.lastInsertRowid });
        }
      }

      const sectionIdMatch = pathname.match(/^\/api\/sections\/(\d+)$/);
      if (sectionIdMatch) {
        const secId = parseInt(sectionIdMatch[1], 10);
        const authUser = getAuthUser(req);
        if (!authUser) return sendJson(res, 401, { error: 'Admin access required' });

        if (req.method === 'PUT') {
          const body = await parseJsonBody(req);
          const { title, subtitle, content, icon, is_active, display_order } = body;
          db.prepare(`
            UPDATE custom_sections
            SET title = COALESCE(?, title),
                subtitle = COALESCE(?, subtitle),
                content = COALESCE(?, content),
                icon = COALESCE(?, icon),
                is_active = COALESCE(?, is_active),
                display_order = COALESCE(?, display_order)
            WHERE id = ?
          `).run(title || null, subtitle !== undefined ? subtitle : null, content || null, icon || null, is_active !== undefined ? is_active : null, display_order !== undefined ? display_order : null, secId);
          return sendJson(res, 200, { success: true });
        }

        if (req.method === 'DELETE') {
          db.prepare('DELETE FROM custom_sections WHERE id = ?').run(secId);
          logActivity('Section Deleted', `Deleted section ID ${secId}`);
          return sendJson(res, 200, { success: true });
        }
      }

      // 14. ANNOUNCEMENTS: GET, POST, DELETE
      if (pathname === '/api/announcements') {
        if (req.method === 'GET') {
          const list = db.prepare('SELECT * FROM announcements ORDER BY id DESC').all();
          return sendJson(res, 200, { success: true, announcements: list });
        }
        if (req.method === 'POST') {
          const authUser = getAuthUser(req);
          if (!authUser) return sendJson(res, 401, { error: 'Admin access required' });

          const body = await parseJsonBody(req);
          const { title, message, priority, date } = body;
          if (!title || !message) return sendJson(res, 400, { error: 'Title and message are required' });

          const dateStr = date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const result = db.prepare(`
            INSERT INTO announcements (title, message, priority, date)
            VALUES (?, ?, ?, ?)
          `).run(title.trim(), message.trim(), priority || 'normal', dateStr);

          logActivity('Announcement Posted', `Posted: ${title}`);
          return sendJson(res, 201, { success: true, id: result.lastInsertRowid });
        }
      }

      const announcementIdMatch = pathname.match(/^\/api\/announcements\/(\d+)$/);
      if (announcementIdMatch && req.method === 'DELETE') {
        const authUser = getAuthUser(req);
        if (!authUser) return sendJson(res, 401, { error: 'Admin access required' });
        const annId = parseInt(announcementIdMatch[1], 10);
        db.prepare('DELETE FROM announcements WHERE id = ?').run(annId);
        logActivity('Announcement Deleted', `Deleted announcement ID ${annId}`);
        return sendJson(res, 200, { success: true });
      }

      // 15. ADMIN DASHBOARD STATS & OVERVIEW
      if (pathname === '/api/admin/stats' && req.method === 'GET') {
        const authUser = getAuthUser(req);
        if (!authUser) return sendJson(res, 401, { error: 'Admin access required' });

        const totalStudents = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
        const totalLeadershipRoles = db.prepare('SELECT COUNT(*) as c FROM leadership_roles').get().c;
        const assignedLeadershipRoles = db.prepare("SELECT COUNT(*) as c FROM leadership_roles WHERE (assigned_student_id IS NOT NULL OR (assigned_name IS NOT NULL AND assigned_name != ''))").get().c;
        const totalAnnouncements = db.prepare('SELECT COUNT(*) as c FROM announcements').get().c;
        const totalCustomSections = db.prepare('SELECT COUNT(*) as c FROM custom_sections').get().c;
        const recentLogs = db.prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 10').all();

        const roomCounts = db.prepare(`
          SELECT room_no, COUNT(*) as count 
          FROM students 
          WHERE room_no != '' 
          GROUP BY room_no 
          ORDER BY room_no ASC
        `).all();

        return sendJson(res, 200, {
          success: true,
          stats: {
            total_students: totalStudents,
            total_roles: totalLeadershipRoles,
            assigned_roles: assignedLeadershipRoles,
            vacant_roles: totalLeadershipRoles - assignedLeadershipRoles,
            total_announcements: totalAnnouncements,
            total_sections: totalCustomSections,
            room_distribution: roomCounts,
            recent_logs: recentLogs
          }
        });
      }

      // 16. EXPORT / BACKUP STUDENTS (Admin only)
      if (pathname === '/api/students/export' && req.method === 'GET') {
        const authUser = getAuthUser(req);
        if (!authUser) return sendJson(res, 401, { error: 'Admin access required' });

        const students = db.prepare('SELECT * FROM students ORDER BY CAST(admission_no AS INTEGER) ASC').all();
        return sendJson(res, 200, { success: true, exported_at: new Date().toISOString(), students });
      }

      // Route not found in API
      return sendJson(res, 404, { error: 'API endpoint not found' });

    } catch (err) {
      console.error('Server error handling API request:', err);
      return sendJson(res, 500, { error: 'Internal Server Error', message: err.message });
    }
  }

  // ----------------------------------------------------
  // STATIC FILE SERVING
  // ----------------------------------------------------
  let safePath = path.normalize(decodeURI(pathname)).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  let filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If file not found, try fallback to index.html (SPA support)
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404 Not Found');
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  WAFD FRIENDS 14 BATCH - Class Management Server  `);
  console.log(`  Port: http://localhost:${PORT}                      `);
  console.log(`  Default Admin: admin / wafd14@admin               `);
  console.log(`====================================================`);
});
