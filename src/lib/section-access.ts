import { canViewPdfSection, isSectionPageAllowed } from "./pdf-outline";

export function canReadSectionPage(
  preview: boolean,
  enrolled: boolean,
  page: number,
  startPage: number,
  endPage: number,
) {
  return canViewPdfSection(preview, enrolled) &&
    isSectionPageAllowed(page, startPage, endPage);
}
