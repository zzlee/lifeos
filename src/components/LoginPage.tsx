import { getGoogleLoginUrl, loginDemo } from "../lib/api";

export default function LoginPage({ onLoginSuccess }: { onLoginSuccess: (user: any, googleAuthEnabled: boolean) => void }) {
  async function handleDemoLogin() {
    const response = await loginDemo({});
    onLoginSuccess(response.session.user, response.session.googleAuthEnabled);
  }

  return (
    <div className="login-screen">
      <div className="panel login-card">
        <div className="brand-mark">L</div>
        <h1>Welcome to LifeOS</h1>
        <p>Your all-in-one digital life dashboard for finance, health, and knowledge.</p>
        <div className="auth-actions">
          <button className="secondary-button auth-button" type="button" onClick={() => void handleDemoLogin()}>
            Demo Login
          </button>
          <a className="secondary-button auth-button auth-link" href={getGoogleLoginUrl()}>
            Sign in with Google
          </a>
        </div>
      </div>
    </div>
  );
}
