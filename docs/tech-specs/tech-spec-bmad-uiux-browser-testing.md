---
title: 'BMAD UI/UX Intelligence & Browser Testing Integration'
slug: 'bmad-uiux-browser-testing'
created: '2026-02-28'
status: 'Completed'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
tech_stack:
  - BMAD Markdown/YAML workflows (micro-file step architecture)
  - BMAD XML workflow (dev-story pattern)
  - Claude Code Skills invocation via Skill tool
  - Pencil MCP server (mcp__pencil__* tools)
  - Chrome DevTools MCP (mcp__chrome-devtools__* tools)
files_to_modify:
  - src/modules/bmm/workflows/2-plan-workflows/create-ux-design/steps/step-13-responsive-accessibility.md
  - src/modules/bmm/workflows/2-plan-workflows/create-ux-design/steps/step-14-complete.md
  - src/modules/bmm/workflows/2-plan-workflows/create-ux-design/steps/step-01b-continue.md
  - src/modules/bmm/workflows/4-implementation/dev-story/instructions.xml
files_to_create:
  - src/modules/bmm/workflows/2-plan-workflows/create-ux-design/steps/step-14b-uiux-tools.md
  - src/modules/bmm/workflows/testarch/browser/workflow.yaml
  - src/modules/bmm/workflows/testarch/browser/instructions.md
  - src/modules/bmm/workflows/testarch/browser/checklist.md
code_patterns:
  - 'create-ux-design steps: ## MANDATORY RULES + ## EXECUTION PROTOCOLS + ## CONTEXT BOUNDARIES + ## YOUR TASK + ## SEQUENCE + ## SUCCESS METRICS + ## FAILURE MODES + ## NEXT STEP'
  - 'testarch: YAML config + Markdown instructions narrative + checklist.md'
  - 'dev-story: XML avec <step>, <check if="">, <action>, <output>, <critical>, <ask>'
  - 'Skill invocation: textuelle dans les instructions ("use the Skill tool with skill-name")'
  - 'MCP tools: appelés directement par leur nom dans les instructions'
test_patterns:
  - N/A (workflow files — validation via checklist.md uniquement)
---

# Tech-Spec: BMAD UI/UX Intelligence & Browser Testing Integration

**Created:** 2026-02-28

## Overview

### Problem Statement

BMAD workflows manquent d'intelligence UI/UX native et de capacités de test browser systématiques :
- `create-ux-design` génère des documents textuels sans exploiter les outils visuels disponibles (ui-ux-pro-max skill, Pencil MCP)
- `dev-story` n'effectue aucune validation visuelle après implémentation de composants UI
- Il n'existe aucun workflow dédié aux tests browser qui couvre les parcours utilisateur avec preuves screenshots

### Solution

1. **Enrichir `create-ux-design`** : ajouter un `step-14b-uiux-tools.md` entre step-13 et step-14-complete qui orchestre obligatoirement Pencil MCP (maquettes visuelles .pen) + ui-ux-pro-max skill (design system)
2. **Enrichir `dev-story`** : ajouter une section UI-validation conditionnelle à la fin de `<step n="7">` qui détecte automatiquement les tâches UI, invoque ui-ux-pro-max et capture un screenshot Chrome DevTools (avec fallback graceful)
3. **Créer `testarch/browser`** : nouveau workflow qui parcourt tous les journeys utilisateur, capture un screenshot à chaque étape, organise par dossier de parcours, notifie quand terminé

### Scope

**In Scope:**
- Modification de `step-13-responsive-accessibility.md` (changer lien nextStep vers step-14b)
- Modification de `step-14-complete.md` (mettre à jour accomplishments, checklist, lastStep)
- Modification de `step-01b-continue.md` (mettre à jour le lookup table de reprise)
- Création de `step-14b-uiux-tools.md` dans create-ux-design
- Modification de `dev-story/instructions.xml` (ajouter bloc UI-validation en fin de step-7)
- Création de `testarch/browser/` (3 fichiers : workflow.yaml, instructions.md, checklist.md)
- Vérification et mise à jour du routing orchestrateur pour `testarch/browser`

**Out of Scope:**
- Le skill ui-ux-pro-max lui-même (Claude Code skill installé système, vérifié présent dans le skill registry)
- Le MCP server Pencil (déjà configuré)
- Le MCP Chrome DevTools (déjà configuré)
- Les autres workflows testarch (atdd, automate, ci, framework, nfr-assess, test-design, test-review, trace)
- Intégration CI/CD

