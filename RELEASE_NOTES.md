# Release Notes

## Version 0.3.2 - Optional Prompt Truncation & Enhanced Debugging

*Released: September 17, 2025*

### 🎯 Overview

This release introduces optional prompt/response truncation with **full visibility by default**, significantly improving the debugging experience while maintaining backward compatibility. Developers no longer need debug mode to see complete LLM interactions.

### ✨ New Features

#### Optional Prompt/Response Truncation
- **Full visibility by default**: Complete prompts and responses are now shown without truncation
- **Optional truncation**: Add `truncate: true` to logger config when needed
- **Configurable limits**: Use `maxPromptLength` and `maxResponseLength` for custom truncation
- **Backward compatible**: Existing code gets improved visibility automatically

```typescript
// Development - full visibility (default)
const devLogger = createLogger({ level: 'debug' });

// Production - truncated for security
const prodLogger = createLogger({ 
  level: 'info', 
  truncate: true, 
  maxPromptLength: 500 
});
```

#### Enhanced Validation Error Messages
- **Show valid options**: Enum validation errors now display first 10 valid options
- **Smart truncation**: Large option lists show `"option1, option2... (25 total options)"`
- **Preserved fuzzy matching**: "Did you mean" suggestions still available for typos
- **More actionable**: Users see what values are actually valid

### 🔧 Improvements

#### Documentation & Security
- **Comprehensive JSDoc**: Added detailed documentation with security warnings
- **Security guidance**: Clear warnings about PII exposure in production logs
- **Usage examples**: Development vs production configuration examples
- **Migration notes**: Guidance for upgrading from 0.3.1

#### Code Quality
- **TypeScript strictness**: Full compatibility with `exactOptionalPropertyTypes`
- **Simplified session handling**: Removed unnecessary null checks in claude-cli adapter
- **Enhanced error handling**: Better type safety for optional properties

#### Testing
- **New test suite**: 9 comprehensive tests for truncation behavior
- **Edge case coverage**: Large payloads, null handling, custom lengths
- **Backward compatibility**: Ensures legacy configurations continue working
- **Updated expectations**: All validation tests updated for improved error messages

### 🐛 Bug Fixes

#### TypeScript Compatibility
- **Fixed exactOptionalPropertyTypes errors**: Proper handling of optional vs undefined properties
- **Session ID handling**: Conditional property spread for optional sessionId
- **Null-safe logging**: Prevention of substring errors on undefined values

#### Validation Error Improvements
- **Better enum feedback**: Show actual valid options instead of generic messages
- **Consistent error format**: Standardized validation error message structure
- **Enhanced debugging**: Additional error details in feedback formatter

### 🔒 Security Considerations

#### Production Usage
- **PII exposure warning**: Full prompt logging may expose sensitive data
- **Recommended settings**: Use `truncate: true` in production environments
- **Log size management**: Prevent unbounded log growth with truncation

### 📊 Performance

#### Memory & Storage
- **Minimal impact**: Truncation check is simple boolean evaluation
- **Development efficiency**: No repeated debug runs needed for visibility
- **Production optimization**: Optional truncation prevents log bloat

### 🔄 Migration Guide

#### From 0.3.1 to 0.3.2

**No breaking changes** - this is a backward-compatible feature addition.

**Default Behavior Change** (Improvement):
- **Before**: Prompts/responses truncated to 1000 characters at debug level
- **After**: Full prompts/responses shown by default for better debugging

**Optional Migration** (for production environments):
```typescript
// Add explicit truncation for production
const logger = createLogger({
  level: 'info',
  truncate: true,        // Enable truncation
  maxPromptLength: 500   // Custom limit
});
```

### 📈 Metrics

- **Test Coverage**: 443 tests passing (100% of test suite)
- **Files Changed**: 7 files modified/added
- **Lines Added**: 269 lines of new functionality and tests
- **TypeScript Compliance**: Full strict mode compatibility

### 🎉 Benefits

#### Developer Experience
- **🔍 Better debugging**: See complete LLM interactions by default
- **⚡ Faster development**: No need to enable debug mode for full prompts
- **🔧 Flexible control**: Optional truncation when needed for cleaner logs
- **📝 Clear guidance**: Improved validation error messages with actual options

#### Production Ready
- **🔒 Security conscious**: Clear warnings and guidance for production usage
- **📊 Performance aware**: Optional truncation for log size management
- **🔄 Backward compatible**: Existing code works with improved visibility
- **🧪 Well tested**: Comprehensive test coverage for reliability

### 🤝 Contributors

- Enhanced by Claude Code (AI Assistant)
- Based on user feedback and PR review suggestions
- Follows CODESTYLE.md principles for maintainable, human-centric code

---

**Full Changelog**: [View on GitHub](https://github.com/conorluddy/Persuader/compare/v0.3.1...v0.3.2)

**Download**: `npm install persuader@0.3.2`