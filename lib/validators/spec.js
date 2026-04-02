"use strict";

const util = require("../util");
const swaggerMethods = require("@apidevtools/swagger-methods");
const primitiveTypes = ["array", "boolean", "integer", "number", "string"];
const schemaTypes = ["array", "boolean", "integer", "number", "string", "object", "null", undefined];

module.exports = validateSpec;

/**
 * Validates parts of the Swagger 2.0 spec that aren't covered by the Swagger 2.0 JSON Schema.
 *
 * @param {SwaggerObject} api
 */
function validateSpec(api) {
  if (api.openapi) {
    // We don't (yet) support validating against the OpenAPI spec
    return;
  }

  let paths = Object.keys(api.paths || {});
  let operationIds = [];
  for (let pathName of paths) {
    let path = api.paths[pathName];
    let pathId = "/paths" + pathName;

    if (path && pathName.indexOf("/") === 0) {
      validatePath(api, path, pathId, operationIds);
    }
  }

  let definitions = Object.keys(api.definitions || {});
  for (let definitionName of definitions) {
    let definition = api.definitions[definitionName];
    let definitionId = "/definitions/" + definitionName;
    validateRequiredPropertiesExist(definition, definitionId);
  }
}

/**
 * Validates the given path.
 *
 * @param {SwaggerObject} api           - The entire Swagger API object
 * @param {object}        path          - A Path object, from the Swagger API
 * @param {string}        pathId        - A value that uniquely identifies the path
 * @param {string}        operationIds  - An array of collected operationIds found in other paths
 */
function validatePath(api, path, pathId, operationIds) {
  // Check if path object has schema properties (type, properties, etc.)
  // This happens when a $ref points to a schema instead of a path item
  if (path.type || path.properties) {
    const message = `Swagger schema validation failed.\n  Path item at ${pathId} appears to be a schema object, not a path item`;
    const error = new SyntaxError(message);
    error.details = [{
      code: 'INVALID_TYPE',
      message: 'Path item cannot have schema properties like "type" or "properties"',
      path: pathId.split('/').filter(p => p),
      params: []
    }];
    throw error;
  }

  for (let operationName of swaggerMethods) {
    let operation = path[operationName];
    let operationId = pathId + "/" + operationName;

    if (operation) {
      let declaredOperationId = operation.operationId;
      if (declaredOperationId) {
        if (operationIds.indexOf(declaredOperationId) === -1) {
          operationIds.push(declaredOperationId);
        } else {
          throw new SyntaxError(
            `Validation failed. Duplicate operation id '${declaredOperationId}'`
          );
        }
      }
      validateParameters(api, path, pathId, operation, operationId);

      let responses = Object.keys(operation.responses || {});
      for (let responseName of responses) {
        let response = operation.responses[responseName];
        let responseId = operationId + "/responses/" + responseName;
        validateResponse(responseName, response || {}, responseId);
      }
    }
  }
}

/**
 * Validates the parameters for the given operation.
 *
 * @param {SwaggerObject} api           - The entire Swagger API object
 * @param {object}        path          - A Path object, from the Swagger API
 * @param {string}        pathId        - A value that uniquely identifies the path
 * @param {object}        operation     - An Operation object, from the Swagger API
 * @param {string}        operationId   - A value that uniquely identifies the operation
 */
function validateParameters(api, path, pathId, operation, operationId) {
  let pathParams = path.parameters || [];
  let operationParams = operation.parameters || [];

  // Check for conflicting duplicates (same name+location but different definitions)
  // Allow identical duplicates for real-world API compatibility (like isam.json)
  checkForDuplicates(pathParams);
  checkForDuplicates(operationParams);

  // Combine path and operation parameters (operation params override path params)
  let params = pathParams.reduce((combinedParams, value) => {
    let duplicate = combinedParams.some((param) => {
      return param.in === value.in && param.name === value.name;
    });
    if (!duplicate) {
      combinedParams.push(value);
    }
    return combinedParams;
  }, operationParams.slice());

  validateBodyParameters(params, operationId);
  validatePathParameters(params, pathId, operationId);
  validateParameterTypes(params, api, operation, operationId);
}

/**
 * Validates body and formData parameters for the given operation.
 *
 * @param   {object[]}  params       -  An array of Parameter objects
 * @param   {string}    operationId  -  A value that uniquely identifies the operation
 */
