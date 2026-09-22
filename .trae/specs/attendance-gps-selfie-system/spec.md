# SMDL College - Student Attendance (GPS + Selfie) & Teacher Review System

## Overview
- **Summary**: Build the complete end-to-end attendance pipeline for SMDL College Smart Attendance System, covering Academic Structure (Courses/Divisions/Subjects/Lectures), Student Attendance Marking (GPS Geolocation Verification + Live Webcam/Mobile Selfie Capture), Teacher Live Review Dashboard (Roster with Selfie Thumbnails, Photo Verification, Manual Override for phone-less students), and comprehensive Audit Logs for all teacher modifications.
- **Purpose**: Replace manual paper attendance with a modern, verifiable digital system using GPS geofencing and live selfie capture to ensure student physical presence, with teacher review capability and full auditability.
- **Target Users**: SMDL College Students (self-marking via mobile/desktop webcam), SMDL Approved Teachers (lecture start + attendance review + manual override), College Administrators (system oversight).

## Goals
1. Students can mark their attendance using GPS location + live selfie within the college geofence (SMDL Kalamboli: 19.0287° N, 73.1044° E, 300m radius).
2. Include a "Testing Mode / Geofence Bypass" toggle for development so attendance can be tested from anywhere.
3. Teachers can start lectures, view live attendance roster with student selfies + GPS distance, and manually override attendance for students without phones.
4. Every teacher modification creates an audit log entry with old status, new status, teacher ID, timestamp, and reason.
5. Students see real attendance statistics: overall percentage, subject-wise breakdown, and attendance history.
6. Academic structure is seeded with default SMDL courses (BSC-IT, BSC-CS, BCOM), divisions (FY-A, SY-A, TY-A), and subjects with teacher assignments.

## Non-Goals
- Face recognition / face matching (selfie capture only, no AI verification beyond manual teacher review).
- Mobile native app build (responsive web app only via browser on mobile).
- SMS/WhatsApp notifications for attendance (only in-app notifications placeholder).
- Supabase Storage upload integration (selfie stored as base64 data URL in `selfie_url` field for MVP).
- Multi-college / multi-institution support (single SMDL College instance only).

## Background & Context
- SMDL College is located in Kalamboli, Navi Mumbai at coordinates 19.0287° N, 73.1044° E.
- Existing codebase already has Express backend with Supabase PostgreSQL, JWT auth middleware, role-based access (student/teacher/admin), and React + Vite + Tailwind frontend with DashboardLayout.
- Database schema already defines: users, students, teachers, courses, divisions, subjects, teacher_subjects, lectures, attendance, attendance_audit_logs, announcements, notifications, system_config tables.
- Backend controllers/routes for academic, lectures, and attendance exist but frontend UI pages for student mark-attendance and teacher lecture-review are placeholder stubs marked "🚧 coming in Step 10/11".
- Haversine formula, geofence constants, and demo bypass flag already implemented in attendanceController.js; audit log insert already implemented in overrideAttendance.

## Functional Requirements

### Academic & Seeding (Milestone 1)
- **FR-1**: Seed script populates 3 courses: B.Sc. Information Technology (BSC-IT), B.Sc. Computer Science (BSC-CS), Bachelor of Commerce (BCOM), each with 3 divisions (FY-A, SY-A, TY-A), with subjects per division and teacher assignments.
- **FR-2**: `GET /api/academic/courses` returns all courses with nested divisions.
- **FR-3**: `GET /api/academic/subjects` returns subjects filterable by division_id.
- **FR-4**: `POST /api/lectures` allows teacher to create a lecture session with subject_id, division_id, topic, start_time, end_time; auto-sets lecture_date to today.
- **FR-5**: `GET /api/lectures/active` returns today's lectures filtered by student's division (student role) or teacher's assigned subjects (teacher role).

