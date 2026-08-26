import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("dc_token");
    if (token) {
      api
        .me()
        .then((data) => setUser(data.user))
        .catch(() => {
          localStorage.removeItem("dc_token");
          autoRegisterGuest();
        })
        .finally(() => setLoading(false));
    } else {
      autoRegisterGuest();
    }

    function autoRegisterGuest() {
      const guestEmail = `citizen_${Math.random().toString(36).substring(2, 9)}@disasterconnect.local`;
      api
        .register({
          name: "Local Citizen",
          email: guestEmail,
          password: "guest_password_123",
          role: "citizen",
        })
        .then((data) => {
          if (data && data.token) {
            localStorage.setItem("dc_token", data.token);
            setUser(data.user);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, []);

  function login(token, user) {
    localStorage.setItem("dc_token", token);
    setUser(user);
  }

  function logout() {
    localStorage.removeItem("dc_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
