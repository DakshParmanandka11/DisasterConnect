# DisasterConnect — AI-Assisted Student Disaster Verification Workforce System

A civic-tech web platform for real-time disaster reporting, AI-assisted student moderation, community ground-truth verification, crisis mapping, and emergency NGO dispatch focused on disaster management in India.

> **Core Philosophy**: DisasterConnect does not rely solely on AI or immediate unverified posts to decide whether a disaster report is real. Instead, it operates a multi-tiered pipeline: **Citizen Submits → AI Screens → Student Workforce Moderates & Verifies → Public Feed Publication → Local Citizens Validate → NGOs Respond.**

---

## 🔑 Quick Demo Logins

Anyone evaluating or testing the demo can click the **Quick Demo Login Credentials** card directly on the `/login` page to auto-fill these credentials:

| Role / Position | Email | Password | Primary Dashboard |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@disasterconnect.org` | `password` | `/admin/moderator-applications` & `/admin/moderators` |
| **Senior Moderator** | `senior.mod@disasterconnect.org` | `password` | `/moderator` (*Escalated* & *Queue* tabs) |
| **Student Moderator (Trusted)** | `student_mod@disasterconnect.org` | `password` | `/moderator` (*Queue*, *Analytics*, *History*) |
| **Student Moderator (Verified)** | `priya.mod@disasterconnect.org` | `password` | `/moderator` (*Queue*, *Analytics*, *History*) |
| **NGO / Relief Org** | `ndrc-relief@disasterconnect.org` | `password` | `/ngo` (NGO Operations) |
| **Citizen Reporter** | `rahul.citizen@example.com` | `password` | `/` (Public Feed & Incident Reporting) |

---

## 🏛️ System Architecture & Moderation Pipeline

```
Citizen Submits Disaster Report
             │
             ▼
   [ PENDING_MODERATOR ]  (Hidden from public feed, pending verification)
             │
             ├──► Auto-assigned to available Student Moderator (Round-Robin)
             │
   AI Moderation Assist Engine (Relevance, Spam, Gibberish, Duplicate & Flag Analysis)
             │
             ▼
    Human Student Moderator Review
   ┌─────────┼──────────┐
   ▼         ▼          ▼
[APPROVE] [REJECT]  [ESCALATE]
   │         │          │
   │         └► Removed │
   ▼                    ▼
[APPROVED_BY_MODERATOR]  Senior Moderator Review Queue
   │                    └► [APPROVED_BY_SENIOR] / [REJECTED]
   ▼
Published to Public Crisis Feed
   │
   ▼
Community Geofenced Voting (10 km radius)
   │
   ▼ (>40% upvotes + quorum)
