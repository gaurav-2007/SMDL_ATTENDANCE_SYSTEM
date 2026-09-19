# SMDL College Smart Attendance & Communication System

A professional attendance and communication system for SMDL College, Kalamboli, Maharashtra.

## 🎯 Features

- **Student Module**: Attendance marking with location + selfie verification
- **Teacher Module**: Attendance management, announcements, file sharing
- **Admin Module**: Teacher approvals, academic management, reports
- **Role-Based Access**: Student / Teacher (PENDING/ACTIVE/REJECTED) / Admin
- **Audit Logs**: All attendance modifications tracked
- **Communication**: Announcements with PDF/Image attachments

## 🏗️ Project Structure

```
Attendence system/
├── smdl.txt                 # Complete requirements document
├── README.md                # This file
├── .gitignore               # Git ignore rules
├── server/                  # Backend - Node.js + Express
│   ├── package.json
│   ├── src/
│   │   ├── index.js         # Express server entry point
│   │   ├── config/          # Database, environment config
│   │   ├── middleware/      # Auth, role-check middleware
│   │   ├── routes/          # API route definitions
│   │   ├── controllers/     # Business logic
│   │   ├── models/          # Database models/queries
│   │   └── utils/           # Helper functions
│   └── supabase/
│       └── migrations/      # SQL migrations
├── client/                  # Frontend - React + Tailwind CSS
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── pages/           # Page components (Login, Dashboard, etc)
│       ├── components/      # Reusable UI components
│       ├── hooks/           # Custom React hooks
│       ├── context/         # Auth & Global state
│       ├── services/        # API calls
│       ├── utils/           # Helper functions
│       └── styles/          # CSS files
└── docs/                    # Architecture & design docs
```

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React.js + Tailwind CSS | Web UI for all 3 roles |
| Backend | Node.js + Express.js | REST API server |
| Database | Supabase (PostgreSQL) | Data storage |
| Auth | JWT + Supabase Auth | Secure authentication |
| File Storage | Supabase Storage | Selfies, PDFs, Images |
| Version Control | Git + GitHub | Code management |

## 🚀 Getting Started

### 1. Prerequisites

- Install **Git**: https://git-scm.com/download/win
- Install **Node.js (LTS)**: https://nodejs.org/en/download

### 2. Setup Git & Push to GitHub

```bash
# Initialize Git in project folder
git init

# Set your GitHub identity
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Stage all files
git add .

# First commit
git commit -m "Initial commit: Project structure and requirements"

# Link to GitHub Repository (Create empty repo on GitHub first)
git remote add origin https://github.com/your-username/smdl-attendance-system.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 3. Install Backend Dependencies

```bash
cd server
npm init -y
npm install express cors dotenv jsonwebtoken bcryptjs @supabase/supabase-js multer zod
npm install --save-dev nodemon
```

### 4. Install Frontend Dependencies

```bash
cd client
npx create-react-app .
npm install react-router-dom axios @supabase/supabase-js
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

## 📋 Development Phases (Step by Step)

| Phase | Module | Status |
|-------|--------|--------|
| 1 | Git Setup & Project Structure | ⏳ Pending |
| 2 | System Architecture & DB Design | ⏳ Pending |
| 3 | Backend Server Setup | ⏳ Pending |
| 4 | Authentication System | ⏳ Pending |
| 5 | Teacher Registration + Admin Approval | ⏳ Pending |
| 6 | Frontend Setup + Auth Pages | ⏳ Pending |
| 7 | Admin Dashboard | ⏳ Pending |
| 8 | Student Dashboard + Attendance UI | ⏳ Pending |
| 9 | Teacher Dashboard | ⏳ Pending |
| 10 | Attendance Backend (Location + Selfie) | ⏳ Pending |
| 11 | Teacher Review + Audit Logs | ⏳ Pending |
| 12 | Communication + File Upload | ⏳ Pending |
| 13 | Reports + Testing | ⏳ Pending |
| 14 | Deployment | ⏳ Pending |

## 📧 For more details

See complete requirements in `smdl.txt` file.
