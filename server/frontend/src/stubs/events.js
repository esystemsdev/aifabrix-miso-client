// Events stub for browser compatibility
// EventEmitter must be a proper class that can be extended
class EventEmitter {
  constructor() {
    this._events = new Map();
  }
  
  on(event, listener) {
    if (!this._events.has(event)) {
      this._events.set(event, []);
    }
    this._events.get(event).push(listener);
    return this;
  }
  
  once(event, listener) {
    const onceWrapper = (...args) => {
      this.removeListener(event, onceWrapper);
      listener(...args);
    };
    this.on(event, onceWrapper);
    return this;
  }
  
  emit(event, ...args) {
    const listeners = this._events.get(event);
    if (listeners && listeners.length > 0) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (e) {
          console.error('EventEmitter error:', e);
        }
      });
      return true;
    }
    return false;
  }
  
  removeListener(event, listener) {
    const listeners = this._events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }
  
  removeAllListeners(event) {
    if (event) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
    return this;
  }
  
  off(event, listener) {
    return this.removeListener(event, listener);
  }
  
  addListener(event, listener) {
    return this.on(event, listener);
  }
}

const events = {
  EventEmitter: EventEmitter,
};

// CommonJS export (primary) - this is what require() looks for
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = events;
  module.exports.default = events;
  module.exports.EventEmitter = EventEmitter;
  module.exports.events = events;
}

// ESM exports (for import statements)
if (typeof exports !== 'undefined') {
  exports.default = events;
  exports.events = events;
  exports.EventEmitter = EventEmitter;
}

// Also export for ESM
export default events;
export { events, EventEmitter };