## Context for Development

### Codebase Patterns

- **Pattern A — Micro-file Markdown** : `create-ux-design` (14 steps). Chaque step = fichier `.md` autonome. Navigation via menus [A/P/C]. Le dernier step renvoie vers le suivant via `load \`./next-step.md\`` dans la section NEXT STEP. Le `lastStep` dans le frontmatter du document de sortie est un entier — un seul fichier step peut correspondre à chaque entier.
- **Pattern B — XML Workflow** : `dev-story` utilise `workflow.yaml` + `instructions.xml` (logique via `<step n="">` **entier uniquement**, `<check if="">`, `<action>`, `<output>`, `<critical>`, `<ask>`, `<goto step="">`). Les step numbers sont des entiers séquentiels — "7b" n'est pas supporté.
- **Pattern C — YAML+MD Testarch** : `testarch/automate` utilise `workflow.yaml` + `instructions.md` + `checklist.md`. Pattern de dégradation graceful : HALT uniquement si le framework de test est complètement absent, sinon continuer avec warnings.
- **Skill invocation** : Aucun tag dédié dans les fichiers workflow. Les instructions disent en texte naturel "use the Skill tool with `skill-name`". Le skill `ui-ux-pro-max:ui-ux-pro-max` est un Claude Code skill installé au niveau système (visible dans le skill registry), pas dans `src/`.
- **MCP tools** : Référencés directement par nom dans les instructions. `mcp__pencil__open_document("new")` ouvre un nouveau document dans l'éditeur Pencil — le path de sauvegarde est récupéré via `mcp__pencil__get_editor_state()` après ouverture.
- **Step chaining create-ux-design** : Insérer un step X entre A et B = (1) modifier NEXT STEP de A → X, (2) X pointe vers B, (3) mettre à jour `step-01b-continue.md` lookup table, (4) mettre à jour le contenu/checklist/lastStep de B si nécessaire.
- **Nommage steps** : Utiliser le suffixe `-b` pour les steps intercalés (`step-14b-uiux-tools.md`) — évite de renommer step-14-complete et maintient la lisibilité. Le `lastStep` stocké dans le document de sortie doit refléter ce nouveau step (15 logiquement, mais géré par le contenu du step lui-même).

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/modules/bmm/workflows/2-plan-workflows/create-ux-design/steps/step-13-responsive-accessibility.md` | À modifier — NEXT STEP section (dernières 3 lignes) |
| `src/modules/bmm/workflows/2-plan-workflows/create-ux-design/steps/step-14-complete.md` | À modifier — accomplishments list, checklist, WORKFLOW FINALIZATION `lastStep` |
| `src/modules/bmm/workflows/2-plan-workflows/create-ux-design/steps/step-01b-continue.md` | À modifier — lookup table de reprise `lastStep` → step file |
| `src/modules/bmm/workflows/2-plan-workflows/create-ux-design/steps/step-11-component-strategy.md` | Référence — pattern A/P/C menu + structure complète d'un step |
| `src/modules/bmm/workflows/4-implementation/dev-story/instructions.xml` | À modifier — fin de `<step n="7">`, avant `</step>` de fermeture |
| `src/modules/bmm/workflows/testarch/automate/workflow.yaml` | Référence — structure YAML testarch |
| `src/modules/bmm/workflows/testarch/automate/instructions.md` | Référence — pattern narratif instructions.md + graceful degradation |
| `src/modules/bmm/workflows/testarch/automate/checklist.md` | Référence — structure checklist |

### Technical Decisions

**TD1 — Nommage et chaînage : `step-14b-uiux-tools.md`**

Nom : `step-14b-uiux-tools.md` (suffixe `-b` pour éviter collision avec `step-14-complete.md`).
Chaîne finale : `step-13` → `step-14b-uiux-tools` → `step-14-complete`.
Le `lastStep` écrit dans le frontmatter du document de sortie par `step-14b` doit être `14b` (string) ou simplement laisser `step-14-complete` écrire `lastStep = 14` comme avant — car `step-01b-continue.md` mappe sur les steps COMPLÉTÉS, et après step-14b le prochain sera step-14-complete qui garde son `lastStep = 14`. Stratégie : `step-14b` ajoute `"14b"` à `stepsCompleted` dans le frontmatter du document de sortie UX (pas lastStep entier), et `step-01b-continue.md` doit mapper `"14b"` → `step-14-complete.md`.

**TD2 — Phase Pencil dans step-14b**

Séquence d'appels MCP :
1. `mcp__pencil__get_guidelines(topic="web-app")` ou `"landing-page"` selon type de projet détecté dans la spec UX
2. `mcp__pencil__get_style_guide_tags()` + `mcp__pencil__get_style_guide(tags=[...])` avec tags pertinents au projet
3. `mcp__pencil__open_document("new")` pour ouvrir un nouveau canvas
4. `mcp__pencil__get_editor_state(include_schema=false)` pour récupérer le filePath du document ouvert
5. `mcp__pencil__batch_design(filePath, operations)` pour créer les écrans clés listés dans la spec UX (minimum : écran principal + composant clé)
6. `mcp__pencil__get_screenshot(filePath, nodeId)` pour capturer le résultat
7. Communiquer le chemin du fichier .pen à l'utilisateur (path récupéré en étape 4)

**TD3 — Phase ui-ux-pro-max dans step-14b**

Après la phase Pencil, invoquer le skill `ui-ux-pro-max:ui-ux-pro-max` via le Skill tool. Fournir comme contexte : type de projet, design system choisi (step-6), stack technique (step-3), couleurs/typo (step-8). Le résultat (classes CSS, tokens, recommandations) est appendé à la spec UX dans une nouvelle section `## Design System Implementation`.

