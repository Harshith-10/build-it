import { foldEffect } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useRef } from "react";

interface UseBoilerplateFoldingProps {
  questionId: string;
  language: string;
}

export function useBoilerplateFolding({
  questionId,
  language,
}: UseBoilerplateFoldingProps) {
  const viewRef = useRef<EditorView | null>(null);

  const foldBoilerplate = useCallback(
    (view: EditorView) => {
      if (!view) return;

      const doc = view.state.doc;
      const effects = [];

      // Markers for different languages
      const markers = {
        java: { start: "// region boilerplate", end: "// endregion" },
        python: { start: "# region boilerplate", end: "# endregion" },
        rust: { start: "// region boilerplate", end: "// endregion" },
        cpp: { start: "// region boilerplate", end: "// endregion" },
        c: { start: "// region boilerplate", end: "// endregion" },
      };

      const currentMarkers =
        markers[language as keyof typeof markers] || markers.java;

      let startLine = -1;

      // Iterate lines to find regions
      for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        const lineText = line.text.trim();

        if (lineText === currentMarkers.start) {
          startLine = i;
        } else if (lineText === currentMarkers.end && startLine !== -1) {
          // Found a region: fold from end of start line to end of end line
          const startPos = doc.line(startLine).to;
          const endPos = line.to;

          try {
            effects.push(foldEffect.of({ from: startPos, to: endPos }));
          } catch (e) {
            console.error("Failed to create fold effect", e);
          }
          startLine = -1;
        }
      }

      if (effects.length > 0) {
        view.dispatch({ effects });
      }
    },
    [language],
  );

  const onCreateEditor = useCallback(
    (view: EditorView) => {
      viewRef.current = view;
      foldBoilerplate(view);
    },
    [foldBoilerplate],
  );

  // Re-fold when question or language changes
  useEffect(() => {
    if (viewRef.current) {
      foldBoilerplate(viewRef.current);
    }
  }, [questionId, language, foldBoilerplate]);

  return { onCreateEditor };
}
