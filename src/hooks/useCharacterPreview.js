import { useEffect, useRef, useState } from 'react';
import { mountCharacterPreview } from '../scenes/worldTour/characterPreview.js';

// Mounts the creator's 3D turntable and keeps it in sync with the draft appearance.
export function useCharacterPreview(appearance) {
  const host = useRef(null), preview = useRef(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    try { preview.current = mountCharacterPreview(host.current, () => setFailed(true)); }
    catch (error) { console.error('Character preview could not start', error); setFailed(true); }
    return () => { preview.current?.dispose(); preview.current = null; };
  }, []);
  useEffect(() => { preview.current?.update(appearance); }, [appearance]);
  return { host, failed };
}