**TD4 — UI validation dans dev-story (fin de step-7, pas un nouveau step)**

Insérer un bloc `<check if="...">` à la FIN du `<step n="7">`, juste avant sa balise `</step>` fermante. Cela évite d'utiliser un identifiant non-entier.

Détection UI — fichiers qui satisfont TOUS les critères suivants :
- Extension dans : `.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`, `.css`, `.scss`, `.module.css`
- ET nom de fichier NE contient PAS : `.test.`, `.spec.`, `.service.`, `.config.`, `.mock.`, `.fixture.`
- ET chemin contient l'un des segments : `components/`, `pages/`, `views/`, `screens/`, `layouts/`, `ui/`

Si UI détectée :
1. Invoquer `ui-ux-pro-max:ui-ux-pro-max` via Skill tool avec contexte minimal : liste des fichiers UI modifiés + stack tech
2. Tenter `mcp__chrome-devtools__take_screenshot` → si succès, sauvegarder en `{output_folder}/screenshots/{story_key}/task-{N}-visual.png`
3. Si DevTools indisponible (exception/tool error) → `<output>⚠️ DevTools MCP not available — visual screenshot skipped. To enable: start Chrome with remote debugging and configure the DevTools MCP server.</output>`, continuer sans bloquer

**TD5 — testarch/browser : dégradation graceful et format date**

Aligné sur le pattern `testarch/automate` : pas de HALT inconditionnel.
- Si DevTools MCP indisponible au preflight : `⚠️ WARNING: Chrome DevTools MCP not available. Journey execution will be skipped. Start Chrome with remote debugging to enable browser testing.` → afficher instructions + EXIT (pas HALT brutal)
- Format date dans le nom de dossier : `YYYY-MM-DD` uniquement (compatible tous OS) — ex: `{output_folder}/browser-tests/2026-02-28/{journey-slug}/`
- Screenshots : `{step:02d}-{action}.png` où `{action}` est un slug sans espaces ni caractères spéciaux

**TD6 — Routing orchestrateur pour testarch/browser**

Vérifier si le routing de l'orchestrateur (`src/modules/orchestrator/`) référence les workflows testarch par convention de chemin ou via une liste explicite. Si liste explicite, ajouter `testarch-browser`. Si convention, documenter que le workflow est accessible via `bmad tea *browser` (pattern déjà utilisé pour `bmad tea *automate`, `bmad tea *framework`, etc.).

## Implementation Plan

### Tasks

- [x] T1: Modifier step-13 — chaîner vers step-14b
  - File: `src/modules/bmm/workflows/2-plan-workflows/create-ux-design/steps/step-13-responsive-accessibility.md`
  - Action: Dans la section NEXT STEP (3 dernières lignes), remplacer les 2 occurrences de `step-14-complete.md` par `step-14b-uiux-tools.md`
  - Notes: Changement minimal, 2 lignes à modifier

