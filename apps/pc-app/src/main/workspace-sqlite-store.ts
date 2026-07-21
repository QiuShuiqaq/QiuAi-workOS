import { createRequire } from 'node:module';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

import type { DesktopRuntimeState } from '../shared/desktop-api.js';
import { ensureDesktopStorageLayout, type DesktopStorageLayout } from './storage-layout.js';

type JsonRecord = Record<string, unknown>;

interface SqlJsStatement {
  bind(values?: unknown[] | JsonRecord): void;
  step(): boolean;
  getAsObject(): JsonRecord;
  free(): void;
}

interface SqlJsDatabase {
  exec(sql: string): unknown;
  prepare(sql: string): SqlJsStatement;
  export(): Uint8Array;
  close(): void;
}

interface SqlJsModule {
  Database: new (data?: Uint8Array) => SqlJsDatabase;
}

interface WorkspaceSnapshotBundle {
  profile?: JsonRecord;
  catalog?: JsonRecord;
  runtime?: JsonRecord;
}

export interface WorkspaceToolRegistryEntry {
  toolId: string;
  manifest: JsonRecord;
  enabled: boolean;
  lastUsedAt?: string;
  updatedAt: string;
}

const require = createRequire(import.meta.url);
const sqlJsWasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
const schemaVersion = '1';

let sqlJsModulePromise: Promise<SqlJsModule> | undefined;

const schemaStatements = [
  'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS workspace_profile (workspace_id TEXT PRIMARY KEY, profile_json TEXT NOT NULL, saved_at TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS workspace_catalog (workspace_id TEXT PRIMARY KEY, catalog_json TEXT NOT NULL, saved_at TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS workspace_runtime (workspace_id TEXT PRIMARY KEY, runtime_json TEXT NOT NULL, saved_at TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS tool_registry (workspace_id TEXT NOT NULL, tool_id TEXT NOT NULL, tool_json TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, last_used_at TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (workspace_id, tool_id))',
  'INSERT OR IGNORE INTO meta (key, value) VALUES (\'schema_version\', \'1\')'
];

export function getWorkspaceDatabasePath(layout: DesktopStorageLayout): string {
  return layout.workspaceDatabasePath;
}

export async function readWorkspaceSnapshotBundle(
  layout: DesktopStorageLayout,
  workspaceId: string
): Promise<WorkspaceSnapshotBundle | undefined> {
  const { db } = await openWorkspaceDatabase(layout);
  try {
    const metaVersion = readMetaVersion(db);
    if (metaVersion !== undefined && metaVersion !== schemaVersion) {
      return undefined;
    }

    const profileRow = fetchSingleRow(
      db,
      'SELECT profile_json AS json FROM workspace_profile WHERE workspace_id = ?',
      [workspaceId]
    );
    const catalogRow = fetchSingleRow(
      db,
      'SELECT catalog_json AS json FROM workspace_catalog WHERE workspace_id = ?',
      [workspaceId]
    );
    const runtimeRow = fetchSingleRow(
      db,
      'SELECT runtime_json AS json FROM workspace_runtime WHERE workspace_id = ?',
      [workspaceId]
    );

    if (!profileRow || !catalogRow || !runtimeRow) {
      return undefined;
    }

    return {
      profile: parseJsonRecord(profileRow.json),
      catalog: parseJsonRecord(catalogRow.json),
      runtime: parseJsonRecord(runtimeRow.json)
    };
  } finally {
    db.close();
  }
}

export async function readWorkspaceToolRegistry(
  layout: DesktopStorageLayout,
  workspaceId: string
): Promise<WorkspaceToolRegistryEntry[]> {
  const { db } = await openWorkspaceDatabase(layout);
  try {
    const rows = fetchRows(
      db,
      `SELECT tool_id AS toolId,
              tool_json AS toolJson,
              enabled AS enabled,
              last_used_at AS lastUsedAt,
              updated_at AS updatedAt
         FROM tool_registry
        WHERE workspace_id = ?
        ORDER BY tool_id`,
      [workspaceId]
    );

    const entries: WorkspaceToolRegistryEntry[] = [];

    for (const row of rows) {
      const toolId = typeof row.toolId === 'string' ? row.toolId : '';
      const manifest = parseJsonRecord(row.toolJson);
      const updatedAt = typeof row.updatedAt === 'string' ? row.updatedAt : '';

      if (!toolId || !manifest || !updatedAt) {
        continue;
      }

      entries.push({
        toolId,
        manifest,
        enabled: row.enabled === 1,
        lastUsedAt: typeof row.lastUsedAt === 'string' ? row.lastUsedAt : undefined,
        updatedAt
      });
    }

    return entries;
  } finally {
    db.close();
  }
}

