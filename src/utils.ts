import { PaginationPlusOptions } from "./PaginationPlus";
import { PageSize } from "./constants";

export const updateCssVariables = (targetNode: HTMLElement, config: PaginationPlusOptions) => {

    const _pageContentHeight = config.pageHeight - config.contentMarginTop - config.contentMarginBottom - config.marginTop - config.marginBottom;

    const headerHeight = targetNode.querySelector(".rm-first-page-header")?.clientHeight || 0;
    const footerHeight = targetNode.querySelector(".rm-page-footer")?.clientHeight || 0;
    

    const cssVariables = {
        "rm-page-content-height": `${_pageContentHeight}px`,
        "rm-page-height": `${config.pageHeight}px`,
        "rm-page-header-height": `${headerHeight}px`,
        "rm-page-footer-height": `${footerHeight}px`,
        "rm-max-content-child-height": `${_pageContentHeight - 10}px`,
        "rm-margin-top": `${config.marginTop}px`,
        "rm-margin-bottom": `${config.marginBottom}px`,
        "rm-margin-left": `${config.marginLeft}px`,
        "rm-margin-right": `${config.marginRight}px`,
        "rm-content-margin-top": `${config.contentMarginTop}px`,
        "rm-content-margin-bottom": `${config.contentMarginBottom}px`,
        "rm-page-gap-border-color": `${config.pageGapBorderColor}`,
        "rm-page-width": `${config.pageWidth}px`,
      }

  Object.entries(cssVariables).forEach(([key, value]) => {
    targetNode.style.setProperty(`--${key}`, value);
  });
}

export const getPageSize = (height: number, width: number, marginTop: number, marginBottom: number, marginLeft: number, marginRight: number): PageSize => {
    return {
        pageHeight: height,
        pageWidth: width,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
    }
}