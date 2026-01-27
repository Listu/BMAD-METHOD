/**
 * BMAD Hook Registry
 *
 * Central manager for registering, loading, and executing hooks.
 * Follows the registry pattern used elsewhere in BMAD.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const {
  HookType,
  HookMode,
  HookPriority,
  HookResult,
  validateHookDefinition,
  createHookDefinition
} = require('./hook-types');

/**
 * HookRegistry - Central hook management
 */
class HookRegistry {
  constructor(options = {}) {
    this.hooks = new Map();         // type -> [hooks]
    this.handlers = new Map();      // action name -> handler function
    this.enabled = options.enabled !== false;
    this.verbose = options.verbose || false;
    this.builtinPath = options.builtinPath || path.join(__dirname, 'builtin');
    this.listeners = new Map();     // For event emission

    // Auto-load builtin hooks
    if (options.loadBuiltins !== false) {
      this._loadBuiltinHooks();
    }
  }

  /**
   * Register a hook
   * @param {Object} hookDef Hook definition
   * @returns {boolean} Success
   */
  register(hookDef) {
    const validation = validateHookDefinition(hookDef);
    if (!validation.valid) {
      console.error(`Invalid hook: ${validation.errors.join(', ')}`);
      return false;
    }

    const { type } = hookDef;

    if (!this.hooks.has(type)) {
      this.hooks.set(type, []);
    }

    // Check for duplicate
    const existing = this.hooks.get(type).find(h => h.id === hookDef.id);
    if (existing) {
      if (this.verbose) {
        console.log(`Hook ${hookDef.id} already registered, updating`);
      }
      Object.assign(existing, hookDef);
    } else {
      this.hooks.get(type).push(hookDef);
      // Sort by priority
      this.hooks.get(type).sort((a, b) => (a.priority || HookPriority.NORMAL) - (b.priority || HookPriority.NORMAL));
    }

    if (this.verbose) {
      console.log(`Registered hook: ${hookDef.id} (${type})`);
    }

    return true;
  }

