'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const DRAFT_PREFIX = 'dbclient.query.draft.';
const SAVE_DELAY_MS = 300;

function draftKey(connectionId: number): string {
  return `${DRAFT_PREFIX}${connectionId}`;
}

function readDraft(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(key: string, value: string) {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable (private mode, quota); the draft just stops surviving reloads.
  }
}

export function clearSqlDrafts() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

export function useSqlDraft(connectionId: number | null) {
  const [sql, setSqlState] = useState('');
  const pending = useRef<{ key: string; value: string } | null>(null);
  const timer = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const next = pending.current;
    pending.current = null;
    if (next) writeDraft(next.key, next.value);
  }, []);

  useEffect(() => {
    if (connectionId === null) return;
    setSqlState(readDraft(draftKey(connectionId)));
    return flush;
  }, [connectionId, flush]);

  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [flush]);

  const setSql = useCallback(
    (value: string) => {
      setSqlState(value);
      if (connectionId === null) return;
      pending.current = { key: draftKey(connectionId), value };
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
    },
    [connectionId, flush],
  );

  return [sql, setSql] as const;
}
