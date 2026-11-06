/**
 * Loads a module fresh with specific environment variables. Some services read
 * `process.env.EXPO_PUBLIC_*` once at import time, so a test that needs a different key
 * (or none) has to import after setting it, in an isolated module registry.
 */
export function loadFresh<T>(load: () => T, env: Record<string, string | undefined>): T {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    saved[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  let mod!: T;
  try {
    jest.isolateModules(() => {
      mod = load();
    });
  } finally {
    for (const key of Object.keys(env)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
  return mod;
}
