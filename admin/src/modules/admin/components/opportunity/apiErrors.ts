import axios from "axios";

/** Pull the server's message (and pathed errors) out of an axios failure. */
export function readApiErrors(error: unknown): string[] {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: string[] } | undefined;
    if (data?.errors?.length) return [...(data.message ? [data.message] : []), ...data.errors];
    if (data?.message) return [data.message];
  }
  return ["Something went wrong. Check the server logs."];
}
