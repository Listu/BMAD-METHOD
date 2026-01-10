/**
 * BMAD Orchestrator - Meta-Review
 *
 * Analyzes project memories and patterns to generate insights.
 * Identifies improvements and can contribute back to BMAD.
 */

const fs = require('fs').promises;
const path = require('path');

// Review categories
const REVIEW_CATEGORIES = {
  WORKFLOW: 'workflow',         // Workflow execution patterns
  ERRORS: 'errors',             // Common error patterns
  DECISIONS: 'decisions',       // Decision patterns
  PERFORMANCE: 'performance',   // Performance insights
  QUALITY: 'quality',           // Quality trends
  PROCESS: 'process'            // Process improvements
};

// Insight types
const INSIGHT_TYPES = {
  PATTERN: 'pattern',           // Recurring behavior
  ANOMALY: 'anomaly',           // Unusual occurrence
  TREND: 'trend',               // Change over time
  CORRELATION: 'correlation',   // Related events
  RECOMMENDATION: 'recommendation'
};

// Default configuration
const DEFAULT_CONFIG = {
  minPatternOccurrences: 3,
  analysisDepth: 'standard',    // quick, standard, deep
  includeSuggestions: true,
  contributionEnabled: false
};

/**
 * Pattern Detector
 * Identifies recurring patterns in project data
 */
