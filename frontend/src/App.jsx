import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import SideTaskbar from "./components/SideTaskbar";
import Feed from "./pages/Feed";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NewReport from "./pages/NewReport";
import ReportDetail from "./pages/ReportDetail";
import NGODashboard from "./pages/NGODashboard";
import CrisisMap from "./pages/CrisisMap";

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
          </Routes>
        </main>
      </BrowserRouter>
      <PwaInstallBanner />
    </AuthProvider>
  );
}
