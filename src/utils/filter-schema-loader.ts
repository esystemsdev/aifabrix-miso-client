/**
 * Filter schema loading from JSON
 */

import type { FilterSchema, FilterFieldDefinition } from "../types/filter-schema.types";
import type { FilterOperator } from "../types/filter.types";

function getFilterSchemaObject(json: unknown): {
  resource: string;
  version?: string;
  fields: Record<string, unknown>;
} {
  if (typeof json !== "object" || json === null) {
    throw new Error("Invalid filter schema: expected object");
  }

  const obj = json as Record<string, unknown>;
  if (typeof obj.resource !== "string") {
    throw new Error("Invalid filter schema: missing 'resource' field");
  }
  if (typeof obj.fields !== "object" || obj.fields === null) {
    throw new Error("Invalid filter schema: missing 'fields' object");
  }

  return {
    resource: obj.resource,
    version: typeof obj.version === "string" ? obj.version : undefined,
    fields: obj.fields as Record<string, unknown>,
  };
}

function parseFilterField(
  fieldName: string,
  fieldDef: unknown,
): FilterFieldDefinition {
  if (typeof fieldDef !== "object" || fieldDef === null) {
    throw new Error(`Invalid filter schema: field '${fieldName}' must be an object`);
  }

  const def = fieldDef as Record<string, unknown>;
  if (typeof def.column !== "string") {
    throw new Error(`Invalid filter schema: field '${fieldName}' missing 'column'`);
  }
  if (typeof def.type !== "string") {
    throw new Error(`Invalid filter schema: field '${fieldName}' missing 'type'`);
  }
  if (!Array.isArray(def.operators)) {
    throw new Error(`Invalid filter schema: field '${fieldName}' missing 'operators' array`);
  }

  return {
    column: def.column,
    type: def.type as FilterFieldDefinition["type"],
    operators: def.operators as FilterOperator[],
    enumValues: Array.isArray(def.enumValues) ? (def.enumValues as string[]) : undefined,
    nullable: typeof def.nullable === "boolean" ? def.nullable : undefined,
    description: typeof def.description === "string" ? def.description : undefined,
  };
}

function parseFilterFields(
  fields: Record<string, unknown>,
): Record<string, FilterFieldDefinition> {
  const parsedFields: Record<string, FilterFieldDefinition> = {};
  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    parsedFields[fieldName] = parseFilterField(fieldName, fieldDef);
  }
  return parsedFields;
}

/**
 * Load a filter schema from a JSON object.
 * @param json - JSON object representing a filter schema
 * @returns Parsed FilterSchema
 * @throws Error if schema format is invalid
 */
export function loadFilterSchema(json: unknown): FilterSchema {
  const obj = getFilterSchemaObject(json);
  const parsedFields = parseFilterFields(obj.fields);

  return {
    resource: obj.resource,
    version: obj.version,
    fields: parsedFields,
  };
}
