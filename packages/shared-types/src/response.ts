/**
 * The API response envelope — was byte-identical in admin and client
 * already (a rare case of zero drift), and near-identical in community's
 * two local copies (blog.ts, community.ts), which had `data: T` required
 * instead of optional. This keeps the wider, safer shape: `data` is only
 * guaranteed on success.
 */
export interface PaginationMetadata {
  total: number;
  page: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: {
    [key: string]: PaginationMetadata | undefined;
  } & PaginationMetadata;
}
