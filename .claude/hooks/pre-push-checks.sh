#!/bin/bash

# Pre-push quality checks for Persuader project
# This script runs comprehensive quality checks before allowing git push operations
# Based on CODESTYLE.md requirements and project conventions

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
    echo -e "${BLUE}[HOOK]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[HOOK]${NC} ✅ $1"
}

print_warning() {
    echo -e "${YELLOW}[HOOK]${NC} ⚠️  $1"
}

print_error() {
    echo -e "${RED}[HOOK]${NC} ❌ $1"
}

# Check if this is a git push command
if [[ "$CLAUDE_TOOL_PARAMS" =~ "git push" ]]; then
    print_status "🔍 Intercepted git push - running quality checks..."
    
    # Change to project directory
    cd "$CLAUDE_PROJECT_DIR"
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_warning "Not in a git repository, skipping checks"
        exit 0
    fi
    
    # Run comprehensive quality checks as per CODESTYLE.md
    print_status "Running TypeScript type checking..."
    if ! npm run typecheck; then
        print_error "TypeScript type checking failed!"
        print_error "Fix type errors before pushing (see CODESTYLE.md)"
        exit 1
    fi
    print_success "TypeScript type checking passed"
    
    print_status "Running Biome code quality checks..."
    if ! npm run check; then
        print_error "Biome code quality checks failed!"
        print_error "Run 'npm run check:fix' to auto-fix issues"
        exit 1
    fi
    print_success "Biome code quality checks passed"
    
    print_status "Running test suite..."
    if ! npm run test:run; then
        print_error "Test suite failed!"
        print_error "Fix failing tests before pushing"
        exit 1
    fi
    print_success "All tests passed"
    
    print_status "Running build verification..."
    if ! npm run build; then
        print_error "Build failed!"
        print_error "Fix build errors before pushing"
        exit 1
    fi
    print_success "Build completed successfully"
    
    print_success "🚀 All quality checks passed! Git push approved."
    
elif [[ "$CLAUDE_TOOL_PARAMS" =~ "git commit" ]]; then
    print_status "🔍 Intercepted git commit - running pre-commit checks..."
    
    # Change to project directory  
    cd "$CLAUDE_PROJECT_DIR"
    
    # Run lighter checks for commits (just formatting and type checking)
    print_status "Running quick TypeScript check..."
    if ! npm run typecheck; then
        print_error "TypeScript errors found!"
        exit 1
    fi
    
    print_status "Running Biome formatting check..."
    if ! npm run check; then
        print_warning "Auto-fixing formatting issues..."
        npm run check:fix
    fi
    
    print_success "✅ Pre-commit checks passed"
fi

# Allow all other commands to proceed normally
exit 0