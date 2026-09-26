import { useEffect, useRef } from 'react';

// What you hear at the venues: walking into the lounge starts your music (a playlist named "Lounge" if the site has
// one) if it was not already playing, and walking out stops what the lounge started. At the cinema, your music pauses
// while a film is on and comes back when you leave.
export function useVenueSound(venue, music, cinemaLive) {
  const started = useRef(false), held = useRef(false);
  useEffect(() => {
    if (venue === 'lounge' && !started.current && music.status === 'ready') started.current = music.startFor('lounge');
    if (venue !== 'lounge' && started.current) { started.current = false; music.hold(); }
  }, [venue, music.status]);
  useEffect(() => {
    const quiet = venue === 'cinema' && cinemaLive;
    if (quiet && !held.current) held.current = music.hold();
    if (!quiet && held.current) { held.current = false; music.release(); }
  }, [venue, cinemaLive]);
}
