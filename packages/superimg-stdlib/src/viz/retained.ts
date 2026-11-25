//! Private page lifecycle shared by executable graphics helpers and capture.

export function graphicsKey(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export const retainedResourcesScript = `
const resources = window.__superimgResources || (window.__superimgResources = (function() {
  const entries = new Map();
  const used = new Set();
  const slots = new Map();
  const pending = new Set();
  const failures = [];
  function release(entry) {
    try {
      const value = entry.value.dispose();
      if (value && typeof value.then === 'function') {
        const task = Promise.resolve(value).catch(error => { failures.push(error); }).finally(() => pending.delete(task));
        pending.add(task);
      }
    } catch (error) { failures.push(error); }
  }
  return {
    begin() { used.clear(); slots.clear(); },
    retain(key, signature, create) {
      const slot = slots.get(key) || 0;
      slots.set(key, slot + 1);
      key += ':' + slot;
      let entry = entries.get(key);
      if (entry && entry.signature !== signature) {
        release(entry); entries.delete(key); entry = null;
      }
      if (!entry) { entry = { signature, value: create() }; entries.set(key, entry); }
      used.add(key);
      return entry.value;
    },
    end() {
      for (const [key, entry] of entries) {
        if (!used.has(key)) { release(entry); entries.delete(key); }
      }
    },
    discard(value) {
      for (const [key, entry] of entries) {
        if (entry.value === value) { release(entry); entries.delete(key); used.delete(key); }
      }
    },
    dispose() {
      for (const entry of entries.values()) release(entry);
      entries.clear(); used.clear(); slots.clear();
    },
    async flush() {
      while (pending.size) await Promise.all([...pending]);
      if (failures.length) throw new AggregateError(failures.splice(0), 'Retained graphics cleanup failed');
    }
  };
})());
`;
