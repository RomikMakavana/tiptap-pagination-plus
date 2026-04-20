import { Editor, Extension } from "@tiptap/core";
import { EditorState, Plugin, PluginKey} from "@tiptap/pm/state";
import { Decoration, DecorationSet, EditorView } from "@tiptap/pm/view";
import { deepEqualIterative, footerClickEvent, getCustomPages, getFooter, getFooterHeight, getHeader, getHeaderHeight, getHeight, headerClickEvent, updateCssVariables } from "./utils";
import { PageSize } from "./constants";
import { HeaderOptions, FooterOptions, PageNumber, HeaderHeightMap, FooterHeightMap, HeaderClickEvent, FooterClickEvent } from "./types";
import type { Node as PMNode } from 'prosemirror-model';

export interface PaginationPlusConfig {
  pageBreakBackground: string;
  pageHeight: number;
  pageWidth: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  pageGap: number;
  contentMarginTop: number;
  contentMarginBottom: number;
  footerRight: string;
  footerLeft: string;
  headerRight: string;
  headerLeft: string;
  customHeader: Record<PageNumber, HeaderOptions>;
  customFooter: Record<PageNumber, FooterOptions>;
}

export interface PaginationPlusOptions extends PaginationPlusConfig {
  pageGapBorderSize: number;
  pageGapBorderColor: string;
  onHeaderClick?: HeaderClickEvent
  onFooterClick?: FooterClickEvent
}

export interface PaginationPlusStorage extends PaginationPlusOptions {
  headerHeight: HeaderHeightMap;
  footerHeight: FooterHeightMap;
  appliedConfig: PaginationPlusConfig;
}

const page_count_meta_key = "PAGE_COUNT_META_KEY";
const footer_height_meta_key = "FOOTER_HEIGHT_META_KEY";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    PaginationPlus: {
      updatePageBreakBackground: (color: string) => ReturnType;
      updatePageSize: (size: PageSize) => ReturnType;
      updatePageHeight: (height: number) => ReturnType;
      updatePageWidth: (width: number) => ReturnType;
      updatePageGap: (gap: number) => ReturnType;
      updateMargins: (margins: { top: number, bottom: number, left: number, right: number }) => ReturnType;
      updateContentMargins: (margins: { top: number, bottom: number }) => ReturnType;
      updateHeaderContent: (left: string, right: string, pageNumber?: PageNumber) => ReturnType;
      updateFooterContent: (left: string, right: string, pageNumber?: PageNumber) => ReturnType;
    };
  }
  interface Storage {
    PaginationPlus: PaginationPlusStorage
  }
}

const key = new PluginKey<DecorationSet>('brDecoration');

function buildDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === 'hardBreak') {
      const afterPos = pos + 1;
      const widget = Decoration.widget(afterPos, () => {
        const el = document.createElement('span');
        el.classList.add('rm-br-decoration');
        return el;
      });
      decorations.push(widget);
    }
  });
  return DecorationSet.create(doc, decorations);

}

const defaultPageConfig: PaginationPlusConfig = {
  pageBreakBackground: "#ffffff",
  pageHeight: 800,
  pageWidth: 789,
  marginTop: 20,
  marginBottom: 20,
  marginLeft: 50,
  marginRight: 50,
  pageGap: 50,
  contentMarginTop: 10,
  contentMarginBottom: 10,
  footerRight: "{page}",
  footerLeft: "",
  headerRight: "",
  headerLeft: "",
  customHeader: {},
  customFooter: {},
}

const defaultOptions: PaginationPlusOptions = {
  pageGapBorderSize: 1,
  pageGapBorderColor: "#e5e5e5",
  ...defaultPageConfig,
}



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
      targetNode.style.minHeight = `calc(${minHeight}px + 2px)`;
    }
  }
};

const getAppliedPageConfig = (_storage: PaginationPlusStorage, _currentOptions: PaginationPlusOptions): PaginationPlusOptions => {
  return {
    ..._currentOptions,
    pageBreakBackground: _storage.appliedConfig.pageBreakBackground ?? defaultOptions.pageBreakBackground,
    pageHeight: _storage.appliedConfig.pageHeight ?? defaultOptions.pageHeight,
    pageWidth: _storage.appliedConfig.pageWidth ?? defaultPageConfig.pageWidth,
    marginTop: _storage.appliedConfig.marginTop ?? defaultPageConfig.marginTop,
    marginBottom: _storage.appliedConfig.marginBottom ?? defaultPageConfig.marginBottom,
    marginLeft: _storage.appliedConfig.marginLeft ?? defaultPageConfig.marginLeft,
    marginRight: _storage.appliedConfig.marginRight ?? defaultPageConfig.marginRight,
    pageGap: _storage.appliedConfig.pageGap ?? defaultPageConfig.pageGap,
    contentMarginTop: _storage.appliedConfig.contentMarginTop ?? defaultPageConfig.contentMarginTop,
    contentMarginBottom: _storage.appliedConfig.contentMarginBottom ?? defaultPageConfig.contentMarginBottom,
    footerRight: _storage.appliedConfig.footerRight ?? defaultPageConfig.footerRight,
    footerLeft: _storage.appliedConfig.footerLeft ?? defaultPageConfig.footerLeft,
    headerRight: _storage.appliedConfig.headerRight ?? defaultPageConfig.headerRight,
    headerLeft: _storage.appliedConfig.headerLeft ?? defaultPageConfig.headerLeft,
    customHeader: _storage.appliedConfig.customHeader ?? defaultPageConfig.customHeader,
    customFooter: _storage.appliedConfig.customFooter ?? defaultPageConfig.customFooter,
  };
}

