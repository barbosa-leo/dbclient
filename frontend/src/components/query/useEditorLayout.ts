'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, RefObject } from 'react';

const HEIGHT_STORAGE_KEY = 'dbclient.query.editorHeight';
export const MIN_EDITOR_HEIGHT = 80;
export const DEFAULT_EDITOR_HEIGHT = 160;
const MIN_RESULTS_HEIGHT = 300;
const COLLAPSE_THRESHOLD = 64;
const KEYBOARD_STEP = 16;
const KEYBOARD_STEP_LARGE = 64;

function readStoredHeight(): number {
  try {
    const stored = Number(window.localStorage.getItem(HEIGHT_STORAGE_KEY));
    return Number.isFinite(stored) && stored >= MIN_EDITOR_HEIGHT ? stored : DEFAULT_EDITOR_HEIGHT;
  } catch {
    return DEFAULT_EDITOR_HEIGHT;
  }
}

function storeHeight(height: number) {
  try {
    window.localStorage.setItem(HEIGHT_STORAGE_KEY, String(Math.round(height)));
  } catch {
    // Without storage the height just resets to the default on reload.
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface DragState {
  pointerId: number;
  startY: number;
  startEditor: number;
  max: number;
}

// The results area is flex-1 below the editor, so every pixel the editor grows comes out of it.
// The editor may only grow while the results keep MIN_RESULTS_HEIGHT; dragging past that limit
// collapses the results into their tab bar instead of pushing them off screen.
export function useEditorLayout(
  editorAreaRef: RefObject<HTMLElement | null>,
  resultsAreaRef: RefObject<HTMLElement | null>,
) {
  const [height, setHeight] = useState(DEFAULT_EDITOR_HEIGHT);
  const [resultsCollapsed, setResultsCollapsed] = useState(false);
  const [maxHeight, setMaxHeight] = useState(DEFAULT_EDITOR_HEIGHT);
  const drag = useRef<DragState | null>(null);
  const heightRef = useRef(height);
  heightRef.current = height;

  useEffect(() => {
    setHeight(readStoredHeight());
  }, []);

  const measureMax = useCallback(() => {
    const editor = editorAreaRef.current?.getBoundingClientRect().height ?? heightRef.current;
    const results = resultsAreaRef.current?.getBoundingClientRect().height ?? MIN_RESULTS_HEIGHT;
    return Math.max(MIN_EDITOR_HEIGHT, editor + results - MIN_RESULTS_HEIGHT);
  }, [editorAreaRef, resultsAreaRef]);

  const applyHeight = useCallback((candidate: number, max: number) => {
    if (candidate > max + COLLAPSE_THRESHOLD) {
      setResultsCollapsed(true);
      return;
    }
    setResultsCollapsed(false);
    const next = clamp(candidate, MIN_EDITOR_HEIGHT, max);
    heightRef.current = next;
    setHeight(next);
  }, []);

  useEffect(() => {
    const results = resultsAreaRef.current;
    if (!results || resultsCollapsed) return;
    const observer = new ResizeObserver(() => {
      if (drag.current) return;
      const available = results.getBoundingClientRect().height;
      const deficit = MIN_RESULTS_HEIGHT - available;
      if (deficit > 1) {
        setHeight((current) => Math.max(MIN_EDITOR_HEIGHT, current - deficit));
      }
      setMaxHeight(measureMax());
    });
    observer.observe(results);
    return () => observer.disconnect();
  }, [resultsAreaRef, resultsCollapsed, measureMax]);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startEditor: editorAreaRef.current?.getBoundingClientRect().height ?? height,
      max: measureMax(),
    };
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    applyHeight(state.startEditor + event.clientY - state.startY, state.max);
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    storeHeight(heightRef.current);
    setMaxHeight(measureMax());
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;
    const max = measureMax();
    let next: number;
    switch (event.key) {
      case 'ArrowUp':
        next = (resultsCollapsed ? max : height) - step;
        break;
      case 'ArrowDown':
        next = height + step;
        break;
      case 'Home':
        next = MIN_EDITOR_HEIGHT;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }
    event.preventDefault();
    setResultsCollapsed(false);
    const clamped = clamp(next, MIN_EDITOR_HEIGHT, max);
    setHeight(clamped);
    storeHeight(clamped);
  }

  function reset() {
    setResultsCollapsed(false);
    const clamped = clamp(DEFAULT_EDITOR_HEIGHT, MIN_EDITOR_HEIGHT, measureMax());
    setHeight(clamped);
    storeHeight(clamped);
  }

  return {
    height,
    maxHeight,
    resultsCollapsed,
    expandResults: () => setResultsCollapsed(false),
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onKeyDown,
      onDoubleClick: reset,
    },
  };
}
