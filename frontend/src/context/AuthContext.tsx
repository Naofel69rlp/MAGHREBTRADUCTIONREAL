import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import { router } from "expo-router";

import { api, setToken, clearToken, loadToken } from "@/src/api/client";

WebBrowser.maybeCompleteAuthSession();

// Crée ces identifiants dans Google Cloud Console (OAuth consent screen +
// identifiants OAuth 2.0 : type "iOS", "Android" et "Web").
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export interface AppUser {
  id: string;
  email: string;
  name: string;
  username?: string;
  phone?: string;
  picture: string;
  is_premium: boolean;
}

export interface RegisterPayload {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone?: string;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  signingIn: boolean;
  signIn: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  registerWithEmail: (payload: RegisterPayload) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    clientId: GOOGLE_WEB_CLIENT_ID, // utilisé pour web
  });

  const processGoogleIdToken = useCallback(async (idToken: string): Promise<boolean> => {
    try {
      const data = await api.post("/auth/google", { id_token: idToken });
      await setToken(data.session_token);
      setUser(data.user);
      return true;
    } catch (e) {
      console.warn("google session exchange failed", e);
      return false;
    }
  }, []);

  useEffect(() => {
    if (response?.type === "success" && response.params?.id_token) {
      (async () => {
        const ok = await processGoogleIdToken(response.params.id_token);
        setSigningIn(false);
        if (ok) router.replace("/(tabs)");
      })();
    } else if (response && response.type !== "success") {
      setSigningIn(false);
    }
  }, [response, processGoogleIdToken]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const t = await loadToken();
        if (t) {
          try {
            const me = await api.get("/auth/me");
            if (mounted) setUser(me);
          } catch {
            await clearToken();
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async () => {
    setSigningIn(true);
    try {
      await promptAsync();
    } catch (e) {
      console.warn("google prompt failed", e);
      setSigningIn(false);
    }
  }, [promptAsync]);

  const signInWithApple = useCallback(async () => {
    setSigningIn(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const identityToken = credential.identityToken;
      if (!identityToken) throw new Error("Aucun jeton Apple reçu");
      const fullName = credential.fullName;
      const name = fullName
        ? [fullName.givenName, fullName.familyName].filter(Boolean).join(" ")
        : null;
      const data = await api.post("/auth/apple", {
        identity_token: identityToken,
        name: name || null,
        email: credential.email || null,
      });
      await setToken(data.session_token);
      setUser(data.user);
      router.replace("/(tabs)");
    } catch (e: any) {
      if (e?.code === "ERR_REQUEST_CANCELED") return;
      console.warn("apple signin failed", e);
      throw e;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const registerWithEmail = useCallback(async (payload: RegisterPayload) => {
    setSigningIn(true);
    try {
      const data = await api.post("/auth/register", payload);
      await setToken(data.session_token);
      setUser(data.user);
      router.replace("/(tabs)");
    } finally {
      setSigningIn(false);
    }
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setSigningIn(true);
    try {
      const data = await api.post("/auth/login", { email, password });
      await setToken(data.session_token);
      setUser(data.user);
      router.replace("/(tabs)");
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout", {});
    } catch {
      /* ignore */
    }
    await clearToken();
    setUser(null);
    router.replace("/login");
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.get("/auth/me");
      setUser(me);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signingIn,
        signIn,
        signInWithApple,
        registerWithEmail,
        loginWithEmail,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