- [x] T2: Créer step-14b-uiux-tools.md
  - File: `src/modules/bmm/workflows/2-plan-workflows/create-ux-design/steps/step-14b-uiux-tools.md`
  - Action: Créer le fichier complet en suivant exactement le pattern de `step-11-component-strategy.md` (sections MANDATORY RULES, EXECUTION PROTOCOLS, CONTEXT BOUNDARIES, YOUR TASK, SEQUENCE numéroté, SUCCESS METRICS, FAILURE MODES, NEXT STEP)
  - Notes:
    - Phase A (Pencil) : séquence exacte TD2. Obligatoire, pas de skip.
    - Phase B (ui-ux-pro-max) : séquence TD3. Obligatoire, pas de skip.
    - `stepsCompleted`: ajouter `"14b"` au tableau existant dans le frontmatter du document UX
    - NEXT STEP : `load \`./step-14-complete.md\``
    - Menu : [C] uniquement (pas de A/P car step technique, pas collaboratif)

- [x] T3: Mettre à jour step-14-complete.md
  - File: `src/modules/bmm/workflows/2-plan-workflows/create-ux-design/steps/step-14-complete.md`
  - Action (3 sous-tâches) :
    1. Dans l'annonce de complétion (section "What we've accomplished"), ajouter après le dernier item `✅ Responsive design and accessibility strategy` :
       `- ✅ Visual mockups created in Pencil (.pen format)`
       `- ✅ Design system implementation rules generated (ui-ux-pro-max)`
    2. Dans la section WORKFLOW COMPLETION CHECKLIST (Design Specification Complete), ajouter :
       `- [ ] Visual mockups created in Pencil (.pen file)`
       `- [ ] Design system implementation rules generated and appended to spec`
    3. Dans WORKFLOW FINALIZATION, NE PAS modifier `lastStep = 14` — ce step reste le dernier step entier, step-14b ajoute `"14b"` séparément dans `stepsCompleted`

- [x] T4: Mettre à jour step-01b-continue.md
  - File: `src/modules/bmm/workflows/2-plan-workflows/create-ux-design/steps/step-01b-continue.md`
  - Action: Lire le fichier complet, identifier le lookup table `lastStep` → step file. Ajouter l'entrée pour `"14b"` → `step-14-complete.md` (car si on reprend après step-14b, on continue vers la complétion)
  - Notes: Lire le fichier AVANT de modifier pour identifier le format exact du lookup table

- [x] T5: Ajouter UI validation dans dev-story/instructions.xml (fin de step-7)
  - File: `src/modules/bmm/workflows/4-implementation/dev-story/instructions.xml`
  - Action: Localiser la balise fermante `</step>` du `<step n="7">`. Insérer AVANT cette balise le bloc XML suivant (respecter indentation existante) :
    ```xml
    <!-- UI Visual Validation (auto-triggered when UI files detected) -->
    <check if="any file in current task matches: (extension in [.tsx,.jsx,.vue,.svelte,.html,.css,.scss,.module.css]) AND (filename does NOT contain [.test.,.spec.,.service.,.config.,.mock.,.fixture.]) AND (path contains one of [components/,pages/,views/,screens/,layouts/,ui/])">
      <action>Use the Skill tool to invoke the skill `ui-ux-pro-max:ui-ux-pro-max` with context: list of UI files modified in this task and the project tech stack</action>
      <action>Attempt to capture a visual screenshot using the mcp__chrome-devtools__take_screenshot tool. If successful, save the screenshot to {output_folder}/screenshots/{story_key}/task-{current_task_number}-visual.png</action>
      <check if="mcp__chrome-devtools__take_screenshot tool is unavailable or returns an error">
        <output>⚠️ DevTools MCP not available — visual screenshot skipped. To enable: start Chrome with remote debugging and configure the Chrome DevTools MCP server.</output>
      </check>
    </check>
    ```
  - Notes: Ne pas créer un nouveau `<step n="">` — insérer à l'intérieur du step-7 existant. L'indentation doit correspondre aux autres `<check>` et `<action>` dans ce step.

