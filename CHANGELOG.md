# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 - 2026-02-28
### Added
- Child panels with configurable name and accent colour
- Chore buttons with emoji or image icons and optional labels
- Tap-to-toggle chore completion (reversible)
- Cumulative point tally per child, preserved across daily resets
- Parent-PIN-protected tally redemption with touchscreen numeric keypad
- SQLite persistence via better-sqlite3 (completions and redemptions)
- Midnight cron job for daily chore reset (via node-cron)
- CSS custom properties for configurable sizing across screen sizes
- Full MagicMirror SDK reference documentation
