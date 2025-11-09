# Highlights: Future Features

This document outlines potential future enhancements for the highlights feature in Sora.

## Current Implementation

- ✅ Text highlighting in articles with visual feedback
- ✅ Click-to-remove individual highlights
- ✅ Persistent storage in dedicated `highlights` table
- ✅ Auto-save with debouncing (1 second)
- ✅ Support for both articles and books (schema-ready)

## Planned Features

### 1. Highlights Gallery

**Description:** A dedicated page showing all user highlights across all content.

**Use Cases:**
- Review all highlights in one place
- Quick navigation back to source content
- Export highlights collection

**Implementation:**
- Use existing `listUserHighlights` query
- Display with content title, excerpt, and timestamp
- Click to jump to article/book with highlight in view

**Estimated Effort:** Medium

---

### 2. Multiple Highlight Colors

**Description:** Allow users to choose from multiple highlight colors (yellow, green, blue, pink, purple).

**Use Cases:**
- Color-code by category (e.g., yellow=important, green=follow-up, blue=quote)
- Visual organization within articles
- Personal highlighting preferences

**Implementation:**
- Add color picker in article toolbar
- Store per-highlight color in `serializedData`
- Update `color` field on save

**Estimated Effort:** Small

---

### 3. Highlight Annotations

**Description:** Add notes/comments to individual highlights.

**Use Cases:**
- Capture thoughts while reading
- Add context to why something was highlighted
- Create study notes

**Implementation:**
- Extend `highlights` table with `note` field
- Add popover UI on highlight hover
- Store notes separately from serialized highlight data

**Estimated Effort:** Medium

---

### 4. Highlight Search

**Description:** Full-text search across all highlight content and notes.

**Use Cases:**
- Find that passage you highlighted last month
- Search across all reading material
- Research and reference retrieval

**Implementation:**
- Add search index on highlight text/notes
- Create search UI in highlights gallery
- Deep link to source content

**Estimated Effort:** Medium

---

### 5. Highlight Export

**Description:** Export highlights to various formats (Markdown, CSV, PDF, Notion).

**Use Cases:**
- Share highlights with others
- Import into note-taking apps
- Create study guides
- Backup personal highlights

**Implementation:**
- Create export action in Convex
- Format highlights with metadata
- Support multiple export formats

**Estimated Effort:** Medium

---

### 6. Social Highlights

**Description:** See popular highlights from other users (opt-in, privacy-aware).

**Use Cases:**
- Discover what others found valuable
- Community-driven reading
- Find key passages in long articles

**Implementation:**
- Add `public` flag to highlights table
- Aggregate highlights across users
- Privacy controls and opt-in mechanism

**Estimated Effort:** Large (requires privacy review)

---

### 7. Smart Highlights

**Description:** AI-suggested highlights based on article content and user preferences.

**Use Cases:**
- Speed up article processing
- Identify key points automatically
- Learn from user's highlighting patterns

**Implementation:**
- LLM integration for passage extraction
- User preference learning
- Approval workflow before saving

**Estimated Effort:** Large

---

### 8. Highlight-to-Flashcard

**Description:** Convert highlights into spaced repetition flashcards.

**Use Cases:**
- Study and retention
- Language learning
- Knowledge review

**Implementation:**
- New `flashcards` table
- Generate Q&A from highlights
- Integration with spaced repetition algorithm

**Estimated Effort:** Large

---

### 9. Highlight Statistics

**Description:** Analytics on highlighting behavior (most highlighted articles, daily streaks, categories).

**Use Cases:**
- Track reading habits
- Identify valuable content
- Engagement insights

**Implementation:**
- Aggregate queries on highlights
- Visualization components
- Dashboard page

**Estimated Effort:** Medium

---

### 10. Collaborative Highlights

**Description:** Share articles with others and see their highlights alongside yours.

**Use Cases:**
- Book club discussions
- Study groups
- Team research

**Implementation:**
- Sharing mechanism for articles
- Multi-user highlight rendering
- Color-coding by user
- Comment threads on highlights

**Estimated Effort:** Very Large (requires collaboration features)

---

## Quick Wins

Features that could be implemented quickly for high impact:

1. **Multiple Highlight Colors** (Small effort, high UX value)
2. **Highlights Gallery** (Medium effort, core feature)
3. **Highlight Export** (Medium effort, high utility)

## Technical Considerations

### Performance
- Highlights are stored as serialized JSON (efficient)
- Index strategy supports fast queries by user and content
- Consider pagination for highlights gallery

### Mobile Support
- Touch selection already works
- Test annotation UI on mobile
- Consider mobile-specific highlight gestures

### Data Model
- Current schema supports all planned features
- `serializedData` allows library format changes
- Modular design enables incremental feature additions

### Privacy
- All highlights are private by default
- Social features require explicit opt-in
- Export includes privacy controls

## Related Features

Features that complement highlights:

- **Reading Lists:** Organize articles with heavy highlighting
- **Tags:** Categorize highlights by theme
- **Notes:** Standalone annotations (separate from highlights)
- **Reading Goals:** Track progress via highlighting activity
