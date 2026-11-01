// Sets the window size a component sees, and tells it the window was resized.
// happy-dom starts at 1024 × 768, below the editor's minimum (spec ED-12).
export function setWindowSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    configurable: true,
    writable: true,
  });
  window.dispatchEvent(new Event('resize'));
}
