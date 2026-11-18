import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { type z } from "zod";
import { useSession } from "./session";

export interface ApiData<T> {
  data: T | null;
  error: string | null;
  // True only while there is nothing to show yet; a reload keeps the old data.
  loading: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
}

// Reads one of the app's endpoints whenever the screen comes into focus, so
// what it shows is never older than the last time it was looked at.
export function useApi<T>(path: string | null, schema: z.ZodType<T>): ApiData<T> {
  const { api, state, signOut } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Nothing to ask once signed out, and asking would only answer 401 again.
    if (path === null || state.status !== "signed-in") {
      return;
    }
    const result = await api.get(path, schema);
    if (result.ok) {
      setData(result.value);
      setError(null);
    } else if (result.status === 401) {
      // The server ended the session (signed out elsewhere, or expired).
      await signOut();
    } else {
      setError(result.message);
    }
  }, [api, state.status, path, schema, signOut]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const reload = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { data, error, loading: data === null && error === null, refreshing, reload };
}
