# Testing with Vitest

This project uses Vitest for unit testing. Vitest is a blazing fast unit test framework powered by Vite.

## Running Tests

### Run all tests in watch mode (interactive)
```bash
npm test
```

### Run tests once
```bash
npm run test:run
```

### Run tests with UI
```bash
npm run test:ui
```
This opens a browser-based UI where you can see and run tests interactively.

### Run tests with coverage
```bash
npm run test:coverage
```

## Test Structure

Tests are located alongside the source files with `.test.ts` or `.spec.ts` extensions.

```
src/
  designer/
    ElementManager.ts
    ElementManager.test.ts
    ConnectionManager.ts
    ConnectionManager.test.ts
```

## Writing Tests

### Basic Test Structure
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyClass } from './MyClass';

describe('MyClass', () => {
  let instance: MyClass;

  beforeEach(() => {
    instance = new MyClass();
  });

  describe('methodName', () => {
    it('should do something', () => {
      const result = instance.methodName();
      expect(result).toBe(expectedValue);
    });
  });
});
```

### Mocking

Vitest provides powerful mocking capabilities:

```typescript
import { vi } from 'vitest';

// Mock a module
vi.mock('./module', () => ({
  default: vi.fn(),
  namedExport: vi.fn()
}));

// Mock a function
const mockFn = vi.fn();
mockFn.mockReturnValue('mocked value');

// Spy on existing methods
const spy = vi.spyOn(object, 'method');
```

## Test Configuration

Configuration is in `vitest.config.ts`:
- **Environment**: jsdom (for DOM testing)
- **Globals**: Enabled (no need to import describe, it, expect)
- **Setup Files**: `src/test/setup.ts` runs before each test file
- **Coverage**: Uses v8 provider

## SVG and DOM Testing

The setup file (`src/test/setup.ts`) includes mocks for SVG elements which are not fully supported in jsdom. This allows testing of components that create and manipulate SVG elements.

## Best Practices

1. **Keep tests focused**: Each test should verify one specific behavior
2. **Use descriptive names**: Test names should clearly describe what is being tested
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Clean up after tests**: Use `afterEach` to clean up any side effects
5. **Test edge cases**: Include tests for error conditions and boundary values
6. **Mock external dependencies**: Keep tests isolated and fast

## Common Assertions

```typescript
// Equality
expect(value).toBe(expected);
expect(value).toEqual(expected); // Deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(expected);
expect(value).toBeLessThanOrEqual(expected);

// Arrays
expect(array).toContain(item);
expect(array).toHaveLength(length);

// Objects
expect(object).toHaveProperty('key');
expect(object).toMatchObject(partial);

// Functions
expect(fn).toThrow();
expect(fn).toHaveBeenCalled();
expect(fn).toHaveBeenCalledWith(args);
```

## Debugging Tests

1. Use `test.only()` or `it.only()` to run a single test
2. Use `describe.skip()` or `it.skip()` to skip tests
3. Add `console.log()` statements to debug
4. Use VS Code's Vitest extension for debugging with breakpoints

## Continuous Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npm run test:run
  
- name: Generate coverage
  run: npm run test:coverage
```
