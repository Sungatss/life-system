import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { api } from '../api/client';
import './LoginScreen.css';

export default function LoginScreen({ configured, serverError, onLogin, onRetry }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.login(password);
      setPassword('');
      onLogin();
    } catch (failure) {
      setError(failure.message || 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-heading">
        <img src="/lock-in-logo.png" alt="" width="64" height="64" />
        <h1 id="login-heading">Lock In</h1>
        <p>Your private productivity space.</p>
        {serverError ? <><p className="login-error" role="alert">{serverError}</p><button type="button" onClick={onRetry}>Check again</button></> : configured ? (
          <form onSubmit={submit}>
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required autoFocus />
            {error && <p className="login-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy || !password}><LockKeyhole size={17} aria-hidden="true" /> {busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
        ) : (
          <><p className="login-error" role="alert">Server login is not configured. Set the password hash and session secret in the server environment, then restart the backend.</p><button type="button" onClick={onRetry}>Check again</button></>
        )}
      </section>
    </main>
  );
}
