# Issue tracker: GitHub

Issues and specs live in GitHub Issues in `LyKhoris/yt4k`.
Use the `gh` CLI from this repository.

## Operations

- Publish work: `gh issue create --repo LyKhoris/yt4k --title "..." --body-file <file>`.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open`, with appropriate label filters.
- Comment: `gh issue comment <number> --body-file <file>`.
- Label: `gh issue edit <number> --add-label "..." --remove-label "..."`.
- Close: post the explanation, then `gh issue close <number>`.

Before creating issues, verify the target with
`gh repo view --json nameWithOwner`. File into `LyKhoris/yt4k`;
ask before using another repository.

## Relationships

Use native GitHub sub-issues and blocking dependencies when available.
Otherwise, link children with `Part of #<parent>` and blockers with
`Blocked by: #<number>`. Work is unblocked when all blockers are closed.

## Pull requests as a triage surface

**PRs as a request surface: no.**

If enabled later, use the equivalent `gh pr` operations for external PRs.
GitHub shares issue and PR numbers; resolve the item type before acting.

## Wayfinding

The map is an issue labelled `wayfinder:map`, with linked child tickets.
Children use `wayfinder:research`, `wayfinder:prototype`,
`wayfinder:grilling`, or `wayfinder:task`.
Choose the first unblocked, unassigned child in map order; claim it with
`gh issue edit <number> --add-assignee @me`.
On resolution, comment, close the child, and add the finding and link
to the map's Decisions-so-far section.
