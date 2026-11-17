import type { z } from "zod";
import { AuthzError } from "@/lib/auth/dal";
import { SettingError } from "@/lib/settings";

// API ຕອບເປັນ error code (ພາສາອັງກິດ) ສະເໝີ — UI ແປງເປັນຂໍ້ຄວາມຜ່ານໄຟລ໌ແປພາສາ
export class BusinessError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
  }
}

export function jsonError(status: number, error: string, details?: Record<string, unknown>): Response {
  return Response.json({ error, ...details }, { status });
}

type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

function validationError(error: z.ZodError): Response {
  return jsonError(400, "validation", {
    issues: error.issues.map((i) => ({ path: i.path.join("."), code: i.code, message: i.message })),
  });
}

export async function parseJsonBody<S extends z.ZodType>(req: Request, schema: S): Promise<Parsed<z.output<S>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, response: jsonError(400, "invalid_json") };
  }
  const result = schema.safeParse(body);
  return result.success ? { ok: true, data: result.data } : { ok: false, response: validationError(result.error) };
}

export function parseQuery<S extends z.ZodType>(req: Request, schema: S): Parsed<z.output<S>> {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const result = schema.safeParse(params);
  return result.success ? { ok: true, data: result.data } : { ok: false, response: validationError(result.error) };
}

export function errorResponse(error: unknown): Response {
  if (error instanceof BusinessError) return jsonError(error.status, error.code, error.details);
  if (error instanceof AuthzError) return jsonError(error.status, error.message);
  if (error instanceof SettingError) {
    console.error(error);
    return jsonError(500, "misconfigured");
  }
  console.error(error);
  return jsonError(500, "internal");
}
