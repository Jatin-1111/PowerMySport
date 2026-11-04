type ErrorPayload = { message?: string; errors?: string[] };

/**
 * Pull the server's message (and pathed errors) out of a failed request.
 *
 * Not `axios.isAxiosError`: the response interceptor in `lib/api/axios.ts`
 * rewraps every failure as a plain `Error` carrying the original `response`, so
 * that check is false for every request made through the shared instance and
 * the server's reason was replaced by the generic line below.
 */
export function readApiErrors(error: unknown): string[] {
  const data = (error as { response?: { data?: ErrorPayload } } | null)?.response?.data;
  if (data?.errors?.length) return [...(data.message ? [data.message] : []), ...data.errors];
  if (data?.message) return [data.message];
  return ["Something went wrong. Check the server logs."];
}
