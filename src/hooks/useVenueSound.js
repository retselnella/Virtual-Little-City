import { useEffect, useRef } from 'react';

// What you hear at the lounge: walking in starts your music (a playlist named "Lounge" if the site has one) if it was
// not already playing, and walking out stops what the lounge started.
export function useVenueSound(venue, music) {
  const started = useRef(false);
  useEffect(() => {
    if (venue === 'lounge' && !started.current && music.status === 'ready') started.current = music.startFor('lounge');
    if (venue !== 'lounge' && started.current) { started.current = false; music.hold(); }
  }, [venue, music.status]);
}
