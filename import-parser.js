// Import Parser for Test Cases
// Supports multiple file formats and parsing strategies

class ImportParser {
    constructor() {
        this.supportedFormats = ['txt', 'csv'];
    }

    /**
     * Parse imported file content based on format
     * @param {string} content - The file content to parse
     * @param {string} format - The file format (txt, csv)
     * @param {Object} options - Parsing options
     * @returns {Object} Parsed test structure with steps and metadata
     */
    parse(content, format, options = {}) {
        const {
            importType = 'steps', // 'steps', 'tests', or 'both'
            validateSteps = true,
            preserveSections = true
        } = options;

        let parsed;
        
        if (format === 'csv') {
            parsed = this.parseCSV(content, options);
        } else {
            // Default to text format
            parsed = this.parseText(content, options);
        }

        // Apply validation if requested
        if (validateSteps && importType !== 'tests') {
            parsed = this.validateSteps(parsed);
        }

        return parsed;
    }

    /**
     * Parse text format (supports both simple and sectioned formats)
     */
    parseText(content, options = {}) {
        const lines = content.split('\n').map(line => line.trim());
        const result = {
            tests: [],
            sections: [],
            steps: [],
            metadata: {
                format: 'text',
                hasSections: false,
                hasHierarchy: false
            }
        };

        let currentSection = null;
        let currentTest = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Skip empty lines
            if (!line) continue;

            // Check for section headers (lines starting with #)
            if (line.startsWith('#')) {
                const sectionName = line.substring(1).trim();
                currentSection = {
                    name: sectionName,
                    steps: [],
                    lineNumber: i + 1
                };
                result.sections.push(currentSection);
                result.metadata.hasSections = true;
                currentTest = null;
                continue;
            }

            // Check for hierarchical naming (Feature/UserStory/TestCase format)
            if (line.includes('/') && !line.match(/^\d+\./)) {
                const parts = line.split('/').map(p => p.trim());
                if (parts.length >= 2) {
                    const testCase = {
                        hierarchy: parts,
                        feature: parts[0],
                        name: parts[parts.length - 1],
                        fullPath: line,
                        steps: [],
                        lineNumber: i + 1
                    };
                    
                    // Add intermediate levels as metadata
                    if (parts.length > 2) {
                        testCase.subFeatures = parts.slice(1, -1);
                    }
                    
                    result.tests.push(testCase);
                    result.metadata.hasHierarchy = true;
                    currentTest = testCase;
                    continue;
                }
            }

            // Parse numbered steps (1. Step description)
            const numberedMatch = line.match(/^(\d+)\.\s*(.*)$/);
            if (numberedMatch) {
                const step = {
                    number: parseInt(numberedMatch[1]),
                    description: numberedMatch[2],
                    lineNumber: i + 1,
                    section: currentSection ? currentSection.name : null,
                    test: currentTest ? currentTest.name : null
                };

                // Add to appropriate container
                if (currentTest) {
                    currentTest.steps.push(step);
                } else if (currentSection) {
                    currentSection.steps.push(step);
                }
                result.steps.push(step);
                continue;
            }

            // Parse non-numbered lines as test cases or steps
            if (line.length > 0) {
                const item = {
                    description: line,
                    lineNumber: i + 1,
                    section: currentSection ? currentSection.name : null,
                    test: currentTest ? currentTest.name : null
                };

                // If we're within a test context, treat as a step
                if (currentTest) {
                    item.isStep = true;
                    currentTest.steps.push(item);
                    result.steps.push(item);
                } else if (currentSection) {
                    // Within a section but no explicit test - treat as step
                    item.isStep = true;
                    currentSection.steps.push(item);
                    result.steps.push(item);
                } else {
                    // Standalone line - could be a test case name
                    result.tests.push({
                        name: line,
                        description: line,
                        steps: [],
                        lineNumber: i + 1
                    });
                }
            }
        }

