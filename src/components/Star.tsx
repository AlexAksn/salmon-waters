/** Star toggle for "My rivers". Stops the click so a star on a card does not also open the card. */
export default function Star({ on, onToggle, big }: { on: boolean; onToggle: () => void; big?: boolean }) {
  return (
    <button className={`star${big ? ' big' : ''}`} aria-pressed={on} aria-label={on ? 'Remove from my rivers' : 'Add to my rivers'} title={on ? 'In my rivers' : 'Add to my rivers'}
      onClick={(e) => { e.stopPropagation(); onToggle(); }} onKeyDown={(e) => e.stopPropagation()}>{on ? '★' : '☆'}</button>
  );
}