### Student Attendance Marking (Milestone 2)
- **FR-6**: `POST /api/attendance/mark` validates lecture_id, prevents duplicates for same (lecture_id, student_id), calculates Haversine distance from SMDL coordinates, rejects if outside 300m radius UNLESS `is_demo_bypass=true` is set.
- **FR-7**: Attendance requires non-empty selfie (base64 data URL). Stores latitude, longitude, selfie_url, marks `location_verified=true`, status=PRESENT, source=AUTO_VERIFIED.
- **FR-8**: Frontend Student "Mark Present" page requests browser geolocation (navigator.geolocation.getCurrentPosition), displays distance badge (X meters from SMDL College), and includes a "Testing Mode: Bypass Geofence" toggle in development.
- **FR-9**: Frontend Student page uses HTML5 getUserMedia to stream live camera, with Capture button to take snapshot, preview thumbnail, and Retake option.
- **FR-10**: `GET /api/attendance/my-stats` returns student_info (roll, course, division), stats (total_lectures, attended, percentage, is_safe >=75%), and history array per lecture.
- **FR-11**: Student Dashboard has tabbed navigation: Overview (welcome + stat cards), Mark Present (FR-8/FR-9 UI), History (attendance history table), Announcements.

### Teacher Review & Audit Logs (Milestone 3)
- **FR-12**: `GET /api/attendance/lecture/:lectureId` returns complete class roster: all students in division with attendance status, marked_at time, GPS distance from college, selfie_url, teacher_override flag. Includes summary: total/present/absent counts.
- **FR-13**: `POST /api/attendance/override` accepts (lecture_id, student_pk, status, reason). If no attendance record exists, creates one (for manual mark of phone-less students). Updates existing record if present. Sets teacher_override=true, override_reason=reason.
- **FR-14**: Every override inserts into `attendance_audit_logs`: attendance_id FK, changed_by (user UUID), old_status, new_status, reason, changed_at timestamp.
- **FR-15**: Teacher Dashboard Attendance Review page has:
  - Lecture selector dropdown + "Start New Lecture" modal (form with subject, division, topic).
  - Live roster table columns: Student Name, Roll No, Status Badge, Marked Time, GPS Distance, Selfie thumbnail (modal on click), Actions (Override button).
  - Override dialog: present/absent radio + reason textarea required + submit.
  - Summary card showing total / present / absent / percentage.
- **FR-16**: Override for a student with no existing attendance record uses source=TEACHER_OVERRIDE and status based on teacher choice; this supports students without smartphones.

## Non-Functional Requirements
- **NFR-1 (Responsive)**: Student Mark Attendance page must be mobile-responsive (minimum 375px width viewport) since students will use phones.
- **NFR-2 (Permissions UX)**: Geolocation and camera permission denied states must show clear, actionable error messages with instructions.
- **NFR-3 (Selfie Size)**: Selfie snapshots are compressed via canvas toDataURL('image/jpeg', 0.7) to keep payload < 20MB (server body limit).
- **NFR-4 (Performance)**: API responses < 2s for all endpoints; roster table loads within 3s for 60-student class.
- **NFR-5 (Security)**: Attendance endpoints require JWT protect middleware; mark-attendance restricted to student role; override restricted to teacher/admin.
- **NFR-6 (Data Integrity)**: Unique constraint on attendance(lecture_id, student_id) enforced via DB and backend duplicate-check.

## Constraints
- **Technical**: Backend stack fixed: Express.js 5 + @supabase/supabase-js service-role client; Frontend stack fixed: React 18 + Vite 8 + Tailwind 3 + lucide-react + react-hot-toast + axios; No new dependencies beyond what's in package.json unless explicitly needed (e.g., no new npm install unless camera/GPS lib is required — but getUserMedia/navigator.geolocation are native web APIs so no deps needed).
- **Business**: SMDL College coordinates and 300m radius are hardcoded constants (with system_config table reserved for future admin UI editing).
- **Dependencies**: Backend requires Supabase PostgreSQL tables matching 02-database-schema.md; .env requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET.

## Assumptions
1. All student/teacher users are registered, students are linked to a division via the students table, and teachers are assigned subjects via teacher_subjects (seeded by seed_academic.js).
2. Browser supports navigator.geolocation and navigator.mediaDevices.getUserMedia (HTTPS required for geolocation/camera in production; localhost works in dev).
3. Selfie stored as base64 JPEG data URL directly in attendance.selfie_url column (MVP scope; Supabase Storage bucket upgrade is future work).
4. Testing Mode toggle is shown unconditionally in NODE_ENV=development and hidden in production.
5. `marked_by` column stores the UUID of the marker user (for student self-mark = student's user UUID; for teacher override = teacher's user UUID); currently code stores 'student'/'teacher' strings which need to be fixed to UUID references.
6. attendance_audit_logs.old_status column name matches schema (code currently uses `previous_status` which needs alignment).

