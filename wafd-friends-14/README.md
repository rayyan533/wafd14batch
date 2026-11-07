# WAFD FRIENDS 14 BATCH – Class Management Website

A modern, professional, fully responsive web application built for **WAFD FRIENDS 14 BATCH**.

---

## 🌟 Highlights & Features

### 1. Homepage
- **Website Name**: WAFD FRIENDS 14 BATCH
- **Class Name**: WAFD (14th Batch)
- **Class Usthad**: Muhammed Haithami (with dedicated mentor honors, title, and guidance message)
- **Total Number of Students**: Live, dynamic counter automatically updated from the database
- **Phone Call Day**: Highlighted widget with day indicator, permitted hours, and rules
- **Student Details**: Interactive directory with search, filter, and layout toggles
- **Class Leadership Team**: Complete showcase of all leadership roles with custom badges and profiles

### 2. Student Management
- **Initial Admission Numbers Loaded**:
  `519, 520, 523, 525, 526, 528, 529, 530, 531, 532, 533, 534, 537, 538, 540, 541, 542, 544, 545, 546, 548, 551` (Total 22 students).
- **Features**:
  - Add new student (Admission number, full name, room, blood group, contact phone, notes)
  - Edit existing student details
  - Delete student records with safety confirmation
  - Instant live search by student name or admission number
  - Filter by room allocation
  - Sort by admission number (Ascending / Descending) or student name (A–Z)
  - Attractive **Card View** and clean **Table View** layout toggle
  - Student profile modal showing full batch records

### 3. Class Leadership Team
Includes all 10 positions:
1. **Class Leader**: Yazeed Rayyan.p
2. **Second Leader**: Rahil.k
3. **Class President**: muhammed shibili
4. **Secretary**: sinan
5. **Joint Secretary**: *(To be assigned)*
6. **Vice President**: *(To be assigned)*
7. **1st Room Leader**: Munthasir hamza
8. **Room 2nd Leader**: ibrahim
9. **Library Coordinator**: Hani polar bear
10. **Lab Coordinator**: Yazeed Rayyan

- Admin can assign/reassign students to any position, change badge colors, update descriptions, and add/delete custom positions (e.g. Sports Captain, Stage Convener).

### 4. Admin Authentication & Credential Management
- Secure authentication system with PBKDF2 salted password hashing.
- Token-based session management with 7-day expiration.
- **Username & Password Change**:
  - Authorized admins can change **both their username and password** anytime directly inside the **Security** tab of the Admin Dashboard.
  - Requires current password verification for safety.
- Default Admin Credentials:
  - **Username**: `admin`
  - **Password**: `wafd14@admin`

### 5. Admin Dashboard
- **Class Settings**: Edit Website Name, Class Name, Usthad's Name, Usthad's guidance message, Phone Call Day, timings, notification banners, Campus 360 URL, and Silah URL.
- **Student Management**: Full CRUD interface for all students.
- **Leadership Team**: Manage existing positions or add new ones.
- **Notice Board / Announcements**: Post urgent or regular batch notices.
- **Custom Homepage Sections**: Add new content blocks directly to the homepage.
- **Security & Credentials**: Change admin username and password.
- **Real-Time Synchronization**: Any update made in the dashboard is immediately reflected across the website.

### 6. Connected Digital Web Applications (Direct Web — No Modal)
- **1. Darul Falah Campus 360**:
  - URL: `https://darulfalah.in/campus360/index.php`
  - Official campus management software & student information system.
  - Direct 1-click launch from the top navbar, hero banner, and dedicated Apps section (opens directly in a clean new tab without modal frame restrictions).
- **2. Hostiva Silah Portal**:
  - URL: `https://hostiva.co.in/silah`
  - Direct 1-click launch for batch communication and student network.
- **Admin Configurable**: Both Campus 360 and Silah URLs can be edited and updated dynamically in the Admin Dashboard Settings tab.

---

## 🚀 Running the Project

### Location:
```bash
C:\Users\STUDENT\.gemini\antigravity\scratch\wafd-friends-14
```

### Start Server:
```bash
agy-node server.js
```
The server will start on: **`http://localhost:3000`**

### Active Server Status:
The server is currently running in the background on **`http://localhost:3000`**.

---

## 🗄️ Database Schema (SQLite)

- `students`: `id`, `admission_no`, `name`, `phone`, `room_no`, `blood_group`, `notes`, `avatar_color`, timestamps
- `leadership_roles`: `id`, `title`, `assigned_student_id`, `assigned_name`, `display_order`, `badge_color`, `description`
- `settings`: `key`, `value`, `updated_at` (stores all class and site settings)
- `admins`: `id`, `username`, `password_hash`, `salt`, `role`, `last_login`
- `sessions`: `token`, `user_id`, `created_at`, `expires_at`
- `custom_sections`: `id`, `title`, `subtitle`, `content`, `icon`, `is_active`, `display_order`
- `announcements`: `id`, `title`, `message`, `priority`, `date`
- `activity_logs`: `id`, `action`, `details`, `created_at`
