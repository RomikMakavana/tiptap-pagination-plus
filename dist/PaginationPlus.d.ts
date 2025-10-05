import { Extension } from "@tiptap/core";
import { PageSize } from "./constants";
export interface PaginationPlusOptions {
    pageHeight: number;
    pageWidth: number;
    pageGap: number;
    pageBreakBackground: string;
    pageHeaderHeight: number;
    pageFooterHeight: number;
    pageGapBorderSize: number;
    footerRight: string;
    footerLeft: string;
    headerRight: string;
    headerLeft: string;
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    contentMarginTop: number;
    contentMarginBottom: number;
    pageGapBorderColor: string;
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        PaginationPlus: {
            updatePageBreakBackground: (color: string) => ReturnType;
            updatePageSize: (size: PageSize) => ReturnType;
            updatePageHeight: (height: number) => ReturnType;
            updatePageWidth: (width: number) => ReturnType;
            updatePageGap: (gap: number) => ReturnType;
            updateMargins: (margins: {
                top: number;
                bottom: number;
                left: number;
                right: number;
            }) => ReturnType;
            updateContentMargins: (margins: {
                top: number;
                bottom: number;
            }) => ReturnType;
            updateHeaderHeight: (height: number) => ReturnType;
            updateFooterHeight: (height: number) => ReturnType;
            updateHeaderContent: (left: string, right: string) => ReturnType;
            updateFooterContent: (left: string, right: string) => ReturnType;
        };
    }
    interface Storage {
        PaginationPlus: PaginationPlusOptions;
    }
}
export declare const PaginationPlus: Extension<PaginationPlusOptions, any>;
