let activeLocks = 0;
let bodyOverflow = "";
let htmlOverflow = "";

/** Keep scrolling locked until the last admin dialog closes, in any order. */
export function lockAdminDialogScroll() {
  if (activeLocks === 0) {
    bodyOverflow = document.body.style.overflow;
    htmlOverflow = document.documentElement.style.overflow;
  }
  activeLocks += 1;
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeLocks -= 1;
    if (activeLocks === 0) {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    }
  };
}
