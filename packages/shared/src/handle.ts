// The database checks the same format (users_handle_format), so a handle
// that reaches it some other way is still refused.
const HANDLE_FORMAT = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;

// A handle is the first segment of a page's path, so it must never shadow one
// of the app's own routes, and must not pass for the people who run Pomi.
const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "about",
  "account",
  "admin",
  "api",
  "app",
  "apps",
  "assets",
  "auth",
  "blog",
  "dashboard",
  "docs",
  "download",
  "email",
  "explore",
  "help",
  "home",
  "legal",
  "login",
  "logout",
  "mail",
  "new",
  "official",
  "pay",
  "pomi",
  "pomiapp",
  "pomi-app",
  "privacy",
  "profile",
  "profiles",
  "public",
  "register",
  "request",
  "requests",
  "root",
  "search",
  "security",
  "settings",
  "sign-in",
  "sign-out",
  "sign-up",
  "signin",
  "signout",
  "signup",
  "staff",
  "static",
  "status",
  "support",
  "system",
  "team",
  "terms",
  "useroutr",
  "verify",
  "www",
]);

export class InvalidHandleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidHandleError";
  }
}

export function parseHandle(input: string): string {
  const handle = input.trim().toLowerCase();
  if (!HANDLE_FORMAT.test(handle) || handle.includes("--")) {
    throw new InvalidHandleError(
      "Use 3 to 30 lowercase letters, digits and single hyphens, starting with a letter",
    );
  }
  if (RESERVED_HANDLES.has(handle)) {
    throw new InvalidHandleError("That handle is reserved");
  }
  return handle;
}
