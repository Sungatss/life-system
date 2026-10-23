import { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Moon, Sparkles, Utensils, X } from 'lucide-react';
import './CatPet.css';

const STORE_KEY = 'life-system-miso-pet-v1';
const WALK_TIME = 2700;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const pagePhrases = {
  today: 'A little progress today is enough for me to purr.',
  inbox: 'Let’s sort one thought at a time.',
  tasks: 'Pick one task. I’ll keep the others company.',
  projects: 'Big ideas grow from small, steady steps.',
  goals: 'Your next step is a lovely place to start.',
  calendar: 'There is room to breathe between plans.',
  finance: 'A thoughtful plan is worth sleeping on.',
  habits: 'Tiny repeats make strong roots.',
  profile: 'Look how far your little pawprints have come.',
};
const thoughts = [
  'One small step still counts. 🐾',
  'You may rest. Your plans will be here later.',
  'Progress can be quiet. I still see it.',
  'A fresh start fits into any moment.',
  'You don’t have to finish everything today.',
  'Drink some water, human. I’ll guard the list.',
];

function readPetStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && Number.isFinite(saved.energy) && Number.isFinite(saved.bond)) {
      const elapsed = Math.max(0, Date.now() - (Number(saved.updatedAt) || Date.now()));
      return {
        energy: clamp(Math.round(saved.energy + elapsed / (6 * 60 * 1000)), 0, 100),
        bond: clamp(Math.round(saved.bond), 0, 100),
        treats: clamp(Math.round(Number(saved.treats) || 0), 0, 9999),
      };
    }
  } catch { /* Miso can start fresh if device storage is unavailable. */ }
  return { energy: 78, bond: 10, treats: 0 };
}

function CatArt({ mode, facing }) {
  const resting = mode === 'idle' || mode === 'sleeping';
  return <span className="cat-pet-sprite" style={{ '--pet-facing': facing }} aria-hidden="true">
    <img
      className="cat-pet-art"
      src={resting ? '/miso-pixel-sleeping.png' : '/miso-pixel-awake.png'}
      alt=""
      draggable="false"
    />
    {mode === 'happy' && <span className="cat-pet-effect cat-pet-heart">♥</span>}
    {mode === 'sleeping' && <span className="cat-pet-effect cat-pet-dream">z z</span>}
    {mode === 'playing' && <span className="cat-pet-effect cat-pet-toy">●</span>}
  </span>;
}

