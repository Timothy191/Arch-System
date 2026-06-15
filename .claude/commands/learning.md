---
description: Manage learnings - search, list, and save persistent knowledge
---

# /learning - Learning Management

Search, list, and capture learnings stored in the pro-workflow database.

## Usage

- `/learning` — List all learnings
- `/learning <query>` — Search learnings by keyword (BM25 full-text search)
- `/learning save` — Capture a lesson from this session

## Commands

### /learning (list)

```
/learning
/learning recent              # most recently created (default)
/learning applied             # sort by times_applied
/learning category:Testing    # filter by category
/learning project:my-app      # filter by project
```

Categories: Navigation, Editing, Testing, Git, Quality, Context, Architecture, Performance, Claude-Code, Prompting

### /learning <query> (search)

```
/learning testing
/learning "file paths"
/learning git commit category:Quality
```

Features: BM25 ranking, prefix matching, phrase search with quotes, space-separated OR.

### /learning save (capture)

When the user wants to save a lesson, capture it with this format:

```
Category: <category>
Rule: <one-line description of the correct behavior>
Mistake: <what went wrong>
Correction: <how it was fixed>
```

**Categories:** Navigation, Editing, Testing, Git, Quality, Context, Architecture, Performance, Claude-Code, Prompting

After user confirms, save to database:

```bash
sqlite3 ~/.pro-workflow/data.db "INSERT INTO learnings (project, category, rule, mistake, correction) VALUES ('<project>', '<category>', '<rule>', '<mistake>', '<correction>');"
```

Output: `Saved as learning #<id>. Use /learning <keyword> to find this later.`

### Auto-capture via [LEARN] tags

Emit `[LEARN]` blocks in responses and the Stop hook will auto-capture:

```
[LEARN] Category: Rule text here
Mistake: What went wrong
Correction: How it was fixed
```
