import { at } from "./lib/util.js";
import { act1 } from "./shots/act1.js";
import { act2 } from "./shots/act2.js";
import { act3 } from "./shots/act3.js";
import { act4, END } from "./shots/act4.js";

export const DURATION = END;

export function buildTimeline() {
  const shots = [...act1, ...act2, ...act3, ...act4];
  shots.sort((x, y) => x.start - y.start);
  // sanity: contiguous, non-overlapping
  for (let i = 1; i < shots.length; i++) {
    const g = shots[i].start - shots[i - 1].end;
    if (Math.abs(g) > 1e-6) console.warn(`timeline gap/overlap ${g.toFixed(4)} between ${shots[i - 1].id} and ${shots[i].id}`);
  }
  return shots;
}

export function cues() {
  return buildTimeline().flatMap((s) => s.cues.map(([t, name, gain]) => ({ t, name, gain, shot: s.id })));
}
