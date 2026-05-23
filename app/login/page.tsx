export default function LoginPage() {
  return (
    <div className="auth-panel">
      <section className="card">
        <p className="eyebrow">Private internal app</p>
        <h1>Armitage Ops login</h1>
        <p className="subtitle">
          Production should use Supabase Auth with invited users only. This preview screen documents the intended auth flow.
        </p>
        <form className="form-grid">
          <label><span className="eyebrow">Email</span><input className="input" type="email" placeholder="name@armitageinteriors.com" /></label>
          <label><span className="eyebrow">Password</span><input className="input" type="password" /></label>
          <button className="button" type="button">Sign in</button>
        </form>
      </section>
    </div>
  );
}
