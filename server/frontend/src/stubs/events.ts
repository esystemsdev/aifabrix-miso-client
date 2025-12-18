// Events stub for browser compatibility
// EventEmitter must be a proper class that can be extended
class EventEmitter {
  private _events: Map<string, Function[]> = new Map();
  
  on(event: string, listener: Function) {
    if (!this._events.has(event)) {
      this._events.set(event, []);
    }
    this._events.get(event)!.push(listener);
    return this;
  }
  
  once(event: string, listener: Function): Promise<any> {
    const onceWrapper = (...args: any[]) => {
      this.removeListener(event, onceWrapper);
      listener(...args);
    };
    return this.on(event, onceWrapper) as any;
  }
  
  emit(event: string, ...args: any[]): boolean {
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
  
  removeListener(event: string, listener: Function) {
    const listeners = this._events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }
  
  removeAllListeners(event?: string) {
    if (event) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
    return this;
  }
  
  off(event: string, listener: Function) {
    return this.removeListener(event, listener);
  }
  
  addListener(event: string, listener: Function) {
    return this.on(event, listener);
  }
}

const events = {
  EventEmitter: EventEmitter,
};

export default events;
export { events, EventEmitter };

// CommonJS exports
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = events;
  module.exports.default = events;
  module.exports.EventEmitter = EventEmitter;
  module.exports.events = events;
}

// ESM exports
if (typeof exports !== 'undefined') {
  exports.default = events;
  exports.events = events;
  exports.EventEmitter = EventEmitter;
}
