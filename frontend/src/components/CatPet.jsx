import { useEffect, useRef, useState } from 'react';
import './CatPet.css';

const POSITION_KEY = 'life-system-yuki-position-v1';
const CAT_WIDTH = 116;
const CAT_HEIGHT = 78;
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
const reactions = ['happy', 'curious', 'playing', 'sleeping', 'stretching'];

function readPosition() {
  const fallback = { x: Math.max(72, window.innerWidth - 160), y: Math.max(8, window.innerHeight - CAT_HEIGHT - 8) };
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null');
    return Number.isFinite(saved?.x) && Number.isFinite(saved?.y) ? saved : fallback;
  } catch { return fallback; }
}

function CatArt({ mode, facing }) {
  return <span className="cat-pet-sprite" style={{ '--pet-facing': facing }} aria-hidden="true">
    <span className="cat-pet-motion">
      {mode === 'sleeping' ? <img className="cat-pet-art" src="/yuki-pixel-sleeping.png" alt="" draggable="false" /> : <>
        <img className="cat-pet-art cat-pet-art-base" src="/yuki-pixel-awake.png" alt="" draggable="false" />
        {mode === 'walking' && <img className="cat-pet-art cat-pet-art-step" src="/yuki-pixel-step.png" alt="" draggable="false" />}
      </>}
      {mode === 'happy' && <span className="cat-pet-effect cat-pet-heart">♥</span>}
      {mode === 'sleeping' && <span className="cat-pet-effect cat-pet-dream">z z</span>}
      {mode === 'playing' && <span className="cat-pet-effect cat-pet-toy">✦</span>}
      {mode === 'curious' && <span className="cat-pet-effect cat-pet-curious">?</span>}
    </span>
  </span>;
}

