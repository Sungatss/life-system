import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsciiInkRenderer } from './asciiInkRenderer.js';

function fixture({ reducedMotion = false, width = 390, height = 844 } = {}) {
  const events = () => ({
    listeners: new Map(),
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    removeEventListener(type, listener) { if (this.listeners.get(type) === listener) this.listeners.delete(type); },
    emit(type) { this.listeners.get(type)?.(); },
  });
  const pending = new Map();
  const glyphs = [];
  const context = {
    fillRect() {}, setTransform() {},
    fillText(...args) { glyphs.push(args); },
  };
  const sample = { width: 0, height: 0 };
  sample.getContext = () => ({
    clearRect() {}, drawImage() {},
    getImageData: () => ({ data: new Uint8ClampedArray(sample.width * sample.height * 4).fill(255) }),
  });
  const motion = Object.assign(events(), { matches: reducedMotion });
  let nextId = 0;
  let image;
  const win = Object.assign(events(), {
    innerWidth: width, innerHeight: height, devicePixelRatio: 2,
    matchMedia: () => motion,
    Image: class { constructor() { image = this; this.naturalWidth = 900; this.naturalHeight = 1200; } },
    requestAnimationFrame: (callback) => { const id = ++nextId; pending.set(id, callback); return id; },
    cancelAnimationFrame: (id) => pending.delete(id),
  });
  const doc = Object.assign(events(), { defaultView: win, hidden: false, createElement: () => sample });
  const canvas = { ownerDocument: doc, getContext: () => context };
  const renderer = createAsciiInkRenderer(canvas);
  const step = (time) => {
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach((callback) => callback(time));
  };
  return { renderer, canvas, image, pending, glyphs, step, win, doc, motion, sample };
}

test('draws actual ASCII and animates at a bounded rate after the local artwork loads', () => {
  const f = fixture();
  assert.equal(f.pending.size, 0);
  f.image.onload();
  assert.ok(f.glyphs.length > 0);
  assert.ok(f.glyphs.every(([glyph]) => '.,:;=+*#%@'.includes(glyph)));
  assert.equal(f.pending.size, 1);
  const initialCount = f.glyphs.length;
  const initialPoint = f.glyphs[0];
  f.step(0);
  f.step(16);
  assert.equal(f.glyphs.length, initialCount, 'skip rendering between 12 fps frames');
  f.step(100);
  assert.ok(f.glyphs.length > initialCount);
  assert.notDeepEqual(f.glyphs[initialCount], initialPoint, 'the ASCII drawing drifts over time');
  f.renderer.destroy();
});

test('pause, page visibility, and live reduced-motion changes stop and resume rendering', () => {
  const f = fixture();
  f.renderer.setPaused(true);
  f.image.onload();
  assert.ok(f.glyphs.length > 0, 'paused themes still show a static drawing');
  assert.equal(f.pending.size, 0);
  f.renderer.setPaused(false);
  assert.equal(f.pending.size, 1);
  f.doc.hidden = true;
  f.doc.emit('visibilitychange');
  assert.equal(f.pending.size, 0);
  const count = f.glyphs.length;
  f.step(1000);
  assert.equal(f.glyphs.length, count);
  f.doc.hidden = false;
  f.doc.emit('visibilitychange');
  assert.equal(f.pending.size, 1);
  f.motion.matches = true;
  f.motion.emit('change');
  assert.equal(f.pending.size, 0);
  f.renderer.setPaused(false);
  assert.equal(f.pending.size, 0, 'the play control cannot override reduced motion');
  f.motion.matches = false;
  f.motion.emit('change');
  assert.equal(f.pending.size, 1);
  f.renderer.destroy();
});

test('initial reduced motion renders a static frame; resizing bounds high-resolution work', () => {
  const f = fixture({ reducedMotion: true, width: 5120, height: 2880 });
  f.image.onload();
  assert.ok(f.glyphs.length > 0);
  assert.equal(f.pending.size, 0);
  assert.ok(f.sample.width <= 240 && f.sample.height <= 107);
  assert.equal(f.canvas.width, 7680, 'cap backing scale at 1.5 even on retina displays');
  f.win.innerWidth = 320;
  f.win.innerHeight = 640;
  f.win.emit('resize');
  assert.equal(f.canvas.width, 480);
  assert.equal(f.pending.size, 0);
  f.renderer.destroy();
});

test('unmounting cancels the frame and removes all listeners, including before decode', () => {
  for (const loadFirst of [false, true]) {
    const f = fixture();
    const onload = f.image.onload;
    if (loadFirst) onload();
    f.renderer.destroy();
    assert.equal(f.pending.size, 0);
    assert.equal(f.win.listeners.size + f.doc.listeners.size + f.motion.listeners.size, 0);
    assert.equal(f.image.onload, null);
    onload();
    f.renderer.setPaused(false);
    assert.equal(f.pending.size, 0, 'late decode cannot restart an unmounted background');
  }
});
