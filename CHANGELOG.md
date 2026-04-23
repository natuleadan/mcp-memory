# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.2](https://github.com/natuleadan/mcp-memory/compare/v2.2.1...v2.2.2) (2026-04-23)

### 🐛 Bug Fixes

* **indexing:** reorganize helpers into functions and cli entry points ([60f0ae4](https://github.com/natuleadan/mcp-memory/commit/60f0ae46acb2295701be89c0e39f421a37d4c4fb))

### ♻️ Refactoring

* **indexing:** reorganize indexers to helpers and improve visual output ([906dcef](https://github.com/natuleadan/mcp-memory/commit/906dcef126e43e3857392d732fc2834a4a316d0e))

## [2.2.1](https://github.com/natuleadan/mcp-memory/compare/v2.2.0...v2.2.1) (2026-04-21)

### 🐛 Bug Fixes

* **data_sync:** bidirectional sync with LanceDB API fix and new flags ([fed9c00](https://github.com/natuleadan/mcp-memory/commit/fed9c00ed1f8b8a415d47951f69add330093b3e2))

### 🔧 Chore

* **release:** bump version to 2.2.0 ([212fd4f](https://github.com/natuleadan/mcp-memory/commit/212fd4f5247696673f52b8cc78ed86d1c0120f46))

## [2.2.0](https://github.com/natuleadan/mcp-memory/compare/v2.1.0...v2.2.0) (2026-04-21)

### ✨ Features

* **functions:** add business logic layer for CRUD, search, and admin ([8766898](https://github.com/natuleadan/mcp-memory/commit/8766898b196115dbb043a993d32ba91c4699b94b))
* **tools:** add 14 unified data_* MCP tools ([149ed38](https://github.com/natuleadan/mcp-memory/commit/149ed38854263c2155d401f7a60fcf0f272ebfc5))
* **types:** add TypeScript schemas for memories, search, and data sources ([ef49e4b](https://github.com/natuleadan/mcp-memory/commit/ef49e4b614bf3ce7babb783e145546d7498a375c))

### 🐛 Bug Fixes

* **config:** remove duplicate commitlint.config.mjs ([600e9b2](https://github.com/natuleadan/mcp-memory/commit/600e9b2328b7e7f74702d93ebe3b94ec79ac7630))

### 📖 Documentation

* update CHANGELOG and README with new architecture overview ([3ae2a82](https://github.com/natuleadan/mcp-memory/commit/3ae2a82223d4fd06f795b3939e2146f190388431))

### ♻️ Refactoring

* **indexer:** consolidate into unified indexer supporting code, docs, chatlogs ([29aba7d](https://github.com/natuleadan/mcp-memory/commit/29aba7d8a77bd0342a1d89686aadc9cba44212bc))
* **tools:** remove 28 legacy MCP tools in favor of unified data_* API ([fd806f4](https://github.com/natuleadan/mcp-memory/commit/fd806f4836bc456463246cf83bf3e4b5933b4f85))

## [2.1.1](https://github.com/natuleadan/mcp-memory/compare/v2.1.0...v2.1.1) (2026-03-29)

### 🐛 Bug Fixes

* **config:** remove duplicate commitlint.config.mjs ([600e9b2](https://github.com/natuleadan/mcp-memory/commit/600e9b2328b7e7f74702d93ebe3b94ec79ac7630))

## [2.1.0](https://github.com/natuleadan/mcp-memory/compare/v2.0.0...v2.1.0) (2026-03-29)

### ✨ Features

* **obsidian:** add vault sync, auto-export on startup, crud tools and bi-directional sync ([66ce41e](https://github.com/natuleadan/mcp-memory/commit/66ce41e5e896bbf5fecc888b9d789355f5872e12))

### ♻️ Refactoring

* **config:** rename fullstack_dir to coding_dir and update env example with obsidian vars ([142468d](https://github.com/natuleadan/mcp-memory/commit/142468dbfcdfb48d4f19c3d72d4b53e986f2b99f))
* **scripts:** move setup.ts from scripts/ to src/ ([0eaf223](https://github.com/natuleadan/mcp-memory/commit/0eaf2230f23677df1097665652c240b61079dc04))

## [2.0.0](https://github.com/natuleadan/mcp-memory/compare/v1.3.0...v2.0.0) (2026-03-29)

### 🔥 Upgrade

* **deps:** update @modelcontextprotocol/sdk to 1.28.0 ([ae15dae](https://github.com/natuleadan/mcp-memory/commit/ae15dae8ff195b8a9adcb1b1d08cfa660c6b3c54))

## [1.3.0](https://github.com/natuleadan/mcp-memory/compare/v1.2.2...v1.3.0) (2026-03-28)

### ✨ Features

* **memory:** add load_session_context optimized context loader ([ed969e6](https://github.com/natuleadan/mcp-memory/commit/ed969e696edaaa979062a7656434283acd77bd5f))
* **memory:** optimize load_context default to minimal mode ([1f319d7](https://github.com/natuleadan/mcp-memory/commit/1f319d7856130bbf98f284304ee06f5c27fc6e9d))

### 📖 Documentation

* **memory:** update tools count and session start guidance ([f691667](https://github.com/natuleadan/mcp-memory/commit/f6916673d928dde5db2306feb7f23bf98b34f08a))

### 🔧 Chore

* **memory:** register load_session_context tool ([9990719](https://github.com/natuleadan/mcp-memory/commit/99907191cf7bb633f8f0a168994b5171c4c532a2))

## [1.2.2](https://github.com/natuleadan/mcp-memory/compare/v1.2.1...v1.2.2) (2026-03-26)

### 🐛 Bug Fixes

* **security:** upgrade picomatch to 4.0.4+ to fix cwe-1321 vulnerability ([63511b9](https://github.com/natuleadan/mcp-memory/commit/63511b900a17479668a7ca02705e1ee06aade2c8))

### 🔧 Chore

* **husky:** add git hooks for commitlint validation ([5b4a891](https://github.com/natuleadan/mcp-memory/commit/5b4a891cf5cb716bd6f81809cba061e1bef7aa9e))
* **husky:** standardize commit-msg hook format with fullstack ([8a54a5d](https://github.com/natuleadan/mcp-memory/commit/8a54a5dafe139d21b20381698738b7188c09f054))

## [1.2.1](https://github.com/natuleadan/mcp-memory/compare/v1.2.0...v1.2.1) (2026-03-26)

### 🐛 Bug Fixes

* **indexer:** add chatlogs table indexing to embedder ([065f9eb](https://github.com/natuleadan/mcp-memory/commit/065f9ebd31e70df2f456fa1a28973f2e5d6c9012))

## [1.2.0](https://github.com/natuleadan/mcp-memory/compare/v1.1.0...v1.2.0) (2026-03-26)

### ✨ Features

* **memory:** add load_context modes and version tracking ([2c470fd](https://github.com/natuleadan/mcp-memory/commit/2c470fd7b2dae8ae926dcd190a42d8e4afc9d892))
* **search:** add global unified search across all 4 memory layers ([b494c13](https://github.com/natuleadan/mcp-memory/commit/b494c13bd5bc80db3c788eefcc4f3d78512087cc))
* **tools:** add 10 optimization tools for context and performance ([0f550b1](https://github.com/natuleadan/mcp-memory/commit/0f550b1095630298c90739d13d72cc276e549e4b))

### 🐛 Bug Fixes

* **tools:** apply z.coerce for all numeric params across all tools ([87d19b5](https://github.com/natuleadan/mcp-memory/commit/87d19b5aaf752c06056075816999122cc6024652))

### ♻️ Refactoring

* **tools:** separate MCP tools into individual files ([7f4ef9e](https://github.com/natuleadan/mcp-memory/commit/7f4ef9e151fa9125f9772d9984340eb982fc2362))

### 🔧 Chore

* **config:** update gitignore, remove *.env, add .ds_store ([4f95a7b](https://github.com/natuleadan/mcp-memory/commit/4f95a7b2e4c14f5a32374d407a774a20c0772ea7))
* **i18n:** translate all comments and messages to english ([b893dae](https://github.com/natuleadan/mcp-memory/commit/b893dae3ac60a2670d5b8c91fe20af81c591fdd0))
* **lint:** add eslint, prettier, and tsconfig with lint+format scripts ([9fb4d48](https://github.com/natuleadan/mcp-memory/commit/9fb4d48336f14b79db4267a44ca146819a385cdb))
* **mcp-memory:** add conventional commits and semantic release configuration ([647f7b8](https://github.com/natuleadan/mcp-memory/commit/647f7b89fc66b124977ebfb8c830588e99a08520))

## [1.1.0](https://github.com/natuleadan/mcp-memory/compare/v1.0.0...v1.1.0) (2026-03-26)

### ✨ Features

* **setup:** add cross-platform bootstrap script ([3389303](https://github.com/natuleadan/mcp-memory/commit/3389303b869fc67df59ffa376adfdd6237c47a3d))

## 1.0.0 (2026-03-22)

### ✨ Features

* **mcp-memory:** initial release v1.0.0 — mcp server with semantic search, crud and vector memory ([1320677](https://github.com/natuleadan/mcp-memory/commit/1320677747461e7daa3ec7f71c421cafb702b9d8))

### 📖 Documentation

* **license:** add mit license ([ffe4ec6](https://github.com/natuleadan/mcp-memory/commit/ffe4ec6a857c54b93a07e51d87eb93ca0e343877))
