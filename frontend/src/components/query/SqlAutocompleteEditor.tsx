'use client';

import { acceptCompletion, autocompletion } from '@codemirror/autocomplete';
import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { Compartment, EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { minimalSetup } from 'codemirror';
import { useEffect, useRef } from 'react';
import { onExplorerRefresh } from '@/services/explorer';
import { MAX_SQL_LENGTH } from '@/services/query';
import { SqlMetadata, sqlKeywordCompletions, sqlMetadataCompletions } from './sqlCompletion';
import { statementAt } from './sqlStatements';

interface SqlAutocompleteEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: (statement: string) => void;
  connectionId: number | null;
  disabled: boolean;
  height: string;
  metadataRevision: number;
}

function statementUnderCursor(state: EditorState): string {
  const { main } = state.selection;
  if (!main.empty) return state.sliceDoc(main.from, main.to).trim();
  const doc = state.doc.toString();
  const range = statementAt(doc, main.head);
  return range ? doc.slice(range.from, range.to) : '';
}

export function SqlAutocompleteEditor({
  value,
  onChange,
  onRun,
  connectionId,
  disabled,
  height,
  metadataRevision,
}: SqlAutocompleteEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  const disabledRef = useRef(disabled);
  const metadataRef = useRef<SqlMetadata | null>(null);
  const editableRef = useRef(new Compartment());

  onChangeRef.current = onChange;
  onRunRef.current = onRun;
  disabledRef.current = disabled;

  useEffect(() => {
    metadataRef.current = connectionId === null ? null : new SqlMetadata(connectionId);
    if (metadataRef.current) void metadataRef.current.schemas().catch(() => undefined);
  }, [connectionId, metadataRevision]);

  useEffect(() => onExplorerRefresh(() => {
    metadataRef.current = connectionId === null ? null : new SqlMetadata(connectionId);
    if (metadataRef.current) void metadataRef.current.schemas().catch(() => undefined);
  }), [connectionId]);

  useEffect(() => {
    if (!hostRef.current) return;

    function runStatement(editor: EditorView): boolean {
      if (disabledRef.current) return true;
      const statement = statementUnderCursor(editor.state);
      if (statement) onRunRef.current(statement);
      return true;
    }

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          minimalSetup,
          sql({ dialect: PostgreSQL, upperCaseKeywords: true }),
          autocompletion({
            override: [
              sqlKeywordCompletions,
              async (context) => {
                const metadata = metadataRef.current;
                const result = await sqlMetadataCompletions(context, metadata);
                return metadataRef.current === metadata ? result : null;
              },
            ],
            activateOnTyping: true,
          }),
          placeholder('SELECT * FROM ...'),
          EditorView.contentAttributes.of({ 'aria-label': 'Consulta SQL' }),
          editableRef.current.of(EditorView.editable.of(!disabled)),
          EditorState.changeFilter.of((transaction) => transaction.newDoc.length <= MAX_SQL_LENGTH),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
          Prec.highest(
            keymap.of([
              { key: 'Mod-Enter', run: runStatement },
              { key: 'Ctrl-Enter', run: runStatement },
              {
                key: 'Tab',
                run: (editor) => {
                  if (acceptCompletion(editor)) return true;
                  if (!editor.state.selection.main.empty) return false;
                  editor.dispatch(editor.state.replaceSelection('  '));
                  return true;
                },
              },
            ]),
          ),
          EditorView.theme({
            '&': {
              height: '100%',
              fontSize: '13px',
              color: 'var(--fg-primary)',
              backgroundColor: 'transparent',
            },
            '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono), monospace' },
            '.cm-content': { padding: '12px 16px', minHeight: '100%' },
            '.cm-line': { padding: '0' },
            '.cm-focused': { outline: 'none' },
            '.cm-cursor': { borderLeftColor: 'var(--fg-primary)' },
            '.cm-selectionBackground': { backgroundColor: 'var(--bg-muted) !important' },
            '.cm-tooltip': {
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--fg-primary)',
              border: '1px solid var(--border-line)',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16)',
              zIndex: '50',
            },
            '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
              backgroundColor: 'var(--bg-muted)',
              color: 'var(--fg-primary)',
            },
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: editableRef.current.reconfigure(EditorView.editable.of(!disabled)) });
  }, [disabled]);

  return (
    <div
      ref={hostRef}
      style={{ height }}
      className="relative z-20 w-full rounded-lg border border-line bg-subtle focus-within:border-line-strong focus-within:bg-panel"
    />
  );
}
