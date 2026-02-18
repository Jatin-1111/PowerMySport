/**
 * Pagination utilities for chunking data and managing pagination state
 */

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  data: T[];
  pagination: PaginationState;
}

/**
 * Paginate an array of items
 * @param items - Array of items to paginate
 * @param pageSize - Number of items per page (default: 10)
 * @param currentPage - Current page number (1-indexed, default: 1)
 */
export function paginateArray<T>(
  items: T[],
  pageSize: number = 10,
  currentPage: number = 1,
): PaginatedData<T> {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Ensure currentPage is valid
  const validPage = Math.max(1, Math.min(currentPage, totalPages || 1));

  const startIndex = (validPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    data: items.slice(startIndex, endIndex),
    pagination: {
      currentPage: validPage,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}

/**
 * Get pagination info (for UI display)
 */
export function getPaginationInfo(pagination: PaginationState) {
  const { currentPage, pageSize, totalItems } = pagination;
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return {
    startItem,
    endItem,
    showing: `${startItem}-${endItem}`,
    total: totalItems,
  };
}

/**
 * Get array of page numbers for pagination UI
 */
export function getPageNumbers(
  currentPage: number,
  totalPages: number,
  visiblePages: number = 5,
) {
  if (totalPages <= visiblePages) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const halfVisible = Math.floor(visiblePages / 2);
  let start = currentPage - halfVisible;
  let end = currentPage + halfVisible;

  if (start < 1) {
    end += 1 - start;
    start = 1;
  }

  if (end > totalPages) {
    start -= end - totalPages;
    end = totalPages;
  }

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
