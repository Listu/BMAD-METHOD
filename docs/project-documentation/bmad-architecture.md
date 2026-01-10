# BMAD Framework - Architecture Technique

> Documentation générée automatiquement pour le projet BMAD-orchestrator
> Date: 2026-01-09

## Vue d'ensemble

BMAD (Breakthrough Method of Agile AI-driven Development) est un framework modulaire pour le développement assisté par IA, utilisant des agents spécialisés et des workflows structurés.

### Classification du projet

| Attribut | Valeur |
|----------|--------|
| **Type** | Library/Framework |
| **Structure** | Monorepo modulaire |
| **Langage** | JavaScript (Node.js ≥20) |
| **Version** | 6.0.0-alpha.22 |
| **Licence** | MIT |

---

## Architecture globale

```
BMAD-METHOD/
├── src/
│   ├── core/                    # Noyau BMAD (obligatoire)
│   ├── modules/
│   │   ├── bmm/                 # BMad Method (méthodologie principale)
│   │   ├── bmb/                 # BMad Builder (création agents/workflows)
│   │   ├── bmgd/                # BMad Game Dev
│   │   └── cis/                 # Creative Intelligence
│   └── utility/                 # Composants partagés
├── tools/                       # CLI, bundlers, scripts
├── docs/                        # Documentation (Astro/Starlight)
└── _bmad-output/                # Artéfacts générés
```

---

## Core Module - Le cerveau de BMAD

### workflow.xml - Moteur d'exécution

Le fichier `src/core/tasks/workflow.xml` est le **moteur d'exécution universel** qui traite tous les workflows.

#### Flux d'exécution

```
ÉTAPE 1: INITIALISATION
├── 1a: Charger workflow.yaml
├── 1b: Résoudre variables ({project-root}, {config_source}:)
├── 1c: Charger instructions + template
└── 1d: Créer fichier output

ÉTAPE 2: EXÉCUTION DES STEPS
├── 2a: Évaluer attributs (optional, if, for-each)
├── 2b: Exécuter contenu (action, check, ask, invoke-*)
├── 2c: Gérer template-output (save + confirm)
└── 2d: Continuer ou modifier

ÉTAPE 3: COMPLÉTION
└── Confirmer sauvegarde + rapport
```

#### Tags XML supportés

| Catégorie | Tags |
|-----------|------|
| **Structure** | `step`, `optional`, `if`, `for-each`, `repeat` |
| **Exécution** | `action`, `check`, `ask`, `goto` |
| **Invocation** | `invoke-workflow`, `invoke-task`, `invoke-protocol` |
| **Output** | `template-output`, `critical`, `example` |

#### Modes d'exécution

- **normal**: Interaction complète, confirmation à chaque `template-output`
- **yolo**: Mode automatique, simulation d'utilisateur expert

### Tasks Core

| Task | Description |
|------|-------------|
| `workflow.xml` | Moteur d'exécution universel |
| `shard-doc.xml` | Découpe documents MD par sections |
| `index-docs.xml` | Génère index.md pour répertoires |
| `review-adversarial-general.xml` | Revue adversariale |

### Workflows Core

| Workflow | Description |
|----------|-------------|
| `brainstorming/` | Sessions créatives, 100+ idées, anti-bias |
| `party-mode/` | Discussion multi-agents, TTS intégré |
| `advanced-elicitation/` | Amélioration itérative de contenu |

---

## BMM Module - Méthodologie principale

### 9 Agents

| Agent | Nom | Rôle |
|-------|-----|------|
| analyst | - | Analyse, recherche, brainstorming |
| pm | John | Product Manager (PRD, epics) |
| architect | Winston | Architecture système |
| dev | Amelia | Développement, TDD strict |
| sm | - | Scrum Master (sprints) |
| tea | - | Test Engineering Architect |
| ux-designer | - | Design UX |
| tech-writer | - | Documentation technique |
| quick-flow-solo-dev | - | Développement rapide |

### 4 Phases de workflow

```
Phase 1: ANALYSIS
├── create-product-brief
└── research

Phase 2: PLANNING
├── prd (Product Requirements Document)
└── create-ux-design

Phase 3: SOLUTIONING
├── create-architecture
├── create-epics-and-stories
├── testarch-test-design
└── check-implementation-readiness

Phase 4: IMPLEMENTATION
├── sprint-planning
├── create-story
├── dev-story
├── code-review
├── correct-course
└── retrospective
```

### Structure d'un Agent (agent.yaml)

```yaml
agent:
  metadata:
    id: "_bmad/bmm/agents/pm.md"
    name: "John"
    title: "Product Manager"
    icon: 📋
    module: bmm
    hasSidecar: false

  persona:
    role: "..."
    identity: "..."
    communication_style: "..."
    principles: |
      - Principe 1
      - Principe 2

  critical_actions:
    - "Action obligatoire 1"
    - "Action obligatoire 2"

  menu:
    - trigger: "PR or fuzzy match on prd"
      exec: "{project-root}/_bmad/.../workflow.md"
      description: "[PR] Create PRD"
```

### Structure d'un Workflow

