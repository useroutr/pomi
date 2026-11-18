import * as SecureStore from "expo-secure-store";
import { createContext, type ReactNode, use, useEffect, useMemo, useState } from "react";
import { ApiClient, sessionSchema } from "./api";
import { forgetPushDevice, registerIfAllowed } from "./push";

const TOKEN_KEY = "pomi.session";

type SessionState =
  { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; token: string };

interface Session {
  state: SessionState;
  api: ApiClient;
  verifyCode: (email: string, code: string) => Promise<VerifyResult>;
  signOut: () => Promise<void>;
}

// Signed in, with whether a handle is claimed yet (the next step depends on
// it), or the message to show.
export type VerifyResult = { ok: true; handle: string | null } | { ok: false; message: string };

const SessionContext = createContext<Session | null>(null);

// The session token lives in the platform's secure store (the Keychain on
// iOS, the Keystore on Android), never in plain storage.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    void SecureStore.getItemAsync(TOKEN_KEY).then((token) => {
      setState(token === null ? { status: "signed-out" } : { status: "signed-in", token });
    });
  }, []);

  const session = useMemo<Session>(() => {
    const api = new ApiClient(state.status === "signed-in" ? state.token : null);
    return {
      state,
      api,
      async verifyCode(email, code) {
        const result = await api.post(
          "/api/auth/verify",
          { email, code, client: "mobile" },
          sessionSchema,
        );
        if (!result.ok) {
          return { ok: false, message: result.message };
        }
        await SecureStore.setItemAsync(TOKEN_KEY, result.value.session.token);
        setState({ status: "signed-in", token: result.value.session.token });
        void registerIfAllowed(new ApiClient(result.value.session.token));
        return { ok: true, handle: result.value.user.handle };
      },
      async signOut() {
        await forgetPushDevice(api);
        await api.postNoContent("/api/auth/sign-out", {});
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setState({ status: "signed-out" });
      },
    };
  }, [state]);

  return <SessionContext value={session}>{children}</SessionContext>;
}

export function useSession(): Session {
  const session = use(SessionContext);
  if (session === null) {
    throw new Error("useSession needs a SessionProvider above it");
  }
  return session;
}
