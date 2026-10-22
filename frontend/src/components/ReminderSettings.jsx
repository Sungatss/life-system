import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../api/client';

function decodeKey(key) {
  const padded = key.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(key.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (letter) => letter.charCodeAt(0));
}

export default function ReminderSettings() {
  const [available, setAvailable] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState(() => localStorage.getItem('life-system-reminder-time') || '19:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const supported = typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  useEffect(() => {
    let active = true;
    api.getReminderConfig().then(async (config) => {
      if (!active) return;
      setAvailable(config.available);
      setPublicKey(config.public_key);
      if (supported) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (active) setEnabled(Boolean(subscription));
      }
    }).catch(() => { if (active) setError('Could not load reminder settings.'); });
    return () => { active = false; };
  }, [supported]);

  async function saveSubscription(subscription, selectedTime) {
    const json = subscription.toJSON();
    const [hour, minute] = selectedTime.split(':').map(Number);
    await api.saveReminderSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      hour, minute,
    });
    localStorage.setItem('life-system-reminder-time', selectedTime);
  }

  async function enable() {
    setBusy(true);
    setError('');
    try {
      if (await Notification.requestPermission() !== 'granted') {
        throw new Error('Allow notifications in your browser settings to enable reminders.');
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) });
      try {
        await saveSubscription(subscription, time);
      } catch (saveError) {
        if (!existing) await subscription.unsubscribe();
        throw saveError;
      }
      setEnabled(true);
    } catch (cause) {
      setError(cause.message || 'Could not turn on reminders.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.removeReminderSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setEnabled(false);
    } catch (cause) {
      setError(cause.message || 'Could not turn off reminders.');
    } finally {
      setBusy(false);
    }
  }

  async function changeTime(event) {
    const selectedTime = event.target.value;
    setTime(selectedTime);
    if (!enabled) {
      localStorage.setItem('life-system-reminder-time', selectedTime);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await saveSubscription(subscription, selectedTime);
    } catch (cause) {
      setError(cause.message || 'Could not save reminder time.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="reminder-settings" aria-labelledby="reminder-title">
      <div className="reminder-heading"><Bell size={19} aria-hidden="true" /><h2 id="reminder-title">Daily reminders</h2></div>
      <p>Get one reminder for unfinished due tasks and habits you have not checked today.</p>
      {available && supported ? (
        <div className="reminder-controls">
          <label htmlFor="reminder-time">Remind me at</label>
          <input id="reminder-time" type="time" value={time} onChange={changeTime} disabled={busy} />
          <button type="button" className={enabled ? 'btn-secondary' : 'btn-primary'} onClick={enabled ? disable : enable} disabled={busy}>
            {busy ? 'Saving…' : enabled ? 'Turn off reminders' : 'Enable reminders'}
          </button>
          <span className="reminder-state">{enabled ? 'On for this device' : 'Off for this device'}</span>
        </div>
      ) : (
        <p className="reminder-unavailable">{!available ? 'Push reminders need server setup before they can be enabled.' : 'This browser cannot receive push reminders. On iPhone, add Lock In to your Home Screen and open it there.'}</p>
      )}
      {error && <p className="profile-error" role="alert">{error}</p>}
    </section>
  );
}
