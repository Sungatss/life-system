import { useEffect, useRef } from 'react';
import { createAsciiInkRenderer } from '../utils/asciiInkRenderer';

export default function AsciiBackground({ paused = false }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    const renderer = createAsciiInkRenderer(canvasRef.current);
    rendererRef.current = renderer;
    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setPaused(paused);
  }, [paused]);

  return <canvas ref={canvasRef} className="ascii-background" aria-hidden="true" />;
}