const getPageConfig = (_storage: PaginationPlusStorage, _currentOptions: PaginationPlusOptions): { config: PaginationPlusConfig, options: PaginationPlusOptions } => {
  const pageConfig: PaginationPlusConfig = {
    pageBreakBackground: _storage.pageBreakBackground ?? defaultOptions.pageBreakBackground,
    pageHeight: _storage.pageHeight ?? defaultOptions.pageHeight,
    pageWidth: _storage.pageWidth ?? defaultPageConfig.pageWidth,
    marginTop: _storage.marginTop ?? defaultPageConfig.marginTop,
    marginBottom: _storage.marginBottom ?? defaultPageConfig.marginBottom,
    marginLeft: _storage.marginLeft ?? defaultPageConfig.marginLeft,
    marginRight: _storage.marginRight ?? defaultPageConfig.marginRight,
    pageGap: _storage.pageGap ?? defaultPageConfig.pageGap,
    contentMarginTop: _storage.contentMarginTop ?? defaultPageConfig.contentMarginTop,
    contentMarginBottom: _storage.contentMarginBottom ?? defaultPageConfig.contentMarginBottom,
    footerRight: _storage.footerRight ?? defaultPageConfig.footerRight,
    footerLeft: _storage.footerLeft ?? defaultPageConfig.footerLeft,
    headerRight: _storage.headerRight ?? defaultPageConfig.headerRight,
    headerLeft: _storage.headerLeft ?? defaultPageConfig.headerLeft,
    customHeader: _storage.customHeader ?? defaultPageConfig.customHeader,
    customFooter: _storage.customFooter ?? defaultPageConfig.customFooter,
  };
  return {
    config: pageConfig,
    options: {
    ..._currentOptions,
    ...pageConfig}
  };
}

const getPageConfigFromOptions = (_currentOptions: PaginationPlusOptions): PaginationPlusConfig => {
  return {
    pageBreakBackground: _currentOptions.pageBreakBackground ?? defaultOptions.pageBreakBackground,
    pageHeight: _currentOptions.pageHeight ?? defaultOptions.pageHeight,
    pageWidth: _currentOptions.pageWidth ?? defaultPageConfig.pageWidth,
    marginTop: _currentOptions.marginTop ?? defaultPageConfig.marginTop,
    marginBottom: _currentOptions.marginBottom ?? defaultPageConfig.marginBottom,
    marginLeft: _currentOptions.marginLeft ?? defaultPageConfig.marginLeft,
    marginRight: _currentOptions.marginRight ?? defaultPageConfig.marginRight,
    pageGap: _currentOptions.pageGap ?? defaultPageConfig.pageGap,
    contentMarginTop: _currentOptions.contentMarginTop ?? defaultPageConfig.contentMarginTop,
    contentMarginBottom: _currentOptions.contentMarginBottom ?? defaultPageConfig.contentMarginBottom,
    footerRight: _currentOptions.footerRight ?? defaultPageConfig.footerRight,
    footerLeft: _currentOptions.footerLeft ?? defaultPageConfig.footerLeft,
    headerRight: _currentOptions.headerRight ?? defaultPageConfig.headerRight,
    headerLeft: _currentOptions.headerLeft ?? defaultPageConfig.headerLeft,
    customHeader: _currentOptions.customHeader ?? defaultPageConfig.customHeader,
    customFooter: _currentOptions.customFooter ?? defaultPageConfig.customFooter,
  };
}

const paginationKey = new PluginKey("pagination");

