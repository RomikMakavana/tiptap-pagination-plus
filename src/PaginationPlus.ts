import { Editor, Extension } from "@tiptap/core";
import { DOMSerializer } from "@tiptap/pm/model";
import { EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, EditorView } from "@tiptap/pm/view";

interface PaginationPlusOptions {
  pageHeight: number;
  pageGap: number;
  pageBreakBackground: string;
  pageHeaderHeight: number;
  pageGapBorderSize: number;
  footerRight: string;
  footerLeft: string;
  headerRight: string;
  headerLeft: string;
  pagePlaceholder: string;
}
const page_count_meta_key = "PAGE_COUNT_META_KEY";
const header_footer_update_meta_key = "HEADER_FOOTER_UPDATE_META_KEY";
export const PaginationPlus = Extension.create<PaginationPlusOptions>({
  name: "PaginationPlus",
  addOptions() {
    return {
      pageHeight: 800,
      pageGap: 50,
      pageGapBorderSize: 1,
      pageBreakBackground: "#ffffff",
      pageHeaderHeight: 10,
      footerRight: "",
      footerLeft: "",
      headerRight: "",
      headerLeft: "",
      pagePlaceholder: "{page}",
    };
  },
  onCreate() {
    const targetNode = this.editor.view.dom;
    targetNode.classList.add("rm-with-pagination");
    const config = { attributes: true };
    const _pageHeaderHeight = this.options.pageHeaderHeight;
    const _pageHeight = this.options.pageHeight - _pageHeaderHeight * 2;

    const style = document.createElement("style");
    style.dataset.rmPaginationStyle = "";

    style.textContent = `
      .rm-with-pagination {
        counter-reset: page-number;
      }
      .rm-with-pagination .rm-first-page-header,
      .rm-with-pagination .rm-page-header {
        counter-increment: page-number;
      }
      .rm-with-pagination .rm-page-break:last-child .rm-pagination-gap {
        display: none;
      }
      .rm-with-pagination .rm-page-break:last-child .rm-page-header {
        display: none;
      }
      
      .rm-with-pagination table tr td,
      .rm-with-pagination table tr th {
        word-break: break-all;
      }
      .rm-with-pagination table > tr {
        display: grid;
        min-width: 100%;
      }
      .rm-with-pagination table {
        border-collapse: collapse;
        width: 100%;
        display: contents;
      }
      .rm-with-pagination table tbody{
        display: table;
        max-height: 300px;
        overflow-y: auto;
      }
      .rm-with-pagination table tbody > tr{
        display: table-row !important;
      }
      .rm-with-pagination p:has(br.ProseMirror-trailingBreak:only-child) {
        display: table;
        width: 100%;
      }
      .rm-with-pagination .table-row-group {
        max-height: ${_pageHeight}px;
        overflow-y: auto;
        width: 100%;
      }
      .rm-with-pagination .rm-page-header,
      .rm-with-pagination .rm-page-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 0 1in;
      }

      .rm-with-pagination .rm-page-footer-left,
      .rm-with-pagination .rm-page-footer-right,
      .rm-with-pagination .rm-page-header-left,
      .rm-with-pagination .rm-page-header-right {
        display: flex;
        align-items: center;
        height: 100%;
      }
      .rm-with-pagination .rm-page-number::before {
        content: counter(page-number);
      }
      .rm-with-pagination .rm-first-page-header{
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        height: 100%;
      }

       .rm-page-header:has(input),
  .rm-first-page-header:has(input) {
    border-bottom: 2px solid
  }

  /* Add a line at the top of the footer when it's being edited */
  .rm-page-footer:has(input) {
    border-top: 2px solid
  }

    `;
    document.head.appendChild(style);

    const refreshPage = (targetNode: HTMLElement) => {
      const paginationElement = targetNode.querySelector(
        "[data-rm-pagination]"
      );
      if (paginationElement) {
        const lastPageBreak = paginationElement.lastElementChild?.querySelector(
          ".breaker"
        ) as HTMLElement;
        if (lastPageBreak) {
          const minHeight =
            lastPageBreak.offsetTop + lastPageBreak.offsetHeight;
          targetNode.style.minHeight = `${minHeight}px`;
        }
      }
    };

    const callback = (
      mutationList: MutationRecord[],
      observer: MutationObserver
    ) => {
      if (mutationList.length > 0 && mutationList[0].target) {
        const _target = mutationList[0].target as HTMLElement;
        if (_target.classList.contains("rm-with-pagination")) {
          const currentPageCount = getExistingPageCount(this.editor.view);
          const pageCount = calculatePageCount(this.editor.view, this.options);
          if (currentPageCount !== pageCount) {
            
               const tr = this.editor.view.state.tr.setMeta(
                 page_count_meta_key,
                 Date.now()
               );
               this.editor.view.dispatch(tr);
          }

          refreshPage(_target);
        }
      }
    };
    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
    refreshPage(targetNode);
  },
  addProseMirrorPlugins() {
    const pageOptions = this.options;
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("pagination"),

        state: {
          init(_, state) {
            const widgetList = createDecoration(state, pageOptions, editor);
            return DecorationSet.create(state.doc, widgetList);
          },
          apply(tr, oldDeco, oldState, newState) {
            const pageCount = calculatePageCount(editor.view, pageOptions);
            const currentPageCount = getExistingPageCount(editor.view);
            
            // Check if forced update via meta key
            const headerUpdate = tr.getMeta(header_footer_update_meta_key);
            
            // Rebuild decorations if page count changed OR header/footer content changed OR forced update
            if ((pageCount > 1 ? pageCount : 1) !== currentPageCount || headerUpdate) {
              const widgetList = createDecoration(newState, pageOptions, editor);
              return DecorationSet.create(newState.doc, [...widgetList]);
            }
            return oldDeco;
          },
        },

        props: {
          decorations(state: EditorState) {
            return this.getState(state) as DecorationSet;
          },
        },
      }),
    ];
  },
});

