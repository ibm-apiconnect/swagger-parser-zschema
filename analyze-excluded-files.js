const SwaggerParser = require('./lib/index.js');
const fs = require('fs');
const path = require('path');

const testDir = './lib/validators/test';

const EXCLUDED_FILES = [
  // AsyncAPI files (not Swagger/OpenAPI)
  'async-v3.json',
  'basic_asyncapi.json',
  'custom-schema-async-v3.json',
  'deep-local-async-v3.json',
  'ebay_marketplace_account_deletion.json',
  'ibmmq.json',
  'mixed-param-async-v3.json',
  'reference-async-v3.json',
  'sample-async-v3.json',
  'servers-async-v3.json',
  'streetlights.json',
  'weather-event.json',
  
  // Intentionally invalid files
  'invalid-items-endpoint.json',
  'apim.json',
  'isam.json',
  
  // Files with missing external references
  'dcsa.json',
  'petstore.json',
  'items-endpoint-v3.1.json',
  'items-endpoint-v3.json',
  'items-endpoint.json',
  'extensions.json',
  'openapi3.json',
  
  // Files with known schema issues
  'api-with-docs.json',
  'enumreq.json',
  'personality.json',
  'types.json',
  'petstore-v3.json',
  
  // Security scheme issues
  'digest-security.json',
  'hoba-security.json',
  'jwt-security.json',
  'mutual-security.json',
  'negotiate-security.json',
  'no-security-scheme.json',
  'scram-sha-security.json',
  'vapid-security.json',
];

async function analyzeFile(filePath, fileName) {
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Check if it's AsyncAPI
    if (content.asyncapi) {
      return {
        file: fileName,
        reason: 'AsyncAPI',
        version: content.asyncapi,
        legitimate: true,
        note: 'Not a Swagger/OpenAPI spec'
      };
    }
    
    // Try to validate
    try {
      await SwaggerParser.validate(filePath);
      return {
        file: fileName,
        reason: 'PASSES',
        legitimate: false,
        note: 'This file actually passes validation! Should not be excluded.'
      };
    } catch (err) {
      // Analyze the error
      const errorMsg = err.message;
      
      if (errorMsg.includes('ENOENT') || errorMsg.includes('no such file')) {
        return {
          file: fileName,
          reason: 'Missing external file',
          legitimate: true,
          note: 'References external files that don\'t exist',
          error: errorMsg.split('\n')[0]
        };
      }
      
      if (errorMsg.includes('Duplicate operation id')) {
        return {
          file: fileName,
          reason: 'Duplicate operation IDs',
          legitimate: true,
          note: 'Intentionally invalid - has duplicate operation IDs',
          error: errorMsg.split('\n')[0]
        };
      }
      
      if (errorMsg.includes('path parameter') && errorMsg.includes('no corresponding')) {
        return {
          file: fileName,
          reason: 'Invalid path parameters',
          legitimate: true,
          note: 'Path parameters don\'t match placeholders',
          error: errorMsg.split('\n')[0]
        };
      }
      
      if (errorMsg.includes('Additional properties not allowed')) {
        return {
          file: fileName,
          reason: 'Invalid schema structure',
          legitimate: true,
          note: 'Has properties not allowed by OpenAPI schema',
          error: errorMsg.split('\n')[0]
        };
      }
      
      if (errorMsg.includes('Data does not match any schemas from')) {
        return {
          file: fileName,
          reason: 'Schema validation failure',
          legitimate: 'NEEDS_REVIEW',
          note: 'May be valid but uses features z-schema doesn\'t recognize',
          error: errorMsg.substring(0, 150)
        };
      }
      
      if (errorMsg.includes('Missing $ref pointer')) {
        return {
          file: fileName,
          reason: 'Broken $ref',
          legitimate: true,
          note: 'References definitions that don\'t exist',
          error: errorMsg.split('\n')[0]
        };
      }
      
      return {
        file: fileName,
        reason: 'Other error',
        legitimate: 'NEEDS_REVIEW',
        note: 'Needs manual review',
        error: errorMsg.substring(0, 150)
      };
    }
  } catch (err) {
    return {
      file: fileName,
      reason: 'Parse error',
      legitimate: true,
      note: 'Cannot parse JSON',
      error: err.message
    };
  }
}

async function main() {
  console.log('Analyzing excluded files...\n');
  console.log('='.repeat(100));
  
  const results = [];
  
  for (const file of EXCLUDED_FILES) {
    const filePath = path.join(testDir, file);
    if (!fs.existsSync(filePath)) {
      results.push({
        file,
        reason: 'File not found',
        legitimate: true,
        note: 'File does not exist'
      });
      continue;
    }
    
    const result = await analyzeFile(filePath, file);
    results.push(result);
  }
  
  // Group by legitimacy
  const legitimate = results.filter(r => r.legitimate === true);
  const needsReview = results.filter(r => r.legitimate === 'NEEDS_REVIEW');
  const shouldNotBeExcluded = results.filter(r => r.legitimate === false);
  
  console.log('\n✅ LEGITIMATELY EXCLUDED (' + legitimate.length + ' files):\n');
  legitimate.forEach(r => {
    console.log(`  ${r.file}`);
    console.log(`    Reason: ${r.reason}`);
    console.log(`    Note: ${r.note}`);
    if (r.error) console.log(`    Error: ${r.error}`);
    console.log();
  });
  
  if (needsReview.length > 0) {
    console.log('\n⚠️  NEEDS REVIEW (' + needsReview.length + ' files):\n');
    needsReview.forEach(r => {
      console.log(`  ${r.file}`);
      console.log(`    Reason: ${r.reason}`);
      console.log(`    Note: ${r.note}`);
      if (r.error) console.log(`    Error: ${r.error}`);
      console.log();
    });
  }
  
  if (shouldNotBeExcluded.length > 0) {
    console.log('\n❌ SHOULD NOT BE EXCLUDED (' + shouldNotBeExcluded.length + ' files):\n');
    shouldNotBeExcluded.forEach(r => {
      console.log(`  ${r.file}`);
      console.log(`    Note: ${r.note}`);
      console.log();
    });
  }
  
  console.log('='.repeat(100));
  console.log('\nSummary:');
  console.log(`  Legitimately excluded: ${legitimate.length}`);
  console.log(`  Needs review: ${needsReview.length}`);
  console.log(`  Should NOT be excluded: ${shouldNotBeExcluded.length}`);
  console.log();
}

main().catch(console.error);

// Made with Bob
