import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from './fixture-harness';
import { observeOutcomes } from './outcomes';

let stop: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<main><button><svg data-test-icon="connect-small"></svg></button></main>';
});

afterEach(() => {
  stop?.();
  stop = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('the outcome observer', () => {
  it('does no work while nothing is pending', async () => {
    const evaluate = vi.fn();
    stop = observeOutcomes(document, () => false, evaluate);
    document.querySelector('main')!.appendChild(document.createElement('p'));
    document.querySelector('svg')!.setAttribute('data-test-icon', 'clock-small');
    await flush();
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('evaluates on child, data-test-icon and disabled mutations once something is pending', async () => {
    const evaluate = vi.fn();
    stop = observeOutcomes(document, () => true, evaluate);
    document.querySelector('main')!.appendChild(document.createElement('p'));
    await flush();
    document.querySelector('svg')!.setAttribute('data-test-icon', 'clock-small');
    await flush();
    document.querySelector('button')!.setAttribute('disabled', '');
    await flush();
    expect(evaluate).toHaveBeenCalledTimes(3);
  });

  it('ignores attributes outside the filter', async () => {
    const evaluate = vi.fn();
    stop = observeOutcomes(document, () => true, evaluate);
    document.querySelector('button')!.setAttribute('class', 'artdeco-button');
    document.querySelector('button')!.setAttribute('aria-pressed', 'true');
    await flush();
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('stops observing after the returned function is called', async () => {
    const evaluate = vi.fn();
    stop = observeOutcomes(document, () => true, evaluate);
    stop();
    stop = null;
    document.querySelector('main')!.appendChild(document.createElement('p'));
    await flush();
    expect(evaluate).not.toHaveBeenCalled();
  });
});
