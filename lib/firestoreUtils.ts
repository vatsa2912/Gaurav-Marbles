/**
 * lib/firestoreUtils.ts
 *
 * Utilities for auditing, sanitizing, and validating data before writing to Firestore.
 * Firestore rejects writes (transaction.set, setDoc, transaction.update, etc.) if any
 * field value in a document, map, or array is `undefined`.
 */

/**
 * Checks whether a value is a plain JavaScript object (and not a Firestore sentinel,
 * Timestamp, FieldValue, Date, or class instance).
 */
export function isPlainObject(value: unknown): value is Record<string, any> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/**
 * Recursively inspects an object or array to find any paths whose value is `undefined`.
 * Returns an array of string paths (e.g. `["items[0].pieces", "items[0].sellingPrice"]`).
 */
export function findUndefinedFields(data: unknown, currentPath = ""): string[] {
  if (data === undefined) {
    return [currentPath || "(root)"];
  }

  if (data === null || typeof data !== "object") {
    return [];
  }

  if (Array.isArray(data)) {
    const results: string[] = [];
    data.forEach((item, index) => {
      const itemPath = currentPath ? `${currentPath}[${index}]` : `[${index}]`;
      results.push(...findUndefinedFields(item, itemPath));
    });
    return results;
  }

  // If it's not a plain object (e.g. FieldValue, Timestamp, Date), do not inspect internals
  if (!isPlainObject(data)) {
    return [];
  }

  const results: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    const keyPath = currentPath ? `${currentPath}.${key}` : key;
    if (value === undefined) {
      results.push(keyPath);
    } else {
      results.push(...findUndefinedFields(value, keyPath));
    }
  }

  return results;
}

/**
 * Recursively cleans an object or array for Firestore writes by omitting keys
 * whose value is `undefined`.
 *
 * - Non-plain objects (FieldValue like serverTimestamp(), Timestamp, Date) are preserved as-is.
 * - In plain objects, keys with `undefined` values are omitted.
 * - In arrays, items are recursively sanitized.
 */
export function sanitizeFirestoreData<T>(data: T): T {
  if (data === undefined) {
    return undefined as unknown as T;
  }

  if (data === null || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeFirestoreData(item)) as unknown as T;
  }

  if (!isPlainObject(data)) {
    return data;
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleaned[key] = sanitizeFirestoreData(value);
    }
  }

  return cleaned as T;
}

/**
 * Development-only validator that asserts no fields in `data` are `undefined`.
 * In development, throws a detailed error if any undefined fields are detected.
 * In production, does not log or throw, ensuring 0 noise in production.
 */
export function assertNoUndefined(data: unknown, contextName = "Firestore operation"): void {
  if (process.env.NODE_ENV !== "production") {
    const undefinedPaths = findUndefinedFields(data);
    if (undefinedPaths.length > 0) {
      const msg = `[Firestore Validation] Attempted to write undefined field(s) in ${contextName}: ${undefinedPaths.join(", ")}`;
      console.error(msg, data);
      throw new Error(msg);
    }
  }
}
