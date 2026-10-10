import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("dc_user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("dc_token");
    if (token) {
      api
        .me()
        .then((data) => {
          if (data && data.user) {
            setUser(data.user);
            localStorage.setItem("dc_user", JSON.stringify(data.user));
          }
        })
        .catch((err) => {
          // Expired/invalid token: drop the stale session. Otherwise (server
          // down / offline) keep the saved user from localStorage.
          if (err && err.status === 401) {
            localStorage.removeItem("dc_token");
            localStorage.removeItem("dc_user");
            setUser(null);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  function login(token, userObj) {
    localStorage.setItem("dc_token", token);
    localStorage.setItem("dc_user", JSON.stringify(userObj));
    setUser(userObj);
  }

  function logout() {
    localStorage.removeItem("dc_token");
    localStorage.removeItem("dc_user");
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
