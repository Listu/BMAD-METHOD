/**
 * BMAD Orchestrator - Intent Detection
 *
 * Analyzes natural language input to detect user intent
 * and extract relevant entities for routing.
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Intent detection result
 * @typedef {Object} IntentResult
 * @property {string} category - The detected intent category
 * @property {number} confidence - Confidence score (0-1)
 * @property {Object} entities - Extracted entities (project names, workflow types, etc.)
 * @property {string[]} alternatives - Alternative interpretations
 * @property {string} raw_input - Original user input
 */

class IntentDetector {
  constructor(dataPath = null) {
    this.dataPath = dataPath || path.join(__dirname, '..', 'data');
    this.categories = null;
    this.routingRules = null;
  }

  /**
   * Load intent categories and routing rules
   */
  async init() {
    // Load intent categories from CSV
    const categoriesPath = path.join(this.dataPath, 'intent-categories.csv');
    const categoriesContent = await fs.readFile(categoriesPath, 'utf8');
    this.categories = this.parseCSV(categoriesContent);

    // Load routing rules
    const rulesPath = path.join(this.dataPath, 'routing-rules.yaml');
    const rulesContent = await fs.readFile(rulesPath, 'utf8');
    const yaml = require('yaml');
    this.routingRules = yaml.parse(rulesContent);
  }

  /**
   * Detect intent from natural language input
   * @param {string} input - User's natural language input
   * @returns {IntentResult}
   */
  async detectIntent(input) {
    if (!this.categories) await this.init();

    const normalizedInput = input.toLowerCase().trim();

    // Try exact/pattern matches first
    const patternMatch = this.matchPatterns(normalizedInput);
    if (patternMatch.confidence >= 0.9) {
      return patternMatch;
    }

    // Try keyword-based detection
    const keywordMatch = this.matchKeywords(normalizedInput);
    if (keywordMatch.confidence >= 0.7) {
      return keywordMatch;
    }

    // Fall back to heuristic analysis
    const heuristicMatch = this.analyzeHeuristically(normalizedInput);

    // Return best match
    const matches = [patternMatch, keywordMatch, heuristicMatch]
      .filter(m => m.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);

    if (matches.length === 0) {
      return {
        category: 'unknown',
        confidence: 0,
        entities: {},
        alternatives: [],
        raw_input: input
      };
    }

    const best = matches[0];
    best.alternatives = matches.slice(1).map(m => m.category);
    return best;
  }

  /**
   * Match against known patterns from intent-categories.csv
   */
  matchPatterns(input) {
    let bestMatch = { category: 'unknown', confidence: 0, entities: {} };

    for (const category of this.categories) {
      const patterns = category.example_prompts?.split('|') || [];
      for (const pattern of patterns) {
        const normalizedPattern = pattern.toLowerCase().trim();
        if (!normalizedPattern) continue;

        // Exact match
        if (input === normalizedPattern) {
          return {
            category: category.category,
            confidence: 1.0,
            entities: this.extractEntities(input, category.category),
            raw_input: input
          };
        }

        // Contains match
        if (input.includes(normalizedPattern)) {
          const confidence = normalizedPattern.length / input.length;
          if (confidence > bestMatch.confidence) {
            bestMatch = {
              category: category.category,
              confidence: Math.min(0.9, confidence + 0.3),
              entities: this.extractEntities(input, category.category),
              raw_input: input
            };
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Match against workflow keywords from routing rules
   */
  matchKeywords(input) {
    if (!this.routingRules?.workflow_keywords) {
      return { category: 'unknown', confidence: 0, entities: {} };
    }

    let bestMatch = { category: 'unknown', confidence: 0, entities: {} };

    for (const [workflow, keywords] of Object.entries(
      this.routingRules.workflow_keywords
    )) {
      for (const keyword of keywords) {
        if (input.includes(keyword.toLowerCase())) {
          const confidence = 0.7 + (keyword.length / input.length) * 0.2;
          if (confidence > bestMatch.confidence) {
            bestMatch = {
              category: 'specific_workflow',
              confidence: Math.min(0.95, confidence),
              entities: { workflow, keyword },
              raw_input: input
            };
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Heuristic analysis for ambiguous inputs
   */
  analyzeHeuristically(input) {
    const entities = {};
    let category = 'unknown';
    let confidence = 0;

    // Question detection
    if (input.includes('?') || input.startsWith('what') || input.startsWith('how') ||
        input.startsWith('where') || input.startsWith('quoi') || input.startsWith('comment')) {
      if (input.includes('status') || input.includes('phase') || input.includes('where')) {
        category = 'status';
        confidence = 0.6;
      } else if (input.includes('help') || input.includes('can you') || input.includes('aide')) {
        category = 'help';
        confidence = 0.6;
      } else if (input.includes('remember') || input.includes('memory') || input.includes('souviens')) {
        category = 'memory_query';
        confidence = 0.6;
      }
    }

    // Action detection
    if (input.startsWith('create') || input.startsWith('make') || input.startsWith('build') ||
        input.startsWith('creer') || input.startsWith('faire')) {
      category = 'specific_workflow';
      confidence = 0.5;
      entities.action = 'create';
    }

    // Continuation detection
    if (input.includes('continue') || input.includes('next') || input.includes('go') ||
        input.includes('proceed') || input.includes('suite') || input === 'c') {
      category = 'continue';
      confidence = 0.8;
    }

    // Multi-project detection
    if ((input.includes(' on ') || input.includes(' sur ')) &&
        (input.includes(' and ') || input.includes(' et '))) {
      category = 'multi_project';
      confidence = 0.7;
      entities.multiProject = true;
    }

    // Project switching
    if (input.includes('switch') || input.includes('change') ||
        input.includes('work on') || input.includes('travaille sur')) {
      category = 'switch_project';
      confidence = 0.7;
    }

    return { category, confidence, entities, raw_input: input };
  }

  /**
   * Extract entities from input based on detected category
   */
  extractEntities(input, category) {
    const entities = {};

    // Extract project names (quoted strings or after "project")
    const projectMatch = input.match(/(?:project|projet)\s+["']?(\w+)["']?/i);
    if (projectMatch) {
      entities.projectName = projectMatch[1];
    }

    // Extract quoted strings as potential targets
    const quotedMatch = input.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      entities.target = quotedMatch[1];
    }

    // For specific workflows, try to extract workflow type
    if (category === 'specific_workflow') {
      const workflowTypes = ['prd', 'architecture', 'epics', 'sprint', 'test', 'review', 'brainstorm'];
      for (const wf of workflowTypes) {
        if (input.includes(wf)) {
          entities.workflowType = wf;
          break;
        }
      }
    }

    return entities;
  }

  /**
   * Parse CSV content into array of objects
   */
  parseCSV(content) {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',');

    return lines.slice(1).map(line => {
      const values = this.parseCSVLine(line);
      const obj = {};
      headers.forEach((header, i) => {
        obj[header.trim()] = values[i]?.trim();
      });
      return obj;
    });
  }

  /**
   * Parse a single CSV line handling quoted values
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    return values;
  }
}

module.exports = { IntentDetector };
