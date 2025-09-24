/**
 * Tests for Category Manager Module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CategoryManager,
  LogCategory,
  CategoryPresets,
  getGlobalCategoryManager,
  setGlobalCategoryManager,
  shouldLogCategory,
  enableCategories,
  disableCategories,
  setCategoryPreset,
} from './category-manager.js';

describe('CategoryManager', () => {
  describe('Basic operations', () => {
    let manager: CategoryManager;
    
    beforeEach(() => {
      manager = new CategoryManager(LogCategory.NONE);
    });
    
    it('should check if category is enabled', () => {
      manager.enable(LogCategory.ERROR);
      expect(manager.isEnabled(LogCategory.ERROR)).toBe(true);
      expect(manager.isEnabled(LogCategory.WARN)).toBe(false);
    });
    
    it('should enable multiple categories', () => {
      manager.enable(LogCategory.ERROR, LogCategory.WARN, LogCategory.INFO);
      expect(manager.isEnabled(LogCategory.ERROR)).toBe(true);
      expect(manager.isEnabled(LogCategory.WARN)).toBe(true);
      expect(manager.isEnabled(LogCategory.INFO)).toBe(true);
      expect(manager.isEnabled(LogCategory.DEBUG)).toBe(false);
    });
    
    it('should disable categories', () => {
      manager.enable(LogCategory.ERROR, LogCategory.WARN);
      manager.disable(LogCategory.ERROR);
      expect(manager.isEnabled(LogCategory.ERROR)).toBe(false);
      expect(manager.isEnabled(LogCategory.WARN)).toBe(true);
    });
    
    it('should toggle categories', () => {
      manager.enable(LogCategory.ERROR);
      manager.toggle(LogCategory.ERROR, LogCategory.WARN);
      expect(manager.isEnabled(LogCategory.ERROR)).toBe(false);
      expect(manager.isEnabled(LogCategory.WARN)).toBe(true);
    });
    
    it('should check if any category is enabled', () => {
      manager.enable(LogCategory.ERROR);
      expect(manager.isAnyEnabled(LogCategory.ERROR, LogCategory.WARN)).toBe(true);
      expect(manager.isAnyEnabled(LogCategory.WARN, LogCategory.INFO)).toBe(false);
    });
    
    it('should check if all categories are enabled', () => {
      manager.enable(LogCategory.ERROR, LogCategory.WARN);
      expect(manager.areAllEnabled(LogCategory.ERROR, LogCategory.WARN)).toBe(true);
      expect(manager.areAllEnabled(LogCategory.ERROR, LogCategory.WARN, LogCategory.INFO)).toBe(false);
    });
  });
  
  describe('Category presets', () => {
    it('should set categories using presets', () => {
      const manager = new CategoryManager(CategoryPresets.LEVEL_INFO);
      expect(manager.isEnabled(LogCategory.ERROR)).toBe(true);
      expect(manager.isEnabled(LogCategory.WARN)).toBe(true);
      expect(manager.isEnabled(LogCategory.INFO)).toBe(true);
      expect(manager.isEnabled(LogCategory.DEBUG)).toBe(false);
    });
    
    it('should use LLM_ALL preset', () => {
      const manager = new CategoryManager(CategoryPresets.LLM_ALL);
      expect(manager.isEnabled(LogCategory.LLM_REQUEST)).toBe(true);
      expect(manager.isEnabled(LogCategory.LLM_RESPONSE)).toBe(true);
      expect(manager.isEnabled(LogCategory.LLM_ERROR)).toBe(true);
      expect(manager.isEnabled(LogCategory.LLM_TOKEN)).toBe(true);
      expect(manager.isEnabled(LogCategory.ERROR)).toBe(false);
    });
    
    it('should use DEV_FULL preset to enable all', () => {
      const manager = new CategoryManager(CategoryPresets.DEV_FULL);
      expect(manager.isEnabled(LogCategory.ERROR)).toBe(true);
      expect(manager.isEnabled(LogCategory.LLM_REQUEST)).toBe(true);
      expect(manager.isEnabled(LogCategory.VALIDATION_FAILURE)).toBe(true);
      expect(manager.isEnabled(LogCategory.PERF_TIMING)).toBe(true);
      expect(manager.isEnabled(LogCategory.SESSION_CREATE)).toBe(true);
    });
  });
  
  describe('Context overrides', () => {
    let manager: CategoryManager;
    
    beforeEach(() => {
      manager = new CategoryManager(LogCategory.ERROR);
    });
    
    it('should set context override', () => {
      manager.setOverride('validation', CategoryPresets.VALIDATION_ALL);
      expect(manager.isEnabledInContext(LogCategory.VALIDATION_FAILURE, 'validation')).toBe(true);
      expect(manager.isEnabledInContext(LogCategory.VALIDATION_FAILURE)).toBe(false);
    });
    
    it('should clear context override', () => {
      manager.setOverride('validation', CategoryPresets.VALIDATION_ALL);
      manager.clearOverride('validation');
      expect(manager.isEnabledInContext(LogCategory.VALIDATION_FAILURE, 'validation')).toBe(false);
    });
    
    it('should get effective categories for context', () => {
      manager.setOverride('llm', CategoryPresets.LLM_ALL);
      const effective = manager.getEffectiveCategories('llm');
      expect(effective).toBe(CategoryPresets.LLM_ALL);
      expect(manager.getEffectiveCategories()).toBe(LogCategory.ERROR);
    });
  });
  
  describe('String operations', () => {
    it('should convert to string', () => {
      const manager = new CategoryManager(LogCategory.ERROR | LogCategory.WARN);
      const str = manager.toString();
      expect(str).toContain('ERROR');
      expect(str).toContain('WARN');
    });
    
    it('should parse category string', () => {
      const categories = CategoryManager.parse('ERROR,WARN,LLM_REQUEST');
      const manager = new CategoryManager(categories);
      expect(manager.isEnabled(LogCategory.ERROR)).toBe(true);
      expect(manager.isEnabled(LogCategory.WARN)).toBe(true);
      expect(manager.isEnabled(LogCategory.LLM_REQUEST)).toBe(true);
      expect(manager.isEnabled(LogCategory.INFO)).toBe(false);
    });
    
    it('should parse preset names', () => {
      const categories = CategoryManager.parse('LEVEL_INFO');
      const manager = new CategoryManager(categories);
      expect(manager.isEnabled(LogCategory.ERROR)).toBe(true);
      expect(manager.isEnabled(LogCategory.WARN)).toBe(true);
      expect(manager.isEnabled(LogCategory.INFO)).toBe(true);
      expect(manager.isEnabled(LogCategory.DEBUG)).toBe(false);
    });
  });
  
  describe('Summary', () => {
    it('should generate summary', () => {
      const manager = new CategoryManager(LogCategory.ERROR | LogCategory.WARN);
      manager.setOverride('test', LogCategory.DEBUG);
      
      const summary = manager.getSummary();
      expect(summary.enabledCategories).toContain('ERROR');
      expect(summary.enabledCategories).toContain('WARN');
      expect(summary.disabledCategories).toContain('INFO');
      expect(summary.overrides.has('test')).toBe(true);
      expect(summary.overrides.get('test')).toContain('DEBUG');
    });
  });
  
  describe('Global functions', () => {
    beforeEach(() => {
      setGlobalCategoryManager(new CategoryManager(LogCategory.ERROR));
    });
    
    it('should check category globally', () => {
      expect(shouldLogCategory(LogCategory.ERROR)).toBe(true);
      expect(shouldLogCategory(LogCategory.WARN)).toBe(false);
    });
    
    it('should enable categories globally', () => {
      enableCategories(LogCategory.WARN, LogCategory.INFO);
      expect(shouldLogCategory(LogCategory.WARN)).toBe(true);
      expect(shouldLogCategory(LogCategory.INFO)).toBe(true);
    });
    
    it('should disable categories globally', () => {
      enableCategories(LogCategory.WARN);
      disableCategories(LogCategory.ERROR);
      expect(shouldLogCategory(LogCategory.ERROR)).toBe(false);
      expect(shouldLogCategory(LogCategory.WARN)).toBe(true);
    });
    
    it('should set preset globally', () => {
      setCategoryPreset('LEVEL_DEBUG');
      const manager = getGlobalCategoryManager();
      expect(manager.isEnabled(LogCategory.ERROR)).toBe(true);
      expect(manager.isEnabled(LogCategory.WARN)).toBe(true);
      expect(manager.isEnabled(LogCategory.INFO)).toBe(true);
      expect(manager.isEnabled(LogCategory.DEBUG)).toBe(true);
    });
  });
  
  describe('Bit flag optimization', () => {
    it('should use efficient bit operations', () => {
      const manager = new CategoryManager(0);
      
      // Test that categories are powers of 2
      expect(LogCategory.ERROR).toBe(1);
      expect(LogCategory.WARN).toBe(2);
      expect(LogCategory.INFO).toBe(4);
      expect(LogCategory.DEBUG).toBe(8);
      
      // Test bitwise operations work correctly
      manager.setCategories(LogCategory.ERROR | LogCategory.INFO);
      expect(manager.getCategories()).toBe(5); // 1 + 4
      
      manager.enable(LogCategory.WARN);
      expect(manager.getCategories()).toBe(7); // 1 + 2 + 4
      
      manager.disable(LogCategory.ERROR);
      expect(manager.getCategories()).toBe(6); // 2 + 4
    });
    
    it('should handle high bit categories', () => {
      const manager = new CategoryManager(LogCategory.SESSION_METRICS);
      expect(manager.isEnabled(LogCategory.SESSION_METRICS)).toBe(true);
      expect(manager.getCategories()).toBe(1073741824); // 2^30
    });
  });
});