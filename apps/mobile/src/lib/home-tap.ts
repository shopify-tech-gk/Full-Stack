// v1.17 Tapping the YouMart logo while already on Home (Instagram-style): the header tells the Home
// screen, which scrolls back to the top - or, if it is already at the top, reloads.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onHomeLogoTap(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitHomeLogoTap(): void {
  for (const listener of listeners) listener();
}

// Arriving on Home from another tab via the logo: Home plays a short entrance once.
let logoArrival = false;

export function markLogoArrival(): void {
  logoArrival = true;
}

/** True once after markLogoArrival(). */
export function consumeLogoArrival(): boolean {
  const was = logoArrival;
  logoArrival = false;
  return was;
}
