# TipTap Pagination Plus
[![NPM](https://img.shields.io/npm/v/tiptap-pagination-plus.svg)](https://www.npmjs.com/package/tiptap-pagination-plus)

`tiptap-pagination-plus` extension that adds pagination support to your editor with table handling capabilities, and now supports persistent, document-embedded headers and footers.

# Demo

https://romikmakavana.me/tiptap-pagination/

## Installation

```bash
npm install tiptap-pagination-plus
```

## Usage

### Basic Setup

```typescript
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Document from '@tiptap/extension-document'
import { 
  PaginationPlus,
  TablePlus,
  TableRowPlus,
  TableCellPlus,
  TableHeaderPlus,
  HeaderNode,
  FooterNode
} from 'tiptap-pagination-plus'

const editor = new Editor({
  extensions: [
    StarterKit.configure({
                document: false,
            }),
    TablePlus,
    TableRowPlus,
    TableCellPlus,
    TableHeaderPlus,
    HeaderNode, // <-- Add this for header support
    FooterNode, // <-- Add this for footer support
    Document.extend({
                content: "header? block+ footer?"
            }),
    PaginationPlus.configure({
      pageHeight: 842,        // Height of each page in pixels
      pageGap: 20,           // Gap between pages in pixels
      pageBreakBackground: "#f7f7f7",  // Background color for page gaps
      pageHeaderHeight: 50,   // Height of page header/footer in pixels
      footerRight: "Made with ❤️ by Romik", // Fallback if no footer node
      footerLeft: "Page {page}",           // Fallback if no footer node
      headerLeft: "Header Left",           // Fallback if no header node
      headerRight: "Header Right",         // Fallback if no header node
    }),
  ],
})
```

### Document-Embedded Header and Footer

You can now add a `header` or `footer` node to your document. The content of these nodes will be rendered as the header and footer on every page, and are part of the document structure (they can be edited, saved, and loaded like any other content).

- **Header/Footer Node Precedence:**
  - If a `header` or `footer` node exists in the document, its content is used for the header/footer on every page.
  - If not, the configuration options (`headerLeft`, `footerRight`, etc.) are used as a fallback.

#### Example: Adding a Header/Footer Node

```typescript
// Insert a header node 
editor.commands.setHeaderContent(content);

// Insert a footer node at the end of the document
editor.commands.setFooterContent(content);
```

- The `{page}` variable in the footer node will be replaced with the current page number.
- You can use any valid ProseMirror/Tiptap content inside the header/footer nodes.

#### Editing Header/Footer Content

- The header and footer nodes are part of the document and can be set using commands. Editing in the UI directly is slightly more complicated, because what's actually being presented is the DecorationSet and not the Node itself.
- They can be styled, saved, and loaded like any other node.

### Table Pagination

Key points for table pagination:
- Tables will automatically split across pages when they exceed the page height
- To split table across pages, you have to use these extensions
- List : TablePlus, TableRowPlus, TableCellPlus, TableHeaderPlus

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pageHeight` | number | 842 | Height of each page in pixels |
| `pageGap` | number | 20 | Gap between pages in pixels |
| `pageBreakBackground` | string | "#f7f7f7" | Background color for page gaps |
| `pageHeaderHeight` | number | 50 | Height of page header/footer in pixels |
| `footerRight` | string | "" | Custom text to display in the footer right side (used if no footer node) |
| `footerLeft` | string | "" | Custom text to display in the footer left side (used if no footer node) |
| `headerRight` | string | "" | Custom text to display in the header right side (used if no header node) |
| `headerLeft` | string | "" | Custom text to display in the header left side (used if no header node) |

### Features

- Automatic page breaks based on content height
- Page numbers in the footer
- Custom header/footer text support via document nodes or config
- Use `{page}` variable to display current page number in header/footer text
- Table pagination with header preservation
- Responsive design
- Automatic page height calculation
- Support for nested content
- **Header and footer are now part of the document structure and can be edited**

## License

MIT