        return result;
    }

    /**
     * Parse CSV format
     * Expected columns: Feature, UserStory, TestCase, Step, Description
     */
    parseCSV(content, options = {}) {
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        const result = {
            tests: [],
            sections: [],
            steps: [],
            metadata: {
                format: 'csv',
                hasSections: false,
                hasHierarchy: false
            }
        };

        if (lines.length === 0) return result;

        // Parse header
        const header = this.parseCSVLine(lines[0]);
        const columnMap = this.mapCSVColumns(header);

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === 0) continue;

            // Build hierarchical structure using column indexes
            const feature = columnMap.feature >= 0 ? values[columnMap.feature] : '';
            const userStory = columnMap.userstory >= 0 ? values[columnMap.userstory] : '';
            const testCase = columnMap.testcase >= 0 ? values[columnMap.testcase] : '';
            const stepNum = columnMap.step >= 0 ? values[columnMap.step] : '';
            const description = columnMap.description >= 0 ? values[columnMap.description] : '';

            // Create or find test case
            let test = result.tests.find(t => 
                t.feature === feature && 
                t.userStory === userStory && 
                t.name === testCase
            );

            if (!test && (feature || userStory || testCase)) {
                test = {
                    feature,
                    userStory,
                    name: testCase || `Test ${i}`,
                    hierarchy: [feature, userStory, testCase].filter(Boolean),
                    fullPath: [feature, userStory, testCase].filter(Boolean).join('/'),
                    steps: [],
                    lineNumber: i + 1
                };
                result.tests.push(test);
                result.metadata.hasHierarchy = true;
            }

            // Add step if description exists
            if (description) {
                const step = {
                    number: stepNum ? parseInt(stepNum) : null,
                    description,
                    lineNumber: i + 1,
                    feature,
                    userStory,
                    test: testCase
                };

                if (test) {
                    test.steps.push(step);
                }
                result.steps.push(step);
            }
        }

        return result;
    }

    /**
     * Parse a single CSV line handling quoted values
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = i + 1 < line.length ? line[i + 1] : null;
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i++;
                } else {
                    // Toggle quote mode
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    /**
     * Map CSV columns to expected fields
     */
    mapCSVColumns(header) {
        const map = {};
        const lowerHeader = header.map(h => h.toLowerCase());

        // Map common variations
        map.feature = lowerHeader.findIndex(h => h.includes('feature') || h === 'module');
        map.userstory = lowerHeader.findIndex(h => h.includes('story') || h.includes('user'));
        map.testcase = lowerHeader.findIndex(h => h.includes('test') || h.includes('case'));
        map.step = lowerHeader.findIndex(h => h.includes('step') || h === '#' || h === 'no');
        map.description = lowerHeader.findIndex(h => 
            h.includes('description') || 
            h.includes('detail') || 
            h === 'step description' ||
            h.includes('action')
        );

        // Only use last column as fallback if we found at least some other columns
        if (map.description === -1) {
            const foundColumns = [map.feature, map.userstory, map.testcase, map.step].filter(idx => idx !== -1);
            if (foundColumns.length > 0) {
                map.description = header.length - 1;
            }
        }

        return map;
    }

    /**
     * Validate parsed steps
     */
    validateSteps(parsed) {
        const validation = {
            errors: [],
            warnings: [],
            valid: true
        };

        // Check for empty steps
        parsed.steps.forEach((step, idx) => {
            if (!step.description || step.description.trim().length === 0) {
                validation.errors.push({
                    line: step.lineNumber || idx + 1,
                    message: 'Step has no description'
                });
                validation.valid = false;
            }
        });

        // Check for duplicate step numbers within sections
        const numbersBySection = {};
        parsed.steps.forEach(step => {
            if (step.number) {
                const section = step.section || 'default';
                if (!numbersBySection[section]) {
                    numbersBySection[section] = new Set();
                }
                if (numbersBySection[section].has(step.number)) {
                    validation.warnings.push({
                        line: step.lineNumber,
                        message: `Duplicate step number ${step.number} in section "${section}"`
                    });
                }
                numbersBySection[section].add(step.number);
            }
        });

        parsed.validation = validation;
        return parsed;
    }

    /**
     * Convert parsed data to test steps format
     */
    convertToTestSteps(parsed, options = {}) {
        const {
            importType = 'steps',
            status = 'pending',
            markAsFromScript = true
        } = options;

        const steps = [];
        let idCounter = Date.now();

        if (importType === 'steps' || importType === 'both') {
            // Import individual steps
            parsed.steps.forEach(step => {
                steps.push({
                    id: idCounter++, // Use incrementing counter for unique IDs
                    description: step.description,
                    status: status,
                    screenshots: [],
                    fromScript: markAsFromScript,
                    metadata: {
                        section: step.section,
                        test: step.test,
                        feature: step.feature,
                        userStory: step.userStory,
                        lineNumber: step.lineNumber,
                        stepNumber: step.number
                    }
                });
            });
        }

        if (importType === 'tests' || importType === 'both') {
            // Import test cases as steps
            parsed.tests.forEach(test => {
                const description = test.fullPath || test.name;
                steps.push({
                    id: idCounter++, // Use incrementing counter for unique IDs
                    description: description,
                    status: status,
                    screenshots: [],
                    fromScript: markAsFromScript,
                    isTestCase: true,
                    metadata: {
                        feature: test.feature,
                        userStory: test.userStory,
                        hierarchy: test.hierarchy,
                        lineNumber: test.lineNumber,
                        stepCount: test.steps ? test.steps.length : 0
                    }
                });
            });
        }

        return steps;
    }

    /**
     * Generate template files
     */
    generateTemplate(format = 'txt') {
        if (format === 'csv') {
            return this.generateCSVTemplate();
        }
        return this.generateTextTemplate();
    }

    generateTextTemplate() {
        return `# Sample Test Script Template

# Feature/User Story Format Examples
# You can use hierarchical naming to organize tests
Feature Name/User Story/Test Case Name
Feature Name/Login/Valid Credentials
Feature Name/Login/Invalid Credentials
Feature Name/Profile/Update Information

# Traditional Numbered Steps Format
# Login Functionality Testing
1. Navigate to the login page
2. Verify login form is displayed correctly
3. Test with valid credentials
4. Verify successful login redirect
5. Test with invalid credentials
6. Verify error message display
7. Test password reset functionality

# Product Search and Browse
8. Navigate to product catalog
9. Test search functionality with valid product name
10. Verify search results are relevant
11. Test filtering options (price, category, brand)
12. Test sorting options (price, popularity, ratings)
13. Verify product details page loads correctly

# You can also mix formats - sections with steps
# Shopping Cart Functionality
14. Add product to cart from product page
15. Verify cart counter updates
16. Navigate to shopping cart
17. Verify product appears in cart
18. Test quantity adjustment
19. Test item removal from cart

# Notes:
# - Lines starting with # are section headers
# - Lines with numbers (1., 2., etc.) are test steps
# - Lines with / (Feature/Story/Test) are hierarchical test cases
# - Blank lines are ignored
# - You can mix different formats as needed`;
    }

    generateCSVTemplate() {
        return `Feature,User Story,Test Case,Step,Step Description
Login,User Login,Valid Login,1,Navigate to login page
Login,User Login,Valid Login,2,Enter valid username
Login,User Login,Valid Login,3,Enter valid password
Login,User Login,Valid Login,4,Click login button
Login,User Login,Valid Login,5,Verify successful redirect to dashboard
Login,User Login,Invalid Login,1,Navigate to login page
Login,User Login,Invalid Login,2,Enter invalid credentials
Login,User Login,Invalid Login,3,Click login button
Login,User Login,Invalid Login,4,Verify error message is displayed
Search,Product Search,Search by Name,1,Navigate to search page
Search,Product Search,Search by Name,2,Enter product name in search box
Search,Product Search,Search by Name,3,Click search button
Search,Product Search,Search by Name,4,Verify relevant results are displayed
Search,Product Search,Filter Results,1,Perform a search
Search,Product Search,Filter Results,2,Apply price filter
Search,Product Search,Filter Results,3,Verify filtered results
Search,Product Search,Filter Results,4,Apply category filter
Search,Product Search,Filter Results,5,Verify category filtered results
Cart,Shopping Cart,Add to Cart,1,Select a product
Cart,Shopping Cart,Add to Cart,2,Click add to cart button
Cart,Shopping Cart,Add to Cart,3,Verify cart icon updates
Cart,Shopping Cart,Add to Cart,4,Navigate to cart
Cart,Shopping Cart,Add to Cart,5,Verify product is in cart

# Notes:
# - First row is the header (Feature, User Story, Test Case, Step, Step Description)
# - Each subsequent row represents a test step
# - Feature: The high-level feature being tested
# - User Story: The user story or subfeature
# - Test Case: The specific test case name
# - Step: The step number within the test case
# - Step Description: The detailed description of what to test`;
    }
}

// Export for use in popup.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImportParser;
}
