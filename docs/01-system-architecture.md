# =============================================
# SMDL Attendance System - System Architecture
# =============================================

## Overview
Monorepo with separate Frontend + Backend + Supabase (PostgreSQL)

## Architecture Diagram

                        ┌─────────────────────────┐
                        │     User Browser      │
                        │  (Student/Teacher/  │
                        │       Admin)        │
                        └───────────┬─────────────┘
                                │ HTTPS
                                ▼
                    ┌─────────────────────────────┐
                    │   React Frontend        │
                    │  (Tailwind CSS UI)   │
                    └───────────┬─────────────┘
                                │ REST API (JSON)
                                ▼
                ┌───────────────────────────────────┐
                │   Node.js + Express Backend       │
                │  - Auth Middleware              │
                │  - Role-Based Access           │
                │  - JWT Verification          │
                └──────┬──────────────┬───────┘
                       │              │
                       ▼              ▼
              ┌──────────────┐   ┌───────────────┐
              │  Supabase  │   │  Supabase     │
              │ PostgreSQL │   │  Storage      │
              │  (Data)    │   │ (PDF/Images) │
              └──────────────┘   └───────────────┘

## Data Flow

1. User logs in → React sends credentials to Backend
2. Backend verifies via Supabase Auth → returns JWT token
3. Every subsequent requests include JWT in Authorization header
4. Middleware validates JWT + checks role permissions
5. Backend queries PostgreSQL for data operations

## API Endpoint Structure

/api/auth
  POST /register/student        - Student registration
  POST /register/teacher        - Teacher registration (status: PENDING)
  POST /login                  - Login for all roles
  GET  /me                     - Get current user info

/api/admin
  GET    /teachers/pending           - List pending teacher (admin)
  POST   /teachers/:id/approve  - Approve teacher (admin)
  POST   /teachers/:id/reject   - Reject teacher (admin)
  POST   /teachers/:id/suspend  - Suspend teacher (admin)
  GET    /students             - Manage students (admin)
  GET    /courses            - CRUD courses/classes/subjects

/api/student
  GET    /attendance           - Get own attendance
  POST   /attendance/mark      - Mark attendance
  GET    /announcements        - View announcements

/api/teacher
  GET    /classes                 - Get assigned classes/subjects
  GET    /attendance/:lectureId - Get attendance for lecture
  POST   /attendance/manual    - Manually mark attendance
  POST   /attendance/:id/update   - Correct attendance
  GET    /attendance/:id/audit  - Get audit log
  POST   /announcements        - Send announcement
  POST   /announcements/upload  - Upload PDF/Image attachment

## Role Permissions Matrix:

| Action                    | Student | Teacher(Pending) | Teacher(Active) | Admin |
|-------------------------|---------|-------------------|----------------|-------|
| Register                | Yes      | Yes               | -              | -     |
| Login                 | Yes     | Status Msg          | Yes            | Yes   |
| Mark Attendance      | Yes     | No                | No             | No    |
| View Own Attendance  | Yes     | No                | Yes(own)       | Yes   |
| View Class Attendance  | No    | No                | Yes(assigned)  | Yes   |
| Approve Teachers         | No      | No                | No             | Yes   |
| Send Announcements   | No      | No                | Yes(assigned)  | Yes   |
| Correct Attendance  | No      | No                | Yes(assigned)  | Yes   |
| Manage Courses/Classes | No      | No                | No             | Yes   |

## CQRS-ish Approach

Write operations go through Express backend with authorization checks before touching the database directly through Supabase client with Row Level Security (RLS) policies enabled.
