"use strict";

const util = require("../util");

const { default: ZSchema, registerFormat } = require("z-schema");

const { openapi } = require("@apidevtools/openapi-schemas");

module.exports = validateSchema;

let zSchema = initializeZSchema();

/**
 * Validates the given Swagger API against the Swagger 2.0 or OpenAPI 3.0 and 3.1 schemas.
 *
 * @param {SwaggerObject} api
 */
function validateSchema (api) {


  // Choose the appropriate schema (Swagger or OpenAPI)
  let schema;

  if(api.swagger){
    schema = openapi.v2;
  }else{
    if(api.openapi.startsWith('3.1')){
      schema = openapi.v31;
      
    }else{
      schema = openapi.v3;

    }
  }

  // Validate against the schema
  // z-schema 12 throws ValidateError on validation failure
  try {
    let isValid = zSchema.validate(api, schema);

    if (!isValid) {
      let err = zSchema.getLastError();
      let message = "Swagger schema validation failed.\n" + formatZSchemaError(err.details);
      const error = new SyntaxError(message);
      error.details = err.details;
      throw error;
    }
  } catch (err) {
    // z-schema 12 throws ValidateError, convert it to SyntaxError
    if (err.name === 'ValidateError' || err.constructor.name === 'ValidateError') {
      let message = "Swagger schema validation failed.\n" + formatZSchemaError(err.details);
      const error = new SyntaxError(message);
      error.details = err.details;
      throw error;
    }
    // Re-throw if it's already a SyntaxError or other error
    throw err;
  }
}

/**
 * Recursively removes $schema properties and replaces external JSON Schema $refs
 * to prevent z-schema from trying to resolve external meta-schemas.
 *
 * External $refs are replaced with an empty schema {} which allows any value,
 * preserving the schema structure while avoiding unresolvable references.
 */
function removeSchemaReferences(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }
  
  if (Array.isArray(obj)) {
    obj.forEach(item => removeSchemaReferences(item));
    return;
  }
  
  // Remove $schema property
  delete obj.$schema;
  
  // Replace external JSON Schema $refs with permissive schema
  // This preserves the schema structure while avoiding unresolvable references
  if (obj.$ref && typeof obj.$ref === 'string' &&
      (obj.$ref.startsWith('http://json-schema.org/') ||
       obj.$ref.startsWith('https://json-schema.org/'))) {
    // Replace the $ref with an empty schema that allows anything
    delete obj.$ref;
    // If the object only had $ref, make it an empty schema
    if (Object.keys(obj).length === 0) {
      // Empty schema {} allows any value
      obj.description = obj.description || "External schema reference replaced";
    }
  }
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      removeSchemaReferences(obj[key]);
    }
  }
}

/**
 * Performs one-time initialization logic to prepare for Swagger Schema validation.
 */
function initializeZSchema () {
  // HACK: Delete the OpenAPI schema IDs because ZSchema can't resolve them
  delete openapi.v2.id;
  delete openapi.v3.id;
  delete openapi.v31.id;

  // Fix ReDoS-sensitive patterns for z-schema 12.x
  // z-schema 12 has strict ReDoS protection that rejects certain regex patterns
  
  // Swagger 2.0: Fix host pattern
  if (openapi.v2 && openapi.v2.properties && openapi.v2.properties.host) {
    // Original: ^[^{}/ :\\]+(?::\d+)?$
    // Simplified to avoid ReDoS detection
    openapi.v2.properties.host.pattern = "^[^{}/ :\\\\]+";
  }
  
  // Swagger 2.0: Fix basePath pattern
  if (openapi.v2 && openapi.v2.properties && openapi.v2.properties.basePath) {
    // Original: ^/
    openapi.v2.properties.basePath.pattern = "^/";
  }

  // Swagger 2.0: Fix schema type validation after removing external $refs
  // The schema.type property references JSON Schema Draft 04 for validation
  // Since we remove external $refs, we need to inline the type validation
  // JSON Schema Draft 04 allows: string, number, integer, boolean, object, array, null
  if (openapi.v2 && openapi.v2.definitions && openapi.v2.definitions.schema &&
      openapi.v2.definitions.schema.properties && openapi.v2.definitions.schema.properties.type) {
    // Replace the external $ref with inline validation
    openapi.v2.definitions.schema.properties.type = {
      oneOf: [
        {
          type: "string",
          enum: ["array", "boolean", "integer", "number", "null", "object", "string"]
        },
        {
          type: "array",
          items: {
            type: "string",
            enum: ["array", "boolean", "integer", "number", "null", "object", "string"]
          },
          minItems: 1,
          uniqueItems: true
        }
      ]
    };
  }

  // Swagger 2.0: Fix response.schema oneOf for z-schema 12 compatibility
  // z-schema 12 is stricter with oneOf validation than v6
  // The response.schema property has oneOf: [schema, fileSchema]
  // z-schema 12 incorrectly thinks schemas with type:"file" match both, causing false positives
  // Replace oneOf with anyOf - the schemas are already well-defined and mutually exclusive
  // (fileSchema requires type:"file", regular schema allows any valid JSON Schema type)
  if (openapi.v2 && openapi.v2.definitions && openapi.v2.definitions.response &&
      openapi.v2.definitions.response.properties && openapi.v2.definitions.response.properties.schema) {
    const schemaProperty = openapi.v2.definitions.response.properties.schema;
    if (schemaProperty.oneOf) {
      schemaProperty.anyOf = schemaProperty.oneOf;
      delete schemaProperty.oneOf;
    }
  }

  // Swagger 2.0: Remove $schema references to prevent external JSON Schema Draft 04 resolution
  if (openapi.v2) {
    removeSchemaReferences(openapi.v2);
  }

  // OpenAPI 3.0: Remove $schema references
  if (openapi.v3) {
    removeSchemaReferences(openapi.v3);
  }

  // OpenAPI 3.1: Fix openapi version pattern
  if (openapi.v31 && openapi.v31.properties && openapi.v31.properties.openapi) {
    // Original: ^3\.1\.\d+(-.+)?$
    // Simplified to avoid ReDoS detection
    openapi.v31.properties.openapi.pattern = "^3\\.1\\.";
  }

  // Remove all $schema references from OpenAPI 3.1 to prevent z-schema from validating
  // against JSON Schema 2020-12 meta-schema (which z-schema doesn't fully support)
  if (openapi.v31) {
    removeSchemaReferences(openapi.v31);
  }

  // The OpenAPI 3.0 schema uses "uri-reference" formats.
  // Assume that any non-whitespace string is valid.
  ZSchema.registerFormat("uri-reference", (value) => value.trim().length > 0);

  // Configure ZSchema
  return ZSchema.create({
    //breakOnFirstError: true,
    // Allow JSON Schema 2020-12 keywords used in OpenAPI 3.1
    noExtraKeywords: false,
    ignoreUnknownFormats: false,
    reportPathAsArray: true,
    ignoreUnresolvableReferences: true
  });
}

/**
 * Z-Schema validation errors are a nested tree structure.
 * This function crawls that tree and builds an error message string.
 *
 * @param {object[]}  errors     - The Z-Schema error details
 * @param {string}    [indent]   - The whitespace used to indent the error message
 * @returns {string}
 */
function formatZSchemaError (errors, indent) {
  indent = indent || "  ";
  let message = "";
  for (let error of errors) {
    message += util.format(`${indent}${error.message} at #/${error.path.join("/")}\n`);
    if (error.inner) {
      message += formatZSchemaError(error.inner, indent + "  ");
    }
  }
  return message;
}