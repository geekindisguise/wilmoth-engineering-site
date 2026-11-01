# Wilmoth Engineering

Static site for Wilmoth Engineering, LLC (Jacob Wilmoth): plain HTML, CSS, and JavaScript modules, with no deploy-time build step.
A small Node script (no dependencies) generates the app pages, and that output is committed.
Live on Railway and served by Caddy; the apex domain is wilmoth.engineering.

## Lessons
<!-- Repo-specific lessons. Index-style: one line each, `- L-WESITE-NNN [tags] rule (source)`. Curated by the Chief of Staff in the nightly review; task agents propose lessons in their PR body under "Lessons" and do not edit this section. Cross-project lessons live in the vault's Agent Learnings.md. -->
- L-WESITE-001 [deploy, admob] Copy app-ads.txt into the Docker image so AdMob can fetch /app-ads.txt at the domain root (2853e1c)
- L-WESITE-002 [apps, drafts] Publish only released apps; draft apps stay unlisted and noindex, and existing App Store legacy URLs keep serving the verbatim copy (b88556b)
- L-WESITE-003 [build] Return injected HTML from a String.replace callback so $ stays literal; a $ in the replacement string is a backreference and wrote the $2.99 price as the closing marker (371d188, #8)
