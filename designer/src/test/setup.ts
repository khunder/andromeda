import { afterEach, vi } from 'vitest';

// Cleanup after each test case
afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks();
  
  // Clean up any DOM elements if they exist
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '';
  }
});

// Mock SVG elements which are not fully supported in jsdom
global.SVGElement = global.SVGElement || global.Element;
global.SVGSVGElement = global.SVGSVGElement || global.SVGElement;
global.SVGGElement = global.SVGGElement || global.SVGElement;
global.SVGPathElement = global.SVGPathElement || global.SVGElement;
global.SVGLineElement = global.SVGLineElement || global.SVGElement;
global.SVGRectElement = global.SVGRectElement || global.SVGElement;
global.SVGCircleElement = global.SVGCircleElement || global.SVGElement;

// Mock createElementNS for SVG support
document.createElementNS = vi.fn((namespaceURI: string, qualifiedName: string) => {
  const element = document.createElement(qualifiedName) as any;
  element.setAttribute = vi.fn();
  element.getAttribute = vi.fn();
  element.appendChild = vi.fn();
  element.removeChild = vi.fn();
  element.remove = vi.fn();
  element.style = {};
  return element;
});

// Mock SVGSVGElement methods
Object.defineProperty(global.SVGSVGElement.prototype, 'viewBox', {
  get: vi.fn(() => ({
    baseVal: {
      x: 0,
      y: 0,
      width: 1000,
      height: 600
    }
  })),
  configurable: true
});

Object.defineProperty(global.SVGSVGElement.prototype, 'getBoundingClientRect', {
  value: vi.fn(() => ({
    top: 0,
    left: 0,
    right: 1000,
    bottom: 600,
    width: 1000,
    height: 600,
    x: 0,
    y: 0,
  })),
  configurable: true
});
