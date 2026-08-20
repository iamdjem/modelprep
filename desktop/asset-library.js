'use strict';

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const parseJson = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };

function createAssetLibrary(dbPath) {
  const db = new DatabaseSync(dbPath === ':memory:' ? dbPath : path.resolve(dbPath));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, name TEXT NOT NULL, tags_json TEXT NOT NULL DEFAULT '[]', metadata_json TEXT NOT NULL DEFAULT '{}', updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS asset_files (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE, name TEXT NOT NULL, source_path TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'model', extension TEXT NOT NULL DEFAULT '', content_hash TEXT, revision INTEGER NOT NULL DEFAULT 1, metadata_json TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS asset_relations (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE, from_id TEXT NOT NULL, to_id TEXT NOT NULL, relation_type TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS derived_previews (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE, asset_file_id TEXT NOT NULL, kind TEXT NOT NULL, plate INTEGER, cache_path TEXT, status TEXT NOT NULL DEFAULT 'pending', metadata_json TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS watched_folders (path TEXT PRIMARY KEY, added_at INTEGER NOT NULL, last_scan_at INTEGER);
    CREATE VIRTUAL TABLE IF NOT EXISTS asset_search USING fts5(asset_id UNINDEXED, name, tags, files, metadata);
  `);
  const sql = {
    asset: db.prepare('INSERT INTO assets(id,name,tags_json,metadata_json,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,tags_json=excluded.tags_json,metadata_json=excluded.metadata_json,updated_at=excluded.updated_at'),
    clearFiles: db.prepare('DELETE FROM asset_files WHERE asset_id=?'), clearRelations: db.prepare('DELETE FROM asset_relations WHERE asset_id=?'), clearPreviews: db.prepare('DELETE FROM derived_previews WHERE asset_id=?'), clearSearch: db.prepare('DELETE FROM asset_search WHERE asset_id=?'),
    file: db.prepare('INSERT OR REPLACE INTO asset_files(id,asset_id,name,source_path,role,extension,content_hash,revision,metadata_json) VALUES(?,?,?,?,?,?,?,?,?)'),
    relation: db.prepare('INSERT OR REPLACE INTO asset_relations(id,asset_id,from_id,to_id,relation_type) VALUES(?,?,?,?,?)'),
    preview: db.prepare('INSERT OR REPLACE INTO derived_previews(id,asset_id,asset_file_id,kind,plate,cache_path,status,metadata_json) VALUES(?,?,?,?,?,?,?,?)'),
    searchRow: db.prepare('INSERT INTO asset_search(asset_id,name,tags,files,metadata) VALUES(?,?,?,?,?)'),
    search: db.prepare('SELECT a.* FROM asset_search s JOIN assets a ON a.id=s.asset_id WHERE asset_search MATCH ? ORDER BY rank LIMIT ?'),
    list: db.prepare('SELECT * FROM assets ORDER BY updated_at DESC LIMIT ?'),
    folder: db.prepare('INSERT INTO watched_folders(path,added_at,last_scan_at) VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET last_scan_at=excluded.last_scan_at'),
    folders: db.prepare('SELECT * FROM watched_folders ORDER BY added_at DESC'),
  };
  const upsertAssets = (assets = []) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const asset of assets) {
        sql.asset.run(asset.id, asset.name, JSON.stringify(asset.tags || []), JSON.stringify(asset.metadata || {}), Date.now());
        sql.clearFiles.run(asset.id); sql.clearRelations.run(asset.id); sql.clearPreviews.run(asset.id); sql.clearSearch.run(asset.id);
        for (const file of asset.files || []) sql.file.run(file.id, asset.id, file.name, file.sourcePath || '', file.role || 'model', file.extension || '', file.contentHash || null, file.revision || 1, JSON.stringify(file.metadata || {}));
        for (const relation of asset.relations || []) sql.relation.run(relation.id, asset.id, relation.from, relation.to, relation.type);
        for (const preview of asset.previews || []) sql.preview.run(preview.id, asset.id, preview.assetFileId, preview.kind, preview.plate || null, preview.cachePath || null, preview.status || 'pending', JSON.stringify(preview.metadata || {}));
        sql.searchRow.run(asset.id, asset.name, (asset.tags || []).join(' '), (asset.files || []).map((file) => file.name).join(' '), JSON.stringify(asset.metadata || {}));
      }
      db.exec('COMMIT');
      return { ok: true, count: assets.length };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const hydrate = (row) => row ? { ...row, tags: parseJson(row.tags_json, []), metadata: parseJson(row.metadata_json, {}) } : row;
  return {
    upsertAssets,
    search(query = '', limit = 100) { const clean = String(query).trim().replace(/["']/g, ' '); return (clean ? sql.search.all(`${clean}*`, Math.max(1, Math.min(limit, 500))) : sql.list.all(Math.max(1, Math.min(limit, 500)))).map(hydrate); },
    addWatchedFolder(folderPath) { sql.folder.run(path.resolve(folderPath), Date.now(), Date.now()); return { ok: true }; },
    listWatchedFolders() { return sql.folders.all(); },
    close() { db.close(); },
  };
}

module.exports = { createAssetLibrary };
