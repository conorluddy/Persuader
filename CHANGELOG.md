# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - 2024-01-24

### Added
- Comprehensive logging system with category-based control
  - New `logs` CLI command with subcommands: view, search, clean, stats, perf, privacy-scan, config, tail
  - Category-based log filtering with presets (DEVELOPMENT, PRODUCTION, DEBUG, PERFORMANCE, MINIMAL)
  - Privacy filter module with regex DoS protection
  - Performance monitoring with metrics collection
  - JSONL rotation writer for structured logging
  - Session-scoped logger with context propagation
  - Migration bridge for legacy logger configurations

### Changed
- Split large logging modules into smaller, focused files following CODESTYLE.md guidelines
  - `logs.ts` split into `logs.ts`, `logs-commands.ts`, `logs-utils.ts`, `logs-types.ts`
  - All modules now under 300 lines per CODESTYLE.md requirements
- Improved TypeScript types throughout the codebase
  - Replaced all `any` types with proper TypeScript types
  - Added JsonValue types for JSON-compatible values
  - Fixed decorator types in performance monitor

### Fixed
- Regex DoS vulnerability in privacy filter
  - Added MAX_INPUT_LENGTH (100KB) limit
  - Added REGEX_TIMEOUT (100ms) protection
  - Added safe regex execution wrapper
- TypeScript compilation errors after refactoring
- Memory stats display in performance metrics

### Security
- Enhanced privacy protection with configurable levels (OFF, MINIMAL, STANDARD, STRICT, PARANOID)
- Safe regex execution to prevent DoS attacks
- Input sanitization and length limits on all regex operations

## [0.7.1] - Previous Release

_Previous changelog entries would go here..._