```
workflow-name/
├── workflow.md           # Entry point + règles + init
├── steps/                # Fichiers d'étapes séquentiels
│   ├── step-01-init.md
│   ├── step-01b-continue.md
│   ├── step-02-*.md
│   └── ...
├── *.csv                 # Données
└── *-template.md         # Template de sortie
```

### Structure d'un Step File

```markdown
---
name: 'step-01-init'
workflow_path: '{project-root}/_bmad/...'
nextStepFile: '{workflow_path}/steps/step-02-*.md'
outputFile: '{planning_artifacts}/document.md'
---

# Step 1: Title

**Progress: Step X of N**

## STEP GOAL: ...
## MANDATORY EXECUTION RULES: ...
## EXECUTION PROTOCOLS: ...
## CONTEXT BOUNDARIES: ...

## Sequence of Instructions
### 1. Première action
### 2. Deuxième action
### 3. Menu Options

## SUCCESS/FAILURE METRICS
```

---

## BMB Module - Builder

### 3 Builders

| Builder | Rôle |
|---------|------|
| Agent Builder (Bond) | Créer/éditer/valider agents |
| Module Builder | Créer/éditer/valider modules |
| Workflow Builder | Créer/éditer/valider workflows |

### Architecture Tri-modale

Chaque builder supporte 3 modes avec des step-flows séparés:

```
workflow/
├── workflow.md           # Entry + mode selection
├── data/                 # Données de référence
├── steps-c/              # Mode CREATE
├── steps-e/              # Mode EDIT
├── steps-v/              # Mode VALIDATE
└── templates/            # Templates
```

---

## BMGD Module - Game Development

### 6 Agents Game Dev

| Agent | Rôle |
|-------|------|
| game-architect | Architecture technique jeux |
| game-designer | Game Design Document |
| game-dev | Développement gameplay |
| game-qa | Quality Assurance |
| game-scrum-master | Gestion sprint |
| game-solo-dev | Développeur indie |

### Phases Game Dev

```
1-preproduction/
├── brainstorm-game/
└── game-brief/

2-design/
├── gdd/ (Game Design Document)
└── narrative/

3-technical/
├── game-architecture/
└── generate-project-context/

4-production/
├── sprint-planning/
├── create-story/
├── dev-story/
├── code-review/
└── retrospective/

gametest/
├── test-design/
├── test-framework/
├── test-review/
└── performance/
```

---

## Système d'Installation

### CLI

```bash
npx bmad-method install
# ou
npm run bmad:install
```

### Structure installée (_bmad/)

```
_bmad/
├── core/                    # Core module
│   ├── config.yaml          # Configuration core
│   ├── agents/
│   ├── tasks/
│   └── workflows/
├── bmm/                     # BMad Method module
│   ├── config.yaml
│   ├── agents/
│   └── workflows/
├── _config/                 # Manifests compilés
│   ├── agent-manifest.csv
│   ├── workflow-manifest.csv
│   └── task-manifest.csv
└── [autres modules]
```

### Flux d'installation

```
UI.promptInstall() → Config selection
    ↓
Installer.install()
    ↓
├── Create _bmad/ structure
├── Copy modules (core, bmm, bmb, bmgd, cis)
├── Compile agent manifests (CSV)
├── IDE-specific configs (claude-code, cursor, windsurf)
└── Optional: AgentVibes TTS setup
```

---

## Patterns clés pour BMAD-orchestrator

### 1. Résolution de variables

```
{project-root}          → Racine du projet
{config_source}:key     → Valeur depuis config.yaml
{installed_path}        → Chemin du module installé
{planning_artifacts}    → Dossier artéfacts planning
{output_folder}         → Dossier output
```

### 2. Architecture micro-fichiers

- Chaque step est auto-contenu
- Chargement Just-In-Time (un step à la fois)
- Exécution séquentielle stricte
- État tracké dans frontmatter

### 3. Smart Discovery

```
Priorité: Sharded folders > Single files
Pattern: {folder}/index.md pour navigation
Strategy: FULL_LOAD | SELECTIVE_LOAD | INDEX_GUIDED
```

### 4. Menu-driven progression

```markdown
[C] Continue - Aller au step suivant
[a] Advanced Elicitation
[p] Party Mode
[y] YOLO mode
```

### 5. Manifests CSV

Les agents, workflows et tasks sont compilés en manifests CSV pour découverte runtime:

```csv
name,displayName,title,icon,role,identity,communicationStyle,principles,module,path
pm,John,Product Manager,📋,...
```

---

## Points d'extension pour l'orchestrateur

### Hooks d'extension potentiels

1. **Agent Master** - Point d'entrée pour orchestration
2. **Workflow chaining** - `invoke-workflow` pour enchaîner
3. **Protocol system** - `invoke-protocol` pour réutilisation
4. **Manifest system** - Découverte dynamique des composants

### Composants à créer pour BMAD-orchestrator

1. **Orchestrator Agent** - Agent maître supervisant tous les autres
2. **Project Registry** - Système de gestion multi-projets
3. **Memory System** - Stockage persistant par projet (Docker)
4. **Background Tasks** - Délégation de tâches en arrière-plan
5. **Abstraction Layer** - Interface simplifiée pour utilisateurs non-BMAD
