import { responseHeaders } from "./cors.ts";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export function json(request: Request, body: JsonValue, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(request) });
}

export function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isStringValue(value: JsonValue | undefined): value is string {
  return typeof value === "string";
}

export function isBooleanValue(value: JsonValue | undefined): value is boolean {
  return typeof value === "boolean";
}

export function isFiniteNumberValue(value: JsonValue | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isIntegerValue(value: JsonValue | undefined): value is number {
  return isFiniteNumberValue(value) && Number.isInteger(value);
}
