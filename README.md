# DisasterConnect

A web-based disaster reporting, calamity moderation, and community verification platform. Citizens report disaster incidents with photos/video; posts undergo automated relevance & gibberish scoring and student moderator review; users within a **10 km radius** cast ground-truth votes; reports that cross **>40% upvotes** (with a minimum quorum) are auto-flagged and nearby **NGOs are notified** automatically.

---

## 🛠️ Tech Stack

### **Backend**
- **Runtime & Server**: Node.js & Express.js (REST API backend)
- **Database**: Lightweight JSON File Store (`backend/db/data.json`) using Node's built-in `fs` module — zero C++ native compiler dependencies or SQL setup needed!
- **Authentication**: JWT (`jsonwebtoken`) & `bcryptjs` password hashing
- **File Uploads**: `multer` for disaster media attachments
- **Content Moderation & Relevance Engine**: Custom algorithmic disaster relevance & gibberish detector (`backend/util/relevance.js`)
- **SMS Gateway**: Simulated emergency SMS SOS parser and interactive SMS bot (`/api/sms`)

### **Frontend**
- **Framework & Build Tool**: React 19 + Vite
- **Routing**: `react-router-dom` (v7)
- **Interactive Crisis Mapping**: Leaflet & `react-leaflet` with free OpenStreetMap tiles
- **Styling**: Modern dark mode glassmorphism CSS, responsive layouts & micro-animations

---

## 🌟 Key Features

1. **Calamity Post Moderation & Student Micro-Earnings Portal (`/moderator`)**:
   - Registered student moderators review user-submitted disaster reports to filter out spam and gibberish.
   - Moderators earn a fixed stipend (e.g. ₹5 per post reviewed) credited to their Moderator Wallet with instant simulated UPI payouts.
   - Verified posts earn a **"🛡️ Verified Calamity Relevant"** badge in the public feed.
2. **Ground-Truth Geofenced Voting**:
   - Server-calculated 10 km voting eligibility using Haversine distance.
   - Prevents remote spam from diluting local ground-truth verification.
3. **Automated NGO Dispatch**:
   - Reports reaching quorum (>40% upvotes) auto-flag and dispatch notifications to registered relief NGOs in the incident radius.
4. **Live Crisis Map (`/map`)**:
   - Color-coded map markers showing real-time calamity status across the region.
5. **Offline SMS SOS Emergency System**:
   - Fallback SMS gateway endpoint allowing citizens without active internet connections to send SOS alerts.

---

## 📁 Project Structure

```
disasterconnect/
  backend/
    server.js             # Express REST server entry point
    db/
      index.js            # JSON file database helper
      data.json           # Human-readable JSON database store
    routes/
      auth.js             # Register (Citizen, NGO, Student Mod) / Login / Me
      reports.js          # Create / List / Vote / Status — ground-truth verification
      moderator.js        # Moderation queue, verdict reviews, student wallet & payouts
      ngo.js              # NGO notifications & public relief directory
      sms.js              # Emergency SMS SOS fallback & webhook bot
    util/
      relevance.js        # Heuristic disaster relevance & gibberish analyzer
      geo.js              # Haversine distance formula
      auth.js             # JWT authentication middleware
    uploads/              # Uploaded media files
  frontend/
    src/
      pages/              # Feed, CrisisMap, ModeratorDashboard, NGODashboard, NewReport, etc.
      components/         # Navbar, ReportRow, SignalMeter, SideTaskbar, MobileNav
      context/            # AuthContext
      hooks/              # useGeolocation
```

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

Open `http://localhost:5173`. No external API keys or database servers required — OpenStreetMap tiles and JSON database work out of the box!
