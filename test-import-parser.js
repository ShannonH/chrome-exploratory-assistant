const ImportParser = require('./import-parser.js');

console.log('=== Import Parser Tests ===\n');

const parser = new ImportParser();
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ PASS:', name);
        passed++;
    } catch (error) {
        console.log('❌ FAIL:', name);
        console.log('   Error:', error.message);
        failed++;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// Test 1: Simple numbered steps
test('Simple Numbered Steps', () => {
    const input = `1. First step
2. Second step
3. Third step`;
    const result = parser.parse(input, 'txt', { importType: 'steps' });
    assert(result.steps.length === 3, 'Should parse 3 steps');
    assert(result.steps[0].description === 'First step', 'First step description should match');
});

// Test 2: Section headers
test('Section Headers', () => {
    const input = `# Login Tests
1. Navigate to login
2. Enter credentials

# Profile Tests
3. Update profile`;
    const result = parser.parse(input, 'txt', { importType: 'steps' });
    assert(result.sections.length === 2, 'Should find 2 sections');
    assert(result.steps.length === 3, 'Should parse 3 steps');
});

// Test 3: Hierarchical naming
test('Hierarchical Naming', () => {
    const input = `Feature/Login/Valid Credentials
Feature/Login/Invalid Password`;
    const result = parser.parse(input, 'txt', { importType: 'tests' });
    assert(result.tests.length === 2, 'Should parse 2 test cases');
    assert(result.tests[0].hierarchy.length === 3, 'Should have 3 hierarchy levels');
});

// Test 4: CSV format
test('CSV Format', () => {
    const input = `Feature,User Story,Test Case,Step,Step Description
Login,User Auth,Valid Login,1,Enter username
Login,User Auth,Valid Login,2,Enter password`;
    const result = parser.parse(input, 'csv', { importType: 'steps' });
    assert(result.steps.length === 2, 'Should parse 2 steps');
    assert(result.steps[0].description === 'Enter username', 'First step description should match');
});

// Test 5: Convert to test steps
test('Convert to Test Steps', () => {
    const input = `1. First step
2. Second step`;
    const parsed = parser.parse(input, 'txt', { importType: 'steps' });
    const steps = parser.convertToTestSteps(parsed, { status: 'pending', markAsFromScript: true });
    assert(steps.length === 2, 'Should convert 2 steps');
    assert(steps[0].status === 'pending', 'Status should be pending');
    assert(steps[0].fromScript === true, 'Should mark as from script');
});

// Test 6: Template generation
test('Template Generation', () => {
    const txtTemplate = parser.generateTemplate('txt');
    const csvTemplate = parser.generateTemplate('csv');
    assert(txtTemplate.length > 100, 'TXT template should have content');
    assert(csvTemplate.length > 100, 'CSV template should have content');
    assert(txtTemplate.includes('#'), 'TXT template should include sections');
    assert(csvTemplate.includes('Feature,'), 'CSV template should include headers');
});

// Test 7: Backward compatibility
test('Backward Compatibility', () => {
    const oldInput = `1. Navigate to login page
2. Enter valid credentials`;
    const result = parser.parse(oldInput, 'txt', { importType: 'steps' });
    const steps = parser.convertToTestSteps(result, { status: 'pending' });
    assert(steps.length === 2, 'Should parse old format');
    assert(steps[0].description === 'Navigate to login page', 'Description should match');
});

// Test 8: Empty input
test('Empty Input', () => {
    const result = parser.parse('', 'txt', { importType: 'steps' });
    assert(result.steps.length === 0, 'Empty input should produce no steps');
});

// Test 9: Mixed format
test('Mixed Format', () => {
    const input = `# Section
Feature/Test/Case
1. Step one`;
    const result = parser.parse(input, 'txt', { importType: 'both' });
    assert(result.sections.length === 1, 'Should have 1 section');
    assert(result.tests.length === 1, 'Should have 1 test');
    assert(result.steps.length === 1, 'Should have 1 step');
});

// Test 10: Validation
test('Validation', () => {
    const input = `1. Valid step
2. 
3. Another step`;
    const result = parser.parse(input, 'txt', { validateSteps: true });
    assert(result.validation.errors.length > 0, 'Should detect validation errors');
    assert(!result.validation.valid, 'Should be marked as invalid');
});

console.log(`\n=== Test Results ===`);
console.log(`Total: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

process.exit(failed > 0 ? 1 : 0);
