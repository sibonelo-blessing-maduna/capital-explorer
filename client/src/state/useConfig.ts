/**
 * useConfig.ts — loads the public /api/config map (the `explain.*` text
 * blocks plus the published defaults/limits) once per app load. Every
 * ExplanationCard reads from this shared map rather than each firing its
 * own fetch, and because these are admin-editable (routes/admin.ts +
 * config.ts), an admin's edits show up for every visitor without a
 * redeploy — see ARCHITECTURE.md "Site config: the editable-without-code
 * escape hatch".
 */
import { useEffect, useState } from "react";
import { api } from "../api";

export function useConfig() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .config()
      .then((res) => setConfig(res.config))
      .catch(() => setConfig({}))
      .finally(() => setLoaded(true));
  }, []);

  return { config, loaded };
}
