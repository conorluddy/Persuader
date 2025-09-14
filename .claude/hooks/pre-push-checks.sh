#!/bin/bash

# Pre-push quality checks for Persuader project
# This script runs the SAME quality checks as the GitHub CI workflow
# Ensures local environment matches CI requirements before pushing

# Exit on any error
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[HOOK]${NC} $1" >&2
}

print_success() {
    echo -e "${GREEN}[HOOK]${NC} ✅ $1" >&2
}

print_warning() {
    echo -e "${YELLOW}[HOOK]${NC} ⚠️  $1" >&2
}

print_error() {
    echo -e "${RED}[HOOK]${NC} ❌ $1" >&2
}

# Read JSON input from stdin
input_json=""
if [ -t 0 ]; then
    # No stdin input (testing mode)
    print_warning "No stdin input - running in test mode"
else
    # Read JSON from stdin
    input_json=$(cat)
fi

# Parse the JSON to get tool information
tool_name=""
tool_command=""

if [ -n "$input_json" ]; then
    # Use python to parse JSON safely
    tool_name=$(echo "$input_json" | python3 -c "import json, sys; data=json.load(sys.stdin); print(data.get('tool_name', ''))" 2>/dev/null || echo "")
    tool_command=$(echo "$input_json" | python3 -c "import json, sys; data=json.load(sys.stdin); print(data.get('tool_input', {}).get('command', ''))" 2>/dev/null || echo "")
fi

# Check if this is a Bash tool with git push command
if [[ "$tool_name" == "Bash" && "$tool_command" =~ git[[:space:]]+push ]]; then
    print_status "🔍 Intercepted git push command: $tool_command"
    print_status "Running comprehensive quality checks (matching GitHub CI workflow)..."
    
    # Change to project directory
    cd "$CLAUDE_PROJECT_DIR" || exit 1
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_warning "Not in a git repository, skipping checks"
        exit 0
    fi
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_error "node_modules not found! Run 'npm install' first."
        exit 1
    fi
    
    # Run the EXACT same checks as GitHub CI workflow (in same order)
    
    print_status "1/4 TypeScript type checking (npm run typecheck)..."
    if ! npm run typecheck > /dev/null 2>&1; then
        print_error "TypeScript type checking failed!"
        print_error "This matches the CI 'Type check' step that would fail."
        print_error "Fix type errors before pushing (see CODESTYLE.md)"
        exit 1
    fi
    print_success "TypeScript type checking passed"
    
    print_status "2/4 Code quality check with ESLint (npm run check)..."
    if ! npm run check > /dev/null 2>&1; then
        print_error "ESLint code quality checks failed!"
        print_error "This matches the CI 'Code quality check (ESLint & TypeScript)' step that would fail."
        print_error "Run 'npm run check:fix' to auto-fix issues, then retry"
        exit 1
    fi
    print_success "ESLint code quality checks passed"
    
    print_status "3/4 Build verification (npm run build)..."
    if ! npm run build > /dev/null 2>&1; then
        print_error "Build failed!"
        print_error "This matches the CI 'Build' step that would fail."
        print_error "Fix build errors before pushing"
        exit 1
    fi
    print_success "Build completed successfully"
    
    print_status "4/4 Test suite (npm run test:run)..."
    if ! npm run test:run > /dev/null 2>&1; then
        print_error "Test suite failed!"
        print_error "This matches the CI 'Run tests' step that would fail."
        print_error "Fix failing tests before pushing"
        exit 1
    fi
    print_success "All tests passed"
    
    # Additional checks for session-related issues (related to GitHub issue #33)
    print_status "5/5 Session regression checks (for issue #33)..."
    
    # Check for session coordinator regression tests
    if ! npm run test:run -- src/core/runner/__tests__/session-coordinator.test.ts > /dev/null 2>&1; then
        print_error "Session coordinator regression tests failed!"
        print_error "These are critical for preventing reintroduction of issue #33 (session ID confusion)"
        exit 1
    fi
    
    # Check for potential session ID confusion patterns
    session_confusion=$(grep -r "sessionId.*sessionId" src --include="*.ts" --exclude-dir="__tests__" | wc -l)
    if [ "$session_confusion" -gt 0 ]; then
        print_warning "Potential session ID naming confusion detected - review for CODESTYLE.md clarity"
        print_warning "Found $session_confusion occurrences of 'sessionId.*sessionId' patterns"
    fi
    
    # Check for console.log statements that might be debugging code
    debug_logs=$(grep -r "console\.log" src --include="*.ts" --exclude-dir="__tests__" | wc -l)
    if [ "$debug_logs" -gt 0 ]; then
        print_warning "Found $debug_logs console.log statements in source code"
        print_warning "Consider using structured logging (utils/logger.ts) instead"
    fi
    
    print_success "🚀 All quality checks passed! Git push approved."
    print_success "These are the same checks that run in GitHub CI - your push should pass!"
    
elif [[ "$tool_name" == "Bash" && "$tool_command" =~ git[[:space:]]+commit ]]; then
    print_status "🔍 Intercepted git commit - running lighter pre-commit checks..."
    
    # Change to project directory  
    cd "$CLAUDE_PROJECT_DIR" || exit 1
    
    # Run lighter checks for commits (just formatting and type checking)
    print_status "Quick TypeScript check..."
    if ! npm run typecheck > /dev/null 2>&1; then
        print_error "TypeScript errors found! Fix before committing."
        exit 1
    fi
    
    print_status "ESLint and Prettier formatting check..."
    if ! npm run check > /dev/null 2>&1; then
        print_warning "Linting/formatting issues found. Auto-fixing..."
        npm run check:fix > /dev/null 2>&1 || true
        print_success "Linting/formatting issues fixed"
    fi
    
    print_success "✅ Pre-commit checks passed"
fi

# Allow all other commands to proceed normally  
exit 0