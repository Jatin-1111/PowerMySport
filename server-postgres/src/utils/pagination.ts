export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export const getPaginationParams = (
  rawPage: unknown,
  rawLimit: unknown,
  defaultLimit: number,
  maxLimit: number,
): PaginationParams => {
  const parsedPage = parseInt(String(rawPage ?? "1"), 10);
  const parsedLimit = parseInt(String(rawLimit ?? String(defaultLimit)), 10);

  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const safeLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, maxLimit)
      : defaultLimit;

  return {
    page,
    limit: safeLimit,
    skip: (page - 1) * safeLimit,
  };
};
