#!/bin/bash

# Pre-push quality checks - runs before git push
# This ensures code quality standards are met before pushing to remote

set -e  # Exit on any error

echo "[PRE-PUSH] Running quality checks..." >&2

# Parse stdin to get push information
while read local_ref local_sha remote_ref remote_sha; do
    # Skip if deleting a branch
    if [ "$local_sha" = "0000000000000000000000000000000000000000" ]; then
        continue
    fi
    
    echo "[PRE-PUSH] Checking push to $remote_ref..." >&2
    
    # Run TypeScript type checking (matches CI)
    echo "[PRE-PUSH] TypeScript type checking..." >&2
    npm run typecheck || {
        echo "[PRE-PUSH] ❌ TypeScript type checking failed!" >&2
        exit 1
    }
    
    # Run code quality checks (matches CI - includes TypeScript + ESLint)
    echo "[PRE-PUSH] Code quality checks (ESLint & TypeScript)..." >&2
    npm run check || {
        echo "[PRE-PUSH] ❌ Code quality checks failed!" >&2
        echo "[PRE-PUSH] Run 'npm run lint:fix' to auto-fix linting issues" >&2
        echo "[PRE-PUSH] Run 'npm run format' to format code with Prettier" >&2
        exit 1
    }
    
    # Run build (matches CI)
    echo "[PRE-PUSH] Build check..." >&2
    npm run build || {
        echo "[PRE-PUSH] ❌ Build failed!" >&2
        exit 1
    }
    
    # Run tests (matches CI)
    echo "[PRE-PUSH] Running tests..." >&2
    npm run test:run || {
        echo "[PRE-PUSH] ❌ Tests failed!" >&2
        exit 1
    }
    
    echo "[PRE-PUSH] ✅ All quality checks passed!" >&2
done

exit 0