# ANALISA DEPLOYMENT READINESS - BRANCH DEV
**Tanggal:** 2026-09-30
**Branch:** origin/dev (commit b7b4c88)
**Target:** Server aaPanel

---

## ❌ STATUS: BELUM READY DEPLOY

### 🔴 BLOCKER KRITIS

#### 1. MISSING DATABASE MIGRATION
**Severity:** CRITICAL - Deploy akan crash backend

**Problem:**
Branch dev menambahkan 3 kolom baru di model `User`:
- `custom_status_message` (String 255)
- `custom_status_expires_at` (DateTime)
- `custom_status_pre_status` (String 20)

**Evidence:**
```python
# backend/app/models/user.py (line 35-37)
custom_status_message = db.Column(db.String(255), nullable=True, default=None)
custom_status_expires_at = db.Column(db.DateTime(timezone=True), nullable=True, default=None)
custom_status_pre_status = db.Column(db.String(20), nullable=True, default=None)
```

**Impact:**
- Backend akan crash saat akses `User.to_dict()` atau `/api/users/presence`
- Error: `OperationalError: column users.custom_status_message does not exist`

**Solution Required:**
Buat migration file sebelum deploy:
```bash
cd backend
source venv/bin/activate
flask db migrate -m "add custom status fields to users"
flask db upgrade  # test di local
```

---

#### 2. DEPLOYMENT WORKFLOW TIDAK SINKRON
**Severity:** HIGH - Deployment automation rusak

**Problem:**
File `.github/workflows/deploy.yml` di branch dev masih versi LAMA, tidak include perbaikan yang dijelaskan di `DEPLOYMENT_FIX.md` dan `NEXT_STEPS.md`.

**Evidence:**
- Line 45: Masih copy `frontend/pnpm-lock.yaml` saja
- Line 62: Masih `pnpm install --prod --frozen-lockfile` 
- Tidak ada copy `frontend/public/` 
- Tidak ada copy `frontend/package-lock.json`

**Fix yang belum diapply dari docs:**
- Copy `frontend/public/` (untuk static assets)
- Copy `frontend/package-lock.json` (untuk npm fallback)
- Update restart command sesuai nama PM2 di server
- Update backend restart logic

---

### ⚠️ WARNINGS (Tidak blocking, tapi perlu diperhatikan)

#### 3. SECURITY VULNERABILITIES
**Severity:** MEDIUM

20 npm vulnerabilities terdeteksi:
- 13 HIGH severity (react-router XSS/RCE, vite path traversal, rollup file write)
- 6 MODERATE severity
- 1 LOW severity

**Recommendation:**
```bash
cd frontend
npm audit fix
npm audit  # verify
```

#### 4. RECHARTS CIRCULAR DEPENDENCY WARNING
**Severity:** LOW

Build warning di `staff-performance/route.tsx` dan `analytics/route.tsx`:
```
Export "Bar" will end up in different chunks and produce circular dependency
```

**Impact:** Potential runtime execution order issues
**Fix:** Import langsung dari `recharts/es6/cartesian/Bar` atau configure `output.manualChunks`

---

## ✅ YANG SUDAH OKE

1. **Frontend Build:** Berhasil tanpa error
2. **Dependencies:** Radix UI sudah complete di commit terbaru
3. **Code Quality:** No TypeScript errors, build artifacts generated
4. **Backend Requirements:** File `requirements.txt` lengkap
5. **Migration Infrastructure:** Alembic setup sudah ada

---

## 📋 CHECKLIST SEBELUM DEPLOY

### Must-Do (Blocker):
- [ ] Buat dan test migration untuk `custom_status_*` fields
- [ ] Update `.github/workflows/deploy.yml` sesuai DEPLOYMENT_FIX.md
- [ ] Test migration di local database dulu

### Should-Do (Strong recommendation):
- [ ] Run `npm audit fix` untuk security patches
- [ ] Test full flow di local: login → set custom status → logout
- [ ] Verify PM2 process name di server (apakah benar `it_ticket_frontend`?)
- [ ] Verify backend service name di server (supervisor/systemctl)

### Nice-to-Have:
- [ ] Fix recharts import warning
- [ ] Setup GitHub Actions secrets (jika belum):
  - SERVER_IP
  - SERVER_USERNAME  
  - SERVER_SSH_KEY
  - SERVER_PORT

---

## 🚀 DEPLOYMENT STEPS (Setelah semua blocker resolved)

1. **Create & Test Migration**
   ```bash
   cd backend
   source venv/bin/activate
   flask db migrate -m "add custom status fields to users"
   flask db upgrade
   # Test: pastikan tidak ada error
   ```

2. **Commit Migration**
   ```bash
   git add backend/migrations/versions/*.py
   git commit -m "migration: add custom status fields to users table"
   git push origin dev
   ```

3. **Update Deployment Workflow**
   ```bash
   # Apply fixes dari DEPLOYMENT_FIX.md ke .github/workflows/deploy.yml
   git add .github/workflows/deploy.yml
   git commit -m "fix: update deployment workflow for aaPanel"
   git push origin dev
   ```

4. **Merge to Main & Deploy**
   ```bash
   git checkout main
   git merge dev
   git push origin main
   # GitHub Actions akan auto-deploy
   ```

5. **Post-Deploy Verification**
   - SSH ke server
   - Check migration applied: `cd backend && flask db current`
   - Check frontend: `pm2 list`
   - Check backend: `supervisorctl status` atau `systemctl status backend`
   - Test presence status feature di browser

---

## 💡 NOTES

- Commit terakhir: `b7b4c88` - "feat: add user authentication, staff status tracking, and performance monitoring features"
- Total changes: +1037 lines, -64 lines across 19 files
- New feature: Discord-style custom status dengan auto-expire
- Backend endpoint baru: `POST /api/users/<id>/presence` dengan `message` dan `clearAfterMinutes`
