import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-hero" aria-labelledby="login-title">
        <div className="brand-lockup" aria-label="FutHub">
          <span className="brand-mark" aria-hidden="true" />
          <strong>FutHub</strong>
        </div>
        <div>
          <p className="eyebrow">Controle operacional</p>
          <h2 id="login-title">Economia precisa de decisões claras.</h2>
          <p>Configure recompensas, chance e intervalo do comando de lucro sem expor credencial.</p>
        </div>
      </section>
      <LoginForm />
    </main>
  );
}
