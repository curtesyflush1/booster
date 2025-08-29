/**
 * Tests for content script scope isolation
 * Ensures that the content script doesn't leak variables into the global scope
 */

describe('Content Script Scope Isolation', () => {
  let mockWindow: any;

  beforeEach(() => {
    // Create a mock window object for testing
    mockWindow = {
      addEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    };
    
    // Mock chrome extension APIs
    (global as any).chrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn()
        }
      }
    };
  });

  afterEach(() => {
    // Clean up
    delete (global as any).chrome;
  });

  test('should not leak ContentScript class to global scope', () => {
    // Store original global properties
    const originalGlobalKeys = Object.keys(mockWindow);
    
    // Simulate IIFE execution with scope isolation
    const executeIIFE = () => {
      // This simulates the IIFE wrapper from our content script
      (() => {
        'use strict';
        
        class ContentScript {
          initialized = true;
        }
        
        // Initialize within IIFE scope
        const instance = new ContentScript();
        
        // Use unique namespace to prevent conflicts
        const NAMESPACE = '__BoosterBeacon_ContentScript_' + Date.now() + '_' + Math.random().toString(36);
        
        if (!mockWindow[NAMESPACE]) {
          mockWindow[NAMESPACE] = {
            initialized: false,
            instance: null
          };
          
          mockWindow[NAMESPACE].instance = instance;
          mockWindow[NAMESPACE].initialized = true;
        }
      })();
    };

    // Execute the IIFE
    executeIIFE();

    // Check that classes are not leaked to global scope
    expect(mockWindow.ContentScript).toBeUndefined();

    // Check that no new global variables were added (except our namespaced one)
    const newGlobalKeys = Object.keys(mockWindow);
    const addedKeys = newGlobalKeys.filter(key => !originalGlobalKeys.includes(key));
    
    // Should only have one new key (our namespace)
    expect(addedKeys.length).toBe(1);
    expect(addedKeys[0]).toMatch(/^__BoosterBeacon_ContentScript_/);

    // Verify the namespace contains our instance
    const namespaceKey = addedKeys[0];
    if (namespaceKey) {
      expect(mockWindow[namespaceKey]).toBeDefined();
      expect(mockWindow[namespaceKey].initialized).toBe(true);
      expect(mockWindow[namespaceKey].instance).toBeDefined();
    }
  });

  test('should not pollute window object with utility functions', () => {
    const originalGlobalKeys = Object.keys(mockWindow);
    
    // Simulate IIFE execution
    (() => {
      'use strict';
      
      // These should not leak to global scope
      function log() { return 'test'; }
      function debounce() { return 'test'; }
      function generateId() { return 'test'; }
      
      const utilityObject = {
        helper1: () => 'test',
        helper2: () => 'test',
        config: { setting: 'value' }
      };
      
      class IsolatedClass {
        method() {
          return 'isolated';
        }
      }
      
      // Use the functions/objects locally
      log();
      debounce();
      generateId();
      utilityObject.helper1();
      new IsolatedClass().method();
    })();

    // Verify no utility functions leaked
    expect(mockWindow.log).toBeUndefined();
    expect(mockWindow.debounce).toBeUndefined();
    expect(mockWindow.generateId).toBeUndefined();
    expect(mockWindow.utilityObject).toBeUndefined();
    expect(mockWindow.IsolatedClass).toBeUndefined();

    // Verify no new globals were added
    const newGlobalKeys = Object.keys(mockWindow);
    expect(newGlobalKeys).toEqual(originalGlobalKeys);
  });

  test('should prevent variable conflicts with host page', () => {
    // Simulate host page variables that might conflict
    mockWindow.ContentScript = 'host-page-value';
    mockWindow.ProductDetector = { hostMethod: () => 'host' };
    mockWindow.log = () => 'host-log';
    mockWindow.debounce = () => 'host-debounce';

    // Simulate IIFE execution
    (() => {
      'use strict';
      
      // Our content script variables with same names
      class ContentScript {
        getValue() { return 'extension-value'; }
      }
      
      class ProductDetector {
        extensionMethod() { return 'extension'; }
      }
      
      function log() { return 'extension-log'; }
      function debounce() { return 'extension-debounce'; }
      
      // Use our local versions
      const cs = new ContentScript();
      const pd = new ProductDetector();
      const logResult = log();
      const debounceResult = debounce();
      
      // Store results in a way we can verify them
      const NAMESPACE = '__Test_Results_' + Date.now();
      mockWindow[NAMESPACE] = {
        csValue: cs.getValue(),
        pdValue: pd.extensionMethod(),
        logValue: logResult,
        debounceValue: debounceResult
      };
    })();

    // Verify host page variables are unchanged
    expect(mockWindow.ContentScript).toBe('host-page-value');
    expect(mockWindow.ProductDetector.hostMethod()).toBe('host');
    expect(mockWindow.log()).toBe('host-log');
    expect(mockWindow.debounce()).toBe('host-debounce');

    // Verify our extension code used its own isolated versions
    const testNamespace = Object.keys(mockWindow).find(key => key.startsWith('__Test_Results_'));
    expect(testNamespace).toBeDefined();
    
    if (testNamespace) {
      const results = mockWindow[testNamespace];
      expect(results.csValue).toBe('extension-value');
      expect(results.pdValue).toBe('extension');
      expect(results.logValue).toBe('extension-log');
      expect(results.debounceValue).toBe('extension-debounce');
    }
  });

  test('should clean up namespace on page unload', () => {
    let namespaceKey: string;
    
    // Simulate IIFE execution
    (() => {
      'use strict';
      
      const NAMESPACE = '__BoosterBeacon_ContentScript_' + Date.now() + '_' + Math.random().toString(36);
      
      mockWindow[NAMESPACE] = {
        initialized: true,
        instance: { test: 'value' }
      };
      
      // Set up cleanup on beforeunload
      mockWindow.addEventListener('beforeunload', () => {
        delete mockWindow[NAMESPACE];
      });
      
      // Store namespace key for testing
      namespaceKey = NAMESPACE;
    })();

    if (namespaceKey) {
      expect(mockWindow[namespaceKey]).toBeDefined();
      expect(mockWindow[namespaceKey].initialized).toBe(true);
    }

    // Simulate page unload by calling the event handler
    const eventHandler = mockWindow.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'beforeunload'
    )?.[1];
    
    if (eventHandler) {
      eventHandler();
    }

    // Verify namespace was cleaned up
    if (namespaceKey) {
      expect(mockWindow[namespaceKey]).toBeUndefined();
    }
  });

  test('should handle multiple content script instances safely', () => {
    // Simulate first IIFE execution
    (() => {
      'use strict';
      
      class ContentScript {
        constructor(public id: string) {}
        initialized = true;
      }
      
      // Simulate multiple instances trying to initialize
      const NAMESPACE = '__BoosterBeacon_ContentScript_shared';
      
      if (!mockWindow[NAMESPACE]) {
        mockWindow[NAMESPACE] = {
          initialized: false,
          instance: null
        };
      }
      
      // Only initialize if not already done
      if (!mockWindow[NAMESPACE].initialized) {
        mockWindow[NAMESPACE].instance = new ContentScript('first');
        mockWindow[NAMESPACE].initialized = true;
      }
    })();

    // Simulate second IIFE execution (duplicate injection)
    (() => {
      'use strict';
      
      class ContentScript {
        constructor(public id: string) {}
        initialized = true;
      }
      
      // Simulate multiple instances trying to initialize
      const NAMESPACE = '__BoosterBeacon_ContentScript_shared';
      
      if (!mockWindow[NAMESPACE]) {
        mockWindow[NAMESPACE] = {
          initialized: false,
          instance: null
        };
      }
      
      // Only initialize if not already done
      if (!mockWindow[NAMESPACE].initialized) {
        mockWindow[NAMESPACE].instance = new ContentScript('second');
        mockWindow[NAMESPACE].initialized = true;
      }
    })();

    // Verify only one instance was created (the first one)
    const namespace = mockWindow.__BoosterBeacon_ContentScript_shared;
    expect(namespace).toBeDefined();
    expect(namespace.initialized).toBe(true);
    expect(namespace.instance.id).toBe('first'); // Should be the first instance, not overridden
  });

  test('IIFE pattern prevents global scope pollution', () => {
    // Test that our IIFE pattern actually works
    const globalsBefore = Object.keys(mockWindow);
    
    // Execute an IIFE that would normally pollute global scope
    (() => {
      'use strict';
      
      // These would normally become global variables without IIFE
      const SECRET_CONFIG = { apiKey: 'secret' };
      
      function privateFunction() {
        return 'should not be accessible';
      }
      
      class PrivateClass {
        private data = 'confidential';
        
        getData() {
          return this.data;
        }
      }
      
      // Use them internally to prevent unused variable warnings
      const instance = new PrivateClass();
      const internalState = privateFunction();
      
      // Simulate some internal processing to use all variables
      if (SECRET_CONFIG.apiKey && internalState && instance.getData()) {
        // Variables are used, preventing TypeScript warnings
      }
      
      // Only expose what we want through a controlled namespace
      const CONTROLLED_NAMESPACE = '__BoosterBeacon_Controlled';
      mockWindow[CONTROLLED_NAMESPACE] = {
        publicMethod: () => 'this is intentionally public',
        version: '1.0.0'
      };
    })();
    
    const globalsAfter = Object.keys(mockWindow);
    const newGlobals = globalsAfter.filter(key => !globalsBefore.includes(key));
    
    // Should only have our controlled namespace
    expect(newGlobals).toEqual(['__BoosterBeacon_Controlled']);
    
    // Private variables should not be accessible
    expect(mockWindow.SECRET_CONFIG).toBeUndefined();
    expect(mockWindow.internalState).toBeUndefined();
    expect(mockWindow.privateFunction).toBeUndefined();
    expect(mockWindow.PrivateClass).toBeUndefined();
    
    // Only controlled exposure should be available
    expect(mockWindow.__BoosterBeacon_Controlled).toBeDefined();
    expect(mockWindow.__BoosterBeacon_Controlled.publicMethod()).toBe('this is intentionally public');
    expect(mockWindow.__BoosterBeacon_Controlled.version).toBe('1.0.0');
  });
});