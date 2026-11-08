import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCrudResource, useResource } from '@/hooks/useResource';

describe('resource hooks', () => {
  it('fetches and refreshes records', async () => {
    const load = vi.fn().mockResolvedValueOnce(['first']).mockResolvedValueOnce(['second']);
    const { result } = renderHook(() => useResource(load));
    await waitFor(() => expect(result.current.data).toEqual(['first']));
    await act(() => result.current.refresh());
    expect(result.current.data).toEqual(['second']);
  });
  it('surfaces read errors instead of returning an empty success', async () => {
    const load = vi.fn().mockRejectedValue(new Error('Backend unavailable'));
    const { result } = renderHook(() => useResource(load));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Backend unavailable');
    expect(result.current.data).toBeUndefined();
  });
  it('does not replace newer results with a stale read', async () => {
    let complete!: (value: string[]) => void;
    const slow = new Promise<string[]>(resolve => { complete = resolve; });
    const load = vi.fn().mockReturnValueOnce(slow).mockResolvedValueOnce(['newer']);
    const { result } = renderHook(() => useResource(load));
    await act(() => result.current.refresh());
    await act(async () => { complete(['stale']); await slow; });
    expect(result.current.data).toEqual(['newer']);
  });
  it('ignores results after unmount', async () => {
    let complete!: (value: string[]) => void;
    const pending = new Promise<string[]>(resolve => { complete = resolve; });
    const load = () => pending;
    const { result, unmount } = renderHook(() => useResource(load));
    unmount();
    await act(async () => { complete(['late']); await pending; });
    expect(result.current.data).toBeUndefined();
  });
  it('clears previous-route records when the loader changes', async () => {
    const first = vi.fn().mockResolvedValue(['first-route']);
    const second = vi.fn().mockRejectedValue(new Error('Second route unavailable'));
    const { result, rerender } = renderHook(({ load }) => useResource(load), { initialProps: { load: first } });
    await waitFor(() => expect(result.current.data).toEqual(['first-route']));
    rerender({ load: second });
    await waitFor(() => expect(result.current.error).toBe('Second route unavailable'));
    expect(result.current.data).toBeUndefined();
  });
  it('reports a saved write separately from a failed refresh', async () => {
    const load = vi.fn().mockResolvedValueOnce([{ id: '1' }]).mockRejectedValueOnce(new Error('Refresh failed'));
    const create = vi.fn().mockResolvedValue({ id: '2' });
    const { result } = renderHook(() => useCrudResource(load, create, vi.fn(), vi.fn()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.create({}));
    expect(create).toHaveBeenCalledTimes(1);
    expect(result.current.notice).toBe('Record created.');
    expect(result.current.mutationError).toContain('Saved, but refreshing failed');
  });
});
