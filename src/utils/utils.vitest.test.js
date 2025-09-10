import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Utils from "./utils.js";
import constants from "../config/constants.js";

describe('Utils Module - Vitest Tests', () => {
    
    describe('moduleIsActive', () => {
        it('should return true for active modules', () => {
            const serverIsAvailable = Utils.moduleIsActive(constants.SERVER);
            expect(serverIsAvailable).toBe(true);
        });
        
        it('should return false for unknown modules', () => {
            const unknownModuleIsAvailable = Utils.moduleIsActive("unknownModule");
            expect(unknownModuleIsAvailable).toBe(false);
        });
    });
    
    describe('with mocks', () => {
        let originalEnv;
        
        beforeEach(() => {
            // Save original environment
            originalEnv = { ...process.env };
        });
        
        afterEach(() => {
            // Restore original environment
            process.env = originalEnv;
        });
        
        it('should handle environment variables', () => {
            // Mock environment variable
            process.env.TEST_VAR = 'test_value';
            
            // Your test logic here
            expect(process.env.TEST_VAR).toBe('test_value');
        });
    });
    
    describe('async operations', () => {
        it('should handle async operations', async () => {
            // Example of testing async code
            const result = await Promise.resolve('async result');
            expect(result).toBe('async result');
        });
        
        it('should handle timeouts with vi.useFakeTimers', () => {
            vi.useFakeTimers();
            
            let executed = false;
            setTimeout(() => {
                executed = true;
            }, 1000);
            
            expect(executed).toBe(false);
            
            // Fast-forward time
            vi.advanceTimersByTime(1000);
            
            expect(executed).toBe(true);
            
            vi.useRealTimers();
        });
    });
    
    describe('spies and mocks', () => {
        it('should spy on console.log', () => {
            const logSpy = vi.spyOn(console, 'log');
            
            console.log('test message');
            
            expect(logSpy).toHaveBeenCalledWith('test message');
            expect(logSpy).toHaveBeenCalledTimes(1);
            
            // Restore the original implementation
            logSpy.mockRestore();
        });
        
        it('should mock a module function', () => {
            // Create a mock for a hypothetical function
            const mockFunction = vi.fn().mockReturnValue('mocked value');
            
            // Use the mock
            const result = mockFunction('arg1', 'arg2');
            
            expect(result).toBe('mocked value');
            expect(mockFunction).toHaveBeenCalledWith('arg1', 'arg2');
            expect(mockFunction).toHaveBeenCalledTimes(1);
        });
    });
});
