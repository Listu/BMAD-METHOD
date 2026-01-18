# CLAUDE.md

Ce fichier guide Claude Code dans le repository BMAD-METHOD.

> **CRITIQUE - METHODOLOGIE BMAD**
>
> Ce projet **EST** la méthodologie BMAD. **TOUJOURS** utiliser les workflows BMAD :
>
> | Action | Commande |
> |--------|----------|
> | N'importe quelle tâche | `/orchestrate` ou `/o` (routing intelligent) |
> | Documentation projet | `/document-project` |
> | Créer un PRD | `/create-prd` |
> | Architecture | `/create-architecture` |
> | Epics & Stories | `/create-epics-and-stories` |
> | Développement story | `/dev-story` |
> | Développement rapide | `/quick-dev` |
> | Statut workflow | `/workflow-status` |
>
> **NE JAMAIS** faire d'analyse ou de documentation ad-hoc sans passer par BMAD.

## Structure du Repository

```
BMAD-METHOD/
├── src/                    # Source code de BMAD
│   ├── modules/            # Modules installables (bmm, bmb, core, orchestrator)
│   ├── templates/          # Templates de fichiers BMAD
│   └── ...
├── projects/               # Projets utilisant BMAD
│   ├── spt-api-management/ # Backend Express.js/TypeScript
│   ├── my-garden-assist/   # Full-stack NestJS/Next.js
│   └── ...
├── docs/                   # Documentation BMAD
└── _bmad/                  # Configuration BMAD locale
```

## Modules BMAD

- **bmm** (BMAD Method Module): Workflows complets pour développement logiciel
- **bmb** (BMAD Builder): Création d'agents et workflows personnalisés
- **core**: Fonctionnalités de base (orchestrateur de workflows, tâches)
- **orchestrator**: Routage intelligent vers les workflows appropriés

## Commandes Principales

```bash
# Routing intelligent - analyse la demande et route vers le bon workflow
/orchestrate "votre demande"
/o "votre demande"

# Workflows spécifiques
/document-project <chemin>   # Documenter un projet existant
/create-prd                  # Créer un Product Requirements Document
/create-architecture         # Créer documentation d'architecture
/workflow-status             # Voir le statut du workflow en cours
```

## IMPORTANT: Gestion des Repositories Git

> **CRITIQUE: Les projets dans `projects/` sont des repositories Git SÉPARÉS !**

```
BMAD-METHOD/           ← Repo Git #1 (la méthodologie)
├── .git/
├── projects/
│   ├── localai/       ← Repo Git #2 (projet indépendant)
│   │   └── .git/
│   ├── botabot/       ← Repo Git #3 (projet indépendant)
│   │   └── .git/
│   └── ...
```

**Règles:**
- Pour les commandes git sur un projet → `cd projects/<nom> && git ...` ou utiliser le chemin absolu
- Ne JAMAIS confondre le git de BMAD-METHOD avec celui des projets
- Chaque projet a son propre historique, branches, et remote
- Quand on travaille sur `projects/localai`, les commandes git doivent être exécutées DANS ce dossier

**Exemple correct:**
```bash
# Pour localai
cd /mnt/c/Users/gabin/Documents/GitHub/BMAD-METHOD/projects/localai && git status
cd /mnt/c/Users/gabin/Documents/GitHub/BMAD-METHOD/projects/localai && git add . && git commit -m "feat: ..."
```

## Notes de Développement

- Tous les projets dans `projects/` peuvent avoir leur propre CLAUDE.md
- Les workflows BMAD génèrent la documentation dans le dossier `docs/` du projet
- Les fichiers de tracking (JSON/YAML) permettent de reprendre les workflows interrompus
