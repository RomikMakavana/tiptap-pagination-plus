import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { updateCssVariables } from "./utils";
const page_count_meta_key = "PAGE_COUNT_META_KEY";
const defaultOptions = {
    pageHeight: 800,
    pageWidth: 789,
    pageGap: 50,
    pageGapBorderSize: 1,
    pageBreakBackground: "#ffffff",
    pageHeaderHeight: 30,
    pageFooterHeight: 30,
    footerRight: "{page}",
    footerLeft: "",
    headerRight: "",
    headerLeft: "",
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 50,
    marginRight: 50,
    contentMarginTop: 10,
    contentMarginBottom: 10,
    pageGapBorderColor: "#e5e5e5",
};
export const PaginationPlus = Extension.create({
    name: "PaginationPlus",
    addOptions() {
        return defaultOptions;
    },
    addStorage() {
        return defaultOptions;
    },
    onCreate() {
        const targetNode = this.editor.view.dom;
        targetNode.classList.add("rm-with-pagination");
        targetNode.style.border = `1px solid var(--rm-page-gap-border-color)`;
        targetNode.style.paddingLeft = `var(--rm-margin-left)`;
        targetNode.style.paddingRight = `var(--rm-margin-right)`;
        targetNode.style.width = `var(--rm-page-width)`;
        const config = { attributes: true };
        updateCssVariables(targetNode, this.options);
        const style = document.createElement("style");
        style.dataset.rmPaginationStyle = "";
        style.textContent = `
      .rm-pagination-gap{
        border-top: 1px solid;
        border-bottom: 1px solid;
        border-color: var(--rm-page-gap-border-color);
      }
      .rm-with-pagination {
        counter-reset: page-number;
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
      .rm-with-pagination .rm-page-footer {
        counter-increment: page-number;
        margin-bottom: var(--rm-margin-bottom);
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
      .rm-with-pagination > *:has(> br.ProseMirror-trailingBreak:only-child) {
        display: table;
        width: 100%;
      }
      .rm-with-pagination .rm-br-decoration {
        display: table;
        width: 100%;
      }
      .rm-with-pagination .table-row-group {
        max-height: var(--rm-page-content-height);
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
      .rm-with-pagination .rm-page-number::before {
        content: counter(page-number);
      }
      .rm-with-pagination .rm-first-page-header{
        display: inline-flex;
        justify-content: space-between;
        width: 100%;
      }
      .rm-with-pagination .rm-page-header,
      .rm-with-pagination .rm-first-page-header{
        margin-bottom: var(--rm-content-margin-top) !important;
        margin-top: var(--rm-margin-top) !important;
      }
      .rm-with-pagination .rm-page-footer{
        margin-top: var(--rm-content-margin-bottom) !important;
        margin-bottom: var(--rm-margin-bottom) !important;
      }
    `;
        document.head.appendChild(style);
        const refreshPage = (targetNode) => {
            var _a;
            const paginationElement = targetNode.querySelector("[data-rm-pagination]");
            if (paginationElement) {
                const lastPageBreak = (_a = paginationElement.lastElementChild) === null || _a === void 0 ? void 0 : _a.querySelector(".breaker");
                if (lastPageBreak) {
                    const minHeight = lastPageBreak.offsetTop + lastPageBreak.offsetHeight;
                    targetNode.style.minHeight = `${minHeight}px`;
                }
            }
        };
        const callback = (mutationList) => {
            if (mutationList.length > 0 && mutationList[0].target) {
                const _target = mutationList[0].target;
                if (_target.classList.contains("rm-with-pagination")) {
                    const currentPageCount = getExistingPageCount(this.editor.view);
                    const pageCount = calculatePageCount(this.editor.view, this.options);
                    if (currentPageCount !== pageCount) {
                        const tr = this.editor.view.state.tr.setMeta(page_count_meta_key, Date.now());
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
                    init: (_, state) => {
                        const widgetList = createDecoration(state, this.options);
                        this.storage = Object.assign({}, this.options);
                        return DecorationSet.create(state.doc, widgetList);
                    },
                    apply: (tr, oldDeco, oldState, newState) => {
                        const pageCount = calculatePageCount(editor.view, this.options);
                        const currentPageCount = getExistingPageCount(editor.view);
                        if ((pageCount > 1 ? pageCount : 1) !== currentPageCount ||
                            this.storage.pageBreakBackground !== this.options.pageBreakBackground ||
                            this.storage.pageHeight !== this.options.pageHeight ||
                            this.storage.pageWidth !== this.options.pageWidth ||
                            this.storage.marginTop !== this.options.marginTop ||
                            this.storage.marginBottom !== this.options.marginBottom ||
                            this.storage.marginLeft !== this.options.marginLeft ||
                            this.storage.marginRight !== this.options.marginRight ||
                            this.storage.pageGap !== this.options.pageGap ||
                            this.storage.contentMarginTop !== this.options.contentMarginTop ||
                            this.storage.contentMarginBottom !== this.options.contentMarginBottom) {
                            const widgetList = createDecoration(newState, this.options);
                            this.storage = Object.assign({}, this.options);
                            return DecorationSet.create(newState.doc, [...widgetList]);
                        }
                        return oldDeco;
                    },
                },
                props: {
                    decorations(state) {
                        return this.getState(state);
                    },
                },
            }),
            new Plugin({
                key: new PluginKey('brDecoration'),
                state: {
                    init() { return DecorationSet.empty; },
                    apply(tr, old) {
                        // Map decorations through document changes
                        return old.map(tr.mapping, tr.doc);
                    }
                },
                props: {
                    decorations(state) {
                        const decorations = [];
                        state.doc.descendants((node, pos) => {
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
                        return DecorationSet.create(state.doc, decorations);
                    }
                }
            }),
        ];
    },
    addCommands() {
        return {
            updatePageBreakBackground: (color) => () => {
                this.options.pageBreakBackground = color;
                return true;
            },
            updatePageSize: (size) => () => {
                this.options.pageHeight = size.pageHeight;
                this.options.pageWidth = size.pageWidth;
                this.options.marginTop = size.marginTop;
                this.options.marginBottom = size.marginBottom;
                this.options.marginLeft = size.marginLeft;
                this.options.marginRight = size.marginRight;
                return true;
            },
            updatePageWidth: (width) => () => {
                this.options.pageWidth = width;
                return true;
            },
            updatePageHeight: (height) => () => {
                this.options.pageHeight = height;
                return true;
            },
            updatePageGap: (gap) => () => {
                this.options.pageGap = gap;
                return true;
            },
            updateMargins: (margins) => () => {
                this.options.marginTop = margins.top;
                this.options.marginBottom = margins.bottom;
                this.options.marginLeft = margins.left;
                this.options.marginRight = margins.right;
                return true;
            },
            updateContentMargins: (margins) => () => {
                this.options.contentMarginTop = margins.top;
                this.options.contentMarginBottom = margins.bottom;
                return true;
            },
            updateHeaderHeight: (height) => () => {
                this.options.pageHeaderHeight = height;
                return true;
            },
            updateFooterHeight: (height) => () => {
                this.options.pageFooterHeight = height;
                return true;
            },
            updateHeaderContent: (left, right) => () => {
                this.options.headerLeft = left;
                this.options.headerRight = right;
                return true;
            },
            updateFooterContent: (left, right) => () => {
                this.options.footerLeft = left;
                this.options.footerRight = right;
                return true;
            },
        };
    },
});
const getExistingPageCount = (view) => {
    const editorDom = view.dom;
    const paginationElement = editorDom.querySelector("[data-rm-pagination]");
    if (paginationElement) {
        return paginationElement.children.length;
    }
    return 0;
};
const calculatePageCount = (view, pageOptions) => {
    var _a;
    const editorDom = view.dom;
    updateCssVariables(editorDom, pageOptions);
    const _pageHeaderHeight = pageOptions.pageHeaderHeight + pageOptions.contentMarginTop + pageOptions.marginTop;
    const _pageFooterHeight = pageOptions.pageFooterHeight + pageOptions.contentMarginBottom + pageOptions.marginBottom;
    const pageContentAreaHeight = pageOptions.pageHeight - _pageHeaderHeight - _pageFooterHeight;
    const paginationElement = editorDom.querySelector("[data-rm-pagination]");
    const currentPageCount = getExistingPageCount(view);
    if (paginationElement) {
        const lastElementOfEditor = editorDom.lastElementChild;
        const lastPageBreak = (_a = paginationElement.lastElementChild) === null || _a === void 0 ? void 0 : _a.querySelector(".breaker");
        if (lastElementOfEditor && lastPageBreak) {
            const lastPageGap = lastElementOfEditor.getBoundingClientRect().bottom -
                lastPageBreak.getBoundingClientRect().bottom;
            if (lastPageGap > 0) {
                const addPage = Math.ceil(lastPageGap / pageContentAreaHeight);
                return currentPageCount + addPage;
            }
            else {
                const lpFrom = -10;
                const lpTo = -(pageOptions.pageHeight - 10);
                if (lastPageGap > lpTo && lastPageGap < lpFrom) {
                    return currentPageCount;
                }
                else if (lastPageGap < lpTo) {
                    const pageHeightOnRemove = pageOptions.pageHeight + pageOptions.pageGap;
                    const removePage = Math.floor(lastPageGap / pageHeightOnRemove);
                    return currentPageCount + removePage;
                }
                else {
                    return currentPageCount;
                }
            }
        }
        return 1;
    }
    else {
        const editorHeight = editorDom.scrollHeight;
        const pageCount = Math.ceil(editorHeight / pageContentAreaHeight);
        return pageCount <= 0 ? 1 : pageCount;
    }
};
function createDecoration(state, pageOptions, isInitial = false) {
    const pageWidget = Decoration.widget(0, (view) => {
        const _pageGap = pageOptions.pageGap;
        const _pageHeaderHeight = (pageOptions.pageHeaderHeight + pageOptions.contentMarginTop + pageOptions.marginTop);
        const _pageFooterHeight = (pageOptions.pageFooterHeight + pageOptions.contentMarginBottom + pageOptions.marginBottom);
        const _pageHeight = pageOptions.pageHeight - _pageHeaderHeight - _pageFooterHeight;
        const _pageBreakBackground = pageOptions.pageBreakBackground;
        const el = document.createElement("div");
        el.dataset.rmPagination = "true";
        const pageBreakDefinition = ({ firstPage = false, }) => {
            const pageContainer = document.createElement("div");
            pageContainer.classList.add("rm-page-break");
            const page = document.createElement("div");
            page.classList.add("page");
            page.style.position = "relative";
            page.style.float = "left";
            page.style.clear = "both";
            page.style.marginTop = firstPage
                ? `calc(${_pageHeaderHeight}px + ${_pageHeight}px)`
                : _pageHeight + "px";
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
            const pageFooter = document.createElement("div");
            pageFooter.classList.add("rm-page-footer");
            pageFooter.style.height = pageOptions.pageFooterHeight + "px";
            pageFooter.style.overflow = "hidden";
            const footerRight = pageOptions.footerRight.replace("{page}", `<span class="rm-page-number"></span>`);
            const footerLeft = pageOptions.footerLeft.replace("{page}", `<span class="rm-page-number"></span>`);
            const pageFooterLeft = document.createElement("div");
            pageFooterLeft.classList.add("rm-page-footer-left");
            pageFooterLeft.innerHTML = footerLeft;
            const pageFooterRight = document.createElement("div");
            pageFooterRight.classList.add("rm-page-footer-right");
            pageFooterRight.innerHTML = footerRight;
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
            pageHeader.style.height = pageOptions.pageHeaderHeight + "px";
            pageHeader.style.overflow = "hidden";
            const pageHeaderLeft = document.createElement("div");
            pageHeaderLeft.classList.add("rm-page-header-left");
            pageHeaderLeft.innerHTML = pageOptions.headerLeft;
            const pageHeaderRight = document.createElement("div");
            pageHeaderRight.classList.add("rm-page-header-right");
            pageHeaderRight.innerHTML = pageOptions.headerRight;
            pageHeader.append(pageHeaderLeft, pageHeaderRight);
            pageBreak.append(pageFooter, pageSpace, pageHeader);
            pageContainer.append(page, pageBreak);
            return pageContainer;
        };
        const page = pageBreakDefinition({ firstPage: false });
        const firstPage = pageBreakDefinition({
            firstPage: true,
        });
        const fragment = document.createDocumentFragment();
        const pageCount = calculatePageCount(view, pageOptions);
        for (let i = 0; i < pageCount; i++) {
            if (i === 0) {
                fragment.appendChild(firstPage.cloneNode(true));
            }
            else {
                fragment.appendChild(page.cloneNode(true));
            }
        }
        el.append(fragment);
        el.id = "pages";
        return el;
    }, { side: -1 });
    const firstHeaderWidget = Decoration.widget(0, () => {
        const el = document.createElement("div");
        el.style.position = "relative";
        el.classList.add("rm-first-page-header");
        const pageHeaderLeft = document.createElement("div");
        pageHeaderLeft.classList.add("rm-first-page-header-left");
        pageHeaderLeft.innerHTML = pageOptions.headerLeft;
        el.append(pageHeaderLeft);
        const pageHeaderRight = document.createElement("div");
        pageHeaderRight.classList.add("rm-first-page-header-right");
        pageHeaderRight.innerHTML = pageOptions.headerRight;
        el.append(pageHeaderRight);
        el.style.height = `${pageOptions.pageHeaderHeight}px`;
        el.style.overflow = "hidden";
        return el;
    }, { side: -1 });
    return !isInitial ? [pageWidget, firstHeaderWidget] : [pageWidget];
}
