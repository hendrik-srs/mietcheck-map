# Session-Workflow

## Neue Session starten

```
Lies CLAUDE.md, mach `git status` + `git log -5`. Sag mir: was ist live,
was steht laut Top-Priorität an, was war der letzte Commit. Dann warte.
```

## Während der Session (bei Bedarf)

```
Migration ist im Supabase SQL Editor gelaufen, Success. No rows returned.
```

```
Auf der Live-URL ist [...]. Bitte beheben.
```

```
Spring zur nächsten Phase laut docs/ROADMAP.md.
```

## Session beenden

```
1. Aktualisiere zuerst CLAUDE.md:
   - aktueller Live-Stand
   - erledigte Punkte
   - neue Top-Priorität
   - bekannte Probleme/TODOs

2. Danach:
   - git status
   - sicherstellen, dass nichts uncommitted ist
   - committen und pushen

3. Gib mir anschließend:
   - kurze Session-Zusammenfassung
   - letzten Commit
   - offene nächste Schritte

4. Aktualisiere danach mein lokales Hauptrepo mit:

git -C /Users/hendrik/Documents/DEV/mietcheck-map pull --ff-only origin main
```

## Notfall (Claude-Limit erreicht)

```bash
git -C /Users/hendrik/Documents/DEV/mietcheck-map pull --ff-only origin main
```
