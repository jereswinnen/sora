declare module "@funktechno/texthighlighter/lib" {
  export interface TextHighlighterOptions {
    color?: string;
    highlightedClass?: string;
    contextClass?: string;
    onRemoveHighlight?: (highlight: HTMLElement) => boolean;
    onBeforeHighlight?: (range: Range) => boolean;
    onAfterHighlight?: (range: Range, highlight: HTMLElement[]) => boolean;
  }

  export class TextHighlighter {
    constructor(element: HTMLElement, options?: TextHighlighterOptions);
    doHighlight(keepRange?: boolean): void;
    removeHighlights(element?: HTMLElement): void;
    destroy(): void;
    setColor(color: string): void;
    serializeHighlights(): string;
    deserializeHighlights(json: string): void;
  }
}