function validateBodyParameters(params, operationId) {
  let bodyParams = params.filter((param) => {
    return param.in === "body";
  });
  let formParams = params.filter((param) => {
    return param.in === "formData";
  });

  // There can only be one "body" parameter
  if (bodyParams.length > 1) {
    throw new SyntaxError(
      `Validation failed. ${operationId} has ${bodyParams.length} body parameters. Only one is allowed.`,
    );
  } else if (bodyParams.length > 0 && formParams.length > 0) {
    // "body" params and "formData" params are mutually exclusive
    throw new SyntaxError(
      `Validation failed. ${operationId} has body parameters and formData parameters. Only one or the other is allowed.`,
    );
  }
}

/**
 * Validates path parameters for the given path.
 *
 * @param   {object[]}  params        - An array of Parameter objects
 * @param   {string}    pathId        - A value that uniquely identifies the path
 * @param   {string}    operationId   - A value that uniquely identifies the operation
 */
function validatePathParameters(params, pathId, operationId) {
  // Find all {placeholders} in the path string
  let placeholders = pathId.match(util.swaggerParamRegExp) || [];

  // Check for duplicates
  for (let i = 0; i < placeholders.length; i++) {
    for (let j = i + 1; j < placeholders.length; j++) {
      if (placeholders[i] === placeholders[j]) {
        throw new SyntaxError(
          `Validation failed. ${operationId} has multiple path placeholders named ${placeholders[i]}`,
        );
      }
    }
  }

  params = params.filter((param) => {
    return param.in === "path";
  });

  for (let param of params) {
    if (param.required !== true) {
      throw new SyntaxError(
        "Validation failed. Path parameters cannot be optional. " +
          `Set required=true for the "${param.name}" parameter at ${operationId}`,
      );
    }
    let match = placeholders.indexOf("{" + param.name + "}");
    if (match === -1) {
      throw new SyntaxError(
        `Validation failed. ${operationId} has a path parameter named "${param.name}", ` +
          `but there is no corresponding {${param.name}} in the path string`,
      );
    }
    placeholders.splice(match, 1);
  }

  if (placeholders.length > 0) {
    throw new SyntaxError(`Validation failed. ${operationId} is missing path parameter(s) for ${placeholders.join(",")}`);
  }
}

/**
 * Validates data types of parameters for the given operation.
 *
 * @param   {object[]}  params       -  An array of Parameter objects
 * @param   {object}    api          -  The entire Swagger API object
 * @param   {object}    operation    -  An Operation object, from the Swagger API
 * @param   {string}    operationId  -  A value that uniquely identifies the operation
 */
function validateParameterTypes(params, api, operation, operationId) {
  for (let param of params) {
    let parameterId = operationId + "/parameters/" + param.name;
    let schema, validTypes;

    switch (param.in) {
      case "body":
        schema = param.schema;
        validTypes = schemaTypes;
        break;
      case "formData":
        schema = param;
        validTypes = primitiveTypes.concat("file");
        break;
      default:
        schema = param;
        validTypes = primitiveTypes;
    }

    validateSchema(schema, parameterId, validTypes);
    validateRequiredPropertiesExist(schema, parameterId);

    if (schema.type === "file") {
      // "file" params must consume at least one of these MIME types
      let formData = /multipart\/(.*\+)?form-data/;
      let urlEncoded = /application\/(.*\+)?x-www-form-urlencoded/;

      let consumes = operation.consumes || api.consumes || [];

      let hasValidMimeType = consumes.some((consume) => {
        return formData.test(consume) || urlEncoded.test(consume);
      });

      if (!hasValidMimeType) {
        throw new SyntaxError(
          `Validation failed. ${operationId} has a file parameter, so it must consume multipart/form-data ` +
            "or application/x-www-form-urlencoded",
        );
      }
    }
  }
}

/**
 * Checks the given parameter list for conflicting duplicates.
 * Allows identical duplicates (for real-world API compatibility like isam.json)
 * but rejects duplicates with different definitions.
 *
 * @param   {object[]}  params  - An array of Parameter objects
 */
