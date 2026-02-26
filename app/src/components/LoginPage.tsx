import { FormEvent, useState } from "react";

interface LoginPageProps {
  onLogin: (token: string) => void;
  multiUser?: boolean;
  hasUsers?: boolean;
}

export function LoginPage({ onLogin, multiUser, hasUsers }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">(
    multiUser && !hasUsers ? "register" : "login",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (multiUser) {
        if (mode === "register") {
          if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
          }
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username,
              password,
              displayName: displayName || username,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || "Registration failed");
            return;
          }
          localStorage.setItem("drawbook_token", data.token);
          onLogin(data.token);
        } else {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || "Invalid credentials");
            return;
          }
          localStorage.setItem("drawbook_token", data.token);
          onLogin(data.token);
        }
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Invalid password");
          return;
        }
        localStorage.setItem("drawbook_token", data.token);
        onLogin(data.token);
      }
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  const isRegister = multiUser && mode === "register";
  const subtitle = !multiUser
    ? "Enter your password to continue"
    : isRegister
      ? hasUsers
        ? "Create a new account"
        : "Create your first account to get started"
      : "Sign in to your account";

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="dashboard-brand__dot" />
          <h1>Drawbook</h1>
        </div>
        <p className="login-subtitle">{subtitle}</p>
        <form onSubmit={handleSubmit} className="login-form">
          {multiUser && (
            <input
              type="text"
              className="login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoFocus
              autoComplete="username"
            />
          )}
          {isRegister && (
            <input
              type="text"
              className="login-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name (optional)"
              autoComplete="name"
            />
          )}
          <input
            type="password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus={!multiUser}
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
          {isRegister && (
            <input
              type="password"
              className="login-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
            />
          )}
          {error && <p className="login-error">{error}</p>}
          <button
            type="submit"
            className="primary-btn login-btn"
            disabled={loading}
          >
            {loading
              ? isRegister
                ? "Creating account..."
                : "Signing in..."
              : isRegister
                ? "Create Account"
                : "Sign in"}
          </button>
        </form>
        {multiUser && (
          <p className="login-toggle">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="login-toggle__link"
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="login-toggle__link"
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