- [x] T6: Créer testarch/browser/workflow.yaml
  - File: `src/modules/bmm/workflows/testarch/browser/workflow.yaml`
  - Action: Créer en copiant la structure de `testarch/automate/workflow.yaml`. Adapter :
    - `name: testarch-browser`
    - `description: "Execute browser journeys with systematic screenshot capture organized by journey folder"`
    - Variables :
      - `app_url: ""` (URL de l'app — requis si `auto_discover_journeys: false`)
      - `journeys: []` (liste de journeys à tester — si vide, auto-découverte depuis spec UX ou PRD)
      - `auto_discover_journeys: true`
      - `screenshots_dir: "{output_folder}/browser-tests"` (date YYYY-MM-DD ajoutée à l'exécution)
      - `devtools_warning_only: true` (dégradation graceful, pas de HALT dur)
    - `tags: [qa, browser, screenshots, journeys, visual-testing]`
    - `execution_hints: interactive: true, autonomous: false`

- [x] T7: Créer testarch/browser/instructions.md
  - File: `src/modules/bmm/workflows/testarch/browser/instructions.md`
  - Action: Créer avec les étapes suivantes (pattern narratif comme `testarch/automate/instructions.md`) :
    - **Preflight** : Tenter `mcp__chrome-devtools__list_pages`. Si indisponible → afficher warning + instructions démarrage DevTools MCP + EXIT graceful (pas HALT dur)
    - **Découverte journeys** : Si `{journeys}` fourni → utiliser tel quel. Sinon → chercher dans `{planning_artifacts}/ux-design-specification.md` section "User Journeys", ou dans PRD, ou demander à l'utilisateur
    - **Pour chaque journey** :
      1. Créer dossier `{screenshots_dir}/{YYYY-MM-DD}/{journey-slug}/`
      2. Naviguer vers `{app_url}` via `mcp__chrome-devtools__navigate_page`
      3. Pour chaque étape du journey : exécuter l'action (`mcp__chrome-devtools__click`, `mcp__chrome-devtools__fill`, `mcp__chrome-devtools__type_text`), puis capturer screenshot `mcp__chrome-devtools__take_screenshot` → sauvegarder en `{step:02d}-{action-slug}.png`
      4. Capturer snapshot accessibilité final via `mcp__chrome-devtools__take_snapshot`
    - **Notification finale** : Afficher résumé : nombre de journeys testés, nombre total de screenshots, chemin du dossier racine `{screenshots_dir}/{YYYY-MM-DD}/`

- [x] T8: Créer testarch/browser/checklist.md
  - File: `src/modules/bmm/workflows/testarch/browser/checklist.md`
  - Action: Créer avec sections : Prerequisites, Preflight DevTools, Journey Discovery, Journey Execution (par journey), Screenshots Quality, Notification
  - Notes: Modèle structurel = `testarch/automate/checklist.md`

- [x] T9: Vérifier routing orchestrateur pour testarch/browser
  - File: `src/modules/orchestrator/` (explorer pour trouver le fichier de routing)
  - Action: Vérifier si les workflows testarch sont routés par convention de chemin (pattern `bmad tea *browser` déjà fonctionnel) ou par liste explicite. Si liste explicite → ajouter `testarch-browser`. Documenter le résultat dans les notes de complétion.
  - Notes: Tâche de vérification — peut ne nécessiter aucune modification si la convention de chemin est déjà en place

### Acceptance Criteria

- [ ] AC1: Given workflow create-ux-design complète step-13 et l'utilisateur sélectionne [C], when l'agent charge le step suivant, then il charge `step-14b-uiux-tools.md` (et non `step-14-complete.md`)

- [ ] AC2: Given step-14b-uiux-tools est chargé, when l'agent exécute la Phase A, then il appelle les outils `mcp__pencil__*` dans la séquence TD2 et crée un fichier .pen. Le path du fichier est communiqué à l'utilisateur.

- [ ] AC3: Given la Phase A de step-14b est complétée, when l'agent exécute la Phase B, then il invoque le skill `ui-ux-pro-max:ui-ux-pro-max` et ajoute une section `## Design System Implementation` à la spec UX. Les deux phases sont obligatoires et séquentielles.

- [ ] AC4: Given step-14b complété et l'utilisateur sélectionne [C], when l'agent charge le step suivant, then il charge `step-14-complete.md` qui affiche la liste d'accomplissements incluant les deux nouvelles lignes Pencil et ui-ux-pro-max

- [ ] AC5: Given une session create-ux-design interrompue après step-14b (stepsCompleted contient "14b"), when l'utilisateur reprend via step-01b-continue.md, then le workflow reprend à `step-14-complete.md`

- [ ] AC6: Given une story dev-story avec des fichiers UI modifiés correspondant aux critères TD4 (.tsx dans `components/`, etc.), when step-7 se termine avec succès, then le bloc UI-validation est exécuté et `ui-ux-pro-max:ui-ux-pro-max` est invoqué

- [ ] AC7: Given le bloc UI-validation s'exécute et Chrome DevTools MCP est disponible, when l'agent tente le screenshot, then un fichier PNG est sauvegardé dans `{output_folder}/screenshots/{story_key}/`

- [ ] AC8: Given le bloc UI-validation s'exécute mais Chrome DevTools MCP est indisponible, when l'agent tente le screenshot, then un message ⚠️ est affiché et le workflow continue vers step-8 sans interruption

- [ ] AC9: Given une story dev-story avec uniquement des fichiers backend modifiés (ex: `user.service.ts`, `auth.controller.ts`), when step-7 se termine, then le bloc UI-validation est ignoré et step-8 démarre directement

- [ ] AC10: Given workflow testarch-browser lancé avec `app_url` valide et DevTools MCP disponible, when l'agent exécute les journeys, then chaque journey produit un sous-dossier `{YYYY-MM-DD}/{journey-slug}/` avec des screenshots nommés `{step:02d}-{action-slug}.png`

- [ ] AC11: Given tous les journeys sont testés, when le workflow se termine, then l'agent notifie l'utilisateur avec le chemin complet du dossier racine, le nombre de journeys et le nombre total de screenshots

- [ ] AC12: Given workflow testarch-browser lancé mais DevTools MCP indisponible, when l'agent exécute le preflight check, then un message ⚠️ avec instructions de démarrage est affiché et le workflow EXIT gracieusement (pas de crash, pas de HALT brutal)

## Additional Context

### Dependencies

- `ui-ux-pro-max:ui-ux-pro-max` skill : Claude Code skill installé au niveau système, vérifié présent dans le skill registry (pas dans `src/` — c'est normal)
- `pencil` MCP server configuré — vérifié présent (outils `mcp__pencil__*` disponibles)
- `mcp__chrome-devtools__*` outils disponibles — vérifié présent
- Aucune dépendance npm additionnelle requise

### Testing Strategy

- Validation manuelle via les checklists (pattern BMAD testarch)
- **T1/T2/T3/T4 (create-ux-design)** : lancer le workflow create-ux-design sur un projet test fictif, vérifier que step-14b est chargé après step-13, que Pencil s'ouvre, que ui-ux-pro-max est invoqué, puis que step-14-complete se charge correctement
- **T5 (dev-story)** : lancer dev-story sur une story avec un composant React/Vue et une tâche API — vérifier que seul le composant UI déclenche la validation, pas la tâche API
- **T6/T7/T8 (testarch/browser)** : lancer `bmad tea *browser` sur un projet avec app démarrée en local, vérifier la création des dossiers et des screenshots
- **T9 (routing)** : tester l'invocation `bmad tea *browser` depuis l'orchestrateur

### Notes

- **Risque performance** : ui-ux-pro-max peut être verbeux. Dans step-14b et le bloc UI-validation de dev-story, fournir uniquement le contexte minimal nécessaire (stack tech + fichiers modifiés) — ne pas passer l'intégralité de la spec UX
- **Futur** : testarch/browser pourrait être déclenché automatiquement depuis dev-story post-implémentation UI (hors scope de cette itération)
- **Pencil file path** : `mcp__pencil__open_document("new")` crée un fichier temporaire dans le dossier Pencil par défaut. `mcp__pencil__get_editor_state()` retourne le `filePath` actif. Le dev devra vérifier si Pencil supporte la sauvegarde vers un path arbitraire ou si le fichier doit être déplacé manuellement après création.

## Review Notes

- Adversarial review completed (quick-dev step-05)
- Findings: 12 total, 11 fixed (auto-fix), 1 skipped (noise: F11 emoji formatting)
- Resolution approach: auto-fix
- Key fixes applied:
  - F1: step-01b-continue routing reordered — stepsCompleted check now precedes lastStep=13 (prevents routing loop)
  - F2: step-14-complete ✅ entries marked conditional "(if step 14b was executed)"
  - F3: step-14b Phase B now has graceful degradation if ui-ux-pro-max skill unavailable
  - F4: step-14b Phase A now has Pencil MCP preflight check (graceful skip if unavailable)
  - F5: dev-story screenshot path — removed undefined `{story_key}` variable
  - F7: workflow.yaml optional_tools replaced with commented optional_capabilities (non-MCP names)
  - F8: instructions.md — journey slug collision handling added (counter suffix for same-run duplicates)
  - F9: step-14b FAILURE MODES — Pencil screenshot failure explicitly non-blocking
  - F10: workflow.yaml — `planning_artifacts` variable declared explicitly
  - F12: instructions.md overview — "significant step" corrected to "each step"
