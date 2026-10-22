import { useCallback, useEffect, useState } from 'react';
import { Plus, Target, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import './ProjectsPage.css';
import './GoalsPage.css';

const draftKey = (id) => `life-system-goal-draft-${id}`;

function readDraft(goal) {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey(goal.id)) || 'null');
    if (draft && typeof draft.name === 'string' && typeof draft.plan === 'string') return draft;
  } catch { /* Use the saved goal when a local draft is invalid. */ }
  return { name: goal.name, plan: goal.plan };
}

export default function GoalsPage() {
  const [areas, setAreas] = useState([]);
  const [goals, setGoals] = useState([]);
  const [areaId, setAreaId] = useState(null);
  const [goalId, setGoalId] = useState(null);
  const [areaName, setAreaName] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [newGoalName, setNewGoalName] = useState('');
  const [goalName, setGoalName] = useState('');
  const [goalPlan, setGoalPlan] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmAreaDelete, setConfirmAreaDelete] = useState(false);
  const [confirmGoalDelete, setConfirmGoalDelete] = useState(false);

  const selectGoal = (goal) => {
    setGoalId(goal?.id ?? null);
    const draft = goal ? readDraft(goal) : { name: '', plan: '' };
    setGoalName(draft.name);
    setGoalPlan(draft.plan);
    setConfirmGoalDelete(false);
    setError('');
  };

  const selectArea = (area, availableGoals = goals) => {
    setAreaId(area?.id ?? null);
    setAreaName(area?.name ?? '');
    setConfirmAreaDelete(false);
    selectGoal(area ? availableGoals.find((goal) => goal.area_id === area.id) : null);
  };

  const load = useCallback(async (isActive = () => true) => {
    setLoading(true);
    setError('');
    try {
      const [nextAreas, nextGoals] = await Promise.all([api.getGoalAreas(), api.getGoals()]);
      if (!isActive()) return;
      setAreas(nextAreas);
      setGoals(nextGoals);
      const firstArea = nextAreas[0];
      setAreaId(firstArea?.id ?? null);
      setAreaName(firstArea?.name ?? '');
      const firstGoal = nextGoals.find((goal) => goal.area_id === firstArea?.id);
      setGoalId(firstGoal?.id ?? null);
      const draft = firstGoal ? readDraft(firstGoal) : { name: '', plan: '' };
      setGoalName(draft.name);
      setGoalPlan(draft.plan);
    } catch (cause) {
      if (isActive()) setError(cause.message || 'Could not load goals.');
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) load(() => active); });
    return () => { active = false; };
  }, [load]);

  const selectedArea = areas.find((area) => area.id === areaId);
  const selectedGoal = goals.find((goal) => goal.id === goalId);
  const areaGoals = goals.filter((goal) => goal.area_id === areaId);
  const goalChanged = selectedGoal && (goalName.trim() !== selectedGoal.name || goalPlan.trim() !== selectedGoal.plan);

  const updateGoalDraft = (name, plan) => {
    setGoalName(name);
    setGoalPlan(plan);
    setError('');
    if (!selectedGoal) return;
    if (name.trim() === selectedGoal.name && plan.trim() === selectedGoal.plan) localStorage.removeItem(draftKey(selectedGoal.id));
    else localStorage.setItem(draftKey(selectedGoal.id), JSON.stringify({ name, plan }));
  };

  const run = async (action) => {
    setBusy(true);
    setError('');
    try { await action(); } catch (cause) { setError(cause.message || 'Could not save. Try again.'); } finally { setBusy(false); }
  };

  const createArea = (event) => {
    event.preventDefault();
    if (!newAreaName.trim() || busy) return;
    run(async () => {
      const area = await api.createGoalArea({ name: newAreaName.trim() });
      setAreas((previous) => [...previous, area]);
      setNewAreaName('');
      selectArea(area, goals);
    });
  };

  const saveArea = (event) => {
    event.preventDefault();
    if (!selectedArea || !areaName.trim() || areaName.trim() === selectedArea.name || busy) return;
    run(async () => {
      const area = await api.updateGoalArea(areaId, { name: areaName.trim() });
      setAreas((previous) => previous.map((item) => item.id === area.id ? area : item));
      setAreaName(area.name);
    });
  };

  const deleteArea = () => {
    if (!confirmAreaDelete) { setConfirmAreaDelete(true); return; }
    if (!selectedArea || busy) return;
    run(async () => {
      await api.deleteGoalArea(areaId);
      goals.filter((goal) => goal.area_id === areaId).forEach((goal) => localStorage.removeItem(draftKey(goal.id)));
      const remainingAreas = areas.filter((area) => area.id !== areaId);
      const remainingGoals = goals.filter((goal) => goal.area_id !== areaId);
      setAreas(remainingAreas);
      setGoals(remainingGoals);
      selectArea(remainingAreas[0], remainingGoals);
    });
  };

  const createGoal = (event) => {
    event.preventDefault();
    if (!selectedArea || !newGoalName.trim() || busy) return;
    run(async () => {
      const goal = await api.createGoal({ area_id: areaId, name: newGoalName.trim(), plan: '' });
      setGoals((previous) => [goal, ...previous]);
      setNewGoalName('');
      selectGoal(goal);
    });
  };

  const saveGoal = (event) => {
    event.preventDefault();
    if (!selectedGoal || !goalName.trim() || !goalChanged || busy) return;
    run(async () => {
      const goal = await api.updateGoal(goalId, { area_id: areaId, name: goalName.trim(), plan: goalPlan.trim() });
      setGoals((previous) => previous.map((item) => item.id === goal.id ? goal : item));
      setGoalName(goal.name);
      setGoalPlan(goal.plan);
      localStorage.removeItem(draftKey(goal.id));
    });
  };

  const deleteGoal = () => {
    if (!confirmGoalDelete) { setConfirmGoalDelete(true); return; }
    if (!selectedGoal || busy) return;
    run(async () => {
      await api.deleteGoal(goalId);
      localStorage.removeItem(draftKey(goalId));
      const remaining = goals.filter((goal) => goal.id !== goalId);
      setGoals(remaining);
      selectGoal(remaining.find((goal) => goal.area_id === areaId));
    });
  };

  return <div className="goals-page">
    <div className="cockpit-date-banner"><h1 className="cockpit-title">Goals</h1><p className="page-intro">Organize what matters by area, then write a plan for each goal.</p></div>
    <section className="cockpit-section project-create" aria-label="Create an area">
      <form className="project-create-form" onSubmit={createArea}>
        <label className="sr-only" htmlFor="new-goal-area">New area name</label>
        <input id="new-goal-area" className="task-input-field" placeholder="New area, such as Health or Learning" value={newAreaName} onChange={(event) => setNewAreaName(event.target.value)} maxLength={100} disabled={busy || loading} />
        <button className="btn-primary" type="submit" disabled={!newAreaName.trim() || busy || loading}><Plus size={16} aria-hidden="true" /> Add area</button>
      </form>
    </section>
    {error && <p className="goals-error" role="alert">{error}</p>}
    {loading ? <div className="empty-state">Loading goals…</div> : areas.length === 0 ? <div className="empty-state project-empty"><Target size={28} aria-hidden="true" /><p>Add an area to start organizing your goals.</p></div> :
      <div className="projects-layout">
        <nav className="project-rail" aria-label="Goal areas"><h2>Your areas</h2><div className="project-rail-list">{areas.map((area) => <button key={area.id} type="button" className={`project-rail-item${areaId === area.id ? ' active' : ''}`} aria-current={areaId === area.id ? 'true' : undefined} onClick={() => selectArea(area)}><Target size={16} aria-hidden="true" /><span>{area.name}</span></button>)}</div></nav>
        <div className="project-detail">
          <section className="cockpit-section" aria-label="Area settings">
            <div className="section-header"><h2 className="section-title">Area</h2></div>
            <form className="goals-area-form" onSubmit={saveArea}><label className="form-label" htmlFor="goal-area-name">Area name</label><div className="goals-inline"><input id="goal-area-name" className="task-input-field" value={areaName} onChange={(event) => { setAreaName(event.target.value); setConfirmAreaDelete(false); }} maxLength={100} disabled={busy} /><button className="btn-secondary" type="submit" disabled={!areaName.trim() || areaName.trim() === selectedArea?.name || busy}>Save name</button></div></form>
            <div className="goals-delete-row">{confirmAreaDelete && <span>Deleting this area also deletes its {areaGoals.length} {areaGoals.length === 1 ? 'goal' : 'goals'} and plans.</span>}{confirmAreaDelete && <button className="btn-secondary" type="button" onClick={() => setConfirmAreaDelete(false)}>Cancel</button>}<button className="project-delete-button" type="button" onClick={deleteArea} disabled={busy}><Trash2 size={14} aria-hidden="true" />{confirmAreaDelete ? 'Confirm delete area' : 'Delete area'}</button></div>
          </section>
          <section className="cockpit-section" aria-label="Goals in this area"><div className="section-header"><h2 className="section-title">Goals in {selectedArea?.name}</h2><span className="section-badge">{areaGoals.length}</span></div>
            <form className="project-create-form" onSubmit={createGoal}><label className="sr-only" htmlFor="new-goal-name">New goal name</label><input id="new-goal-name" className="task-input-field" placeholder="Write a new goal" value={newGoalName} onChange={(event) => setNewGoalName(event.target.value)} maxLength={100} disabled={busy} /><button className="btn-primary" type="submit" disabled={!newGoalName.trim() || busy}><Plus size={16} aria-hidden="true" /> Add goal</button></form>
            {areaGoals.length ? <div className="goals-list" role="group" aria-label="Select a goal">{areaGoals.map((goal) => <button key={goal.id} className={`project-rail-item${goalId === goal.id ? ' active' : ''}`} type="button" aria-pressed={goalId === goal.id} onClick={() => selectGoal(goal)}><Target size={16} aria-hidden="true" /><span>{goal.name}</span></button>)}</div> : <p className="goals-empty">No goals in this area yet.</p>}
          </section>
          {selectedGoal && <section className="cockpit-section" aria-label="Goal plan"><div className="section-header"><h2 className="section-title">Goal and plan</h2></div>
            <form className="project-plan-form" onSubmit={saveGoal}><label className="form-label" htmlFor="goal-name">Goal name</label><input id="goal-name" className="task-input-field" value={goalName} onChange={(event) => updateGoalDraft(event.target.value, goalPlan)} maxLength={100} disabled={busy} /><label className="form-label" htmlFor="goal-plan">Your plan</label><textarea id="goal-plan" className="task-input-field project-plan-textarea" rows={8} maxLength={50000} value={goalPlan} onChange={(event) => updateGoalDraft(goalName, event.target.value)} disabled={busy} placeholder="Describe your direction, milestones, and ideas." /><div className="project-plan-actions"><span className="project-save-hint">{goalChanged ? 'Unsaved draft kept in this browser' : 'Saved'}</span><button className="btn-primary" type="submit" disabled={!goalName.trim() || !goalChanged || busy}>{busy ? 'Saving…' : 'Save goal'}</button></div></form>
            <div className="goals-delete-row">{confirmGoalDelete && <span>This goal and its plan will be deleted.</span>}{confirmGoalDelete && <button className="btn-secondary" type="button" onClick={() => setConfirmGoalDelete(false)}>Cancel</button>}<button className="project-delete-button" type="button" onClick={deleteGoal} disabled={busy}><Trash2 size={14} aria-hidden="true" />{confirmGoalDelete ? 'Confirm delete goal' : 'Delete goal'}</button></div>
          </section>}
        </div>
      </div>}
  </div>;
}