// Helper functions to get content boundaries excluding header/footer nodes
const getContentChildren = (editorDom: Element): Element[] => {
  const children = Array.from(editorDom.children);
  return children.filter(child =>
    child.getAttribute('data-type') !== 'header' &&
    child.getAttribute('data-type') !== 'footer' &&
    !child.hasAttribute('data-rm-pagination')
  );
};

const getLastContentElement = (editorDom: Element): Element | null => {
  const contentChildren = getContentChildren(editorDom);
  return contentChildren.length > 0 ? contentChildren[contentChildren.length - 1] : null;
};

const getExistingPageCount = (view: EditorView) => {
  const editorDom = view.dom;
  const paginationElement = editorDom.querySelector("[data-rm-pagination]");
  if (paginationElement) {
    return paginationElement.children.length;
  }
  return 0;
};
const calculatePageCount = (
  view: EditorView,
  pageOptions: PaginationPlusOptions
) => {
  const editorDom = view.dom;
  const pageContentAreaHeight =
    pageOptions.pageHeight - pageOptions.pageHeaderHeight * 2;
  const paginationElement = editorDom.querySelector("[data-rm-pagination]");
  const currentPageCount = getExistingPageCount(view);
  if (paginationElement) {
    // Use helper function to get the last content element, excluding header/footer
    const lastElementOfEditor = getLastContentElement(editorDom);
    const lastPageBreak =
      paginationElement.lastElementChild?.querySelector(".breaker");
    if (lastElementOfEditor && lastPageBreak) {
      const lastPageGap =
        lastElementOfEditor.getBoundingClientRect().bottom -
        lastPageBreak.getBoundingClientRect().bottom;
      if (lastPageGap > 0) {
        const addPage = Math.ceil(lastPageGap / pageContentAreaHeight);
        return currentPageCount + addPage;
      } else {
        const lpFrom = -pageOptions.pageHeaderHeight;
        const lpTo = -(pageOptions.pageHeight - pageOptions.pageHeaderHeight);
        if (lastPageGap > lpTo && lastPageGap < lpFrom) {
          return currentPageCount;
        } else if (lastPageGap < lpTo) {
          const pageHeightOnRemove =
            pageOptions.pageHeight + pageOptions.pageGap;
          const removePage = Math.floor(lastPageGap / pageHeightOnRemove);
          return currentPageCount + removePage;
        } else {
          return currentPageCount;
        }
      }
    }
    return 1;
  } else {
    const editorHeight = editorDom.scrollHeight;
    const pageCount = Math.ceil(editorHeight / pageContentAreaHeight);
    return pageCount <= 0 ? 1 : pageCount;
  }
};

