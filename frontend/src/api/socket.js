// Simplified polling / event listener interface for live updates

class SimpleEventEmitter {
  constructor() {
    this.listeners = {};
  }
  on(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  off(event, fn) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== fn);
  }
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => cb(data));
    }
  }
}

export const socket = new SimpleEventEmitter();
