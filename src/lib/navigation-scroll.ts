/** Route changes start at the top immediately, even when in-page links use
 * smooth scrolling. Reset the staff main pane as well as the document. */
export function resetPageScroll() {
  const containers = [document.documentElement, document.body, ...document.querySelectorAll('main')];
  const previous = containers.map(element => element.style.scrollBehavior);
  containers.forEach(element => {
    element.style.scrollBehavior = 'auto';
    element.scrollTop = 0;
    element.scrollLeft = 0;
  });
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  } catch {
    window.scrollTo(0, 0);
  } finally {
    containers.forEach((element, index) => { element.style.scrollBehavior = previous[index]; });
  }
}
