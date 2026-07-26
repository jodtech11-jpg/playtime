'use strict';

function clone(value) {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

class FakeDocumentSnapshot {
  constructor(ref, value) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = value !== undefined;
    this._value = value;
  }

  data() {
    return this.exists ? clone(this._value) : undefined;
  }
}

class FakeDocumentReference {
  constructor(db, path) {
    this.db = db;
    this.path = path;
    this.id = path.split('/').at(-1);
  }

  async get() {
    return this.db._snapshot(this);
  }

  async set(value, options) {
    this.db._set(this, value, options);
  }

  async update(value) {
    if (!this.db._documents.has(this.path)) throw new Error(`Missing document ${this.path}`);
    this.db._set(this, value, {merge: true});
  }

  collection(name) {
    return new FakeCollectionReference(this.db, `${this.path}/${name}`);
  }
}

class FakeQuery {
  constructor(db, path, filters = [], limitCount = null) {
    this.db = db;
    this.path = path;
    this.filters = filters;
    this.limitCount = limitCount;
  }

  where(field, operator, expected) {
    return new FakeQuery(
      this.db,
      this.path,
      [...this.filters, {field, operator, expected}],
      this.limitCount,
    );
  }

  limit(count) {
    return new FakeQuery(this.db, this.path, this.filters, count);
  }

  async get() {
    const depth = this.path.split('/').length + 1;
    let docs = [...this.db._documents.entries()]
      .filter(([path]) => path.startsWith(`${this.path}/`) && path.split('/').length === depth)
      .map(([path]) => this.db._snapshot(new FakeDocumentReference(this.db, path)))
      .filter((snapshot) => this.filters.every(({field, operator, expected}) => {
        const actual = snapshot.data()[field];
        if (operator === '==') return actual === expected;
        if (operator === '<=') return actual <= expected;
        throw new Error(`Unsupported fake query operator ${operator}`);
      }));
    if (this.limitCount != null) docs = docs.slice(0, this.limitCount);
    return {docs, empty: docs.length === 0, size: docs.length};
  }
}

class FakeCollectionReference extends FakeQuery {
  doc(id) {
    return new FakeDocumentReference(this.db, `${this.path}/${id}`);
  }
}

class FakeTransaction {
  constructor(db) {
    this.db = db;
  }

  async get(ref) {
    return ref.get();
  }

  set(ref, value, options) {
    this.db._set(ref, value, options);
  }

  update(ref, value) {
    if (!this.db._documents.has(ref.path)) throw new Error(`Missing document ${ref.path}`);
    this.db._set(ref, value, {merge: true});
  }

  create(ref, value) {
    if (this.db._documents.has(ref.path)) throw new Error(`Document exists ${ref.path}`);
    this.db._set(ref, value);
  }

  delete(ref) {
    this.db._documents.delete(ref.path);
  }
}

class FakeFirestore {
  constructor(seed = {}) {
    this._documents = new Map(
      Object.entries(seed).map(([path, value]) => [path, clone(value)]),
    );
  }

  collection(path) {
    return new FakeCollectionReference(this, path);
  }

  async getAll(...refs) {
    return Promise.all(refs.map((ref) => ref.get()));
  }

  async runTransaction(callback) {
    return callback(new FakeTransaction(this));
  }

  _snapshot(ref) {
    return new FakeDocumentSnapshot(ref, this._documents.get(ref.path));
  }

  _set(ref, value, options = {}) {
    const previous = options.merge ? this._documents.get(ref.path) || {} : {};
    const next = {...clone(previous)};
    for (const [key, item] of Object.entries(value)) {
      if (item && item.__operation === 'increment') {
        next[key] = Number(previous[key] || 0) + item.value;
      } else if (item && item.__operation === 'arrayUnion') {
        next[key] = [...new Set([...(previous[key] || []), ...item.values])];
      } else {
        next[key] = clone(item);
      }
    }
    this._documents.set(ref.path, next);
  }

  data(path) {
    return clone(this._documents.get(path));
  }
}

function createAdmin(db) {
  return {
    firestore: Object.assign(() => db, {
      FieldValue: {
        serverTimestamp: () => new Date('2026-07-26T12:00:00.000Z'),
        increment: (value) => ({__operation: 'increment', value}),
        arrayUnion: (...values) => ({__operation: 'arrayUnion', values}),
      },
      Timestamp: {
        fromDate: (value) => value,
      },
    }),
  };
}

module.exports = {FakeFirestore, createAdmin};
