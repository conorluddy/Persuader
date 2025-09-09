/**
 * Session Management Module
 *
 * Exports session manager implementation and related utilities.
 */

export type {
  Session,
  SessionConfig,
  SessionFilter,
  SessionManager as SessionManagerInterface,
  SessionMetadata,
} from '../types/session.js';
export {
  createSessionManager,
  defaultSessionManager,
  SessionManager,
} from './manager.js';
export {
  createProviderSessionManager,
  ProviderSessionManager,
  SessionUtils,
} from './provider-session.js';
