import { useEffect, useRef, useId } from 'react';

export function ExperienceDialog({ title, children, onClose, className = '' }) {
  const ref = useRef(null), titleId = useId();
  useEffect(() => {
    const previous = document.activeElement, dialog = ref.current; dialog.showModal();
    return () => { dialog.close(); previous?.focus?.({ preventScroll: true }); };
  }, []);
  return <dialog className={`experience-dialog ${className}`} ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose?.(); }}>
    {onClose && <button className="experience-close" onClick={onClose} aria-label="Close dialog">×</button>}
    <span className="experience-eyebrow">LITTLE CITY / WORLD TOUR</span><h2 id={titleId}>{title}</h2>{children}
  </dialog>;
}