[COMMUNITY_VERIFIED] ──► Auto NGO Dispatch Notification
```

---

## 🌟 Key Features

### 🇮🇳 1. Real Indian Disaster Incidents & Geotagged Media
- Seeded with authentic, location-accurate natural calamities across India:
  - **Kerala Monsoon Floods** (Alappuzha & Kuttanad, IAF helicopter operations)
  - **Uttarakhand Flash Floods** (Kedarnath valley, NH-58 washouts)
  - **Super Cyclone** (Puri & coastal Odisha)
  - **Mumbai Extreme Monsoon** (Kurla, Dharavi & train disruptions)
  - **Himachal Pradesh Landslide** (Rohtang Pass & NH-3 Koksar)
  - **Gujarat Earthquake** (Bhuj district, M5.8)
  - **Uttarakhand Forest Wildfires** (Nainital & Almora)
  - **Rajasthan Severe Dust Storm** (Jaisalmer desert andhi)
- High-resolution disaster photos, GPS coordinates, and EXIF authenticity verification badges for each report.

### 🎓 2. AI-Assisted Student Moderator Workforce
- **Application & Approval Flow (`/moderator/apply`)**: Interested students submit their college, student ID, course, year, and volunteer motivation for admin review.
- **Interactive Training Module (`/moderator/training`)**: Approved applicants undergo an 8-scenario interactive quiz (minimum passing score: 80%) covering genuine reports, gibberish detection, spam, image verification, and escalation rules.
- **Moderator Queue & AI Assist Panel (`/moderator`)**: Moderation workspace presenting AI-scored relevance (0–100%), gibberish, spam, duplicate probabilities, location confidence, and natural language flags. AI scores act as non-authoritative recommendations.
- **Decision Pipeline**: Moderators choose **Approve**, **Reject**, or **Escalate** with structured reasons and notes.
- **Trust & Progression System**: Moderators progress through levels (**Trainee** → **Verified** → **Trusted** → **Senior**) with daily task limits (10/15/25/50) and a dynamic Trust Score (0–100).
- **Anti-Abuse & Quality Controls**:
  - Rate limiting (max 5 decisions/minute)
  - Blocked self-moderation (cannot moderate own reports)
  - Round-robin task assignment
  - Senior audit sampling (10% sample rate) with accuracy calculation and trust score updates.

### 🛡️ 3. Pre-Publication Moderation Gatekeeper
- Any newly reported incident automatically enters the moderation queue in `PENDING_MODERATOR` status.
- Reports remain **hidden from the public feed** until approved by a student or senior moderator, preventing panic and misinformation.
- The submitter sees a clear **⏳ Under Moderator Review** status banner on the incident detail page while verification is underway.

### 🎖️ 4. Senior Moderator & Escalation System
- Senior moderators access the **Escalated Queue** to resolve complex, high-impact, or suspicious reports flagged by student moderators.
- Final binding authority: **Approve by Senior** or **Reject**.
- Conducts audit reviews on student decisions to maintain high verification quality.

### 👑 5. Admin Governance Dashboards
- **Applications Management (`/admin/moderator-applications`)**: View pending/approved/rejected applications with expandable student details. Approve, reject with custom reasons, or demand training.
- **Moderator Management (`/admin/moderators`)**: Table of all moderators showing level, trust score, accuracy percentage, total reviews, and last active timestamp. Promote levels, suspend with reasons, or reactivate.
- **System Analytics**: Real-time stats on total reports, status breakdowns, decision rates (approvals/rejections/escalations), and active workforce count.

### 📍 6. Ground-Truth Geofenced Voting & NGO Dispatch
- **10 km Voting Radius**: Server computes Haversine distance from voter coordinates to ensure only nearby citizens cast ground-truth votes.
- **Automated NGO Dispatch**: Reports exceeding **>40% upvotes** with quorum automatically transition to `COMMUNITY_VERIFIED` and trigger real-time dispatch alerts to NGOs within their service radius.

### 🗺️ 7. Live Crisis Map & Emergency SMS SOS
- **Interactive Crisis Map (`/map`)**: Real-time Leaflet map displaying active incident clusters, severity markers, and NGO operational zones.
- **Offline SMS SOS Gateway (`/api/sms`)**: Emergency endpoint parsing SMS SOS messages for citizens in low-connectivity areas.

---

## 🛠️ Tech Stack

### **Backend**
- **Runtime**: Node.js & Express.js
- **Database**: Lightweight JSON File Store (`backend/db/data.json`) via Node's `fs` module — zero SQL/MongoDB setup required!
- **Authentication**: JWT (`jsonwebtoken`) & `bcryptjs` password hashing
- **File Uploads**: `multer` for media attachments
- **Heuristic Engine**: Extended algorithmic disaster relevance, spam, gibberish & duplicate analyzer (`backend/util/relevance.js`)

### **Frontend**
- **Framework**: React 19 + Vite
- **Routing**: `react-router-dom` (v7)
- **Maps**: Leaflet & `react-leaflet` with OpenStreetMap
- **Styling**: Vanilla CSS with modern dark mode glassmorphism, responsive components & micro-animations

---

## 📁 Project Structure

```
disasterconnect/
├── backend/
│   ├── server.js                     # Express REST server entry point
│   ├── app.js                        # App setup & route mounting
│   ├── db/
│   │   ├── index.js                  # JSON database manager (readDb / writeDb / getConfig)
│   │   └── data.json                 # Human-readable JSON database store & seed data
│   ├── routes/
│   │   ├── auth.js                   # Register (Citizen, NGO) / Login / Me
│   │   ├── reports.js                # Create / List / Vote / Moderation pipeline status
│   │   ├── moderator.js              # Tasks, decisions, applications, training, senior escalation
│   │   ├── admin.js                  # Applications management, moderator management, audits, analytics
│   │   ├── ngo.js                    # NGO notifications & relief network directory
│   │   └── sms.js                    # Emergency SMS SOS fallback
│   ├── util/
│   │   ├── relevance.js              # Disaster keywords, spam, gibberish, duplicate & flag analyzer
│   │   ├── geo.js                    # Haversine distance formula
│   │   └── auth.js                   # JWT authentication middleware
│   └── uploads/                      # Uploaded incident media files
│
└── frontend/
    └── src/
        ├── App.jsx                   # Router setup with all citizen, moderator & admin routes
        ├── api/
        │   └── client.js             # API client methods for all backend endpoints
        ├── components/
        │   ├── Navbar.jsx            # Dynamic navigation (role-aware links & quick admin access)
        │   ├── MobileNav.jsx         # Mobile navigation bar
        │   ├── SideTaskbar.jsx       # Category & status filtering sidebar
        │   ├── ReportCard.jsx        # Feed report card component
        │   ├── OfflineBanner.jsx     # Network status banner
        │   └── PwaInstallBanner.jsx  # PWA installation banner
        ├── context/
        │   └── AuthContext.jsx       # User authentication state
        └── pages/
            ├── Feed.jsx              # Main public disaster feed
            ├── CrisisMap.jsx         # Leaflet crisis map
            ├── Login.jsx             # Login page with 1-click Quick Demo Credentials
            ├── Register.jsx          # Account registration (Citizen & NGO)
            ├── NewReport.jsx         # Disaster report submission form
            ├── ReportDetail.jsx      # Incident details & voting view
            ├── ModeratorDashboard.jsx # Student & Senior Moderator Workspace
            ├── ModeratorApply.jsx    # Student Moderator application form & status tracker
            ├── ModeratorTraining.jsx # Mandatory 8-question scenario training module
            ├── AdminApplications.jsx # Admin moderator application review panel
            ├── AdminModerators.jsx   # Admin moderator workforce management table
            ├── NGODashboard.jsx      # NGO dispatch alerts & action tracker
            └── NGONetwork.jsx        # Public NGO relief directory
