import type { PointerEvent } from 'react';

/** A visible field does not need Chrome's implicit focus scroll. Pre-focus it
 * before the mouse default action, without cancelling caret placement or drag
 * selection. Keyboard/touch focus and controls outside the viewport stay native. */
export function focusVisibleOnboardingField(event: PointerEvent<HTMLFormElement>): boolean {
  if (event.pointerType !== 'mouse' || event.button !== 0 || event.defaultPrevented) return false;
  const target = event.target;
  if (!(target instanceof Element)) return false;
  const field = target.closest('input,textarea') || target.closest('label')?.control;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) || field.disabled || !event.currentTarget.contains(field)) return false;
  if (field instanceof HTMLInputElement && !['text','password','email','tel','url','search','number'].includes(field.type)) return false;
  const box = field.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0 || box.top < 0 || box.bottom > window.innerHeight || box.left < 0 || box.right > window.innerWidth) return false;
  field.focus({ preventScroll: true });
  return true;
}
