import { useEffect, useState } from 'react';

export function useCompletionFlash() {
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = setTimeout(() => setFlash(0), 850);
    return () => clearTimeout(timer);
  }, [flash]);

  return [flash, () => setFlash((value) => value + 1)];
}