// Shared by Plugin.state.apply and view.update to decide whether the
// currently-applied page config differs from the desired one.
function isConfigDirty(storage: PaginationPlusStorage): boolean {
  const a = storage.appliedConfig;
  return (
    storage.pageBreakBackground !== a.pageBreakBackground ||
    storage.pageHeight !== a.pageHeight ||
    storage.pageWidth !== a.pageWidth ||
    storage.marginTop !== a.marginTop ||
    storage.marginBottom !== a.marginBottom ||
    storage.marginLeft !== a.marginLeft ||
    storage.marginRight !== a.marginRight ||
    storage.pageGap !== a.pageGap ||
    storage.contentMarginTop !== a.contentMarginTop ||
    storage.contentMarginBottom !== a.contentMarginBottom ||
    storage.headerLeft !== a.headerLeft ||
    storage.headerRight !== a.headerRight ||
    storage.footerLeft !== a.footerLeft ||
    storage.footerRight !== a.footerRight ||
    !deepEqualIterative(a.customHeader, storage.customHeader) ||
    !deepEqualIterative(a.customFooter, storage.customFooter)
  );
}

export const PaginationPlus = Extension.create<PaginationPlusOptions, PaginationPlusStorage>({
  name: "PaginationPlus",
  addOptions() {
    return defaultOptions;
  },
  addStorage() {
    return {
      ...defaultOptions,
      headerHeight: new Map(),
      footerHeight: new Map(),
      appliedConfig: defaultPageConfig,
    };
  },
  onCreate() {

    const { options: _currentOptions } = getPageConfig(this.storage, this.options);
    const pageConfig = getPageConfigFromOptions(this.options);

    const targetNode = this.editor.view.dom;
    targetNode.classList.add("rm-with-pagination");
    targetNode.style.border = `1px solid var(--rm-page-gap-border-color)`;
    targetNode.style.paddingLeft = `var(--rm-margin-left)`;
    targetNode.style.paddingRight = `var(--rm-margin-right)`;
    targetNode.style.width = `var(--rm-page-width)`;

    updateCssVariables(targetNode, {..._currentOptions, ...pageConfig});

    const style = document.createElement("style");
    style.dataset.rmPaginationStyle = "";

    style.textContent = `
      .rm-pagination-gap{
        border-top: 1px solid;
        border-bottom: 1px solid;
        border-color: var(--rm-page-gap-border-color);
      }
      .rm-with-pagination,
      .rm-with-pagination .rm-first-page-header {
        counter-reset: page-number page-number-plus 1;
      }
      .rm-with-pagination .image-plus-wrapper,
      .rm-with-pagination .table-plus td,
      .rm-with-pagination .table-plus th {
        max-height: var(--rm-max-content-child-height);
        overflow-y: auto;
      }
      .rm-with-pagination .image-plus-wrapper {
        overflow-y: visible;
      }
      .rm-with-pagination .rm-page-break {
        counter-increment: page-number page-number-plus;
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
      .rm-with-pagination *:has(>br.ProseMirror-trailingBreak:only-child) {
        display: table;
        width: 100%;
      }
      .rm-with-pagination .rm-br-decoration {
        display: table;
        width: 100%;
      }
      .rm-with-pagination .table-row-group {
        max-height: var(--rm-max-content-child-height);
        overflow-y: auto;
        width: 100%;
      }
      .rm-with-pagination .rm-page-footer-left,
      .rm-with-pagination .rm-page-footer-right,
      .rm-with-pagination .rm-page-header-left,
      .rm-with-pagination .rm-page-header-right {
        display: inline-block;
      }
      
      .rm-with-pagination .rm-page-header-left,
      .rm-with-pagination .rm-page-footer-left{
        float: left;
        margin-left: var(--rm-margin-left);
      }
      .rm-with-pagination .rm-page-header-right,
      .rm-with-pagination .rm-page-footer-right{
        float: right;
        margin-right: var(--rm-margin-right);
      }
      .rm-with-pagination .rm-first-page-header .rm-page-header-right{
        margin-right: 0px !important;
      }
      .rm-with-pagination .rm-first-page-header .rm-page-header-left{
        margin-left: 0px !important;
      }
      .rm-with-pagination .rm-page-number::before {
        content: counter(page-number);
      }
      .rm-with-pagination .rm-page-number-plus::before {
        content: counter(page-number-plus);
      }
      .rm-with-pagination .rm-page-header,
      .rm-with-pagination .rm-page-footer{
        width: 100%;
      }
      .rm-with-pagination .rm-page-header{
        padding-bottom: var(--rm-content-margin-top) !important;
        padding-top: var(--rm-margin-top) !important;
        display: inline-flex;
        justify-content: space-between;
        max-height: calc(calc(var(--rm-page-height) * 0.45) - var(--rm-margin-top) - var(--rm-content-margin-top));
        overflow-y: hidden;
      }
      .rm-with-pagination .rm-page-footer{
        padding-top: var(--rm-content-margin-bottom) !important;
        padding-bottom: var(--rm-margin-bottom) !important;
        display: inline-flex;
        justify-content: space-between;
        max-height: calc(calc(var(--rm-page-height) * 0.45) - var(--rm-content-margin-bottom) - var(--rm-margin-bottom));
        overflow-y: hidden;
      }
    `;
    document.head.appendChild(style);
    refreshPage(targetNode);
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    const storage = this.storage;
    return [
      new Plugin({
        key: paginationKey,

        state: {
          init: (_, state) => {
            const _currentOptions =  getPageConfigFromOptions(this.options);

            const pageConfig = getPageConfigFromOptions(this.options);
            const widgetList = createDecoration({...this.options, ..._currentOptions}, new Map(), new Map());

            storage.pageBreakBackground = _currentOptions.pageBreakBackground;
            storage.pageHeight = _currentOptions.pageHeight;
            storage.pageWidth = _currentOptions.pageWidth;
            storage.marginTop = _currentOptions.marginTop;
            storage.marginBottom = _currentOptions.marginBottom;
            storage.marginLeft = _currentOptions.marginLeft;
            storage.marginRight = _currentOptions.marginRight;
            storage.pageGap = _currentOptions.pageGap;
            storage.contentMarginTop = _currentOptions.contentMarginTop;
            storage.contentMarginBottom = _currentOptions.contentMarginBottom;
            storage.footerRight = _currentOptions.footerRight;
            storage.footerLeft = _currentOptions.footerLeft;
            storage.headerRight = _currentOptions.headerRight;
            storage.headerLeft = _currentOptions.headerLeft;
            storage.customHeader = _currentOptions.customHeader;
            storage.customFooter = _currentOptions.customFooter;
            storage.headerHeight = new Map();
            storage.footerHeight = new Map();
            storage.appliedConfig = pageConfig;

            return {
              decorations : DecorationSet.create(state.doc, widgetList),
            };
          },
          apply: (tr, oldDeco, oldState, newState) => {
            const { options: _currentOptions, config: pageConfig } =  getPageConfig(storage, this.options);

            const pageCount = getNewPageCount(editor.view, {..._currentOptions, ...pageConfig});
            const currentPageCount = getExistingPageCount(editor.view);
            const getNewDecoration = () => {
              const { options: _currentOptions, config: pageConfig } =  getPageConfig(storage, this.options);

              updateCssVariables(editor.view.dom, _currentOptions);

              let headerHeight = "headerHeight" in this.storage ? this.storage.headerHeight : new Map();
              let footerHeight = "footerHeight" in this.storage ? this.storage.footerHeight : new Map();

              const widgetList = createDecoration({..._currentOptions, ...pageConfig}, headerHeight, footerHeight);


              storage.appliedConfig = pageConfig;
              storage.headerHeight = headerHeight;
              storage.footerHeight = footerHeight;

              return {
                decorations : DecorationSet.create(newState.doc, [...widgetList]),
                footerHeight
              };
            }

            if (
              (pageCount > 1 ? pageCount : 1) !== currentPageCount ||
              isConfigDirty(storage)
            ) {
              return getNewDecoration();
            }

            return oldDeco;
          },
         
        },

        props: {
          decorations(state: EditorState) {
            return this.getState(state)?.decorations as DecorationSet;
          },
        },
        view: (editorView: EditorView) => {
          // Pagination has to run repeatedly after mount until the widget's
          // page count matches what layout wants. `converged` gates the
          // early-bail in `update` below: while false we must not skip the
          // layout-read pass; once the widget has caught up we can safely
          // bail on selection-only / meta-only transactions.
          let rafHandle: number | null = null;
          let destroyed = false;
          let converged = false;
          // Set while iterateUntilStable is running so the ResizeObserver
          // below doesn't re-trigger convergence from its own side effects
          // (adding pages grows the editor, which the observer then sees).
          let iterating = false;

          const MAX_CONVERGE_ITER = 50;

          // True when content extends past the last rendered page break.
          // Uses scrollHeight rather than editorDom.lastElementChild.bottom
          // because consumers often use CSS tricks (e.g. `display: contents`
          // on tables to hoist rows into the editor's layout) that make the
          // last DOM child not the visually-lowest descendant.
          const isPaginationInsufficient = (): boolean => {
            const editorDom = editorView.dom;
            const paginationEl = editorDom.querySelector("[data-rm-pagination]");
            if (!paginationEl) return false;
            const lastBreak = paginationEl.lastElementChild;
            if (!lastBreak) return false;
            const lastBreaker = lastBreak.querySelector(".breaker");
            if (!lastBreaker) return false;
            const editorRect = editorDom.getBoundingClientRect();
            const breakerBottomInEditor =
              lastBreaker.getBoundingClientRect().bottom - editorRect.top;
            const contentBottomInEditor = editorDom.scrollHeight;
            return contentBottomInEditor > breakerBottomInEditor + 1;
          };

          // Converge pagination inside a single animation frame.  Each
          // dispatch re-runs Plugin.state.apply, which reads layout and
          // rebuilds the widget when needed; we loop until the content no
          // longer overflows past the last break.  Without this, the
          // original one-rAF-per-iteration scheme made fast scrolls reveal
          // unfinished layout (pages missing breaks at the bottom).
          const iterateUntilStable = () => {
            if (destroyed) return;
            iterating = true;
            try {
              // Always do one dispatch — kicks convergence even when the
              // widget was first constructed before layout existed, so
              // currentPageCount can correctly reflect the rendered DOM.
              editorView.dispatch(
                editorView.state.tr.setMeta(page_count_meta_key, {})
              );
              let i = 0;
              for (; i < MAX_CONVERGE_ITER && isPaginationInsufficient(); i++) {
                editorView.dispatch(
                  editorView.state.tr.setMeta(page_count_meta_key, {})
                );
              }
              if (i === MAX_CONVERGE_ITER && isPaginationInsufficient()) {
                console.warn(
                  "[PaginationPlus] pagination did not converge within",
                  MAX_CONVERGE_ITER,
                  "iterations; bottom of editor may be missing page breaks."
                );
              }
            } finally {
              iterating = false;
            }
            if (rafHandle !== null) {
              cancelAnimationFrame(rafHandle);
              rafHandle = null;
            }
          };

          // ProseMirror only calls pluginView.update on state changes, and
          // TipTap's setup doesn't reliably dispatch one post-mount.
          // Without this kick, pagination would sit at pageCount = 1 until
          // the user clicks / types / focuses the editor.
          const kickRafHandle = requestAnimationFrame(iterateUntilStable);

          // Re-converge when the editor's rendered size changes after
          // initial convergence. Fonts loading, images loading, CSS
          // transitions settling, and window resizes all change scrollHeight
          // without dispatching a ProseMirror transaction, so update never
          // sees them.
          let resizeObserver: ResizeObserver | null = null;
          if (typeof ResizeObserver !== "undefined") {
            let lastSeenHeight = editorView.dom.scrollHeight;
            resizeObserver = new ResizeObserver(() => {
              if (destroyed) return;
              // Skip callbacks caused by our own dispatches.
              if (iterating) return;
              const currentHeight = editorView.dom.scrollHeight;
              if (Math.abs(currentHeight - lastSeenHeight) < 2) return;
              lastSeenHeight = currentHeight;
              if (rafHandle !== null) cancelAnimationFrame(rafHandle);
              rafHandle = requestAnimationFrame(() => {
                rafHandle = null;
                iterateUntilStable();
                // Resync after iteration so later resizes are measured from
                // the new steady state, not the pre-iteration size.
                lastSeenHeight = editorView.dom.scrollHeight;
              });
            });
            resizeObserver.observe(editorView.dom);
          }

          return {
            update: (view: EditorView, prevState?: EditorState) => {
              // Skip the heavy pass when nothing that affects pagination has
              // changed. Gate on `converged` so the initial layout loop can
              // actually converge after mount.
              const configDirty = isConfigDirty(storage);
              if (
                converged &&
                prevState &&
                view.state.doc === prevState.doc &&
                !configDirty
              ) {
                return;
              }

              const { options: _currentOptions, config: pageConfig } = getPageConfig(storage, this.options);
              const pageCount = getNewPageCount(view, {..._currentOptions, ...pageConfig});
              const currentPageCount = getExistingPageCount(view);

              const triggerUpdate = () => {
                // Schedule one rAF; its callback iterates to steady state.
                if (rafHandle !== null) cancelAnimationFrame(rafHandle);
                rafHandle = requestAnimationFrame(() => {
                  rafHandle = null;
                  iterateUntilStable();
                });
              };

              if (currentPageCount !== pageCount) {
                converged = false;
                triggerUpdate();
                return;
              }

              const headerHeight = getHeaderHeight(view.dom, getCustomPages(_currentOptions.customHeader, {}), "content");
              const footerHeight = getFooterHeight(view.dom, getCustomPages({}, _currentOptions.customFooter), "content");

              const footerHeightForCurrentPages = new Map<PageNumber, number>();
              for (let i = 0; i <= pageCount; i++) {
                if (footerHeight.has(i)) {
                  footerHeightForCurrentPages.set(i, footerHeight.get(i) || 0);
                }
              }

              const headerHeightForCurrentPages = new Map<PageNumber, number>();
              for (let i = 0; i <= pageCount; i++) {
                if (headerHeight.has(i)) {
                  headerHeightForCurrentPages.set(i, headerHeight.get(i) || 0);
                }
              }

              const pagesSetToCheck = new Set([1, ...footerHeightForCurrentPages.keys(), ...headerHeightForCurrentPages.keys()]);

              let missingPageNumber: PageNumber | undefined = undefined;
              for (let i = 1; i <= pageCount; i++) {
                if (!pagesSetToCheck.has(i)) {
                  missingPageNumber = i;
                  break;
                }
              }

              if (missingPageNumber) {
                pagesSetToCheck.add(missingPageNumber);
              }

              pagesSetToCheck.delete(0);
              let pageContentHeightVariable: Record<string, string> = {};
              let maxContentHeight: number | undefined = undefined;
              for (const page of pagesSetToCheck) {
                const headerHeight = headerHeightForCurrentPages.has(page) ? headerHeightForCurrentPages.get(page) || 0 : headerHeightForCurrentPages.get(0) || 0;
                const footerHeight = footerHeightForCurrentPages.has(page) ? footerHeightForCurrentPages.get(page) || 0 : footerHeightForCurrentPages.get(0) || 0;
                const { _pageHeaderHeight, _pageHeight } = getHeight(_currentOptions, headerHeight, footerHeight);

                const contentHeight = page === 1 ? _pageHeight + _pageHeaderHeight : _pageHeight;
                if (page === 1) {
                  pageContentHeightVariable[`rm-page-content-first`] = `${contentHeight}px`;
                }
                if (page === missingPageNumber) {
                  pageContentHeightVariable[`rm-page-content-general`] = `${contentHeight}px`;
                } else {
                  pageContentHeightVariable[`rm-page-content-${page}`] = `${contentHeight}px`;
                }
                if (maxContentHeight === undefined || contentHeight < maxContentHeight) {
                  maxContentHeight = contentHeight;
                }
              }

              if (maxContentHeight) {
                view.dom.style.setProperty(`--rm-max-content-child-height`, `${maxContentHeight - 10}px`);
              }
              Object.entries(pageContentHeightVariable).forEach(([key, value]) => {
                view.dom.style.setProperty(`--${key}`, value);
              });
              refreshPage(view.dom);

              // Steady state — matches layout, CSS variables written.
              converged = true;
            },
            destroy: () => {
              destroyed = true;
              cancelAnimationFrame(kickRafHandle);
              if (rafHandle !== null) cancelAnimationFrame(rafHandle);
              if (resizeObserver) resizeObserver.disconnect();
            },
          };
        }
      }),
      new Plugin<DecorationSet>({
        key,

        state: {
          init(_, state) {
            return buildDecorations(state.doc);
          },

          apply(tr, old) {
            if (!tr.docChanged) return old;
            // Map existing hard-break widgets through the transaction so
            // decorations on unchanged ranges stay in place without a full
            // document rescan. Only scan the ranges touched by this
            // transaction's steps to detect added/removed hardBreak nodes.
            // Previously this plugin called buildDecorations(tr.doc) on every
            // content-changing transaction — O(doc size) per keystroke, which
            // dominates latency for large documents.
            let set = old.map(tr.mapping, tr.doc);
            const ranges: Array<[number, number]> = [];
            tr.mapping.maps.forEach((stepMap, i) => {
              stepMap.forEach((_oldFrom, _oldTo, newFrom, newTo) => {
                let from = newFrom;
                let to = newTo;
                for (let j = i + 1; j < tr.mapping.maps.length; j++) {
                  from = tr.mapping.maps[j].map(from, -1);
                  to = tr.mapping.maps[j].map(to, 1);
                }
                ranges.push([
                  Math.max(0, from - 1),
                  Math.min(tr.doc.content.size, to + 1),
                ]);
              });
            });
            if (ranges.length === 0) return set;
            const toRemove: Decoration[] = [];
            const toAdd: Decoration[] = [];
            for (const [from, to] of ranges) {
              toRemove.push(...set.find(from, to));
              tr.doc.nodesBetween(from, to, (node, pos) => {
                if (node.type.name === "hardBreak") {
                  toAdd.push(
                    Decoration.widget(pos + 1, () => {
                      const el = document.createElement("span");
                      el.classList.add("rm-br-decoration");
                      return el;
                    })
                  );
                }
              });
            }
            if (toRemove.length === 0 && toAdd.length === 0) return set;
            return set.remove(toRemove).add(tr.doc, toAdd);
          }
        },

        props: {
          decorations(state) {
            return key.getState(state) ?? DecorationSet.empty;
          }
        }
      }),
    ];
  },
  addCommands() {
    return {
      updatePageBreakBackground: (color: string) => () => {
        this.storage.pageBreakBackground = color;
        return true;
      },
      updatePageSize: (size: PageSize) => () => {
        
        this.storage.pageHeight = size.pageHeight;
        this.storage.pageWidth = size.pageWidth;
        this.storage.marginTop = size.marginTop;
        this.storage.marginBottom = size.marginBottom;
        this.storage.marginLeft = size.marginLeft;
        this.storage.marginRight = size.marginRight;
        return true;
      },
      updatePageWidth: (width: number) => () => {
        this.storage.pageWidth = width;
        return true;
      },
      updatePageHeight: (height: number) => () => {
        this.storage.pageHeight = height;
        return true;
      },
      updatePageGap: (gap: number) => () => {
        this.storage.pageGap = gap;
        return true;
      },
      updateMargins: (margins: { top: number, bottom: number, left: number, right: number }) => () => {
        this.storage.marginTop = margins.top;
        this.storage.marginBottom = margins.bottom;
        this.storage.marginLeft = margins.left;
        this.storage.marginRight = margins.right;
        return true;
      },
      updateContentMargins: (margins: { top: number, bottom: number }) => () => {
        this.storage.contentMarginTop = margins.top;
        this.storage.contentMarginBottom = margins.bottom;
        return true;
      },
      updateHeaderContent: (left: string, right: string, pageNumber?: PageNumber) => () => {
        if(pageNumber) {
          this.storage.customHeader = { ...this.storage.customHeader, [pageNumber]: { headerLeft: left, headerRight: right } };
        }else{
          this.storage.headerLeft = left;
          this.storage.headerRight = right;
        }
        return true;
      },
      updateFooterContent: (left: string, right: string, pageNumber?: PageNumber) => () => {
        if(pageNumber) {
          this.storage.customFooter = { ...this.storage.customFooter, [pageNumber]: { footerLeft: left, footerRight: right } };
        }else{
          this.storage.footerLeft = left;
          this.storage.footerRight = right;
        }
        return true;
      },
    };
  },
});

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
  pageOptions: PaginationPlusOptions,
  headerHeight: number = 0,
  footerHeight: number = 0
) => {
  const editorDom = view.dom;

  const _pageHeaderHeight = pageOptions.contentMarginTop + pageOptions.marginTop + headerHeight;
  const _pageFooterHeight = pageOptions.contentMarginBottom + pageOptions.marginBottom + footerHeight;

  const pageContentAreaHeight =
    pageOptions.pageHeight - _pageHeaderHeight - _pageFooterHeight;


  const paginationElement = editorDom.querySelector("[data-rm-pagination]");
  const currentPageCount = getExistingPageCount(view);
  if (paginationElement) {
    const lastPageBreak =
      paginationElement.lastElementChild?.querySelector(".breaker");
    if (lastPageBreak) {
      // Use editorDom.scrollHeight as the content extent, not
      // lastElementChild.getBoundingClientRect().bottom. When consumers apply
      // `display: contents` to tables so rows participate directly in the
      // editor's layout (a common trick for CSS grid styling), the last DOM
      // child may not be the visually-lowest descendant — the previous
      // formula undercounted pages.
      const editorRect = editorDom.getBoundingClientRect();
      const lastPageBreakRect = lastPageBreak.getBoundingClientRect();
      const breakerBottomInEditor = lastPageBreakRect.bottom - editorRect.top;
      const contentBottomInEditor = editorDom.scrollHeight;
      const lastPageGap = contentBottomInEditor - breakerBottomInEditor;
      if (lastPageGap > 0) {
        const addPage = Math.ceil(lastPageGap / pageContentAreaHeight);
        return currentPageCount + addPage;
      } else {
        const allBreaksAfterLastElement = Array.from(paginationElement.querySelectorAll(".breaker"));
        const allBreaksAfterLastElementRect = allBreaksAfterLastElement.filter(
          (element) => element.getBoundingClientRect().top - editorRect.top > contentBottomInEditor
        );
        const removePage = allBreaksAfterLastElementRect.length;
        if (removePage > 1) {
          return currentPageCount - removePage;
        } else {
          return currentPageCount;
        }
      }
    }
    return 1;
  } else {
    const editorHeight = editorDom.scrollHeight;
    let pageCount = Math.ceil(editorHeight / pageContentAreaHeight);
    pageCount = pageCount <= 0 ? 1 : pageCount;
    return pageCount;
  }
};

