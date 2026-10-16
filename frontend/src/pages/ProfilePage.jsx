import { useEffect, useState } from 'react';
import { Flame, Pencil, Save, X, Zap } from 'lucide-react';
import { api } from '../api/client';
import ContributionGraph from '../components/ContributionGraph';
import WeeklyReviewPage from './WeeklyReviewPage';
import './ProfilePage.css';

export default function ProfilePage({ onSignOut }) {
  const [profile, setProfile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [contributions, setContributions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.getProfile(), api.getProgress()])
      .then(async ([person, activity]) => {
        const history = await api.getContributions(112, activity.date);
        if (!active) return;
        setProfile(person);
        setName(person.name);
        setBio(person.bio);
        setProgress(activity);
        setContributions(history);
      })
      .catch(() => { if (active) setLoadError('Could not load your profile.'); });
    return () => { active = false; };
  }, []);

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await api.updateProfile({ name: name.trim(), bio: bio.trim() });
      setProfile(updated);
      setName(updated.name);
      setBio(updated.bio);
      setEditing(false);
    } catch {
      setSaveError('Could not save your profile. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setName(profile.name);
    setBio(profile.bio);
    setSaveError('');
    setEditing(false);
  };

  const levelProgress = progress ? 100 - progress.xp_to_next_level : 0;

  return (
    <div className="profile-page">
      <div className="profile-title-row">
        <h1 className="profile-page-title">Profile</h1>
        <button type="button" className="btn-secondary" onClick={onSignOut}>Sign out</button>
      </div>

      {loadError && <p className="profile-error" role="alert">{loadError}</p>}
      {!profile && !loadError && <div className="profile-loading" aria-busy="true">Loading profile…</div>}

      {profile && progress && (
        <section className={`profile-hero${editing ? ' is-editing' : ''}`} aria-label="Profile and level">
          <img className="profile-avatar" src="/profile-avatar.png" alt="Your profile avatar" width="112" height="112" />
          <div className="profile-identity">
            {editing ? (
              <form className="profile-edit-form" onSubmit={saveProfile}>
                <label htmlFor="profile-name">Name</label>
                <input id="profile-name" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} required autoFocus />
                <label htmlFor="profile-bio">About</label>
                <textarea id="profile-bio" value={bio} maxLength={1000} rows={3} onChange={(event) => setBio(event.target.value)} />
                {saveError && <p className="profile-error" role="alert">{saveError}</p>}
                <div className="profile-edit-actions">
                  <button type="submit" className="btn-primary" disabled={saving || !name.trim()}><Save size={15} /> {saving ? 'Saving…' : 'Save'}</button>
                  <button type="button" className="btn-secondary" onClick={cancelEdit}><X size={15} /> Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="profile-name-row">
                  <h2>{profile.name}</h2>
                  <button type="button" className="profile-edit-button" onClick={() => setEditing(true)} aria-label="Edit profile"><Pencil size={16} /></button>
                </div>
                {profile.bio && <p className="profile-bio">{profile.bio}</p>}
              </>
            )}
          </div>
          <div className="profile-level">
            <span className="profile-level-label"><Zap size={16} aria-hidden="true" /> Level {progress.level}</span>
            <strong>{progress.total_xp.toLocaleString()} XP</strong>
            <div className="profile-level-bar" role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={levelProgress}>
              <span style={{ width: `${levelProgress}%` }} />
            </div>
            <small>{progress.xp_to_next_level} XP to level {progress.level + 1}</small>
          </div>
        </section>
      )}

      {progress && (
        <div className="profile-stats" aria-label="Activity summary">
          <div><span>Today</span><strong>{progress.today_xp} XP</strong></div>
          <div><span>Streak</span><strong><Flame size={19} aria-hidden="true" /> {progress.streak} days</strong></div>
          <div><span>Daily goal</span><strong>{progress.today_xp} / {progress.daily_goal} XP</strong></div>
        </div>
      )}

      {contributions && <ContributionGraph contributions={contributions} title="Contributions" />}

      <WeeklyReviewPage />
    </div>
  );
}
