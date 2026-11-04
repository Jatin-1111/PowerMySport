# Workflows disabled — GitHub billing lock

Moved out of `.github/workflows/` on 2026-09-03 because the GitHub account
this repo lives under is billing-locked ("The job was not started because
your account is locked due to a billing issue"), so every job just fails
immediately regardless of what it does.

To re-enable: move `ci.yml` and `deploy-server.yml` back into
`.github/workflows/`. No content changes needed — they were working
correctly before the lock.

If you also enabled branch protection requiring the "All Checks Passed"
status check on `master`, that needs to be relaxed too while these are
disabled, or no PR can merge.
