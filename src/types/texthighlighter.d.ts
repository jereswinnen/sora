declare module "@funktechno/texthighlighter/lib" {
  export interface TextHighlighterOptions {
    color?: string;
    highlightedClass?: string;
    contextClass?: string;
    onRemoveHighlight?: (highlight: HTMLElement) => void;
    onBeforeHighlight?: (range: Range) => boolean;
    onAfterHighlight?: (range: Range, highlight: HTMLElement[]) => void;
  }

  export class TextHighlighter {
    constructor(element: HTMLElement, options?: TextHighlighterOptions);
    doHighlight(keepRange?: boolean): void;
    removeHighlights(element?: HTMLElement): void;
    destroy(): void;
    setColor(color: string): void;
    serialize(): string;
    deserialize(json: string): void;
  }
}