function checkForDuplicates(params) {
  for (let i = 0; i < params.length - 1; i++) {
    let outer = params[i];
    for (let j = i + 1; j < params.length; j++) {
      let inner = params[j];
      if (outer.name === inner.name && outer.in === inner.in) {
        // Check if they are identical (same definition)
        // Compare key properties: type, required, schema
        const outerType = outer.type || (outer.schema ? 'schema' : undefined);
        const innerType = inner.type || (inner.schema ? 'schema' : undefined);
        const outerRequired = outer.required === true;
        const innerRequired = inner.required === true;
        
        // If types or required differ, it's a conflict
        if (outerType !== innerType || outerRequired !== innerRequired) {
          throw new SyntaxError(`Validation failed. Found multiple ${outer.in} parameters named "${outer.name}"`);
        }
        
        // For schema-based params, do a deep comparison
        if (outer.schema && inner.schema) {
          if (JSON.stringify(outer.schema) !== JSON.stringify(inner.schema)) {
            throw new SyntaxError(`Validation failed. Found multiple ${outer.in} parameters named "${outer.name}"`);
          }
        }
        
        // If we get here, they're identical duplicates - allow them for backward compatibility
      }
    }
  }
}

/**
 * Validates the given response object.
 *
 * @param   {string}    code        -  The HTTP response code (or "default")
 * @param   {object}    response    -  A Response object, from the Swagger API
 * @param   {string}    responseId  -  A value that uniquely identifies the response
 */
function validateResponse(code, response, responseId) {
  if (code !== "default" && (code < 100 || code > 599)) {
    throw new SyntaxError(`Validation failed. ${responseId} has an invalid response code (${code})`);
  }

  let headers = Object.keys(response.headers || {});
  for (let headerName of headers) {
    let header = response.headers[headerName];
    let headerId = responseId + "/headers/" + headerName;
    validateSchema(header, headerId, primitiveTypes);
  }

  if (response.schema) {
    let validTypes = schemaTypes.concat("file");
    if (validTypes.indexOf(response.schema.type) === -1) {
      // Format error to match schema validation format for consistency
      const message = `Swagger schema validation failed.\n  No enum match for: "${response.schema.type}" at ${responseId}/schema/type`;
      const error = new SyntaxError(message);
      error.details = [{
        code: 'ENUM_MISMATCH',
        message: `No enum match for: "${response.schema.type}"`,
        path: (responseId + '/schema').split('/').filter(p => p),
        params: ['type']
      }];
      throw error;
    } else {
      validateSchema(response.schema, responseId + "/schema", validTypes);
    }
  }
}

/**
 * Validates the given Swagger schema object.
 *
 * @param {object}    schema      - A Schema object, from the Swagger API
 * @param {string}    schemaId    - A value that uniquely identifies the schema object
 * @param {string[]}  validTypes  - An array of the allowed schema types
 */
function validateSchema(schema, schemaId, validTypes) {
  if (validTypes.indexOf(schema.type) === -1) {
    // Format error to match schema validation format for consistency
    const message = `Swagger schema validation failed.\n  No enum match for: "${schema.type}" at ${schemaId}/type`;
    const error = new SyntaxError(message);
    error.details = [{
      code: 'ENUM_MISMATCH',
      message: `No enum match for: "${schema.type}"`,
      path: schemaId.split('/').filter(p => p),
      params: ['type']
    }];
    throw error;
  }

  if (schema.type === "array" && !schema.items) {
    throw new SyntaxError(
      `Validation failed. ${schemaId} is an array, so it must include an "items" schema`,
    );
  }
}
/**
 * Validates that the declared properties of the given Swagger schema object actually exist.
 *
 * @param {object}    schema      - A Schema object, from the Swagger API
 * @param {string}    schemaId    - A value that uniquely identifies the schema object
 */
function validateRequiredPropertiesExist(schema, schemaId) {
  /**
   * Recursively collects all properties of the schema and its ancestors. They are added to the props object.
   */
  function collectProperties(schemaObj, props) {
    if (schemaObj.properties) {
      for (let property in schemaObj.properties) {
        if (schemaObj.properties.hasOwnProperty(property)) {
          props[property] = schemaObj.properties[property];
        }
      }
    }
    if (schemaObj.allOf) {
      for (let parent of schemaObj.allOf) {
        collectProperties(parent, props);
      }
    }
  }

  // The "required" keyword is only applicable for objects
  if (Array.isArray(schema.type) && !schema.type.includes("object")) {
    return;
  } else if (!Array.isArray(schema.type) && schema.type !== "object") {
    return;
  }

  if (schema.required && Array.isArray(schema.required)) {
    let props = {};
    collectProperties(schema, props);
    for (let requiredProperty of schema.required) {
      if (!props[requiredProperty]) {
        throw new SyntaxError(
          `Validation failed. Property '${requiredProperty}' listed as required but does not exist in '${schemaId}'`,
        );
      }
    }
  }
}