function Meter({ label, value }) {
  return <div className="cat-pet-meter"><div><span>{label}</span><strong>{value}%</strong></div><div className="cat-pet-track" role="progressbar" aria-label={`Miso ${label.toLowerCase()}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span style={{ width: `${value}%` }} /></div></div>;
}

export default function CatPet({ activeTab, paused = false, sidebarExpanded = false }) {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [tabHidden, setTabHidden] = useState(() => document.hidden);
  const [x, setX] = useState(() => Math.max(72, window.innerWidth - 160));
  const [facing, setFacing] = useState(1);
  const [mode, setMode] = useState('idle');
  const [panelOpen, setPanelOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [thoughtIndex, setThoughtIndex] = useState(0);
  const [stats, setStats] = useState(readPetStats);
  const animalRef = useRef(null);

  const rail = viewportWidth <= 900 ? 56 : sidebarExpanded ? 220 : 68;
  const maxX = Math.max(8, viewportWidth - 122);
  const minX = Math.min(rail + 8, maxX);
  const displayX = clamp(x, minX, maxX);
  const panelWidth = Math.min(300, Math.max(0, viewportWidth - rail - 16));
  const panelLeft = clamp(displayX - 92, minX, Math.max(minX, viewportWidth - panelWidth - 8));
  const status = mode === 'sleeping' ? 'Napping' : mode === 'walking' ? 'Exploring' : mode === 'playing' ? 'Playing'
    : mode === 'eating' ? 'Snacking' : mode === 'happy' ? 'Purring' : stats.energy < 30 ? 'Sleepy' : 'Feeling cozy';

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => setReducedMotion(motion.matches);
    const onVisibility = () => {
      setTabHidden(document.hidden);
      if (!document.hidden) setMode((current) => current === 'walking' ? 'idle' : current);
    };
    window.addEventListener('resize', onResize);
    motion.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('resize', onResize);
      motion.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...stats, updatedAt: Date.now() })); }
    catch { /* The pet still works for this visit without storage. */ }
  }, [stats]);

  useEffect(() => {
    if (!panelOpen) return undefined;
    const onEscape = (event) => {
      if (event.key === 'Escape') { setPanelOpen(false); setMessage(''); animalRef.current?.focus(); }
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [panelOpen]);

  useEffect(() => {
    if (tabHidden || paused) return undefined;
    let timer;
    if (mode === 'walking') timer = window.setTimeout(() => setMode('idle'), WALK_TIME);
    else if (mode === 'sleeping') timer = window.setTimeout(() => {
      setStats((current) => ({ ...current, energy: clamp(current.energy + 22, 0, 100) }));
      setMode('stretching');
    }, 8500);
    else if (mode !== 'idle') timer = window.setTimeout(() => setMode('idle'), mode === 'playing' ? 2600 : 1900);
    else if (!panelOpen && !reducedMotion) timer = window.setTimeout(() => {
      const choice = Math.random();
      if (stats.energy < 25 || choice < .13) { setMode('sleeping'); return; }
      if (choice < .29) { setMode('stretching'); return; }
      const distance = Math.min(maxX - minX, 90 + Math.random() * 140);
      const direction = displayX > maxX - 55 ? -1 : displayX < minX + 55 ? 1 : Math.random() < .5 ? -1 : 1;
      const target = clamp(displayX + direction * distance, minX, maxX);
      setFacing(target >= displayX ? 1 : -1);
      setX(target);
      setStats((current) => ({ ...current, energy: clamp(current.energy - 3, 0, 100) }));
      setMode('walking');
    }, 3800 + Math.random() * 3000);
    return () => window.clearTimeout(timer);
  }, [mode, panelOpen, reducedMotion, tabHidden, paused, minX, maxX, displayX, stats.energy]);

  const stopAndOpen = () => {
    setX(clamp(animalRef.current?.getBoundingClientRect().left ?? displayX, minX, maxX));
    setPanelOpen(true);
  };
  const pet = () => {
    stopAndOpen();
    setMode('happy');
    setMessage(panelOpen ? 'Purrr… I like being here with you.' : '');
    setStats((current) => ({ ...current, bond: clamp(current.bond + 2, 0, 100) }));
  };
  const feed = () => {
    stopAndOpen();
    setMode('eating');
    setMessage('Crunch, crunch. Thank you for the treat!');
    setStats((current) => ({ energy: clamp(current.energy + 8, 0, 100), bond: clamp(current.bond + 3, 0, 100), treats: current.treats + 1 }));
  };
  const play = () => {
    if (stats.energy < 10) return;
    stopAndOpen();
    setMode('playing');
    setMessage('Catch the little ball with me!');
    setStats((current) => ({ ...current, energy: clamp(current.energy - 10, 0, 100), bond: clamp(current.bond + 4, 0, 100) }));
  };
  const nap = () => {
    stopAndOpen();
    setMode('sleeping');
    setMessage('A little nap, then we explore again.');
  };
  const thought = () => {
    stopAndOpen();
    setMode('curious');
    setMessage(thoughts[thoughtIndex % thoughts.length]);
    setThoughtIndex((index) => index + 1);
  };

  return <div className={`cat-pet-world is-${mode}${panelOpen ? ' is-open' : ''}${paused ? ' is-paused' : ''}`} style={{ '--pet-rail': `${rail}px` }}>
    <div className="cat-pet-home" style={{ left: `${displayX}px` }}>
      {panelOpen && <aside className="cat-pet-panel" id="cat-pet-panel" aria-label="Miso's home" style={{ left: `${panelLeft - displayX}px` }}>
        <div className="cat-pet-panel-head"><div><strong>Miso</strong><span>{status}</span></div><button type="button" onClick={() => { setPanelOpen(false); setMessage(''); animalRef.current?.focus(); }} aria-label="Close Miso's home"><X size={17} aria-hidden="true" /></button></div>
        <p className="cat-pet-message" aria-live="polite">{message || pagePhrases[activeTab] || pagePhrases.today}</p>
        <div className="cat-pet-meters"><Meter label="Energy" value={stats.energy} /><Meter label="Bond" value={stats.bond} /></div>
        <div className="cat-pet-actions">
          <button type="button" onClick={pet}><Heart size={16} aria-hidden="true" /> Pet</button>
          <button type="button" onClick={feed}><Utensils size={16} aria-hidden="true" /> Treat</button>
          <button type="button" onClick={play} disabled={stats.energy < 10} title={stats.energy < 10 ? 'Miso needs a nap first' : undefined}><Sparkles size={16} aria-hidden="true" /> Play</button>
          <button type="button" onClick={nap}><Moon size={16} aria-hidden="true" /> Nap</button>
          <button type="button" className="cat-pet-thought" onClick={thought}><MessageCircle size={16} aria-hidden="true" /> Hear a thought</button>
        </div>
        <small>{stats.treats} {stats.treats === 1 ? 'treat' : 'treats'} shared · saved on this device</small>
      </aside>}
      <button type="button" className="cat-pet-animal" ref={animalRef} onClick={pet} aria-label={panelOpen ? 'Pet Miso the cat' : 'Pet Miso the cat and open her home'} aria-expanded={panelOpen} aria-controls={panelOpen ? 'cat-pet-panel' : undefined} title="Pet Miso">
        <CatArt mode={mode} facing={facing} />
      </button>
    </div>
  </div>;
}
