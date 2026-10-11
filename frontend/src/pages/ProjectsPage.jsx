import { useEffect, useRef, useState } from 'react';
import { FolderKanban, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import QuickTaskInput from '../components/QuickTaskInput';
import TaskItem from '../components/TaskItem';
import './ProjectsPage.css';

const draftKey = (id) => `life-system-project-draft-${id}`;

function readDraft(project) {
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey(project.id)) || 'null');
    if (saved && typeof saved.name === 'string' && typeof saved.plan === 'string') return saved;
  } catch { /* An invalid local draft should not hide the saved project. */ }
  return { name: project.name, plan: project.plan };
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const selectedIdRef = useRef(null);
  const [name, setName] = useState('');
  const [plan, setPlan] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [createError, setCreateError] = useState('');
  const [projectError, setProjectError] = useState('');
  const [taskError, setTaskError] = useState('');
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectProject = (project) => {
    selectedIdRef.current = project.id;
    setSelectedId(project.id);
    const draft = readDraft(project);
    setName(draft.name);
    setPlan(draft.plan);
    setProjectError('');
    setTaskError('');
    setConfirmDelete(false);
    setTasks([]);
    setTasksLoading(true);
  };

  const loadProjects = async (isActive = () => true) => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.getProjects();
      if (!isActive()) return;
      setProjects(data);
      if (data.length) selectProject(data[0]);
    } catch {
      if (isActive()) setLoadError('Could not load projects. Check your connection and try again.');
    } finally {
      if (isActive()) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) loadProjects(() => active); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    let active = true;
    queueMicrotask(async () => {
      if (!active) return;
      setTasksLoading(true);
      setTaskError('');
      try {
        const data = await api.getTasks(null, null, selectedId);
        if (active) setTasks(data);
      } catch {
        if (active) setTaskError('Could not load project tasks. Try again.');
      } finally {
        if (active) setTasksLoading(false);
      }
    });
    return () => { active = false; };
  }, [selectedId]);

  const selectedProject = projects.find((project) => project.id === selectedId);
  const completedCount = tasks.filter((task) => task.completed).length;
  const hasChanges = selectedProject && (name.trim() !== selectedProject.name || plan.trim() !== selectedProject.plan);

  const updateDraft = (nextName, nextPlan) => {
    setName(nextName);
    setPlan(nextPlan);
    setProjectError('');
    if (selectedProject) {
      if (nextName.trim() === selectedProject.name && nextPlan.trim() === selectedProject.plan) localStorage.removeItem(draftKey(selectedId));
      else localStorage.setItem(draftKey(selectedId), JSON.stringify({ name: nextName, plan: nextPlan }));
    }
  };

  const createProject = async (event) => {
    event.preventDefault();
    if (!newName.trim() || creating || loading) return;
    setCreating(true);
    setCreateError('');
    try {
      const project = await api.createProject({ name: newName.trim(), plan: '' });
      setProjects((previous) => [project, ...previous]);
      setNewName('');
      selectProject(project);
    } catch (error) {
      setCreateError(error.message || 'Could not create project. Try again.');
    } finally {
      setCreating(false);
    }
  };

  const saveProject = async (event) => {
    event.preventDefault();
    if (!selectedProject || !name.trim() || !hasChanges || saving) return;
    setSaving(true);
    setProjectError('');
    try {
      const updated = await api.updateProject(selectedId, { name: name.trim(), plan: plan.trim() });
      setProjects((previous) => previous.map((project) => project.id === updated.id ? updated : project));
      if (selectedIdRef.current === updated.id) {
        setName(updated.name);
        setPlan(updated.plan);
      }
      localStorage.removeItem(draftKey(updated.id));
    } catch (error) {
      setProjectError(error.message || 'Could not save project. Your draft is still here.');
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    if (!selectedProject || saving) return;
    setSaving(true);
    setProjectError('');
    try {
      await api.deleteProject(selectedId);
      localStorage.removeItem(draftKey(selectedId));
      const remaining = projects.filter((project) => project.id !== selectedId);
      setProjects(remaining);
      if (remaining.length) selectProject(remaining[0]);
      else {
        selectedIdRef.current = null;
        setSelectedId(null);
        setTasks([]);
        setName('');
        setPlan('');
      }
      setConfirmDelete(false);
    } catch {
      setProjectError('Could not delete this project. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const addTask = async (payload) => {
    const projectId = selectedId;
    const created = await api.createTask({ ...payload, project_id: projectId });
    if (selectedIdRef.current === projectId) {
      setTaskError('');
      setTasks((previous) => [created, ...previous]);
    }
  };

  const toggleTask = async (taskId, completed) => {
    const projectId = selectedId;
    setTasks((previous) => previous.map((task) => task.id === taskId ? { ...task, completed } : task));
    try {
      const updated = await api.updateTask(taskId, { completed });
      if (selectedIdRef.current === projectId) setTasks((previous) => previous.map((task) => task.id === taskId ? updated : task));
    } catch {
      if (selectedIdRef.current === projectId) {
        setTaskError('Could not update that task. Reload the project to try again.');
        setTasks((previous) => previous.map((task) => task.id === taskId ? { ...task, completed: !completed } : task));
      }
    }
  };

  const updateTask = async (taskId, data) => {
    const projectId = selectedId;
    const updated = await api.updateTask(taskId, data);
    if (selectedIdRef.current === projectId) setTasks((previous) => previous.map((task) => task.id === taskId ? updated : task).filter((task) => task.project_id === projectId));
  };

  const removeTask = async (taskId) => {
    const projectId = selectedId;
    await api.deleteTask(taskId);
    if (selectedIdRef.current === projectId) setTasks((previous) => previous.filter((task) => task.id !== taskId));
  };

  return (
    <div className="projects-page">
      <div className="cockpit-date-banner">
        <div className="cockpit-weekday">FROM PLAN TO ACTION</div>
        <h1 className="cockpit-title">Projects</h1>
        <p className="page-intro">Keep each plan, task, and step together. Start with a name like “Exams.”</p>
      </div>

      <section className="cockpit-section project-create" aria-label="Create a project">
        <form onSubmit={createProject} className="project-create-form">
          <label className="sr-only" htmlFor="new-project-name">Project name</label>
          <input id="new-project-name" className="task-input-field" placeholder="New project name, e.g. Exams" value={newName} onChange={(event) => { setNewName(event.target.value); setCreateError(''); }} maxLength={100} disabled={creating || loading} />
          <button type="submit" className="btn-primary" disabled={!newName.trim() || creating || loading}><Plus size={16} /> Create project</button>
        </form>
        {createError && <p className="form-error" role="alert">{createError}</p>}
      </section>

      {loading ? <div className="empty-state">Loading projects…</div> : loadError ? (
        <div className="empty-state error-state" role="alert"><p>{loadError}</p><button type="button" className="btn-secondary" onClick={() => loadProjects()}>Retry</button></div>
      ) : projects.length === 0 ? (
        <div className="empty-state project-empty"><FolderKanban size={28} aria-hidden="true" /><p>No projects yet.</p><p className="empty-state-sub">Name one above, then add its plan and tasks.</p></div>
      ) : (
        <div className="projects-layout">
          <nav className="project-rail" aria-label="Your projects">
            <h2>Your projects</h2>
            <div className="project-rail-list">
              {projects.map((project) => (
                <button type="button" key={project.id} className={`project-rail-item${selectedId === project.id ? ' active' : ''}`} aria-current={selectedId === project.id ? 'true' : undefined} onClick={() => selectProject(project)}>
                  <FolderKanban size={16} aria-hidden="true" /><span>{project.name}</span>
                </button>
              ))}
            </div>
          </nav>

          {selectedProject && <div className="project-detail">
            <section className="cockpit-section" aria-label="Project plan">
              <div className="section-header"><div className="section-title-wrap"><FolderKanban size={17} aria-hidden="true" /><h2 className="section-title">Plan and thoughts</h2></div></div>
              <form onSubmit={saveProject} className="project-plan-form">
                <label className="form-label" htmlFor="project-name">Project name</label>
                <input id="project-name" className="task-input-field" value={name} onChange={(event) => updateDraft(event.target.value, plan)} maxLength={100} disabled={saving} />
                <label className="form-label" htmlFor="project-plan">Your plan or roadmap</label>
                <textarea id="project-plan" className="task-input-field project-plan-textarea" placeholder="What is your goal? Write the steps, ideas, or anything you want to remember…" value={plan} onChange={(event) => updateDraft(name, event.target.value)} maxLength={50000} rows={8} disabled={saving} />
                <div className="project-plan-actions">
                  <span className="project-save-hint">{hasChanges ? 'Unsaved draft kept in this browser' : 'Saved'}</span>
                  <button type="submit" className="btn-primary" disabled={!name.trim() || !hasChanges || saving}>{saving ? 'Saving…' : 'Save project'}</button>
                </div>
              </form>
              {projectError && <p className="form-error" role="alert">{projectError}</p>}
            </section>

            <section className="cockpit-section" aria-label="Project tasks">
              <div className="section-header"><div className="section-title-wrap"><h2 className="section-title">Tasks and steps</h2></div><span className="section-badge">{completedCount} / {tasks.length}</span></div>
              {!tasksLoading && <QuickTaskInput key={selectedId} onAddTask={addTask} projectId={selectedId} />}
              {taskError && <p className="form-error" role="alert">{taskError}</p>}
              {tasksLoading ? <div className="empty-state">Loading tasks…</div> : tasks.length === 0 ? (
                <div className="empty-state"><p>No tasks in this project yet.</p><p className="empty-state-sub">Add a task above. You can add steps to it now or later.</p></div>
              ) : <div className="task-list">{tasks.map((task) => <TaskItem key={task.id} task={task} onToggle={toggleTask} onUpdate={updateTask} onDelete={removeTask} onSubtasksChange={(updated) => setTasks((previous) => previous.map((item) => item.id === updated.id ? updated : item))} />)}</div>}
            </section>

            <div className="project-delete-row">
              {confirmDelete && <span>Tasks and steps will stay in Tasks without a project.</span>}
              {confirmDelete && <button type="button" className="btn-secondary" onClick={() => setConfirmDelete(false)} disabled={saving}>Cancel</button>}
              <button type="button" className={`project-delete-button${confirmDelete ? ' confirm' : ''}`} onClick={deleteProject} disabled={saving}><Trash2 size={14} aria-hidden="true" /> {confirmDelete ? 'Confirm delete project' : 'Delete project'}</button>
            </div>
          </div>}
        </div>
      )}
    </div>
  );
}
