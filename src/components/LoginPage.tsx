import { getGoogleLoginUrl } from "../lib/api";

export default function LoginPage() {
  return (
    <div className="login-screen">
      <div className="panel login-card">
        <div className="brand-mark">L</div>
        <h1>Welcome to LifeOS</h1>
        <p>Your all-in-one digital life dashboard for finance, health, and knowledge.</p>
        <div className="auth-actions">
          <a className="secondary-button auth-button auth-link" href={getGoogleLoginUrl()}>
            Sign in with Google
          </a>
        </div>
      </div>
    </div>
  );
}
