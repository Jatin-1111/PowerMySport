import dotenv from "dotenv";

/**
 * Single, quiet entry point for loading `.env`.
 *
 * `import "dotenv/config"` appeared in several modules, so boot printed the
 * "injecting env (0) from .env" banner — plus a rotating marketing tip — once
 * per import. dotenv is already idempotent about *values* (it never overwrites
 * an existing `process.env` key), so the repetition was pure output noise, but
 * routing every caller through here makes that guarantee explicit.
 */
let loaded = false;

export const loadEnv = (): void => {
  if (loaded) return;
  loaded = true;
  dotenv.config({ quiet: true });
};

loadEnv();