const getNewPageCount = (view: EditorView, pageOptions: PaginationPlusOptions) => {
  const pageCount = calculatePageCount(view, pageOptions);
  return pageCount <= 1 ? 1 : pageCount;
}

function createDecoration(
  pageOptions: PaginationPlusOptions,
  headerHeightMap: HeaderHeightMap,
  footerHeightMap: FooterHeightMap
): Decoration[] {

  const commonHeaderOptions = { headerLeft: pageOptions.headerLeft, headerRight: pageOptions.headerRight };
  const commonFooterOptions = { footerLeft: pageOptions.footerLeft, footerRight: pageOptions.footerRight };
      

  const pageWidget = Decoration.widget(
    0,
    (view) => {
      const _pageGap = pageOptions.pageGap;
      const _pageBreakBackground = pageOptions.pageBreakBackground;
      

      const el = document.createElement("div");
      el.dataset.rmPagination = "true";

      const pageBreakDefinition = (firstPage: boolean, pageHeader: HTMLElement, pageFooter: HTMLElement, headerHeight: number, footerHeight: number, pageNumber?: PageNumber) => {
        const { _pageHeaderHeight, _pageHeight } = getHeight(pageOptions, headerHeight, footerHeight);

        const pageContainer = document.createElement("div");
        pageContainer.classList.add("rm-page-break");

        const page = document.createElement("div");
        page.classList.add("page");
        page.style.position = "relative";
        page.style.float = "left";
        page.style.clear = "both";
        const marginTop = firstPage
          ? `calc(${_pageHeaderHeight}px + ${_pageHeight}px)`
          : _pageHeight + "px";
        if(pageNumber) {
          page.style.marginTop = `var(--rm-page-content-${pageNumber}, ${marginTop})`;
          }else{
            page.style.marginTop = firstPage
              ? `var(--rm-page-content-first, ${marginTop})`
              : `var(--rm-page-content-general, ${marginTop})`;
          }

        const pageBreak = document.createElement("div");
        pageBreak.classList.add("breaker");
        pageBreak.style.width = `calc(100% + var(--rm-margin-left) + var(--rm-margin-right))`;
        pageBreak.style.marginLeft = `calc(-1 * var(--rm-margin-left))`;
        pageBreak.style.marginRight = `calc(-1 * var(--rm-margin-right))`;
        pageBreak.style.position = "relative";
        pageBreak.style.float = "left";
        pageBreak.style.clear = "both";
        pageBreak.style.left = `0px`;
        pageBreak.style.right = `0px`;
        pageBreak.style.zIndex = "2";

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

        pageBreak.append(pageFooter, pageSpace, pageHeader);
        pageContainer.append(page, pageBreak);

        return pageContainer;
      };

      const _headerHeight = headerHeightMap.get(0) || 0;
      const _footerHeight = footerHeightMap.get(0) || 0;

      const fragment = document.createDocumentFragment();

      const pageCount = getNewPageCount(view, pageOptions);

      for (let i = 0; i < pageCount; i++) {
        const pageNumber = i+1;
        const headerPageNumber = i+2;
        if(headerPageNumber in pageOptions.customHeader || pageNumber in pageOptions.customFooter || pageNumber in pageOptions.customHeader) {

          let _headerOptions = commonHeaderOptions;
          let _footerOptions = commonFooterOptions;

          let _pageHeaderHeight = _headerHeight;
          let _pageFooterHeight = _footerHeight;
          if(headerPageNumber in pageOptions.customHeader) {
            _headerOptions = pageOptions.customHeader[headerPageNumber] || commonHeaderOptions;
            _pageHeaderHeight = headerHeightMap.get(headerPageNumber) || 0;
          }
          if(pageNumber in pageOptions.customFooter) {
            _footerOptions = pageOptions.customFooter[pageNumber] || commonFooterOptions;
            _pageFooterHeight = footerHeightMap.get(pageNumber) || 0;
          }
          
          let _pageHeader = getHeader(_headerOptions.headerRight, _headerOptions.headerLeft, headerClickEvent(headerPageNumber, pageOptions.onHeaderClick), headerPageNumber);
          let _pageFooter = getFooter(_footerOptions.footerRight, _footerOptions.footerLeft, footerClickEvent(pageNumber, pageOptions.onFooterClick), pageNumber);

          let pageBreak = pageBreakDefinition(i === 0, _pageHeader, _pageFooter, _pageHeaderHeight, _pageFooterHeight, pageNumber);
          fragment.appendChild(pageBreak);
        }else{
          const __pageHeader = getHeader(commonHeaderOptions.headerRight, commonHeaderOptions.headerLeft, headerClickEvent(headerPageNumber, pageOptions.onHeaderClick));
          const __pageFooter = getFooter(commonFooterOptions.footerRight, commonFooterOptions.footerLeft, footerClickEvent(pageNumber, pageOptions.onFooterClick));
          fragment.appendChild(pageBreakDefinition(i === 0, __pageHeader, __pageFooter, _headerHeight, _footerHeight));
        }

      }
      el.append(fragment);
      el.id = "pages";
      el.classList.add("rm-pages-wrapper");

      return el;
    },
    { side: -1 }
  );
  const firstHeaderWidget = Decoration.widget(
    0,
    () => {
      const pageNumber = 1;
      
      let _headerOptions = commonHeaderOptions;
      if(pageNumber in pageOptions.customHeader) {
        _headerOptions = pageOptions.customHeader[pageNumber];
      }
      const el = getHeader(_headerOptions.headerRight, _headerOptions.headerLeft, headerClickEvent(pageNumber, pageOptions.onHeaderClick));
      el.classList.add("rm-first-page-header");
      return el;
    },
    { side: -1 }
  );

  return [pageWidget, firstHeaderWidget];
}