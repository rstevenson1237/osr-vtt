import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionDebounce } from './connection-debounce';

describe('ConnectionDebounce (SPEC-058 §2, DEC-121)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not lock on a `true` reading', () => {
    const onChange = vi.fn();
    const debounce = new ConnectionDebounce(onChange);
    debounce.report(true);
    vi.advanceTimersByTime(5000);
    expect(debounce.disconnected).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('locks only after `false` holds continuously for the full delay', () => {
    const onChange = vi.fn();
    const debounce = new ConnectionDebounce(onChange);
    debounce.report(false);
    vi.advanceTimersByTime(1999);
    expect(debounce.disconnected).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(debounce.disconnected).toBe(true);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('a `true` reading before the delay elapses cancels the lock — a blip never locks', () => {
    const onChange = vi.fn();
    const debounce = new ConnectionDebounce(onChange);
    debounce.report(false);
    vi.advanceTimersByTime(1500);
    debounce.report(true);
    vi.advanceTimersByTime(5000);
    expect(debounce.disconnected).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('unlocks on the very first `true` once locked, with no delay', () => {
    const onChange = vi.fn();
    const debounce = new ConnectionDebounce(onChange);
    debounce.report(false);
    vi.advanceTimersByTime(2000);
    expect(debounce.disconnected).toBe(true);

    debounce.report(true);
    expect(debounce.disconnected).toBe(false);
    expect(onChange).toHaveBeenNthCalledWith(2, false);
  });

  it('a repeated `false` while already locked does not re-fire onChange', () => {
    const onChange = vi.fn();
    const debounce = new ConnectionDebounce(onChange);
    debounce.report(false);
    vi.advanceTimersByTime(2000);
    expect(onChange).toHaveBeenCalledTimes(1);

    debounce.report(false);
    vi.advanceTimersByTime(2000);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(debounce.disconnected).toBe(true);
  });

  it('dispose cancels a pending lock timer', () => {
    const onChange = vi.fn();
    const debounce = new ConnectionDebounce(onChange);
    debounce.report(false);
    debounce.dispose();
    vi.advanceTimersByTime(5000);
    expect(debounce.disconnected).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});
