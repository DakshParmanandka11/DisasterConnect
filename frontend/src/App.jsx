import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import MobileNav from "./components/MobileNav";
import SideTaskbar from "./components/SideTaskbar";
import Feed from "./pages/Feed";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NewReport from "./pages/NewReport";
import ReportDetail from "./pages/ReportDetail";
import NGODashboard from "./pages/NGODashboard";
import NGONetwork from "./pages/NGONetwork";
import CrisisMap from "./pages/CrisisMap";
import ModeratorDashboard from "./pages/ModeratorDashboard";

import OfflineBanner from "./components/OfflineBanner";
import PwaInstallBanner from "./components/PwaInstallBanner";
import SmsFallbackModal from "./components/SmsFallbackModal";

export default function App() {
  const [taskbarOpen, setTaskbarOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");
  const [activeStatus, setActiveStatus] = useState("");
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [userCoords, setUserCoords] = useState(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 3500 }
      );
    }
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <OfflineBanner />
        <Navbar
          onToggleTaskbar={() => setTaskbarOpen((prev) => !prev)}
          onOpenSms={() => setShowSmsModal(true)}
        />
        
        <SideTaskbar
          isOpen={taskbarOpen}
          onClose={() => setTaskbarOpen(false)}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          activeStatus={activeStatus}
          onSelectStatus={setActiveStatus}
        />

        <main style={{ flex: 1, paddingBottom: 60 }}>
          <Routes>
            <Route
              path="/"
              element={
                <Feed
                  activeCategory={activeCategory}
                  onSelectCategory={setActiveCategory}
                  activeStatus={activeStatus}
                  onSelectStatus={setActiveStatus}
                />
              }
            />
            <Route path="/map" element={<CrisisMap />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/report/new" element={<NewReport />} />
            <Route path="/report/:id" element={<ReportDetail />} />
            <Route path="/ngo" element={<NGODashboard />} />
            <Route path="/ngos" element={<NGONetwork />} />
            <Route path="/moderator" element={<ModeratorDashboard />} />
          </Routes>
        </main>

        <MobileNav onOpenSms={() => setShowSmsModal(true)} />

        {showSmsModal && (
          <SmsFallbackModal
            reportData={{
              category: "FLOOD",
              severity: "CRITICAL",
              title: "EMERGENCY RESCUE SOS",
              lat: userCoords?.lat || 28.6139,
              lng: userCoords?.lng || 77.2090,
            }}
            onClose={() => setShowSmsModal(false)}
          />
        )}
      </BrowserRouter>
      <PwaInstallBanner />
    </AuthProvider>
  );
}