export async function writeWorkspaceSnapshotBundle(
  layout: DesktopStorageLayout,
  workspaceId: string,
  state: DesktopRuntimeState
): Promise<void> {
  const { db, filePath } = await openWorkspaceDatabase(layout);
  try {
    const savedAt = new Date().toISOString();
    const profile = {
      schemaVersion: 1,
      savedAt,
      app: state.app,
      localRuntime: state.localRuntime,
      serverConnection: state.serverConnection
    };
    const catalog = {
      schemaVersion: 1,
      savedAt,
      rolePackages: state.rolePackages,
      modelProfiles: state.modelProfiles,
      tools: state.tools
    };
    const runtime = {
      schemaVersion: 1,
      savedAt,
      runtimeSnapshot: state.runtimeSnapshot,
      knowledgeSources: state.knowledgeSources,
      taskDetails: state.taskDetails ?? []
    };

    db.exec('BEGIN');
    try {
      upsertJsonRecord(db, 'workspace_profile', 'profile_json', workspaceId, profile, savedAt);
      upsertJsonRecord(db, 'workspace_catalog', 'catalog_json', workspaceId, catalog, savedAt);
      upsertJsonRecord(db, 'workspace_runtime', 'runtime_json', workspaceId, runtime, savedAt);
      refreshToolRegistry(db, workspaceId, state, savedAt);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    persistDatabaseFile(db, filePath);
  } finally {
    db.close();
  }
}

async function openWorkspaceDatabase(layout: DesktopStorageLayout): Promise<{
  db: SqlJsDatabase;
  filePath: string;
}> {
  ensureDesktopStorageLayout(layout);

  const sqlJs = await loadSqlJs();
  const filePath = getWorkspaceDatabasePath(layout);
  const db = existsSync(filePath)
    ? new sqlJs.Database(readFileSync(filePath))
    : new sqlJs.Database();

  for (const statement of schemaStatements) {
    db.exec(statement);
  }

  return {
    db,
    filePath
  };
}

async function loadSqlJs(): Promise<SqlJsModule> {
  if (!sqlJsModulePromise) {
    sqlJsModulePromise = initSqlJs({
      locateFile: (file: string) => {
        if (file === 'sql-wasm.wasm') {
          return sqlJsWasmPath;
        }

        return path.join(path.dirname(sqlJsWasmPath), file);
      }
    }) as Promise<SqlJsModule>;
  }

  return sqlJsModulePromise;
}

function readMetaVersion(db: SqlJsDatabase): string | undefined {
  const row = fetchSingleRow(db, 'SELECT value AS value FROM meta WHERE key = ?', ['schema_version']);
  return typeof row?.value === 'string' ? row.value : undefined;
}

function upsertJsonRecord(
  db: SqlJsDatabase,
  tableName: 'workspace_profile' | 'workspace_catalog' | 'workspace_runtime',
  columnName: 'profile_json' | 'catalog_json' | 'runtime_json',
  workspaceId: string,
  payload: JsonRecord,
  savedAt: string
): void {
  const json = JSON.stringify(payload);
  const statement = db.prepare(
    `INSERT INTO ${tableName} (workspace_id, ${columnName}, saved_at) VALUES (?, ?, ?)
     ON CONFLICT(workspace_id) DO UPDATE SET ${columnName} = excluded.${columnName}, saved_at = excluded.saved_at`
  );

  try {
    statement.bind([workspaceId, json, savedAt]);
    statement.step();
  } finally {
    statement.free();
  }
}

function refreshToolRegistry(
  db: SqlJsDatabase,
  workspaceId: string,
  state: DesktopRuntimeState,
  updatedAt: string
): void {
  const clearStatement = db.prepare('DELETE FROM tool_registry WHERE workspace_id = ?');
  try {
    clearStatement.bind([workspaceId]);
    clearStatement.step();
  } finally {
    clearStatement.free();
  }

  const enabledToolIds = new Set(state.localRuntime.enabledToolIds);
  const toolSummaries = new Map(state.runtimeSnapshot.tools.map((tool) => [tool.toolId, tool]));

  for (const tool of state.tools) {
    const toolSummary = toolSummaries.get(tool.id);
    const statement = db.prepare(
      'INSERT INTO tool_registry (workspace_id, tool_id, tool_json, enabled, last_used_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );

    try {
      statement.bind([
        workspaceId,
        tool.id,
        JSON.stringify(tool),
        enabledToolIds.has(tool.id) ? 1 : 0,
        toolSummary?.lastUsedAt ?? null,
        updatedAt
      ]);
      statement.step();
    } finally {
      statement.free();
    }
  }
}

function fetchSingleRow(db: SqlJsDatabase, sql: string, params: unknown[]): JsonRecord | undefined {
  const statement = db.prepare(sql);
  try {
    statement.bind(params);
    if (!statement.step()) {
      return undefined;
    }

    return statement.getAsObject();
  } finally {
    statement.free();
  }
}

function fetchRows(db: SqlJsDatabase, sql: string, params: unknown[]): JsonRecord[] {
  const statement = db.prepare(sql);
  const rows: JsonRecord[] = [];

  try {
    statement.bind(params);
    while (statement.step()) {
      rows.push(statement.getAsObject());
    }

    return rows;
  } finally {
    statement.free();
  }
}

function parseJsonRecord(value: unknown): JsonRecord | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as JsonRecord;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
}

function persistDatabaseFile(db: SqlJsDatabase, filePath: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });

  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, Buffer.from(db.export()));

  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }

  renameSync(tempPath, filePath);
}
