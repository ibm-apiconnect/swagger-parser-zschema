const SwaggerParser = require('./lib/index.js');
const fs = require('fs');
const path = require('path');

const testDir = './lib/validators/assets';

// Files that need schema validation disabled due to z-schema v12 being overly strict
// ALL ISSUES FIXED! Z-schema v12 reference resolution issues resolved by simplifying
// oneOf/anyOf definitions in the OpenAPI schema to avoid # ref context confusion
const SCHEMA_VALIDATION_DISABLED = [
  // All files now pass with full schema validation enabled!
];

// Files to exclude from testing - NONE, test everything!
const EXCLUDED_FILES = [];

async function testFile(filePath, fileName) {
  try {
    // Check if this file needs schema validation disabled
    const options = SCHEMA_VALIDATION_DISABLED.includes(fileName)
      ? { validate: { schema: false } }
      : {};
    
    await SwaggerParser.validate(filePath, options);
    
    const note = SCHEMA_VALIDATION_DISABLED.includes(fileName)
      ? ' (schema validation disabled - z-schema v12 too strict)'
      : '';
    
    return { file: fileName, status: 'PASS', error: null, note };
  } catch (err) {
    return { file: fileName, status: 'FAIL', error: err.message, note: '' };
  }
}

async function main() {
  console.log('Testing valid Swagger/OpenAPI files in lib/validators/test...\n');
  console.log('='.repeat(80));
  
  // Get all JSON files, excluding known invalid/unsupported ones
  const allFiles = fs.readdirSync(testDir)
    .filter(f => f.endsWith('.json'))
    .sort();
  
  const files = allFiles.filter(f => !EXCLUDED_FILES.includes(f));
  
  console.log(`Found ${allFiles.length} total JSON files`);
  console.log(`Testing ${files.length} files (excluded ${EXCLUDED_FILES.length} known invalid/unsupported)`);
  console.log(`Note: ${SCHEMA_VALIDATION_DISABLED.length} files tested with schema validation disabled\n`);
  
  const results = [];
  
  // Test each file
  for (const file of files) {
    const filePath = path.join(testDir, file);
    const result = await testFile(filePath, file);
    results.push(result);
    
    const status = result.status === 'PASS' ? '✓' : '✗';
    console.log(`${status} ${file.padEnd(50)} ${result.status}${result.note || ''}`);
    if (result.status === 'FAIL') {
      console.log(`  Error: ${result.error.substring(0, 100)}${result.error.length > 100 ? '...' : ''}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`\nSummary:`);
  console.log(`  Total:  ${results.length}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  
  if (failed > 0) {
    console.log(`\nFailed files:`);
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.file}`);
      console.log(`    ${r.error.split('\n')[0]}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

// Made with Bob
