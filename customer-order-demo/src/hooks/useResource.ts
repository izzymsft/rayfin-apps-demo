import { useCallback, useEffect, useRef, useState } from 'react';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation failed. Please retry.';
}

export function useResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    if (mounted.current) { setLoading(true); setError(''); }
    try {
      const result = await load();
      if (mounted.current && current === request.current) setData(result);
      return result;
    } catch (err) {
      if (mounted.current && current === request.current) setError(errorMessage(err));
      throw err;
    } finally {
      if (mounted.current && current === request.current) setLoading(false);
    }
  }, [load]);
  useEffect(() => {
    mounted.current = true;
    setData(undefined);
    void refresh().catch(() => { /* refresh exposes the failure in error state. */ });
    return () => { mounted.current = false; };
  }, [refresh]);
  return { data, loading, error, refresh };
}

export function useCrudResource<T extends { id: string }, I>(
  load: () => Promise<T[]>,
  create: (input: I) => Promise<unknown>,
  update: (id: string, input: I) => Promise<unknown>,
  remove: (id: string) => Promise<void>,
) {
  const resource = useResource(load);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [mutationError, setMutationError] = useState('');
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const mutate = async (action: () => Promise<unknown>, message: string) => {
    if (mounted.current) { setSaving(true); setMutationError(''); setNotice(''); }
    try {
      await action();
      if (mounted.current) setNotice(message);
      try {
        await resource.refresh();
      } catch (err) {
        if (mounted.current) setMutationError(`Saved, but refreshing failed: ${errorMessage(err)}. Do not repeat the write; use Refresh.`);
      }
    } catch (err) {
      if (mounted.current) setMutationError(errorMessage(err));
      throw err;
    } finally {
      if (mounted.current) setSaving(false);
    }
  };
  return {
    ...resource, saving, notice, mutationError,
    create: (input: I) => mutate(() => create(input), 'Record created.'),
    update: (id: string, input: I) => mutate(() => update(id, input), 'Record updated.'),
    remove: (id: string) => mutate(() => remove(id), 'Record deleted.'),
  };
}
