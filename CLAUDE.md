# Working on PropScout

- Deploying: production deploys from `main`. When work is finished, tested and
  committed, push it to `main` only (`git push origin HEAD:main`), so nothing
  has to be redeployed by hand.
- Never also push the session's working branch (or any other branch): every
  push to a branch is a Vercel build of its own, and the owner pays for each
  one. One push to `main` per finished change.
- A change that doesn't touch the site (notes like this file) isn't pushed on
  its own: it goes out with the next change that does.

# Before starting

Read `docs/claude-handoff.md`: how the owner likes to work, the standing
rules (keys, branding, what stays switched off) and where the current
project (NBA matchups on the Props tab) stands. Update it when you finish
a piece of work, so the next session can pick up from there.
