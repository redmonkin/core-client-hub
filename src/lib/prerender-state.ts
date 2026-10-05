// True when the page arrived with pre-rendered HTML in #root (the landing page
// in production builds). Read once at startup, before React replaces that HTML,
// so components can skip intro animations that already played.
export const startedPrerendered =
  typeof document !== "undefined" && !!document.getElementById("root")?.firstElementChild;

let introConsumed = false;

/** Whether intro animations should play; false only for the first, pre-rendered render. */
export function shouldPlayIntro(): boolean {
  if (!startedPrerendered || introConsumed) return true;
  return false;
}

/** Called after the first mount so later visits to the page animate normally. */
export function markIntroConsumed() {
  introConsumed = true;
}
