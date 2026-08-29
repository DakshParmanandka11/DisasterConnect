import { useState } from "react";
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
import ModeratorApply from "./pages/ModeratorApply";
import ModeratorTraining from "./pages/ModeratorTraining";
import ModeratorWallet from "./pages/ModeratorWallet";
import AdminApplications from "./pages/AdminApplications";
import AdminModerators from "./pages/AdminModerators";
import OfflineBanner from "./components/OfflineBanner";
import PwaInstallBanner from "./components/PwaInstallBanner";

export default function App() {
  const [taskbarOpen, setTaskbarOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");
  const [activeStatus, setActiveStatus] = useState("");

  return (
    <AuthProvider>
      <BrowserRouter>
        <OfflineBanner />
        <Navbar onToggleTaskbar={() => setTaskbarOpen((prev) => !prev)} />
        <SideTaskbar
          isOpen={taskbarOpen}
          onClose={() => setTaskbarOpen(false)}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          activeStatus={activeStatus}
          onSelectStatus={setActiveStatus}
        />

        <main style={{ flex: 1 }}>
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
            <Route path="/moderator/apply" element={<ModeratorApply />} />
            <Route path="/moderator/training" element={<ModeratorTraining />} />
            <Route path="/moderator/wallet" element={<ModeratorWallet />} />
            <Route path="/admin/moderator-applications" element={<AdminApplications />} />
            <Route path="/admin/moderators" element={<AdminModerators />} />
          </Routes>
        </main>

        <MobileNav />
      </BrowserRouter>
      <PwaInstallBanner />
    </AuthProvider>
  );
}
