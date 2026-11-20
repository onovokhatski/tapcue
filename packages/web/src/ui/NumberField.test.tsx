import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NumberField, stepValue } from './NumberField';

/** A field that keeps its own text, as the editor's drafts do; changes and blurs are recorded. */
function Field({
  initial = '62',
  onChange = vi.fn(),
  onBlur = vi.fn(),
  withPrefix = true,
  ...props
}: Partial<Parameters<typeof NumberField>[0]> & { initial?: string; withPrefix?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <NumberField
      ariaLabel="X"
      {...(withPrefix ? { prefix: 'X' } : {})}
      {...props}
      value={value}
      onChange={(text) => {
        onChange(text);
        setValue(text);
      }}
      onBlur={onBlur}
    />
  );
}

const input = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'X' });

function drag(handle: HTMLElement, moves: { x: number; shiftKey?: boolean }[]) {
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 100 });
  for (const { x, shiftKey = false } of moves) {
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 100 + x, shiftKey });
  }
  fireEvent.pointerUp(handle, { pointerId: 1, clientX: 100 + (moves.at(-1)?.x ?? 0) });
}

describe('stepValue', () => {
  it('steps a whole number and keeps it within the limits', () => {
    expect(stepValue('62', 5)).toBe(67);
    expect(stepValue(' 62 ', -70, 0, 100)).toBe(0);
    expect(stepValue('62', 70, 0, 100)).toBe(100);
  });

  it('steps by a fraction, snapped to it and read without float noise', () => {
    expect(stepValue('0.5', 3, 0, 1, 0.01)).toBe(0.53);
    expect(stepValue('0.1', 2, 0, 1, 0.1)).toBe(0.3);
    expect(stepValue('0.123', 0, 0, 1, 0.01)).toBe(0.12);
    expect(stepValue('0.99', 5, 0, 1, 0.01)).toBe(1);
  });

  it('gives nothing for text that is not a number', () => {
    expect(stepValue('', 1)).toBeNull();
    expect(stepValue('–', 1)).toBeNull();
    expect(stepValue('6a', 1)).toBeNull();
  });
});

describe('NumberField dragging', () => {
  it('changes the value by 1 per pixel while the prefix is dragged, then counts as leaving', () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(<Field onChange={onChange} onBlur={onBlur} />);
    drag(screen.getByText('X'), [{ x: 3 }, { x: 5 }, { x: -2 }]);
    expect(onChange.mock.calls).toEqual([['65'], ['67'], ['60']]);
    expect(input().value).toBe('60');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('steps by 10 per pixel with Shift', () => {
    render(<Field />);
    drag(screen.getByText('X'), [{ x: 3, shiftKey: true }]);
    expect(input().value).toBe('92');
  });

  it('stays within min and max', () => {
    render(<Field min={0} max={100} />);
    const handle = screen.getByText('X');
    drag(handle, [{ x: 500 }]);
    expect(input().value).toBe('100');
    drag(handle, [{ x: -500 }]);
    expect(input().value).toBe('0');
  });

  it('uses the unit as the handle when there is no prefix, and only then', () => {
    const { unmount } = render(<Field withPrefix={false} suffix="%" />);
    drag(screen.getByText('%'), [{ x: 4 }]);
    expect(input().value).toBe('66');
    unmount();

    render(<Field suffix="px" />);
    drag(screen.getByText('px'), [{ x: 4 }]);
    expect(input().value).toBe('62');
  });

  it('does nothing when disabled or when the text is not a number', () => {
    const onChange = vi.fn();
    const { unmount } = render(<Field disabled onChange={onChange} />);
    drag(screen.getByText('X'), [{ x: 10 }]);
    unmount();
    render(<Field initial="–" onChange={onChange} />);
    drag(screen.getByText('X'), [{ x: 10 }]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores moves when no drag started', () => {
    const onChange = vi.fn();
    render(<Field onChange={onChange} />);
    fireEvent.pointerMove(screen.getByText('X'), { pointerId: 1, clientX: 300 });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('NumberField arrow keys', () => {
  it('step the value by 1, or 10 with Shift, within the limits', () => {
    render(<Field min={0} max={70} />);
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(input().value).toBe('63');
    fireEvent.keyDown(input(), { key: 'ArrowDown', shiftKey: true });
    expect(input().value).toBe('53');
    fireEvent.keyDown(input(), { key: 'ArrowUp', shiftKey: true });
    fireEvent.keyDown(input(), { key: 'ArrowUp', shiftKey: true });
    expect(input().value).toBe('70');
  });

  it('leave other keys to the input', () => {
    const onChange = vi.fn();
    render(<Field onChange={onChange} />);
    fireEvent.keyDown(input(), { key: 'ArrowLeft' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
