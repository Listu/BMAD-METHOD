/**
 * BMAD Orchestrator - Memory Client
 *
 * Low-level client for ChromaDB memory storage.
 * Handles connection, collections, and CRUD operations.
 */

const crypto = require('crypto');

// Memory entry types
const MEMORY_TYPES = ['errors', 'decisions', 'lessons', 'patterns'];

// Entry status values
const STATUS = {
  VALID: 'valid',
  DEPRECATED: 'deprecated',
  CORRECTED: 'corrected'
};

/**
 * ChromaDB Memory Client
 * Provides low-level access to the vector database
 */
class MemoryClient {
  constructor(projectId, options = {}) {
    this.projectId = projectId;
    this.host = options.host || 'http://localhost';
    this.port = options.port || 8000;
    this.baseUrl = `${this.host}:${this.port}`;
    this.connected = false;
    this.collections = {};
  }

  /**
   * Check if ChromaDB is available
   */
  async checkConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/heartbeat`);
      this.connected = response.ok;
      return this.connected;
    } catch {
      this.connected = false;
      return false;
    }
  }

  /**
   * Get or create a collection for a memory type
   */
  async getCollection(type) {
    if (!MEMORY_TYPES.includes(type)) {
      throw new Error(`Invalid memory type: ${type}. Must be one of: ${MEMORY_TYPES.join(', ')}`);
    }

    const collectionName = `project-${this.projectId}-${type}`;

    if (this.collections[type]) {
      return this.collections[type];
    }

    // Try to get existing collection
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/collections/${collectionName}`);
      if (response.ok) {
        this.collections[type] = { name: collectionName, type };
        return this.collections[type];
      }
    } catch {
      // Collection doesn't exist
    }

    // Create new collection
    const createResponse = await fetch(`${this.baseUrl}/api/v1/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: collectionName,
        metadata: {
          project_id: this.projectId,
          type: type,
          created_at: new Date().toISOString()
        }
      })
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create collection: ${await createResponse.text()}`);
    }

    this.collections[type] = { name: collectionName, type };
    return this.collections[type];
  }

  /**
   * Add a memory entry
   */
  async addEntry(type, content, metadata = {}) {
    const collection = await this.getCollection(type);
    const id = crypto.randomUUID();

    const entryMetadata = {
      project_id: this.projectId,
      type,
      status: STATUS.VALID,
      created_at: new Date().toISOString(),
      created_by: metadata.created_by || 'ai',
      context: metadata.context || '',
      resolution: metadata.resolution || '',
      tags: JSON.stringify(metadata.tags || []),
      ...metadata
    };

    // Remove complex objects from metadata (ChromaDB only supports primitives)
    delete entryMetadata.tags_array;

    const response = await fetch(`${this.baseUrl}/api/v1/collections/${collection.name}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: [id],
        documents: [content],
        metadatas: [entryMetadata]
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to add entry: ${await response.text()}`);
    }

    return { id, content, metadata: entryMetadata };
  }

  /**
   * Search for relevant memories using semantic search
   */
  async search(query, options = {}) {
    const {
      type = null,
      limit = 5,
      includeDeprecated = false
    } = options;

    const types = type ? [type] : MEMORY_TYPES;
    const allResults = [];

    for (const t of types) {
      try {
        const collection = await this.getCollection(t);

        const whereClause = includeDeprecated
          ? {}
          : { status: { $ne: STATUS.DEPRECATED } };

        const response = await fetch(`${this.baseUrl}/api/v1/collections/${collection.name}/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query_texts: [query],
            n_results: limit,
            where: Object.keys(whereClause).length > 0 ? whereClause : undefined
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.documents && data.documents[0]) {
            const results = data.documents[0].map((doc, i) => ({
              content: doc,
              metadata: data.metadatas?.[0]?.[i] || {},
              id: data.ids?.[0]?.[i],
              distance: data.distances?.[0]?.[i],
              type: t
            }));
            allResults.push(...results);
          }
        }
      } catch (error) {
        console.warn(`Search failed for type ${t}:`, error.message);
      }
    }

    // Sort by relevance (lower distance = more relevant)
    allResults.sort((a, b) => (a.distance || 0) - (b.distance || 0));

    return allResults.slice(0, limit);
  }

  /**
   * Get all entries of a specific type
   */
  async getAllEntries(type, options = {}) {
    const { includeDeprecated = false, limit = 100 } = options;
    const collection = await this.getCollection(type);

    const whereClause = includeDeprecated
      ? {}
      : { status: { $ne: STATUS.DEPRECATED } };

    const response = await fetch(`${this.baseUrl}/api/v1/collections/${collection.name}/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
        limit
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get entries: ${await response.text()}`);
    }

    const data = await response.json();
    return (data.ids || []).map((id, i) => ({
      id,
      content: data.documents?.[i],
      metadata: data.metadatas?.[i] || {}
    }));
  }

  /**
   * Get a specific entry by ID
   */
  async getEntry(type, entryId) {
    const collection = await this.getCollection(type);

    const response = await fetch(`${this.baseUrl}/api/v1/collections/${collection.name}/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: [entryId]
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data.ids || data.ids.length === 0) {
      return null;
    }

    return {
      id: data.ids[0],
      content: data.documents?.[0],
      metadata: data.metadatas?.[0] || {}
    };
  }

  /**
   * Update entry metadata
   */
  async updateMetadata(type, entryId, updates) {
    const collection = await this.getCollection(type);

    const response = await fetch(`${this.baseUrl}/api/v1/collections/${collection.name}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: [entryId],
        metadatas: [updates]
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to update metadata: ${await response.text()}`);
    }

    return true;
  }

  /**
   * Correct an entry (never delete - create new and link)
   */
  async correctEntry(type, entryId, newContent, reason) {
    // 1. Get original entry
    const original = await this.getEntry(type, entryId);
    if (!original) {
      throw new Error(`Entry not found: ${entryId}`);
    }

    // 2. Mark original as corrected
    await this.updateMetadata(type, entryId, {
      status: STATUS.CORRECTED,
      corrected_at: new Date().toISOString()
    });

    // 3. Create new corrected entry
    const newEntry = await this.addEntry(type, newContent, {
      ...original.metadata,
      corrects: entryId,
      correction_reason: reason,
      created_by: 'user',
      status: STATUS.VALID
    });

    // 4. Link original to new
    await this.updateMetadata(type, entryId, {
      corrected_by: newEntry.id
    });

    return newEntry;
  }

  /**
   * Deprecate an entry (soft delete)
   */
  async deprecateEntry(type, entryId, reason) {
    await this.updateMetadata(type, entryId, {
      status: STATUS.DEPRECATED,
      deprecated_at: new Date().toISOString(),
      deprecation_reason: reason
    });
    return true;
  }

  /**
   * Get correction history for an entry
   */
  async getCorrectionHistory(type, entryId) {
    const history = [];
    let currentId = entryId;

    while (currentId) {
      const entry = await this.getEntry(type, currentId);
      if (!entry) break;

      history.push(entry);

      // Follow the correction chain
      currentId = entry.metadata?.corrected_by;
    }

    return history;
  }

  /**
   * Count entries by type
   */
  async countEntries(type) {
    const collection = await this.getCollection(type);

    const response = await fetch(`${this.baseUrl}/api/v1/collections/${collection.name}/count`, {
      method: 'GET'
    });

    if (!response.ok) {
      return 0;
    }

    return await response.json();
  }
}

