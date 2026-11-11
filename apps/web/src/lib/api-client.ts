import { z } from "zod";

const errorBodySchema = z.object({ error: z.object({ message: z.string() }) });

export type ApiResult = { ok: true; body: unknown } | { ok: false; message: string };

// For the app's own JSON endpoints, from the browser. A failure carries a
// message written to be shown to the person as it is.
export async function callApi(
  path: string,
  init: { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown },
): Promise<ApiResult> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method,
      ...(init.body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(init.body) }),
    });
  } catch {
    return {
      ok: false,
      message: "Pomi could not be reached. Check your connection and try again.",
    };
  }
  const body = await readJson(response);
  if (response.ok) {
    return { ok: true, body };
  }
  const parsed = errorBodySchema.safeParse(body);
  return {
    ok: false,
    message: parsed.success ? parsed.data.error.message : "Something went wrong. Try again.",
  };
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}
