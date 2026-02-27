import { useEffect, useState } from "react";
import { LoginPage } from "./components/LoginPage";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { setLinkingEnabled } from "./components/DocumentLink";
import { AppRouter } from "./AppRouter";

function injectAuthFetch(token: string) {
  if ((window as any).__authFetchPatched) return;
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : "";
    if (url.startsWith("/api/") && !url.includes("/api/auth/")) {
      init = init || {};
      const headers = new Headers(init.headers);
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      init.headers = headers;
    }
    return originalFetch.call(this, input, init);
  };
  (window as any).__authFetchPatched = true;
}

export function getAuthToken(): string {
  return localStorage.getItem("drawbook_token") || "";
}

export interface AppConfig {
  enableTldraw: boolean;
  enableLinking: boolean;
  storageBackend: string;
  isElectron: boolean;
  multiUser: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  enableTldraw: false,
  enableLinking: false,
  storageBackend: "local",
  isElectron: false,
  multiUser: false,
};

function App() {
  const [authState, setAuthState] = useState<
    "checking" | "login" | "authenticated"
  >("checking");
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [multiUserInfo, setMultiUserInfo] = useState<{
    multiUser: boolean;
    hasUsers: boolean;
  }>({ multiUser: false, hasUsers: true });

  useEffect(() => {
    const token = localStorage.getItem("drawbook_token") || "";

    const authCheck = fetch("/api/auth/check", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((r) => r.json());

    const configCheck = fetch("/api/config")
      .then((r) => r.json())
      .catch(() => DEFAULT_CONFIG);

    Promise.all([authCheck, configCheck])
      .then(([authData, configData]) => {
        setConfig(configData);
        setLinkingEnabled(!!configData.enableLinking);
        setMultiUserInfo({
          multiUser: !!authData.multiUser,
          hasUsers: authData.hasUsers !== false,
        });
        if (!authData.required || authData.authenticated) {
          if (token) injectAuthFetch(token);
          setAuthState("authenticated");
        } else {
          setAuthState("login");
        }
      })
      .catch(() => setAuthState("login"));
  }, []);

  const handleLogin = (token: string) => {
    if (token) injectAuthFetch(token);
    setAuthState("authenticated");
  };

  if (authState === "checking") {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
      </div>
    );
  }

  if (authState === "login") {
    return (
      <LoginPage
        onLogin={handleLogin}
        multiUser={multiUserInfo.multiUser}
        hasUsers={multiUserInfo.hasUsers}
      />
    );
  }

  return (
    <ConfirmProvider>
      <AppRouter config={config} />
    </ConfirmProvider>
  );
}

export default App;
