import { type z } from "zod";

export class UnsupportedContentTypeError extends Error {
  constructor() {
    super("Send the request body as JSON.");
    this.name = "UnsupportedContentTypeError";
  }
}

export class InvalidRequestBodyError extends Error {
  constructor() {
    super("The request body is not what this endpoint expects.");
    this.name = "InvalidRequestBodyError";
  }
}

// JSON only: a cross-site form cannot send application/json without a CORS
// preflight, which the app never answers.
export async function readJsonBody<Output>(
  request: Request,
  schema: z.ZodType<Output>,
): Promise<Output> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(;|$)/i.test(contentType)) {
    throw new UnsupportedContentTypeError();
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new InvalidRequestBodyError();
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new InvalidRequestBodyError();
  }
  return result.data;
}
