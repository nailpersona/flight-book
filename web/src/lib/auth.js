'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const AuthCtx = createContext({ auth: null, setAuth: () => {} });

export function AuthProvider({ children }) {
  const [auth, setAuthState] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('fly_auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expires && Date.now() < parsed.expires) {
          setAuthState(parsed);
        } else {
          localStorage.removeItem('fly_auth');
        }
      }
    } catch (_) {}
    setLoaded(true);
  }, []);

  const setAuth = (val) => {
    setAuthState(val);
    if (val) {
      localStorage.setItem('fly_auth', JSON.stringify(val));
    } else {
      localStorage.removeItem('fly_auth');
    }
  };

  if (!loaded) return null;

  return (
    <AuthCtx.Provider value={{ auth, setAuth }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}

export { AuthCtx };
