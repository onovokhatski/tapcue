import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { checkHex, ColorField } from './ColorField';
import { Segmented } from './Segmented';
import { Select } from './Select';
import { TextField } from './TextField';
import { useDraft } from './useDraft';

describe('TextField', () => {
  it('labels the field and shows its helper as its description', () => {
    render(
      <TextField
        label="Host"
        helper="An IP address or a name"
        value=""
        onChange={() => undefined}
      />,
    );
    const field = screen.getByRole('textbox', { name: 'Host' });
    expect(field).toHaveAccessibleDescription('An IP address or a name');
    expect(field).not.toHaveAttribute('aria-invalid');
  });

  it('replaces the helper with the error and marks the field invalid', () => {
    render(
      <TextField
        label="Host"
        helper="An IP address"
        error="Each part must be 0–255"
        value="300.1.1.1"
        onChange={() => undefined}
      />,
    );
    const field = screen.getByRole('textbox', { name: 'Host' });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Each part must be 0–255');
    expect(screen.queryByText('An IP address')).toBeNull();
  });

  it('reports typing, Enter and leaving', () => {
    const onChange = vi.fn();
    const onEnter = vi.fn();
    const onBlur = vi.fn();
    render(
      <TextField label="Name" value="" onChange={onChange} onEnter={onEnter} onBlur={onBlur} />,
    );
    const field = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(field, { target: { value: 'Resolume' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith('Resolume');
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('can be multiline, mono, with a fixed prefix, or named without a visible label', () => {
    const { rerender } = render(
      <TextField label="Body" multiline mono value="{}" onChange={() => undefined} />,
    );
    expect(screen.getByRole('textbox', { name: 'Body' }).tagName).toBe('TEXTAREA');
    expect(screen.getByRole('textbox', { name: 'Body' })).toHaveClass('font-mono');
    rerender(
      <TextField
        ariaLabel="Path"
        prefix="http://localhost:4000"
        value="/demo"
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Path' })).toHaveValue('/demo');
    expect(screen.getByText('http://localhost:4000')).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(<TextField label="Base URL" disabled value="" onChange={() => undefined} />);
    expect(screen.getByRole('textbox', { name: 'Base URL' })).toBeDisabled();
  });
});

describe('Select', () => {
  const options = [
    { value: 'p_home00', label: 'Home' },
    { value: 'p_about0', label: 'About us' },
  ];

  it('offers the options, with the placeholder first for "none"', () => {
    render(
      <Select
        label="Go to page"
        placeholder="Stay on this page"
        value={null}
        options={options}
        onChange={() => undefined}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Go to page' });
    expect(select).toHaveValue('');
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Stay on this page',
      'Home',
      'About us',
    ]);
  });

  it('gives the chosen value, and null for the placeholder', () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Go to page"
        placeholder="Stay"
        value="p_home00"
        options={options}
        onChange={onChange}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Go to page' });
    fireEvent.change(select, { target: { value: 'p_about0' } });
    fireEvent.change(select, { target: { value: '' } });
    expect(onChange.mock.calls).toEqual([['p_about0'], [null]]);
  });

  it('can be disabled and named without a visible label', () => {
    render(
      <Select
        ariaLabel="Target"
        disabled
        value="p_home00"
        options={options}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Target' })).toBeDisabled();
  });
});

describe('Segmented', () => {
  const modes = [
    { value: 'fit', label: 'Fit' },
    { value: 'fill', label: 'Fill' },
  ] as const;

  function Modes() {
    const [mode, setMode] = useState<'fit' | 'fill'>('fit');
    return <Segmented label="Scale mode" options={[...modes]} value={mode} onChange={setMode} />;
  }

  it('is a radio group with the chosen option checked', () => {
    render(<Modes />);
    expect(screen.getByRole('radiogroup', { name: 'Scale mode' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Fit' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Fill' })).not.toBeChecked();
  });

  it('chooses on click', () => {
    render(<Modes />);
    fireEvent.click(screen.getByRole('radio', { name: 'Fill' }));
    expect(screen.getByRole('radio', { name: 'Fill' })).toBeChecked();
  });

  it('keeps only the chosen option in the Tab order; the arrows choose and wrap around', () => {
    render(<Modes />);
    const fit = screen.getByRole('radio', { name: 'Fit' });
    expect(fit).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Fill' })).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(fit, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Fill' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Fill' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Fill' }), { key: 'ArrowRight' });
    expect(fit).toBeChecked();
  });
});

describe('useDraft (spec ED-10)', () => {
  const check = (text: string) => (/^\d+$/.test(text) ? null : 'Expected a number');

  it('applies a valid value at once', () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useDraft('10', check, apply));
    act(() => result.current.onChange('12'));
    expect(apply).toHaveBeenCalledWith('12');
    expect(result.current).toMatchObject({ text: '12', error: null });
  });

  it('keeps an invalid value with its reason and applies nothing, also after leaving', () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useDraft('10', check, apply));
    act(() => result.current.onChange('1x'));
    act(() => result.current.onBlur());
    expect(apply).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ text: '1x', error: 'Expected a number' });
  });

  it('follows the saved value when not being edited', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDraft(value, check, () => undefined),
      {
        initialProps: { value: '10' },
      },
    );
    act(() => result.current.onChange('12'));
    act(() => result.current.onBlur());
    rerender({ value: '20' });
    expect(result.current.text).toBe('20');
  });
});

describe('ColorField', () => {
  function Fill({ initial = '#3A7BFF' as string | null, allowNone = true }) {
    const [value, setValue] = useState<string | null>(initial);
    return (
      <>
        <ColorField ariaLabel="fill" value={value} onChange={setValue} allowNone={allowNone} />
        <output data-testid="value">{String(value)}</output>
      </>
    );
  }
  const value = () => screen.getByTestId('value').textContent;

  it('checks a hex colour', () => {
    expect(checkHex('#3a7bff')).toBeNull();
    expect(checkHex(' #3A7BFF ')).toBeNull();
    expect(checkHex('#3A7BF')).toBe('Expected a colour like #3A7BFF');
    expect(checkHex('blue')).toBe('Expected a colour like #3A7BFF');
  });

  it('takes a typed hex, saved in capitals', () => {
    render(<Fill />);
    fireEvent.change(screen.getByRole('textbox', { name: 'fill hex' }), {
      target: { value: '#ff0000' },
    });
    expect(value()).toBe('#FF0000');
  });

  it('keeps a hex that is not a colour in the field with its error, and saves nothing', () => {
    render(<Fill />);
    const hex = screen.getByRole('textbox', { name: 'fill hex' });
    fireEvent.change(hex, { target: { value: '#ff00' } });
    expect(hex).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Expected a colour like #3A7BFF')).toBeInTheDocument();
    expect(value()).toBe('#3A7BFF');
  });

  it('takes a colour from the picker', () => {
    render(<Fill />);
    fireEvent.change(screen.getByLabelText('Pick fill'), { target: { value: '#00ff00' } });
    expect(value()).toBe('#00FF00');
  });

  it('sets None where None is allowed, and shows it', () => {
    render(<Fill />);
    fireEvent.click(screen.getByRole('button', { name: 'Set fill to None' }));
    expect(value()).toBe('null');
    expect(screen.getByText('None')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Pick fill'), { target: { value: '#123456' } });
    expect(value()).toBe('#123456');
  });

  it('offers no None where a colour is required', () => {
    render(<Fill allowNone={false} />);
    expect(screen.queryByRole('button', { name: 'Set fill to None' })).toBeNull();
  });
});
