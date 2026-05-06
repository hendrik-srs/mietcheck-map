# Session-Workflow für MietCheck Map

Kompakte Checkliste für Arbeit mit Claude Code in diesem Projekt.

## 1. Session starten

Erster Prompt an Claude:

> Lies CLAUDE.md, mach `git status` + `git log -5`. Sag mir: was ist live,
> was steht laut Top-Priorität an, was war der letzte Commit. Dann warte.

**Wenn eine Migration aus der Vor-Session offen ist** (z. B. nicht im SQL Editor
angewendet): in derselben Nachricht erwähnen.

## 2. Während der Session

- [ ] **Migration kommt rein** → SQL Editor öffnen, Inhalt einfügen, Run, "Success. No rows returned" → an Claude zurückmelden
- [ ] **Nach jedem Push** → Live-URL `https://mietcheck-map.vercel.app` kurz checken (Deploy in ~1 Min)
- [ ] **Claude sagt "fertig"** → das neue Feature im Browser anklicken; bei Problem sofort melden
- [ ] **Bei riskanten Aktionen** (Schema-Drop, Force-Push, externe Services) → Claude pausiert und fragt; wenn nicht: stoppen

## 3. Session beenden

Letzter Prompt:

> Push alles, sicher dass nichts uncommitted ist, fass kurz zusammen was diese
> Session gebracht hat.

Danach im Terminal **außerhalb** des Worktrees:

```bash
git -C /Users/hendrik/Documents/DEV/mietcheck-map pull --ff-only origin main
```

Damit ist dein lokales `main` für die nächste Session synchron.

**Optional** — alte Worktrees aufräumen, wenn nicht mehr genutzt:

```bash
git worktree list
git worktree remove .claude/worktrees/<name>
```

## Wenn etwas schiefgeht

- **Build / Lint failt** → Claude sehen lassen, nicht selbst pushen
- **Vercel-Deploy rot** → Claude den letzten Commit ansehen lassen
- **Supabase pausiert** → Keep-Alive-Workflow im Repo prüfen (`.github/workflows/keep-alive.yml`); manuell einen Workflow-Run triggern reicht zum Aufwecken
- **Worktree hängt fest** → Claude bitten, `git worktree list` und Status zu zeigen, bevor du etwas löscht