## Acceptance Criteria

### AC-1: Academic Data Seeding Populates Default SMDL Structure
- **Type**: `rule`
- **Given**: Supabase tables exist per schema
- **When**: `node src/scripts/seed_academic.js` runs
- **Then**: DB contains 3 courses (BSC-IT, BSC-CS, BCOM), 9 divisions (FY/SY/TY × A each for BSC-IT at minimum, plus subjects for FYBSc IT with teacher assignments, and students linked to FYBSc IT division). Today's lecture exists if not already present.
- **Pass Condition**: Running seed script exits with success logs; `supabaseAdmin.from('courses').select('count')` returns >= 3 and `supabaseAdmin.from('divisions').select('count')` returns >= 3.
- **Evidence**: Terminal output of seed script + Supabase query counts logged.

### AC-2: Student GPS Geofence Validation
- **Type**: `rule`
- **Given**: Student JWT authenticated, lecture_id is valid, student belongs to lecture division
- **When**: POST /api/attendance/mark with latitude/longitude 500m from SMDL and `is_demo_bypass=false`
- **Then**: Server returns 400 error with message including distance and "Location verification failed"
- **Pass Condition**: HTTP 400 status + error body mentions distance meters
- **Evidence**: curl / axios test call response

### AC-3: Student Geofence Bypass in Testing Mode
- **Type**: `rule`
- **Given**: Same as AC-2 but coordinates are remote (e.g., Mumbai Gateway of India)
- **When**: POST /api/attendance/mark with `is_demo_bypass=true` and valid non-empty selfie
- **Then**: Server returns 201 with attendance record marked PRESENT, location_verified=true, verification.selfie_verified=true.
- **Pass Condition**: HTTP 201 + attendance record inserted, status PRESENT
- **Evidence**: API response JSON + attendance row in DB

### AC-4: Duplicate Attendance Prevention
- **Type**: `rule`
- **Given**: Student has already marked attendance for a specific lecture_id successfully
- **When**: Same student calls POST /api/attendance/mark again for the same lecture_id
- **Then**: Server returns 400 with "Attendance already marked for this lecture" message including marked_at time
- **Pass Condition**: HTTP 400 status + no duplicate row in attendance table
- **Evidence**: Second API call error response + DB query showing only 1 row per (lecture_id, student_id)

### AC-5: Student Mark Attendance Page (GPS + Selfie UI)
- **Type**: `rubric`
- **Dimension**: Completeness and UX quality of the Student Mark Present page
- **Scale**: 1-5
- **Anchors**: 1 = blank/placeholder page still showing "🚧 coming"; 3 = functional but missing preview/retake or distance badge; 5 = Complete page with: live camera stream, capture button, snapshot preview, retake button, geolocation permission request, distance badge (color-coded: green if < 300m, red if > 300m), Testing Mode toggle, active lecture dropdown selector, submit button with loading state, success/error toasts.
- **Pass Threshold**: >= 4
- **Evidence**: Browser screenshot + DOM inspection of key elements (video, canvas, toggle, dropdown, submit button)

### AC-6: Student My-Stats API Returns Correct Metrics
- **Type**: `rule`
- **Given**: Student's division has N total lectures; student has attended P lectures with status=PRESENT
- **When**: GET /api/attendance/my-stats as that student
- **Then**: Response contains stats.total_lectures=N, stats.attended=P, stats.percentage=round(P/N*100), is_safe boolean (percentage >= 75). History array length = N, each entry has date, subject, status.
- **Pass Condition**: All computed numbers match manual count from DB.
- **Evidence**: API response JSON compared against manual SQL COUNT queries.

### AC-7: Student Dashboard Tab Navigation
- **Type**: `rule`
- **Given**: Logged in as student, on /student route
- **When**: Nav links clicked: Dashboard, My Attendance, Mark Present, Reports, Announcements
- **Then**: Router renders correct sub-route component for each nav item (no 404s). Mark Present route shows AC-5 UI, My Attendance shows stats table.
- **Pass Condition**: All 5 student nav links render non-placeholder content.
- **Evidence**: Browser navigation session screenshots or DOM snapshot per route.