```

---

## 📡 API Endpoints Overview

| Area | Method | Path | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/register` | Register new Citizen or NGO account |
| | `POST` | `/api/auth/login` | Authenticate user & issue JWT |
| | `GET` | `/api/auth/me` | Fetch authenticated user profile |
| **Reports** | `GET` | `/api/reports` | List approved public disaster reports |
| | `POST` | `/api/reports` | Submit new disaster report (enters `PENDING_MODERATOR`) |
| | `POST` | `/api/reports/:id/vote` | Cast geofenced ground-truth vote |
| **Student Mod**| `POST` | `/api/moderator/apply` | Submit student moderator application |
| | `GET` | `/api/moderator/application-status` | Check application status |
| | `GET` | `/api/moderator/training/status` | Get training scenarios & progress |
| | `POST` | `/api/moderator/training/submit` | Submit training quiz answers |
| | `GET` | `/api/moderator/tasks` | Fetch assigned moderation queue tasks |
| | `POST` | `/api/moderator/tasks/:id/approve` | Approve report for public feed |
| | `POST` | `/api/moderator/tasks/:id/reject` | Reject report |
| | `POST` | `/api/moderator/tasks/:id/escalate` | Escalate report to senior moderator |
| | `GET` | `/api/moderator/stats` | Moderator dashboard analytics |
| | `GET` | `/api/moderator/leaderboard` | Public moderator leaderboard |
| **Senior Mod** | `GET` | `/api/moderator/escalated` | Fetch escalated reports queue |
| | `POST` | `/api/moderator/escalated/:id/resolve` | Senior decision (Approve/Reject) |
| **Admin** | `GET` | `/api/admin/moderator-applications` | List moderator applications |
| | `POST` | `/api/admin/moderator-applications/:id/approve` | Approve application |
| | `POST` | `/api/admin/moderator-applications/:id/reject` | Reject application |
| | `GET` | `/api/admin/moderators` | List all moderators & stats |
| | `POST` | `/api/admin/moderators/:id/promote` | Promote level (trainee → senior) |
| | `POST` | `/api/admin/moderators/:id/suspend` | Suspend moderator |
| | `POST` | `/api/admin/moderators/:id/reactivate` | Reactivate moderator |
| | `POST` | `/api/admin/audits` | Submit audit decision & update accuracy |
| | `GET` | `/api/admin/analytics` | System-wide moderation analytics |

---

## 🚀 Running Locally

### **1. Backend (port 4000)**
```bash
cd backend
npm install
node server.js
```

### **2. Frontend (port 5173)**
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. All seed data and accounts are loaded automatically from `backend/db/data.json`.