export default function CatPet({ activeTab, paused = false, sidebarExpanded = false }) {
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [tabHidden, setTabHidden] = useState(() => document.hidden);
  const [position, setPosition] = useState(readPosition);
  const [facing, setFacing] = useState(1);
  const [mode, setMode] = useState('sleeping');
  const [walkDuration, setWalkDuration] = useState(1800);
  const [bubble, setBubble] = useState(null);
  const [pressed, setPressed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const homeRef = useRef(null);
  const pointerRef = useRef(null);
  const homeAnchorRef = useRef(position);
  const touchCountRef = useRef(0);
  const messageIdRef = useRef(0);
  const lastPointerUpRef = useRef(0);

  const rail = viewport.width <= 900 ? 56 : sidebarExpanded ? 220 : 68;
  const maxX = Math.max(8, viewport.width - CAT_WIDTH - 8);
  const minX = Math.min(rail + 8, maxX);
  const maxY = Math.max(8, viewport.height - CAT_HEIGHT - 8);
  const minY = Math.min(48, maxY);
  const displayX = clamp(position.x, minX, maxX);
  const displayY = clamp(position.y, minY, maxY);
  const bubbleWidth = Math.min(240, Math.max(0, viewport.width - rail - 16));
  const bubbleLeft = clamp(displayX + CAT_WIDTH / 2 - bubbleWidth / 2, minX, Math.max(minX, viewport.width - bubbleWidth - 8));
  const tailLeft = clamp(displayX + CAT_WIDTH / 2 - bubbleLeft, 16, Math.max(16, bubbleWidth - 16));
  const bubbleBelow = displayY < 145;

  const showBubble = (text) => {
    messageIdRef.current += 1;
    setBubble({ id: messageIdRef.current, text });
  };
  const savePosition = (next) => {
    homeAnchorRef.current = next;
    try { localStorage.setItem(POSITION_KEY, JSON.stringify(next)); }
    catch { /* Dragging still works if device storage is unavailable. */ }
  };
  const reactToPet = () => {
    const index = touchCountRef.current;
    touchCountRef.current += 1;
    setMode(reactions[index % reactions.length]);
    showBubble(index % 4 === 0 ? pagePhrases[activeTab] || pagePhrases.today : thoughts[(index - 1) % thoughts.length]);
  };

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
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
    if (!bubble) return undefined;
    const timer = window.setTimeout(() => setBubble(null), 5200);
    return () => window.clearTimeout(timer);
  }, [bubble]);

  useEffect(() => {
    if (tabHidden || paused || pressed || dragging) return undefined;
    let timer;
    if (mode === 'walking') timer = window.setTimeout(() => setMode('idle'), walkDuration);
    else if (mode === 'sleeping') timer = window.setTimeout(() => setMode('stretching'), 6200 + Math.random() * 2600);
    else if (mode !== 'idle') timer = window.setTimeout(() => setMode('idle'), mode === 'playing' ? 1900 : 1400);
    else if (!reducedMotion && !bubble) timer = window.setTimeout(() => {
      const choice = Math.random();
      if (choice < .16) { setMode('sleeping'); return; }
      if (choice < .28) { setMode('stretching'); return; }
      const anchor = clamp(homeAnchorRef.current.x, minX, maxX);
      const roamMin = Math.max(minX, anchor - 170);
      const roamMax = Math.min(maxX, anchor + 170);
      const direction = displayX > roamMax - 35 ? -1 : displayX < roamMin + 35 ? 1 : Math.random() < .5 ? -1 : 1;
      const target = clamp(displayX + direction * (45 + Math.random() * 105), roamMin, roamMax);
      const distance = Math.abs(target - displayX);
      if (distance < 16) { setMode('curious'); return; }
      setFacing(target < displayX ? 1 : -1);
      setWalkDuration(clamp(Math.round(distance / (48 + Math.random() * 25) * 1000), 700, 3000));
      setPosition((current) => ({ ...current, x: target }));
      setMode('walking');
    }, 2800 + Math.random() * 4300);
    return () => window.clearTimeout(timer);
  }, [mode, walkDuration, tabHidden, paused, pressed, dragging, reducedMotion, bubble, displayX, minX, maxX]);

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    const rect = homeRef.current?.getBoundingClientRect();
    const origin = { x: clamp(rect?.left ?? displayX, minX, maxX), y: clamp(rect?.top ?? displayY, minY, maxY) };
    pointerRef.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastClientX: event.clientX, origin, lastPosition: origin, moved: false };
    setPosition(origin);
    setMode('idle');
    setPressed(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    if (!pointer.moved && Math.hypot(dx, dy) < 7) return;
    if (!pointer.moved) {
      pointer.moved = true;
      setDragging(true);
      setMode('carried');
      setBubble(null);
    }
    const next = { x: clamp(pointer.origin.x + dx, minX, maxX), y: clamp(pointer.origin.y + dy, minY, maxY) };
    if (Math.abs(event.clientX - pointer.lastClientX) > 2) setFacing(event.clientX < pointer.lastClientX ? 1 : -1);
    pointer.lastClientX = event.clientX;
    pointer.lastPosition = next;
    setPosition(next);
  };
  const handlePointerUp = (event) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    pointerRef.current = null;
    lastPointerUpRef.current = Date.now();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setPressed(false);
    setDragging(false);
    if (pointer.moved) {
      setPosition(pointer.lastPosition);
      savePosition(pointer.lastPosition);
      setMode('happy');
      showBubble('I like this spot. Thank you! 🐾');
    } else reactToPet();
  };
  const handlePointerCancel = (event) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    pointerRef.current = null;
    setPressed(false);
    setDragging(false);
    setMode('idle');
    if (pointer.moved) savePosition(pointer.lastPosition);
  };
  const handleKeyDown = (event) => {
    const step = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = { x: clamp(displayX + step[0], minX, maxX), y: clamp(displayY + step[1], minY, maxY) };
    setPosition(next);
    savePosition(next);
    setMode('idle');
    setBubble(null);
    if (step[0]) setFacing(step[0] < 0 ? 1 : -1);
  };

  return <div className={`cat-pet-world is-${mode}${dragging ? ' is-dragging' : ''}${bubbleBelow ? ' is-below' : ''}${paused ? ' is-paused' : ''}`}>
    <div className="cat-pet-home" ref={homeRef} style={{ left: `${displayX}px`, top: `${displayY}px`, '--walk-duration': `${walkDuration}ms` }}>
      {bubble && <div className="cat-pet-bubble" role="status" style={{ left: `${bubbleLeft - displayX}px`, width: `${bubbleWidth}px`, '--bubble-tail-left': `${tailLeft}px` }}>
        <span className="cat-pet-bubble-name">Yuki</span>
        <span>{bubble.text}</span>
      </div>}
      <button type="button" className="cat-pet-animal" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel} onKeyDown={handleKeyDown} onClick={(event) => { if (event.detail === 0 && Date.now() - lastPointerUpRef.current > 500) reactToPet(); }} aria-label="Pet Yuki. Drag to move her, or use arrow keys." title="Pet Yuki · drag to move">
        <CatArt mode={mode} facing={facing} />
      </button>
    </div>
  </div>;
}
