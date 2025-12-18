// Debug script to log all module imports
// This helps identify missing Node.js modules

const originalRequire = typeof require !== 'undefined' ? require : null;

if (typeof window !== 'undefined') {
  window.__debugRequires = [];
  
  // Intercept require calls
  if (originalRequire) {
    const debugRequire = function(id) {
      window.__debugRequires.push(id);
      console.log('[DEBUG] require:', id);
      try {
        return originalRequire(id);
      } catch (e) {
        console.error('[DEBUG] Failed to require:', id, e);
        return {};
      }
    };
    
    // Try to replace require (may not work in all contexts)
    if (typeof global !== 'undefined') {
      global.require = debugRequire;
    }
  }
}

export default {};

