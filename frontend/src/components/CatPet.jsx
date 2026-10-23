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
  return <svg className="cat-pet-art" style={{ '--pet-facing': facing }} viewBox="0 0 170 122" fill="none" aria-hidden="true">
    <ellipse className="pet-ground" cx="86" cy="113" rx="62" ry="5" fill="#070b0a" opacity=".24" />
    <path className="pet-tail" d="M41 75C18 80 8 63 16 49c5-9 16-10 21-3" stroke="#b5b8aa" strokeWidth="13" strokeLinecap="round" />
    <g className="pet-legs-back">
      <path d="M56 78c-5 8-8 18-6 28h17l7-22" fill="#aab09f" stroke="#46514d" strokeWidth="2.5" />
      <ellipse cx="57" cy="107" rx="12" ry="5" fill="#d6d5c8" stroke="#46514d" strokeWidth="2" />
    </g>
    <g className="pet-body">
      <ellipse cx="83" cy="72" rx="52" ry="28" fill="#c9cabc" stroke="#46514d" strokeWidth="3" />
      <path d="M65 87c17 9 34 8 52-1" stroke="#e8e5d8" strokeWidth="12" strokeLinecap="round" />
      <path d="m55 51 7 10m13-15 4 12m13-12-1 11" stroke="#969e90" strokeWidth="4" strokeLinecap="round" />
    </g>
    <g className="pet-legs-front">
      <path d="M111 80c-1 8-1 17 2 27h17l-2-27" fill="#c9cabc" stroke="#46514d" strokeWidth="2.5" />
      <ellipse cx="122" cy="107" rx="13" ry="5" fill="#e8e5d8" stroke="#46514d" strokeWidth="2" />
    </g>
    <g className="pet-head">
      <path d="m106 49-1-25c0-3 3-4 5-2l14 12c5-1 10-1 15 0l14-12c2-2 5-1 5 2l-1 25c5 6 7 13 5 21-3 15-17 25-34 25-20 0-35-13-35-30 0-7 4-13 13-16Z" fill="#d7d8ca" stroke="#46514d" strokeWidth="3" strokeLinejoin="round" />
      <path d="m111 29 1 15 10-9-11-6Zm40 0-11 6 10 9 1-15Z" fill="#c49398" />
      <ellipse cx="114" cy="72" rx="14" ry="10" fill="#e9e6d8" />
      <ellipse cx="146" cy="72" rx="14" ry="10" fill="#e9e6d8" />
      <g className="pet-eyes" fill="#34413d"><ellipse cx="118" cy="59" rx="3" ry="4" /><ellipse cx="143" cy="59" rx="3" ry="4" /></g>
      <g className="pet-sleep-eyes" stroke="#46514d" strokeWidth="2.5" strokeLinecap="round"><path d="m113 60 5 3 5-3m15 0 5 3 5-3" /></g>
      <path d="m125 71 5 4 5-4c-2-2-8-2-10 0Z" fill="#be8c91" />
      <path d="M130 75v4m0 0c-3 3-6 3-8 0m8 0c3 3 6 3 8 0m-35-8-15-3m15 8-15 2m66-7 15-3m-15 8 15 2" stroke="#5b6660" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M104 84c9 8 38 11 51-1" stroke="#879e90" strokeWidth="4" strokeLinecap="round" />
      <circle cx="129" cy="90" r="3.5" fill="#e2bd8a" />
    </g>
    {mode === 'playing' && <g className="pet-toy"><circle cx="27" cy="100" r="10" fill="#d6ab83" stroke="#715848" strokeWidth="2" /><path d="m20 94 14 12m-14 0 14-12" stroke="#f3dcc7" strokeWidth="2" /></g>}
    {mode === 'happy' && <text className="pet-heart" x="130" y="25" fill="#e3a9ad" fontSize="21">♥</text>}
    {mode === 'sleeping' && <g className="pet-dream" fill="#a8bcb0"><circle cx="111" cy="27" r="2.5" /><circle cx="122" cy="18" r="4" /><circle cx="136" cy="8" r="5.5" /></g>}
    {mode === 'eating' && <g className="pet-snack"><ellipse cx="149" cy="105" rx="14" ry="5" fill="#8f9d8e" stroke="#46514d" strokeWidth="2" /><circle cx="146" cy="101" r="3" fill="#d3a674" /><circle cx="153" cy="101" r="3" fill="#d3a674" /></g>}
  </svg>;
}

function Meter({ label, value }) {
  return <div className="cat-pet-meter"><div><span>{label}</span><strong>{value}%</strong></div><div className="cat-pet-track" role="progressbar" aria-label={`Miso ${label.toLowerCase()}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span style={{ width: `${value}%` }} /></div></div>;
}

export default function CatPet({ activeTab, paused = false, sidebarExpanded = false }) {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [tabHidden, setTabHidden] = useState(() => document.hidden);
  const [x, setX] = useState(() => Math.max(72, window.innerWidth - 210));
  const [facing, setFacing] = useState(1);
  const [mode, setMode] = useState('idle');
  const [panelOpen, setPanelOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [thoughtIndex, setThoughtIndex] = useState(0);
  const [stats, setStats] = useState(readPetStats);
  const animalRef = useRef(null);

  const rail = viewportWidth <= 900 ? 56 : sidebarExpanded ? 220 : 68;
  const maxX = Math.max(8, viewportWidth - 154);
  const minX = Math.min(rail + 8, maxX);
  const displayX = clamp(x, minX, maxX);
  const panelWidth = Math.min(300, Math.max(0, viewportWidth - rail - 16));
  const panelLeft = clamp(displayX - 72, minX, Math.max(minX, viewportWidth - panelWidth - 8));
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
