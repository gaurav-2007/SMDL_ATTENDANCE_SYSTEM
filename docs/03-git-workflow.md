# =============================================
# SMDL Attendance System - Git Workflow Guide
# =============================================

## Step-by-Step: First Git Setup (For Beginners)

### Part 1: Install Git & First Commit
### ========================

1. Install Git from https://git-scm.com/download/win
2. Open "Git Bash" or PowerShell as administrator

```
# Test Git installed
git --version

# Configure your identity (do this ONCE per computer)
git config --global user.name "Your Full Name"
git config --global user.email "your.email@example.com"

# Navigate to your project folder
cd "d:\project by trae smdl\Attendence system"

# Initialize Git repository (creates hidden .git folder
git init

# Check status
git status

# Stage ALL files for commit (. = all files)
git add .

# Create your FIRST commit (snapshot of code at this point
git commit -m "Initial commit: Project structure, README, architecture docs, DB schema, .gitignore, requirements doc"

# Check log of commits
git log --oneline
```

---

### Part 2: Create GitHub Repository & Push Code
### ==========================================

1. Go to https://github.com and login/signup
2. Click: "New Repository" (+ sign top-right
3. Repository name: `smdl-attendance-system`
4. Keep it **Public** or **Private** (your choice)
5. **DO NOT** check "Add a README file", ".gitignore", or "License" boxes (we already have these)
6. Click "Create Repository"
7. Copy the URL you see on screen: looks like:
   `https://github.com/your-username/smdl-attendance-system.git`

Back in terminal:

```
# Link your local repo to GitHub
git remote add origin https://github.com/YOUR-USERNAME/smdl-attendance-system.git

# Verify the link
git remote -v

# Rename branch to 'main' (modern standard)
git branch -M main

# PUSH code to GitHub
git push -u origin main
```

Refresh GitHub page — you should see all your files! 🎉

---

### Part 3: Daily Development Workflow (Git Commands You'll Use Every Day)
### =================================================================

Every time you write new code and want to save/push:

```
# 1. See what files you changed
git status

# 2. See the actual changes (optional but good habit)
git diff

# 3. Add specific files to staging area
git add .                 # Add ALL changed files
# OR
git add server/src/index.js  # Add only one specific file

# 4. Commit with a GOOD descriptive message
git commit -m "Add login API endpoint with JWT token"

# 5. Push to GitHub (after committing locally
git push
```

Good commit messages:
✅ `Add user registration endpoint for students
✅ Implement JWT auth middleware
✅ Fix bug: attendance duplicate check
❌ `stuff`
❌ `changes`

---

### Part 4: Useful Git Commands Reference
### ===================================

```bash
# See history
git log --oneline -5            # last 5 commits
git log --oneline --graph         # pretty graph
git show <commit-hash>           # see what changed in specific commit

# Undo things (careful!)
git diff                         # see unstaged changes
git restore <filename>            # discard changes in file
git reset HEAD <file>     # unstage a file
git checkout .           # undo all uncommitted changes

# Branches (for bigger features later)
git branch                   # list branches
git checkout -b feature/login-page   # create + switch to new branch
git checkout main             # switch back to main
git merge feature/login-page    # merge branch into main

# Pull changes from GitHub (if working from multiple computers)
git pull origin main
```

---

### Part 5: Typical Development Flow for This Project

```
Phase 1: Setup done → push to GitHub ✓
Phase 2: Install dependencies, test server runs → commit: "Setup Express server with test route"
Phase 3: Login/Register backend → commit: "Add auth endpoints"
Phase 4: Frontend Login page → commit: "React Login page UI"
Phase 5: ...etc
```

Before each Phase — save progress by committing! Never lose code! 🛡️
---

### After Installing Node.js

After installing Node.js, run:

```bash
cd server
npm install express cors dotenv jsonwebtoken bcryptjs @supabase/supabase-js multer zod
npm install --save-dev nodemon
```
