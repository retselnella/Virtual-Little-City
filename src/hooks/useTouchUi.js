import { useEffect, useState } from 'react';

// Touch controls (joystick, fire button, collapsible cards) on phones and tablets: any device whose main pointer is a
// finger. `?touch=1` or `?touch=0` in the address forces them on or off (handy on a touch laptop).
const QUERY = '(pointer: coarse)';
function forced() {
  const value = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('touch');
  return value === '1' ? true : value === '0' ? false : null;
}
export function useTouchUi() {
  const media = typeof matchMedia === 'function' ? matchMedia(QUERY) : null;
  const [touch, setTouch] = useState(() => forced() ?? !!media?.matches);
  useEffect(() => {
    if (!media || forced() !== null) return;
    const change = () => setTouch(media.matches);
    media.addEventListener?.('change', change);
    return () => media.removeEventListener?.('change', change);
  }, []);
  return touch;
}
