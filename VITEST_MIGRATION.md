# Vitest Migration Guide for Andromeda

## Overview
This guide provides instructions for migrating the Andromeda project's tests from Mocha/Ava to Vitest.

## Current Setup

### Configuration
- **Config File**: `vitest.config.js` - Main Vitest configuration
- **Setup File**: `test/setup.js` - MongoDB Memory Server setup and global hooks
- **Environment**: Node.js environment with ES modules

### Available Scripts
```json
"test": "vitest"                           // Run tests in watch mode
"test:run": "vitest run"                   // Run tests once
"test:ui": "vitest --ui"                   // Open Vitest UI
"test:coverage": "vitest run --coverage"   // Run tests with coverage
"test:watch": "vitest watch"               // Watch mode (alias)
"test:unit": "vitest run src/**/*.unit.test.js"  // Run unit tests only
"test:int": "vitest run src/**/*.int.test.js"    // Run integration tests only
```

## Migration Steps

### 1. Basic Test File Migration

Most existing Mocha tests will work with Vitest without changes due to globals support:

**Before (Mocha)**:
```javascript
import assert from "assert";

describe('MyModule', function () {
    it('should do something', async () => {
        const result = myFunction();
        assert.equal(result, expected);
    });
});
```

**After (Vitest) - Option 1: Keep using globals**:
```javascript
import { expect } from 'vitest';

describe('MyModule', () => {
    it('should do something', async () => {
        const result = myFunction();
        expect(result).toBe(expected);
    });
});
```

**After (Vitest) - Option 2: Explicit imports**:
```javascript
import { describe, it, expect } from 'vitest';

describe('MyModule', () => {
    it('should do something', async () => {
        const result = myFunction();
        expect(result).toBe(expected);
    });
});
```

### 2. Assertion Migration

Replace Node.js `assert` with Vitest's `expect`:

```javascript
// From assert
assert.equal(actual, expected);
assert.strictEqual(actual, expected);
assert.deepEqual(actual, expected);
assert.ok(value);
assert.throws(() => fn());

// To expect
expect(actual).toBe(expected);
expect(actual).toBe(expected);
expect(actual).toEqual(expected);
expect(value).toBeTruthy();
expect(() => fn()).toThrow();
```

### 3. Hooks Migration

Hooks work similarly but can be imported explicitly:

```javascript
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

beforeAll(async () => {
    // Setup before all tests
});

afterAll(async () => {
    // Cleanup after all tests
});

beforeEach(() => {
    // Setup before each test
});

afterEach(() => {
    // Cleanup after each test
});
```

### 4. Mocking and Spying

Vitest provides powerful mocking utilities via `vi`:

```javascript
import { vi } from 'vitest';

// Spy on a method
const spy = vi.spyOn(console, 'log');
expect(spy).toHaveBeenCalledWith('message');
spy.mockRestore();

// Mock a function
const mockFn = vi.fn();
mockFn.mockReturnValue('mocked');
mockFn.mockResolvedValue('async mocked');

// Mock timers
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
vi.useRealTimers();

// Mock modules
vi.mock('./module', () => ({
    default: vi.fn(),
    namedExport: vi.fn()
}));
```

### 5. Async Testing

Vitest handles async tests natively:

```javascript
// Async/await
it('async test', async () => {
    const result = await asyncFunction();
    expect(result).toBe('expected');
});

// Promises
it('promise test', () => {
    return promise.then(result => {
        expect(result).toBe('expected');
    });
});

// With expect
it('expect async', async () => {
    await expect(asyncFunction()).resolves.toBe('expected');
    await expect(failingAsync()).rejects.toThrow('error');
});
```

### 6. Test Isolation

Tests run in isolation by default. Use test contexts for shared state:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';

describe('with context', () => {
    let context;
    
    beforeEach(() => {
        context = {
            value: 'initial'
        };
    });
    
    it('test 1', () => {
        context.value = 'modified';
        expect(context.value).toBe('modified');
    });
    
    it('test 2', () => {
        // Context is reset
        expect(context.value).toBe('initial');
    });
});
```

### 7. Integration Test Setup

For integration tests that need MongoDB:

```javascript
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';

describe('Database Integration', () => {
    it('should connect to MongoDB Memory Server', async () => {
        // MongoDB Memory Server is started in test/setup.js
        const connection = await mongoose.connect(process.env.MONGODB_URI);
        expect(connection).toBeDefined();
        await mongoose.disconnect();
    });
});
```

### 8. Coverage Configuration

Coverage is configured in `vitest.config.js`:

```javascript
coverage: {
    provider: 'c8',
    reporter: ['text', 'json', 'html', 'lcov'],
    exclude: [
        'coverage/**',
        'dist/**',
        '**/*.config.*',
        '**/test/**',
        // ... other exclusions
    ]
}
```

Run coverage with: `npm run test:coverage`

## Common Patterns

### Testing Fastify Routes

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify from 'fastify';
import routes from './routes.js';

describe('API Routes', () => {
    let app;
    
    beforeAll(async () => {
        app = fastify();
        app.register(routes);
        await app.ready();
    });
    
    afterAll(async () => {
        await app.close();
    });
    
    it('GET /endpoint', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/endpoint'
        });
        
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ expected: 'data' });
    });
});
```

### Testing with MongoDB Models

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import Model from './model.js';

describe('Model Tests', () => {
    beforeEach(async () => {
        await Model.deleteMany({});
    });
    
    it('should create a document', async () => {
        const doc = await Model.create({
            name: 'Test',
            value: 123
        });
        
        expect(doc.name).toBe('Test');
        expect(doc.value).toBe(123);
        expect(doc._id).toBeDefined();
    });
});
```

## Running Tests

```bash
# Run all tests in watch mode
npm test

# Run tests once
npm run test:run

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:int

# Run specific file
npx vitest run src/utils/utils.test.js

# Run tests matching pattern
npx vitest run -t "should create"
```

## Troubleshooting

### MongoDB Memory Server Issues
- Ensure port 27018 is not in use
- Check that MongoDB binaries are downloaded: `npx mongodb-memory-server-global-4.2 --download`
- Increase timeout if needed in `vitest.config.js`

### Module Resolution Issues
- Ensure `"type": "module"` is in package.json
- Use `.js` extensions in imports
- Check that all dependencies support ESM

### Test Timeout Issues
- Increase timeout in config: `testTimeout: 30000`
- Use `it('test', { timeout: 10000 }, async () => {})`

## Benefits of Vitest

1. **Faster Execution**: Vitest uses worker threads and smart caching
2. **Better DX**: Hot module replacement, better error messages
3. **Native ESM Support**: Works seamlessly with ES modules
4. **UI Mode**: Interactive test runner with `npm run test:ui`
5. **VS Code Integration**: Install Vitest extension for inline test running
6. **Compatible API**: Similar to Jest, making migration easier
7. **Built-in Coverage**: C8 coverage without additional setup
8. **Snapshot Testing**: Built-in snapshot testing support
9. **Concurrent Tests**: Tests run in parallel by default

## Next Steps

1. Start by running existing tests with Vitest to identify any failures
2. Gradually migrate test files, starting with unit tests
3. Update CI/CD pipelines to use Vitest commands
4. Remove old test dependencies (Mocha, Ava) once migration is complete
5. Leverage Vitest-specific features like UI mode and better mocking

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Migration from Mocha](https://vitest.dev/guide/migration.html#mocha)
- [API Reference](https://vitest.dev/api/)
- [Configuration Reference](https://vitest.dev/config/)
