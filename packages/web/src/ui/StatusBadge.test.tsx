import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type BadgeStatus, StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it.each<[BadgeStatus, string]>([
    ['connected', 'Connected'],
    ['disconnected', 'Disconnected'],
    ['waiting', 'Waiting'],
    ['saving', 'Saving…'],
    ['saved', 'Saved'],
    ['unsaved', 'Unsaved changes'],
    ['error', 'Save error'],
  ])('%s says "%s" by default, as a status', (status, text) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByRole('status')).toHaveTextContent(text);
  });

  it('takes its own words', () => {
    render(<StatusBadge status="waiting" label="Connecting…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Connecting…');
  });

  it.each<[BadgeStatus, string]>([
    ['connected', 'span.rounded-full.bg-success-solid'],
    ['disconnected', 'svg'],
    ['saving', '.spinner'],
    ['saved', 'svg'],
    ['unsaved', 'span.rounded-full.border-current'],
    ['error', 'svg'],
  ])('pairs %s with a shape or an icon, never colour alone', (status, mark) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByRole('status').querySelector(mark)).toBeInTheDocument();
  });
});