  /**
   * Register a hook handler function
   * @param {string} actionName Name of the action
   * @param {Function} handler Handler function
   */
  registerHandler(actionName, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Handler for ${actionName} must be a function`);
    }
    this.handlers.set(actionName, handler);

    if (this.verbose) {
      console.log(`Registered handler: ${actionName}`);
    }
  }

  /**
   * Unregister a hook by ID
   * @param {string} hookId Hook ID to remove
   * @returns {boolean} Success
   */
  unregister(hookId) {
    let removed = false;
    for (const [type, hooks] of this.hooks) {
      const index = hooks.findIndex(h => h.id === hookId);
      if (index !== -1) {
        hooks.splice(index, 1);
        removed = true;
        if (this.verbose) {
          console.log(`Unregistered hook: ${hookId}`);
        }
        break;
      }
    }
    return removed;
  }

  /**
   * Execute hooks for a given type
   * @param {string} type Hook type (from HookType)
   * @param {Object} context Execution context
   * @returns {Object} { result: HookResult, data: any, errors: [] }
   */
  async execute(type, context = {}) {
    if (!this.enabled) {
      return { result: HookResult.CONTINUE, data: context, errors: [] };
    }

    const hooks = this.hooks.get(type) || [];
    const errors = [];
    let currentData = { ...context };
    let finalResult = HookResult.CONTINUE;

    for (const hook of hooks) {
      if (!hook.enabled) continue;

      // Check match pattern (for tool-based hooks)
      if (hook.match && context.toolName) {
        const pattern = typeof hook.match === 'string'
          ? new RegExp(hook.match)
          : hook.match;

        if (!pattern.test(context.toolName)) {
          continue;
        }
      }

      try {
        const result = await this._executeHook(hook, currentData);

        if (result.error) {
          errors.push({ hookId: hook.id, error: result.error });
          continue;
        }

        // Handle result
        switch (result.result) {
          case HookResult.ABORT:
            return {
              result: HookResult.ABORT,
              data: currentData,
              errors,
              abortedBy: hook.id
            };

          case HookResult.SKIP:
            finalResult = HookResult.SKIP;
            break;

          case HookResult.MODIFY:
            if (result.data) {
              currentData = { ...currentData, ...result.data };
            }
            break;

          case HookResult.RETRY:
            finalResult = HookResult.RETRY;
            break;
        }
      } catch (err) {
        errors.push({ hookId: hook.id, error: err.message });
        if (this.verbose) {
          console.error(`Hook ${hook.id} failed:`, err);
        }
      }
    }

    // Emit event for listeners
    this._emit(type, currentData);

    return {
      result: finalResult,
      data: currentData,
      errors
    };
  }

  /**
   * Execute a single hook
   * @private
   */
  async _executeHook(hook, context) {
    const handler = this.handlers.get(hook.action);

    if (!handler) {
      // Try to load handler dynamically
      const loaded = await this._loadHandler(hook.action);
      if (!loaded) {
        return {
          result: HookResult.CONTINUE,
          error: `No handler found for action: ${hook.action}`
        };
      }
    }

    const actualHandler = this.handlers.get(hook.action);

    if (hook.mode === HookMode.ASYNC) {
      // Fire and forget
      setImmediate(() => actualHandler(context, hook).catch(console.error));
      return { result: HookResult.CONTINUE };
    }

    return await actualHandler(context, hook);
  }

  /**
   * Try to load a handler from builtin or custom paths
   * @private
   */
  async _loadHandler(actionName) {
    // Try builtin path
    const builtinPath = path.join(this.builtinPath, `${actionName}.js`);
    if (fs.existsSync(builtinPath)) {
      try {
        const module = require(builtinPath);
        this.registerHandler(actionName, module.handler || module.default || module);
        return true;
      } catch (err) {
        console.error(`Failed to load builtin hook ${actionName}:`, err);
      }
    }

    return false;
  }

  /**
   * Load builtin hooks
   * @private
   */
  _loadBuiltinHooks() {
    if (!fs.existsSync(this.builtinPath)) {
      return;
    }

    const files = fs.readdirSync(this.builtinPath);
    for (const file of files) {
      if (!file.endsWith('.js')) continue;

      try {
        const modulePath = path.join(this.builtinPath, file);
        const module = require(modulePath);

        // Auto-register if module exports hook definition
        if (module.hookDefinition) {
          this.register(module.hookDefinition);
        }

        // Auto-register handler
        if (module.handler) {
          const actionName = path.basename(file, '.js');
          this.registerHandler(actionName, module.handler);
        }
      } catch (err) {
        console.error(`Failed to load builtin ${file}:`, err);
      }
    }
  }

  /**
   * Load hooks from YAML configuration
   * @param {string} yamlPath Path to YAML file
   */
  loadFromYaml(yamlPath) {
    if (!fs.existsSync(yamlPath)) {
      throw new Error(`Hook config not found: ${yamlPath}`);
    }

    const content = fs.readFileSync(yamlPath, 'utf-8');
    const config = yaml.load(content);

    if (!config.hooks) return;

    for (const [type, hookList] of Object.entries(config.hooks)) {
      for (const hookConfig of hookList) {
        this.register(createHookDefinition({
          id: hookConfig.id || `${type}-${hookConfig.action}`,
          type,
          match: hookConfig.match,
          action: hookConfig.action,
          mode: hookConfig.mode,
          priority: hookConfig.priority,
          description: hookConfig.description,
          enabled: hookConfig.enabled !== false
        }));
      }
    }
  }

  /**
   * Load hooks from agent/workflow YAML
   * @param {Object} yamlContent Parsed YAML content
   */
  loadFromAgentConfig(yamlContent) {
    const hooks = yamlContent?.bmad?.hooks || yamlContent?.hooks;
    if (!hooks) return;

    for (const [type, hookList] of Object.entries(hooks)) {
      if (!Array.isArray(hookList)) continue;

      for (const hookConfig of hookList) {
        this.register(createHookDefinition({
          id: `${yamlContent.agent?.metadata?.id || 'anon'}-${hookConfig.action}`,
          type,
          match: hookConfig.match,
          action: hookConfig.action,
          mode: hookConfig.mode || HookMode.SYNC,
          priority: hookConfig.priority || HookPriority.NORMAL,
          enabled: hookConfig.enabled !== false
        }));
      }
    }
  }

  /**
   * Add an event listener
   * @param {string} type Hook type
   * @param {Function} callback Callback function
   */
  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(callback);
  }

  /**
   * Remove an event listener
   * @param {string} type Hook type
   * @param {Function} callback Callback function
   */
  off(type, callback) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   * @private
   */
  _emit(type, data) {
    const listeners = this.listeners.get(type) || [];
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (err) {
        console.error(`Listener error for ${type}:`, err);
      }
    }
  }

  /**
   * Get all registered hooks
   * @returns {Object} Map of type -> hooks
   */
  getAll() {
    const result = {};
    for (const [type, hooks] of this.hooks) {
      result[type] = hooks.map(h => ({
        id: h.id,
        action: h.action,
        match: h.match?.toString(),
        enabled: h.enabled,
        priority: h.priority
      }));
    }
    return result;
  }

  /**
   * Enable/disable the entire hook system
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Enable/disable a specific hook
   * @param {string} hookId Hook ID
   * @param {boolean} enabled
   */
  setHookEnabled(hookId, enabled) {
    for (const [, hooks] of this.hooks) {
      const hook = hooks.find(h => h.id === hookId);
      if (hook) {
        hook.enabled = enabled;
        return true;
      }
    }
    return false;
  }

  /**
   * Clear all hooks
   */
  clear() {
    this.hooks.clear();
    this.handlers.clear();
    this.listeners.clear();
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create the global hook registry
 * @param {Object} options Options for new instance
 * @returns {HookRegistry}
 */
function getHookRegistry(options = {}) {
  if (!instance) {
    instance = new HookRegistry(options);
  }
  return instance;
}

/**
 * Reset the global hook registry (for testing)
 */
function resetHookRegistry() {
  if (instance) {
    instance.clear();
  }
  instance = null;
}

module.exports = {
  HookRegistry,
  getHookRegistry,
  resetHookRegistry
};
