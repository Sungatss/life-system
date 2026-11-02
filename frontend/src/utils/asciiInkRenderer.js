// Rasterize the local ink drawing once per resize, then animate only ASCII glyphs.
// No external media, React frame updates, or animation while the tab is hidden.
const GLYPHS = ' .,:;=+*#%@';
const FRAME_INTERVAL = 1000 / 12;

export function createAsciiInkRenderer(canvas) {
  const doc = canvas.ownerDocument;
  const win = doc.defaultView;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return { setPaused() {}, destroy() {} };

  const sample = doc.createElement('canvas');
  const sampleContext = sample.getContext('2d', { willReadFrequently: true });
  if (!sampleContext) return { setPaused() {}, destroy() {} };

  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const image = new win.Image();
  let points = [];
  let width = 0;
  let height = 0;
  let cellWidth = 7;
  let cellHeight = 11;
  let frame = null;
  let lastFrame = null;
  let elapsed = 0;
  let paused = false;
  let destroyed = false;
  let ready = false;

  const draw = () => {
    context.fillStyle = '#050505';
    context.fillRect(0, 0, width, height);
    context.font = `${cellHeight}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    context.textBaseline = 'top';
    context.fillStyle = '#e8e8e8';
    const time = elapsed / 1000;
    const driftX = Math.sin(time * 0.17) * cellWidth * 0.65;
    const driftY = Math.sin(time * 0.12) * cellHeight * 0.45;

    for (const point of points) {
      // A slow light band moves over the crosshatching; avoid random flashing.
      const wave = Math.sin(point.y * 0.012 - time * 0.48 + point.x * 0.003);
      const ink = Math.min(1, point.light * (0.9 + wave * 0.1));
      const glyph = GLYPHS[Math.max(1, Math.floor(ink * (GLYPHS.length - 1)))];
      context.globalAlpha = (0.14 + ink * 0.61) * point.fade;
      context.fillText(glyph, point.x + driftX, point.y + driftY);
    }
    context.globalAlpha = 1;
  };

  const tick = (now) => {
    if (destroyed) return;
    if (lastFrame === null) lastFrame = now;
    const delta = now - lastFrame;
    if (delta >= FRAME_INTERVAL) {
      elapsed += Math.min(delta, 200);
      lastFrame = now;
      draw();
    }
    frame = win.requestAnimationFrame(tick);
  };

  const syncPlayback = () => {
    if (destroyed) return;
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
    lastFrame = null;
    if (!ready || doc.hidden) return;
    draw();
    if (!paused && !motion.matches) frame = win.requestAnimationFrame(tick);
  };

  const resize = () => {
    if (destroyed) return;
    width = Math.max(1, win.innerWidth);
    height = Math.max(1, win.innerHeight);
    // Bound both sampling and fillText work, including on ultrawide displays.
    cellWidth = Math.max(width < 600 ? 6 : 7, width / 240, height / 170);
    cellHeight = cellWidth * 1.6;
    const ratio = Math.min(win.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    points = [];

    if (ready) {
      sample.width = Math.ceil(width / cellWidth);
      sample.height = Math.ceil(height / cellHeight);
      // Keep the katana to the right, with the reference's black negative space.
      const artHeight = Math.max(height * 1.15, Math.min(width * 0.85, 1100));
      const artWidth = artHeight * image.naturalWidth / image.naturalHeight;
      const left = width - artWidth * 0.88;
      const top = (height - artHeight) * 0.35;
      sampleContext.clearRect(0, 0, sample.width, sample.height);
      sampleContext.drawImage(image, left / cellWidth, top / cellHeight, artWidth / cellWidth, artHeight / cellHeight);
      const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
      for (let row = 0; row < sample.height; row += 1) {
        for (let col = 0; col < sample.width; col += 1) {
          const index = (row * sample.width + col) * 4;
          const light = pixels[index] / 255 * pixels[index + 3] / 255;
          if (light < 0.035) continue;
          const x = col * cellWidth;
          const fade = Math.min(1, Math.max(0, (x / width - 0.16) / 0.4));
          if (fade > 0) points.push({ x, y: row * cellHeight, light, fade });
        }
      }
    }
    syncPlayback();
  };

  image.onload = () => {
    if (destroyed) return;
    ready = true;
    resize();
  };
  image.onerror = () => { if (!destroyed) draw(); };
  image.src = '/art/ascii-katana.svg';
  win.addEventListener('resize', resize);
  doc.addEventListener('visibilitychange', syncPlayback);
  motion.addEventListener('change', syncPlayback);
  resize();

  return {
    setPaused(value) { paused = value; syncPlayback(); },
    destroy() {
      destroyed = true;
      if (frame !== null) win.cancelAnimationFrame(frame);
      win.removeEventListener('resize', resize);
      doc.removeEventListener('visibilitychange', syncPlayback);
      motion.removeEventListener('change', syncPlayback);
      image.onload = null;
      image.onerror = null;
    },
  };
}
