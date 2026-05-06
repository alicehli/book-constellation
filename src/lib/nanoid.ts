// Tiny ID generator — avoids adding the nanoid package dependency
export function nanoid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