/**
 * Fallback memory client when ChromaDB is not available
 * Uses in-memory storage (lost on restart)
 */
class FallbackMemoryClient {
  constructor(projectId) {
    this.projectId = projectId;
    this.storage = {};
    this.connected = false;

    for (const type of MEMORY_TYPES) {
      this.storage[type] = [];
    }
  }

  async checkConnection() {
    return false; // Always offline
  }

  async addEntry(type, content, metadata = {}) {
    const id = crypto.randomUUID();
    const entry = {
      id,
      content,
      metadata: {
        ...metadata,
        project_id: this.projectId,
        type,
        status: STATUS.VALID,
        created_at: new Date().toISOString()
      }
    };
    this.storage[type].push(entry);
    return entry;
  }

  async search(query, options = {}) {
    const { type = null, limit = 5 } = options;
    const types = type ? [type] : MEMORY_TYPES;

    const results = [];
    const queryLower = query.toLowerCase();

    for (const t of types) {
      for (const entry of this.storage[t]) {
        if (entry.metadata.status === STATUS.DEPRECATED) continue;

        // Simple substring search (no semantic)
        if (entry.content.toLowerCase().includes(queryLower)) {
          results.push({ ...entry, type: t });
        }
      }
    }

    return results.slice(0, limit);
  }

  async getAllEntries(type) {
    return this.storage[type].filter(e => e.metadata.status !== STATUS.DEPRECATED);
  }

  async getEntry(type, entryId) {
    return this.storage[type].find(e => e.id === entryId) || null;
  }

  async updateMetadata(type, entryId, updates) {
    const entry = this.storage[type].find(e => e.id === entryId);
    if (entry) {
      entry.metadata = { ...entry.metadata, ...updates };
      return true;
    }
    return false;
  }

  async correctEntry(type, entryId, newContent, reason) {
    await this.updateMetadata(type, entryId, { status: STATUS.CORRECTED });
    return this.addEntry(type, newContent, {
      corrects: entryId,
      correction_reason: reason,
      created_by: 'user'
    });
  }

  async deprecateEntry(type, entryId, reason) {
    return this.updateMetadata(type, entryId, {
      status: STATUS.DEPRECATED,
      deprecation_reason: reason
    });
  }

  async countEntries(type) {
    return this.storage[type].filter(e => e.metadata.status !== STATUS.DEPRECATED).length;
  }
}

/**
 * Create a memory client with automatic fallback
 */
async function createMemoryClient(projectId, options = {}) {
  const client = new MemoryClient(projectId, options);
  const isConnected = await client.checkConnection();

  if (isConnected) {
    console.log(`Memory: Connected to ChromaDB for project ${projectId}`);
    return client;
  }

  console.warn(`Memory: ChromaDB not available, using fallback (in-memory)`);
  return new FallbackMemoryClient(projectId);
}

module.exports = {
  MemoryClient,
  FallbackMemoryClient,
  createMemoryClient,
  MEMORY_TYPES,
  STATUS
};
