import { log as __rootLog } from "../../../utils/logger";

export const log = __rootLog.child("ecommerce");

export const getParam = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;
