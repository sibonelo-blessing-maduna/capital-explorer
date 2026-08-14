import { useCallback, useEffect, useState } from "react";
import { api, type PublicUser } from "../api";

export function useAuth() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.me();
      setUser(res.user);
      setGoogleConfigured(res.googleConfigured);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return { user, googleConfigured, loading, refresh, logout };
}