function createDecoration(
  state: EditorState,
  pageOptions: PaginationPlusOptions,
  editor: Editor
): Decoration[] {


  // Helper function to make an element editable on double-click
  const makeEditable = (
    triggerElement: HTMLElement,
    targetElement: HTMLElement,
    type: 'header' | 'footer',
    getContent: () => string,
    onSave: (newContent: string) => void
  ) => {
    triggerElement.addEventListener("dblclick", () => {
      // Prevent editing if an input is already present
      if (targetElement.querySelector("input")) {
        return;
      }

      const originalText = getContent();
      const originalHtml = targetElement.innerHTML;
      console.log(originalHtml);
      console.log(originalText);
      targetElement.innerHTML = ""; // Clear current content

      const input = document.createElement("input");
      input.type = "text";
      input.value = originalText;
      input.style.textAlign = type === 'header' ? 'right' : 'left';
      input.style.width = "100%";
      input.style.boxSizing = "border-box";
      input.style.border = "none";
      input.style.outline = "none";

      // Stop Tiptap from interfering with typing
      const swallow = (e: Event) => e.stopPropagation();
      ['keydown', 'keypress', 'keyup'].forEach(ev =>
        input.addEventListener(ev, swallow, true)
      );

      const saveChanges = () => {
        if (input.value !== originalText) {
          onSave(input.value);
        } else {
          targetElement.innerHTML = originalHtml;
        }
      };

      input.addEventListener("blur", saveChanges);
      input.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveChanges();
        } else if (e.key === "Escape") {
          targetElement.innerHTML = originalHtml;
        }
      });

      targetElement.appendChild(input);
      input.focus();
      input.select();
    });
  };


  const pageWidget = Decoration.widget(
    0,
    (view) => {
      const _pageGap = pageOptions.pageGap;
      const _pageHeaderHeight = pageOptions.pageHeaderHeight;
      const _pageHeight = pageOptions.pageHeight - _pageHeaderHeight * 2;
      const _pageBreakBackground = pageOptions.pageBreakBackground;

      const breakerWidth = view.dom.clientWidth;

      const el = document.createElement("div");
      el.dataset.rmPagination = "true";

      const serializer = DOMSerializer.fromSchema(state.schema);

      const pageBreakDefinition = () => {
        const pageContainer = document.createElement("div");
        pageContainer.classList.add("rm-page-break");

        const page = document.createElement("div");
        page.classList.add("page");
        page.style.position = "relative";
        page.style.float = "left";
        page.style.clear = "both";
        page.style.marginTop = _pageHeight + "px";

        const pageBreak = document.createElement("div");
        pageBreak.classList.add("breaker");
        pageBreak.style.width = `calc(${breakerWidth}px)`;
        pageBreak.style.marginLeft = `calc(calc(calc(${breakerWidth}px - 100%) / 2) - calc(${breakerWidth}px - 100%))`;
        pageBreak.style.marginRight = `calc(calc(calc(${breakerWidth}px - 100%) / 2) - calc(${breakerWidth}px - 100%))`;
        pageBreak.style.position = "relative";
        pageBreak.style.float = "left";
        pageBreak.style.clear = "both";
        pageBreak.style.left = "0px";
        pageBreak.style.right = "0px";
        pageBreak.style.zIndex = "2";

        const pageFooter = document.createElement("div");
        pageFooter.classList.add("rm-page-footer");
        pageFooter.style.height = _pageHeaderHeight + "px";

        // Find the footer node for this page
        const footerNode = state.doc.lastChild?.type.name === 'footer'
        ? state.doc.lastChild
        : null;
        
        const footerFragment = footerNode
          ? serializer.serializeFragment(footerNode.content)
          : null;

        const pageFooterLeft = document.createElement("div");
        pageFooterLeft.classList.add("rm-page-footer-left");
        if (footerFragment) {
          pageFooterLeft.appendChild(footerFragment.cloneNode(true));
        } else {
          pageFooterLeft.innerHTML = pageOptions.footerLeft;
        }

        makeEditable(
          pageFooter,
          pageFooterLeft,
          'footer',
          () => footerNode?.textContent || pageOptions.footerLeft, // Get content from the node
          (newContent) => {
            editor.chain().focus().setFooterContent(newContent).run();
          }
        );

        const pageFooterRight = document.createElement("div");
        pageFooterRight.classList.add("rm-page-footer-right");
        pageFooterRight.innerHTML = pageOptions.footerRight;

        pageFooter.append(pageFooterLeft);
        pageFooter.append(pageFooterRight);

        const pageSpace = document.createElement("div");
        pageSpace.classList.add("rm-pagination-gap");
        pageSpace.style.height = _pageGap + "px";
        pageSpace.style.borderLeft = "1px solid";
        pageSpace.style.borderRight = "1px solid";
        pageSpace.style.position = "relative";
        pageSpace.style.setProperty("width", "calc(100% + 2px)", "important");
        pageSpace.style.left = "-1px";
        pageSpace.style.backgroundColor = _pageBreakBackground;
        pageSpace.style.borderLeftColor = _pageBreakBackground;
        pageSpace.style.borderRightColor = _pageBreakBackground;

        const pageHeader = document.createElement("div");
        pageHeader.classList.add("rm-page-header");
        pageHeader.style.height = _pageHeaderHeight + "px";

        const headerNode = state.doc.firstChild?.type.name === 'header'
          ? state.doc.firstChild
          : null;

        const headerFragment = headerNode
          ? serializer.serializeFragment(headerNode.content)
          : null;

        const pageHeaderLeft = document.createElement("div");
        pageHeaderLeft.classList.add("rm-page-header-left");
        pageHeaderLeft.innerHTML = pageOptions.headerLeft;

        const pageHeaderRight = document.createElement("div");
        pageHeaderRight.classList.add("rm-page-header-right");
        if (headerFragment) {
          // Get the text content and replace PAGE_PLACEHOLDER with span
          const tempDiv = document.createElement("div");
          tempDiv.appendChild(headerFragment.cloneNode(true));
          const textContent = tempDiv.innerHTML;
          pageHeaderRight.innerHTML = textContent.replace(pageOptions.pagePlaceholder,   `<span class="rm-page-number"></span>`);
        } else {
          pageHeaderRight.innerHTML = pageOptions.headerRight.replace(pageOptions.pagePlaceholder, `<span class="rm-page-number"></span>`);
        }

        makeEditable(
          pageHeader,
          pageHeaderRight,
          'header',
          () => headerNode?.textContent || pageOptions.headerRight, // Get content from the node
          (newContent) => {
            editor.chain().focus().setHeaderContent(newContent).run();
          }
        );

        pageHeader.append(pageHeaderLeft, pageHeaderRight);
        pageBreak.append(pageFooter, pageSpace, pageHeader);
        pageContainer.append(page, pageBreak);

        return pageContainer;
      };

      const pageCount = calculatePageCount(view, pageOptions);
      const fragment = document.createDocumentFragment();

      for (let i = 0; i < pageCount; i++) {
        fragment.appendChild(pageBreakDefinition());
      }
      el.append(fragment);
      el.id = "pages";

      return el;
    },
    { side: -1 }
  );
  const firstHeaderWidget = Decoration.widget(
    0,
    () => {
      const el = document.createElement("div");
      el.style.position = "relative";
      el.classList.add("rm-first-page-header");

      // Use dynamic header content for first page as well
      const headerNode = state.doc.firstChild?.type.name === 'header'
        ? state.doc.firstChild
        : null;
      
      const pageHeaderLeft = document.createElement("div");
      pageHeaderLeft.classList.add("rm-first-page-header-left");
      pageHeaderLeft.innerHTML = pageOptions.headerLeft;
      el.append(pageHeaderLeft);

      const pageHeaderRight = document.createElement("div");
      pageHeaderRight.classList.add("rm-first-page-header-right");
      if (headerNode) {
        const serializer = DOMSerializer.fromSchema(state.schema);
        const headerFragment = serializer.serializeFragment(headerNode.content);
        const tempDiv = document.createElement("div");
        tempDiv.appendChild(headerFragment.cloneNode(true));
        const textContent = tempDiv.innerHTML;
        pageHeaderRight.innerHTML = textContent.replace(pageOptions.pagePlaceholder, `<span class="rm-page-number"></span>`);
      } else {
        pageHeaderRight.innerHTML = pageOptions.headerRight.replace(pageOptions.pagePlaceholder, `<span class="rm-page-number"></span>`);
      }
      el.append(pageHeaderRight);

      makeEditable(
        el,
        pageHeaderRight,
        'header',
        () => headerNode?.textContent || pageOptions.headerRight, // Get content from the node
        (newContent) => {
          editor.chain().focus().setHeaderContent(newContent).run();
        }
      );

      el.style.height = `${pageOptions.pageHeaderHeight}px`;
      return el;
    },
    { side: -1 }
  );

  return [firstHeaderWidget, pageWidget]
}