class PatternDetector {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.patterns = [];
  }

  /**
   * Analyze data for patterns
   */
  analyze(data, category) {
    const patterns = [];

    switch (category) {
      case REVIEW_CATEGORIES.ERRORS:
        patterns.push(...this.analyzeErrorPatterns(data));
        break;

      case REVIEW_CATEGORIES.DECISIONS:
        patterns.push(...this.analyzeDecisionPatterns(data));
        break;

      case REVIEW_CATEGORIES.WORKFLOW:
        patterns.push(...this.analyzeWorkflowPatterns(data));
        break;

      case REVIEW_CATEGORIES.QUALITY:
        patterns.push(...this.analyzeQualityPatterns(data));
        break;

      default:
        patterns.push(...this.analyzeGenericPatterns(data, category));
    }

    return patterns.filter(p => p.occurrences >= this.config.minPatternOccurrences);
  }

  /**
   * Analyze error patterns
   */
  analyzeErrorPatterns(errors) {
    const patterns = [];
    const errorGroups = new Map();

    for (const error of errors) {
      // Group by error type/category
      const key = this.normalizeErrorKey(error);
      if (!errorGroups.has(key)) {
        errorGroups.set(key, []);
      }
      errorGroups.get(key).push(error);
    }

    for (const [key, group] of errorGroups) {
      if (group.length >= this.config.minPatternOccurrences) {
        patterns.push({
          type: INSIGHT_TYPES.PATTERN,
          category: REVIEW_CATEGORIES.ERRORS,
          description: `Recurring error: ${key}`,
          occurrences: group.length,
          examples: group.slice(0, 3),
          suggestion: this.suggestErrorFix(key, group),
          severity: this.calculateSeverity(group)
        });
      }
    }

    return patterns;
  }

  /**
   * Normalize error for grouping
   */
  normalizeErrorKey(error) {
    const content = typeof error === 'string' ? error : error.content || error.message;
    if (!content) return 'unknown';

    // Remove specific values to find pattern
    return content
      .replace(/\d+/g, 'N')
      .replace(/'[^']+'/g, "'X'")
      .replace(/"[^"]+"/g, '"X"')
      .slice(0, 100);
  }

  /**
   * Suggest fix for error pattern
   */
  suggestErrorFix(errorKey, examples) {
    // Common error pattern suggestions
    if (errorKey.includes('timeout')) {
      return 'Consider increasing timeout values or implementing retry logic';
    }
    if (errorKey.includes('not found')) {
      return 'Add existence checks before file/resource access';
    }
    if (errorKey.includes('permission')) {
      return 'Review file permissions and access controls';
    }
    if (errorKey.includes('validation')) {
      return 'Strengthen input validation at entry points';
    }

    return 'Review error handling for this pattern';
  }

  /**
   * Analyze decision patterns
   */
  analyzeDecisionPatterns(decisions) {
    const patterns = [];
    const decisionAreas = new Map();

    for (const decision of decisions) {
      const area = decision.area || decision.metadata?.area || 'general';
      if (!decisionAreas.has(area)) {
        decisionAreas.set(area, []);
      }
      decisionAreas.get(area).push(decision);
    }

    for (const [area, areaDecisions] of decisionAreas) {
      if (areaDecisions.length >= 2) {
        patterns.push({
          type: INSIGHT_TYPES.PATTERN,
          category: REVIEW_CATEGORIES.DECISIONS,
          description: `Multiple decisions in area: ${area}`,
          occurrences: areaDecisions.length,
          decisions: areaDecisions.map(d => d.content || d.decision),
          suggestion: 'Consider documenting area-specific decision criteria'
        });
      }
    }

    // Detect decision reversals
    const reversals = this.detectDecisionReversals(decisions);
    if (reversals.length > 0) {
      patterns.push({
        type: INSIGHT_TYPES.ANOMALY,
        category: REVIEW_CATEGORIES.DECISIONS,
        description: 'Decision reversals detected',
        occurrences: reversals.length,
        examples: reversals,
        suggestion: 'Review decision-making process for these areas'
      });
    }

    return patterns;
  }

  /**
   * Detect reversed decisions
   */
  detectDecisionReversals(decisions) {
    const reversals = [];
    const decisionMap = new Map();

    for (const decision of decisions) {
      const content = decision.content || decision.decision;
      const normalized = content?.toLowerCase() || '';

      // Check for reversal indicators
      if (normalized.includes('reverted') ||
          normalized.includes('changed from') ||
          normalized.includes('no longer')) {
        reversals.push(decision);
      }
    }

    return reversals;
  }

  /**
   * Analyze workflow patterns
   */
  analyzeWorkflowPatterns(workflowData) {
    const patterns = [];

    // Analyze workflow completion rates
    if (workflowData.completions) {
      const completionRates = new Map();

      for (const completion of workflowData.completions) {
        const workflow = completion.workflow;
        if (!completionRates.has(workflow)) {
          completionRates.set(workflow, { completed: 0, failed: 0 });
        }
        if (completion.success) {
          completionRates.get(workflow).completed++;
        } else {
          completionRates.get(workflow).failed++;
        }
      }

      for (const [workflow, stats] of completionRates) {
        const total = stats.completed + stats.failed;
        const failRate = stats.failed / total;

        if (failRate > 0.3 && total >= 3) {
          patterns.push({
            type: INSIGHT_TYPES.TREND,
            category: REVIEW_CATEGORIES.WORKFLOW,
            description: `High failure rate for workflow: ${workflow}`,
            occurrences: total,
            failureRate: Math.round(failRate * 100),
            suggestion: 'Review workflow steps and prerequisites'
          });
        }
      }
    }

    // Analyze workflow sequences
    if (workflowData.sequences) {
      const commonSequences = this.findCommonSequences(workflowData.sequences);
      for (const seq of commonSequences) {
        patterns.push({
          type: INSIGHT_TYPES.PATTERN,
          category: REVIEW_CATEGORIES.WORKFLOW,
          description: `Common workflow sequence: ${seq.sequence.join(' -> ')}`,
          occurrences: seq.count,
          suggestion: 'Consider creating a combined workflow for this sequence'
        });
      }
    }

    return patterns;
  }

  /**
   * Find common workflow sequences
   */
  findCommonSequences(sequences) {
    const sequenceCounts = new Map();

    for (const seq of sequences) {
      if (seq.length < 2) continue;

      // Look at pairs and triples
      for (let i = 0; i < seq.length - 1; i++) {
        const pair = `${seq[i]},${seq[i + 1]}`;
        sequenceCounts.set(pair, (sequenceCounts.get(pair) || 0) + 1);

        if (i < seq.length - 2) {
          const triple = `${seq[i]},${seq[i + 1]},${seq[i + 2]}`;
          sequenceCounts.set(triple, (sequenceCounts.get(triple) || 0) + 1);
        }
      }
    }

    const common = [];
    for (const [seq, count] of sequenceCounts) {
      if (count >= this.config.minPatternOccurrences) {
        common.push({
          sequence: seq.split(','),
          count
        });
      }
    }

    return common.sort((a, b) => b.count - a.count);
  }

  /**
   * Analyze quality patterns
   */
  analyzeQualityPatterns(qualityData) {
    const patterns = [];

    // Analyze quality gate results
    if (qualityData.gateResults) {
      const failureReasons = new Map();

      for (const result of qualityData.gateResults) {
        if (!result.passed) {
          for (const step of result.steps || []) {
            if (!step.success && !step.skipped) {
              const reason = step.step || 'unknown';
              failureReasons.set(reason, (failureReasons.get(reason) || 0) + 1);
            }
          }
        }
      }

      for (const [reason, count] of failureReasons) {
        if (count >= this.config.minPatternOccurrences) {
          patterns.push({
            type: INSIGHT_TYPES.PATTERN,
            category: REVIEW_CATEGORIES.QUALITY,
            description: `Frequent quality gate failure: ${reason}`,
            occurrences: count,
            suggestion: this.suggestQualityFix(reason)
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Suggest quality fix
   */
  suggestQualityFix(failureStep) {
    const suggestions = {
      build: 'Review build configuration and dependencies',
      test: 'Improve test coverage and fix flaky tests',
      lint: 'Address linting issues or adjust rules',
      server: 'Review server startup and health check configuration'
    };

    return suggestions[failureStep] || 'Review quality gate configuration';
  }

  /**
   * Analyze generic patterns
   */
  analyzeGenericPatterns(data, category) {
    const patterns = [];

    if (!Array.isArray(data)) return patterns;

    // Group by content similarity
    const groups = new Map();

    for (const item of data) {
      const key = this.getItemKey(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    }

    for (const [key, group] of groups) {
      if (group.length >= this.config.minPatternOccurrences) {
        patterns.push({
          type: INSIGHT_TYPES.PATTERN,
          category,
          description: `Recurring item: ${key}`,
          occurrences: group.length,
          examples: group.slice(0, 3)
        });
      }
    }

    return patterns;
  }

  /**
   * Get key for grouping items
   */
  getItemKey(item) {
    if (typeof item === 'string') return item.slice(0, 50);
    if (item.content) return item.content.slice(0, 50);
    if (item.type) return item.type;
    return JSON.stringify(item).slice(0, 50);
  }

  /**
   * Calculate severity based on occurrences and impact
   */
  calculateSeverity(items) {
    const count = items.length;
    if (count >= 10) return 'high';
    if (count >= 5) return 'medium';
    return 'low';
  }
}

/**
 * Report Generator
 * Generates meta-review reports from analysis
 */
class ReportGenerator {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Generate comprehensive report
   */
  generate(patterns, projectInfo = {}) {
    const report = {
      generatedAt: new Date().toISOString(),
      project: projectInfo.name || 'Unknown Project',
      summary: this.generateSummary(patterns),
      sections: [],
      recommendations: [],
      bmadContributions: []
    };

    // Group patterns by category
    const byCategory = new Map();
    for (const pattern of patterns) {
      if (!byCategory.has(pattern.category)) {
        byCategory.set(pattern.category, []);
      }
      byCategory.get(pattern.category).push(pattern);
    }

    // Generate sections
    for (const [category, categoryPatterns] of byCategory) {
      report.sections.push({
        title: this.categoryTitle(category),
        patterns: categoryPatterns,
        insights: this.generateCategoryInsights(categoryPatterns)
      });
    }

    // Generate recommendations
    report.recommendations = this.generateRecommendations(patterns);

    // Identify potential BMAD contributions
    report.bmadContributions = this.identifyContributions(patterns);

    return report;
  }

  /**
   * Generate summary
   */
  generateSummary(patterns) {
    const totalPatterns = patterns.length;
    const highSeverity = patterns.filter(p => p.severity === 'high').length;
    const withSuggestions = patterns.filter(p => p.suggestion).length;

    return {
      totalPatterns,
      highSeverity,
      withSuggestions,
      categories: [...new Set(patterns.map(p => p.category))],
      healthScore: this.calculateHealthScore(patterns)
    };
  }

  /**
   * Calculate project health score
   */
  calculateHealthScore(patterns) {
    let score = 100;

    for (const pattern of patterns) {
      if (pattern.severity === 'high') score -= 10;
      else if (pattern.severity === 'medium') score -= 5;
      else score -= 2;

      if (pattern.type === INSIGHT_TYPES.ANOMALY) score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get category title
   */
  categoryTitle(category) {
    const titles = {
      [REVIEW_CATEGORIES.WORKFLOW]: 'Workflow Analysis',
      [REVIEW_CATEGORIES.ERRORS]: 'Error Patterns',
      [REVIEW_CATEGORIES.DECISIONS]: 'Decision Analysis',
      [REVIEW_CATEGORIES.PERFORMANCE]: 'Performance Insights',
      [REVIEW_CATEGORIES.QUALITY]: 'Quality Trends',
      [REVIEW_CATEGORIES.PROCESS]: 'Process Improvements'
    };
    return titles[category] || category;
  }

  /**
   * Generate category-specific insights
   */
  generateCategoryInsights(patterns) {
    const insights = [];

    // Count by type
    const byType = new Map();
    for (const pattern of patterns) {
      byType.set(pattern.type, (byType.get(pattern.type) || 0) + 1);
    }

    if (byType.get(INSIGHT_TYPES.PATTERN) > 3) {
      insights.push('Multiple recurring patterns detected - consider process standardization');
    }

    if (byType.get(INSIGHT_TYPES.ANOMALY) > 0) {
      insights.push('Anomalies detected - review for potential issues');
    }

    if (byType.get(INSIGHT_TYPES.TREND) > 0) {
      insights.push('Trends identified - monitor for continued changes');
    }

    return insights;
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(patterns) {
    const recommendations = [];
    const seenSuggestions = new Set();

    // Sort by severity
    const sorted = [...patterns].sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
    });

    for (const pattern of sorted) {
      if (pattern.suggestion && !seenSuggestions.has(pattern.suggestion)) {
        seenSuggestions.add(pattern.suggestion);
        recommendations.push({
          priority: pattern.severity || 'medium',
          category: pattern.category,
          recommendation: pattern.suggestion,
          basedOn: pattern.description
        });
      }
    }

    return recommendations.slice(0, 10); // Top 10 recommendations
  }

  /**
   * Identify potential BMAD contributions
   */
  identifyContributions(patterns) {
    const contributions = [];

    for (const pattern of patterns) {
      // Workflow improvements could be contributed
      if (pattern.category === REVIEW_CATEGORIES.WORKFLOW &&
          pattern.type === INSIGHT_TYPES.PATTERN &&
          pattern.occurrences >= 5) {
        contributions.push({
          type: 'workflow_improvement',
          description: `Common pattern: ${pattern.description}`,
          suggestion: 'Could be formalized as a new workflow or workflow enhancement'
        });
      }

      // Error patterns with good solutions could help others
      if (pattern.category === REVIEW_CATEGORIES.ERRORS &&
          pattern.suggestion &&
          pattern.occurrences >= 5) {
        contributions.push({
          type: 'error_documentation',
          description: `Common error: ${pattern.description}`,
          solution: pattern.suggestion
        });
      }
    }

    return contributions;
  }

  /**
   * Format report as markdown
   */
  formatMarkdown(report) {
    const lines = [];

    lines.push(`# Meta-Review Report`);
    lines.push(`\n*Generated: ${report.generatedAt}*`);
    lines.push(`*Project: ${report.project}*\n`);

    // Summary
    lines.push(`## Summary\n`);
    lines.push(`- **Health Score:** ${report.summary.healthScore}/100`);
    lines.push(`- **Patterns Found:** ${report.summary.totalPatterns}`);
    lines.push(`- **High Severity:** ${report.summary.highSeverity}`);
    lines.push(`- **Categories:** ${report.summary.categories.join(', ')}\n`);

    // Sections
    for (const section of report.sections) {
      lines.push(`## ${section.title}\n`);

      for (const pattern of section.patterns) {
        const severity = pattern.severity ? ` [${pattern.severity}]` : '';
        lines.push(`### ${pattern.description}${severity}\n`);
        lines.push(`- **Occurrences:** ${pattern.occurrences}`);
        lines.push(`- **Type:** ${pattern.type}`);
        if (pattern.suggestion) {
          lines.push(`- **Suggestion:** ${pattern.suggestion}`);
        }
        lines.push('');
      }

      if (section.insights.length > 0) {
        lines.push(`**Insights:**`);
        for (const insight of section.insights) {
          lines.push(`- ${insight}`);
        }
        lines.push('');
      }
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      lines.push(`## Recommendations\n`);
      for (const rec of report.recommendations) {
        lines.push(`### [${rec.priority.toUpperCase()}] ${rec.recommendation}`);
        lines.push(`_Based on: ${rec.basedOn}_\n`);
      }
    }

    // BMAD Contributions
    if (report.bmadContributions.length > 0) {
      lines.push(`## Potential BMAD Contributions\n`);
      lines.push(`The following patterns could benefit the BMAD community:\n`);
      for (const contrib of report.bmadContributions) {
        lines.push(`- **${contrib.type}:** ${contrib.description}`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * Meta-Review Manager
 * Orchestrates pattern detection and report generation
 */
class MetaReviewManager {
  constructor(projectPath, options = {}) {
    this.projectPath = projectPath;
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.patternDetector = new PatternDetector(options);
    this.reportGenerator = new ReportGenerator(options);
  }

  /**
   * Run full meta-review
   */
  async runReview(memoryManager = null) {
    const data = await this.collectData(memoryManager);
    const patterns = this.analyzeData(data);
    const report = this.reportGenerator.generate(patterns, {
      name: path.basename(this.projectPath)
    });

    return report;
  }

  /**
   * Collect data for analysis
   */
  async collectData(memoryManager) {
    const data = {
      errors: [],
      decisions: [],
      lessons: [],
      patterns: [],
      workflows: { completions: [], sequences: [] },
      quality: { gateResults: [] }
    };

    // Collect from memory manager if provided
    if (memoryManager) {
      try {
        const memories = await memoryManager.getAll();
        data.errors = memories.errors || [];
        data.decisions = memories.decisions || [];
        data.lessons = memories.lessons || [];
        data.patterns = memories.patterns || [];
      } catch {
        // Memory not available
      }
    }

    // Try to load from workflow status
    try {
      const statusPath = path.join(this.projectPath, '_bmad', 'workflow-status.yaml');
      const content = await fs.readFile(statusPath, 'utf8');
      // Parse completed workflows
      const completedMatch = content.match(/completed:\s*\[(.*?)\]/);
      if (completedMatch) {
        data.workflows.sequences.push(completedMatch[1].split(',').map(s => s.trim()));
      }
    } catch {
      // No workflow status
    }

    return data;
  }

  /**
   * Analyze collected data
   */
  analyzeData(data) {
    const allPatterns = [];

    if (data.errors.length > 0) {
      allPatterns.push(...this.patternDetector.analyze(data.errors, REVIEW_CATEGORIES.ERRORS));
    }

    if (data.decisions.length > 0) {
      allPatterns.push(...this.patternDetector.analyze(data.decisions, REVIEW_CATEGORIES.DECISIONS));
    }

    if (data.workflows.completions.length > 0 || data.workflows.sequences.length > 0) {
      allPatterns.push(...this.patternDetector.analyze(data.workflows, REVIEW_CATEGORIES.WORKFLOW));
    }

    if (data.quality.gateResults.length > 0) {
      allPatterns.push(...this.patternDetector.analyze(data.quality, REVIEW_CATEGORIES.QUALITY));
    }

    return allPatterns;
  }

  /**
   * Save report to file
   */
  async saveReport(report, filename = null) {
    const outputDir = path.join(this.projectPath, '_bmad', 'docs');
    await fs.mkdir(outputDir, { recursive: true });

    const outputFile = filename || `meta-review-${new Date().toISOString().split('T')[0]}.md`;
    const outputPath = path.join(outputDir, outputFile);

    const markdown = this.reportGenerator.formatMarkdown(report);
    await fs.writeFile(outputPath, markdown);

    return outputPath;
  }
}

/**
 * Create meta-review manager
 */
function createMetaReviewManager(projectPath, options = {}) {
  return new MetaReviewManager(projectPath, options);
}

module.exports = {
  MetaReviewManager,
  PatternDetector,
  ReportGenerator,
  createMetaReviewManager,
  REVIEW_CATEGORIES,
  INSIGHT_TYPES
};