### AC-8: Teacher Lecture Roster API
- **Type**: `rule`
- **Given**: Lecture exists, division has S students, A attendance rows marked PRESENT
- **When**: Teacher calls GET /api/attendance/lecture/:lectureId
- **Then**: Response returns roster array of length S (every student in division), each with status (PRESENT/ABSENT), distance_meters computed (if present row has lat/lon), selfie_url (if present). summary.total=S, summary.present=A, summary.absent=S-A.
- **Pass Condition**: Roster length = student count in division; summary counts correct.
- **Evidence**: API JSON + manual DB count of students in division vs attendance PRESENT rows.

### AC-9: Teacher Manual Override Creates Attendance Row + Audit Log
- **Type**: `rule`
- **Given**: Lecture exists, student X in division, NO existing attendance row for (lecture_id, student_id=X)
- **When**: Teacher calls POST /api/attendance/override with (lecture_id, student_pk=X.id, status=PRESENT, reason="No smartphone - present physically")
- **Then**: 1) New attendance row inserted with status=PRESENT, teacher_override=true, override_reason stored, source=TEACHER_OVERRIDE or notes contain reason. 2) New attendance_audit_logs row inserted with changed_by=teacher UUID, old_status=ABSENT/null, new_status=PRESENT, reason text.
- **Pass Condition**: COUNT(*) from attendance where lecture_id+student_id matches = 1; COUNT(*) from attendance_audit_logs where attendance_id = new row id = 1 with correct columns.
- **Evidence**: DB SELECT queries after override call + API response.

### AC-10: Teacher Override Updates Existing Row + Audit Log
- **Type**: `rule`
- **Given**: Lecture has existing PRESENT attendance for student Y marked by student
- **When**: Teacher calls POST /api/attendance/override with status=ABSENT, reason="Suspected proxy - selfie doesn't match"
- **Then**: Existing attendance row status changes to ABSENT, teacher_override=true, override_reason stored. Audit log row created with old_status=PRESENT, new_status=ABSENT, reason set.
- **Pass Condition**: attendance row status=ABSENT post-call; 1 audit log row with matching old/new statuses.
- **Evidence**: Before/after DB row snapshots + audit log row.

### AC-11: Teacher Lecture Review Dashboard Page
- **Type**: `rubric`
- **Dimension**: Completeness and UX quality of Teacher Attendance Review page
- **Scale**: 1-5
- **Anchors**: 1 = Placeholder "🚧 coming in Step 11" still present; 3 = Roster table loads but missing selfie modal or override reason dialog; 5 = Complete page with: Lecture selector (list of today's active lectures), "Start New Lecture" button → modal (subject/division/topic form), summary cards (total/present/absent/%), roster table columns (Name, Roll, Status badge, Time, Distance, Selfie thumb + click-to-modal, Actions), Override button → dialog (Present/Absent radio, required Reason textarea, Confirm/Cancel), empty state for no active lecture, auto-refresh or Refresh button.
- **Pass Threshold**: >= 4
- **Evidence**: Browser screenshots of full page + modal dialogs opened.

### AC-12: Backend marked_by and Audit Log Column Alignment
- **Type**: `rule`
- **Given**: Code inspection of attendanceController.js markAttendance and overrideAttendance functions
- **When**: Reviewing insert statements
- **Then**: `marked_by` column stores UUID of the user (student self = req.user.id; teacher override = req.user.id) NOT string 'student'/'teacher'. attendance_audit_logs insert uses column name `old_status` per schema (not `previous_status`), or schema ALTERed if column differs — but INSERT column names must match actual table columns to avoid Postgres errors.
- **Pass Condition**: Insert query fields match 02-database-schema.md attendance table columns and run without Postgres column-not-found errors.
- **Evidence**: Code diff of corrected insert queries + successful API test run (no 500 errors with DB column error messages).

## Open Questions
- [ ] Should the `source` column be used with values `'AUTO_VERIFIED'` and `'TEACHER_OVERRIDE'` per schema, or `teacher_override` boolean column? Code currently uses both patterns inconsistently. Decision in implementation: align with schema `source` VARCHAR and drop non-existent `teacher_override`/`override_reason` columns, use `notes` TEXT + `source` VARCHAR instead, OR add `teacher_override` boolean and `override_reason` text columns to schema if table permits. (Implementation will detect actual columns and use what exists; fallback to `notes` for unknown storage.)
- [ ] Are camera and location permission granted in browser? Assumed yes for manual verification; denied state handled per NFR-2.
