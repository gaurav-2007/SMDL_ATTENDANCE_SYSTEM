# SMDL Smart Attendance & Communication System Workflow {#smdl-system-workflow}

The **SMDL Smart Attendance System** automates college-wide attendance tracking through an integrated pipeline of automated timetable synchronization, campus geofencing, selfie verification, faculty review, and real-time push notifications.

- Automated daily timetable synchronization converts weekly academic schedules into active, trackable lecture slots in Indian Standard Time.
- Multi-factor attendance verification pairs browser HTML5 Geolocation within a 100-meter campus perimeter with live camera selfie capture.
- Faculty retain full control to initiate lectures, review student verification photos in real time, and execute audited attendance overrides.
- Multi-tier architecture powered by Express 5, Supabase PostgreSQL, Supabase Storage, and Firebase Cloud Messaging ensures secure, low-latency execution.

@answer scope="SMDL College · Web & Mobile PWA · Express 5 · Supabase"
@meta locale=en style=clean

## How does the end-to-end attendance process work? {#end-to-end-workflow}

The system coordinates three distinct phases across the college day: schedule preparation, student attendance submission, and faculty review.

@workflow id=attendance-workflow title="Complete System Attendance Workflow"
| lane prep | Academic Setup & Daily Sync |
| lane attend | Student Attendance Marking |
| lane verify | Faculty Review & Reporting |
| admin_setup | Admin Sets Timetable | backend | prep |
| cron_sync | Cron Generates Daily Slots | backend | prep |
| class_active | Lecture Marked ONGOING | backend | prep |
| geo_check | GPS Geofence Check | frontend | attend |
| selfie_capture | Live Selfie Capture | frontend | attend |
| server_verify | Server Validates & Stores | backend | attend |
| teacher_review | Teacher Reviews Submissions | backend | verify |
| auto_complete | Lecture Auto-Completed | backend | verify |
| report_gen | Defaulter & Audit Reports | database | verify |
| admin_setup > cron_sync | Weekly matrix |
| cron_sync > class_active | IST time match |
| class_active > geo_check | Window opens |
| geo_check > selfie_capture | Within 100m |
| selfie_capture > server_verify | PostgREST & S3 |
| server_verify > teacher_review | Live feed |
| teacher_review > auto_complete | End time + buffer |
| auto_complete > report_gen | Aggregate stats |

@steps id=workflow-steps
| step-sync | 1. Daily Schedule Sync | The scheduler converts the division's weekly timetable matrix into active date-specific lecture slots each morning in IST. | attendance-workflow | cron_sync |
| step-geo | 2. Campus Geofence Validation | When the lecture status is ONGOING, students within 100 meters of college coordinates can open the attendance screen. | attendance-workflow | geo_check |
| step-selfie | 3. Live Selfie Verification | The student captures an uncompressed camera photo; the backend validates JPEG magic bytes and persists it to Supabase Storage. | attendance-workflow | server_verify |
| step-review | 4. Faculty Monitoring & Override | Teachers inspect incoming attendance selfies in real time and can override individual student statuses with audit logging. | attendance-workflow | teacher_review |
| step-reports | 5. Lifecycle Closure & Reports | Ended lectures transition to COMPLETED; aggregate attendance percentages and defaulter alerts update automatically. | attendance-workflow | report_gen |

## How is a student's attendance verified? {#student-verification-lifecycle}

The attendance marking flow enforces time-window, geographic, enrollment, and image verification before recording a present mark.

@sequence id=attendance-marking-seq title="Attendance Verification Request Lifecycle"
| actor student | Student PWA | frontend |
| actor api | Express API Server | backend |
| actor db | Supabase DB & Storage | database |
| student | api | POST /api/attendance/mark (GPS + Selfie) | emphasis |
| api | db | SELECT lecture WHERE id = target_id |
| db | api | Lecture details (ONGOING, Division A) | return |
| api | db | Check Duplicate: eq(student_id, lecture_id) |
| db | api | No existing attendance record | return |
| api | db | Upload Selfie to attendance-selfies bucket |
| db | api | Public photo URL returned | return |
| api | db | INSERT attendance_records (PRESENT, selfie_url) | emphasis |
| db | api | Attendance record created | return |
| api | student | 201 Created (Attendance Verified) | return |

## Role-Based Capabilities & System Boundaries {#role-matrix}

Access control is strictly divided into three distinct roles governed by JWT tokens and route middleware.

| Operational Area | Student Role | Teacher Role | Administrator Role |
| --- | --- | --- | --- |
| Timetable & Schedule | View today's assigned classes | View division timetable & edit topics | Full CRUD on timetable matrix & slots {good:Full Control} |
| Lecture Status | Read-only status indicator | Toggle ONGOING, COMPLETED, CANCELLED | System-wide status oversight |
| Attendance Marking | Self-mark via GPS & Selfie {good:Biometric} | Manual override with audit logging | Full override & manual entry |
| Photo Verification | Upload live selfie | Inspect student selfies in real time | Audit storage usage & retention |
| Defaulter Analytics | Personal percentage tracking | Division-level attendance summaries | College-wide defaulters & CSV exports {good:Full Analytics} |
| User Management | Profile self-service | Subject & division mapping | Teacher approvals & bulk student imports |

## Core Verification & Protection Mechanisms {#security-controls}

Multiple defensive layers prevent proxy attendance, credential theft, and out-of-boundary access.

- **Campus Geofencing**: Haversine formula calculates distance from college coordinates; requests beyond 100 meters are rejected immediately.
- **Photo Liveness & Magic-Byte Validation**: Server inspects binary buffer magic bytes to ensure real image data before persisting to cloud object storage.
- **Strict Time-Window Clamping**: Attendance is accepted only while the lecture is ONGOING and between start time and end time plus 60 minutes.
- **Audit-Logged Manual Overrides**: Every faculty attendance override stores teacher ID, timestamp, and previous status in the audit log table.
- **JWT & Role-Based Middleware**: Every route verifies Bearer tokens and confirms active account status before dispatching requests.

## Production Deployment & Operational Verification {#deployment-checklist}

Key checks required to ensure operational stability on Render and Supabase.

- [ ] Confirm `NODE_ENV=production` is configured in the Render environment dashboard
- [ ] Set a strong, randomly generated `JWT_SECRET` in environment variables
- [ ] Verify Supabase database migrations `001` through `011` are executed on the live database
- [ ] Ensure the Supabase Storage bucket `attendance-selfies` exists with restricted read policies
- [ ] Configure Firebase Admin SDK service account credentials for FCM push notifications
- [ ] Set up SMTP credentials in environment variables for student and faculty registration OTPs
