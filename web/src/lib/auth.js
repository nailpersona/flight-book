'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthCtx = createContext({ auth: null, setAuth: () => {}, logout: () => {} });

// SECURITY: Session reduced from 7 days to 8 hours
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours

export function AuthProvider({ children }) {
  const [auth, setAuthState] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Check session validity
  const isSessionValid = useCallback((session) => {
    if (!session || !session.expires) return false;
    return Date.now() < session.expires;
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('fly_auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (isSessionValid(parsed)) {
          setAuthState(parsed);
        } else {
          // Session expired - clean up
          localStorage.removeItem('fly_auth');
        }
      }
    } catch (_) {
      // Invalid data - clean up
      localStorage.removeItem('fly_auth');
    }
    setLoaded(true);
  }, [isSessionValid]);

  // Periodic session check (every 5 minutes)
  useEffect(() => {
    if (!auth) return;

    const interval = setInterval(() => {
      const stored = localStorage.getItem('fly_auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!isSessionValid(parsed)) {
          setAuthState(null);
          localStorage.removeItem('fly_auth');
        }
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [auth, isSessionValid]);

  const setAuth = (val) => {
    setAuthState(val);
    if (val) {
      // Ensure expires is set
      if (!val.expires) {
        val.expires = Date.now() + SESSION_DURATION;
      }
      localStorage.setItem('fly_auth', JSON.stringify(val));
    } else {
      localStorage.removeItem('fly_auth');
    }
  };

  const logout = useCallback(() => {
    setAuthState(null);
    localStorage.removeItem('fly_auth');
    // Redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, []);

  if (!loaded) return null;

  return (
    <AuthCtx.Provider value={{ auth, setAuth, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}

export { AuthCtx };
