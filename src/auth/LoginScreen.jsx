import { useState } from 'react';
import { BrandMark } from '../components/Sidebar';
import { Button, Field, Label, PasswordInput } from '../components/common';

export default function LoginScreen({ onLogin, error, loading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    onLogin(email, password);
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <main className="flex flex-1 items-center px-6 py-12">
        <div className="mx-auto w-full max-w-[360px]">
          <div className="mb-10 flex items-center gap-3">
            <BrandMark size={36} />
            <div className="leading-tight">
              <p className="text-base font-semibold text-fg">Nexus</p>
              <p className="text-xs text-subtle">Control de plataforma</p>
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-fg">Iniciar sesión</h1>
          <p className="mt-1.5 text-sm text-muted">Acceso exclusivo para administradores de la plataforma.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <Field
              label="Correo"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <div>
              <Label htmlFor="login-password">Contraseña</Label>
              <PasswordInput
                id="login-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                visible={showPassword}
                onToggleVisible={() => setShowPassword((v) => !v)}
                required
              />
            </div>
            {error && (
              <p role="alert" className="border-l-2 border-bad pl-3 text-sm text-bad">{error}</p>
            )}
            <Button type="submit" variant="primary" block disabled={loading} className="mt-2">
              {loading ? 'Verificando…' : 'Ingresar'}
            </Button>
          </form>
        </div>
      </main>
      <footer className="px-6 pb-6 text-center text-xs text-subtle">Nexus · Panel interno</footer>
    </div>
  );
}
