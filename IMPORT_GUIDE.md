# Import Functionality Guide

## Overview
The Chrome Exploratory Testing Assistant now supports enhanced import functionality for test cases, allowing you to work with multiple file formats and organizational structures.

## Supported File Formats

### 1. Plain Text (.txt, .md)
Text files support multiple formatting styles:

#### Numbered Steps
```
1. Navigate to login page
2. Enter valid credentials
3. Click login button
4. Verify successful redirect
```

#### Section Headers
Use `#` to denote sections:
```
# Login Testing
1. Navigate to login page
2. Enter credentials

# Profile Management
3. Navigate to profile
4. Update information
```

#### Hierarchical Naming
Use `/` separators for feature/story/test organization:
```
Feature/Login/Valid Credentials
Feature/Login/Invalid Password
Feature/Profile/Update Information
```

#### Mixed Format
You can combine all formats in a single file:
```
# User Authentication
Feature/Login/Valid Login
1. Navigate to login page
2. Enter valid username
3. Enter valid password
```

### 2. CSV Format (.csv)
Structured format with columns:
- **Feature**: High-level feature name
- **User Story**: User story or subfeature
- **Test Case**: Specific test case name
- **Step**: Step number
- **Step Description**: Detailed step description

Example:
```csv
Feature,User Story,Test Case,Step,Step Description
Login,User Login,Valid Login,1,Navigate to login page
Login,User Login,Valid Login,2,Enter valid credentials
Login,User Login,Valid Login,3,Click login button
```

## Import Options

### Import Type
Choose what to import:

1. **Import Steps Only** (Default)
   - Imports individual test steps
   - Each step becomes an executable item
   - Best for step-by-step testing

2. **Import Test Cases Only**
   - Imports test cases as single items
   - Useful for high-level test tracking
   - No individual step breakdown

3. **Import Both**
   - Imports both test cases and their steps
   - Provides complete hierarchy
   - Most comprehensive option

### Validation Options

#### Validate Steps on Import
- Checks for empty descriptions
- Identifies duplicate step numbers
- Warns about formatting issues
- Enabled by default

#### Preserve Section Information
- Maintains section/feature metadata
- Links steps to their parent sections
- Useful for reporting and organization
- Enabled by default

## How to Use

### Basic Import Process

1. **Navigate to Test Script Tab**
   - Click on "Test Script" tab in the extension

2. **Choose Import Method**
   - Upload a file (drag & drop or click to browse)
   - Paste content directly into the text area

3. **Configure Import Options**
   - Select import type (steps, tests, or both)
   - Choose validation preferences

4. **Load Script**
   - Click "Load Script" button
   - Review any validation messages
   - Imported items appear in Test Session tab

### Using Templates

1. **Download Template**
   - Click "Download Template" button
   - Choose format (Text or CSV)
   - Template file downloads automatically

2. **Customize Template**
   - Open template in your preferred editor
   - Add your test cases and steps
   - Follow the format examples

3. **Import Your File**
   - Upload the customized file
   - Configure import options
   - Load the script

## Best Practices

### File Organization

1. **Use Sections for Clarity**
   ```
   # Critical Functionality
   1. Test login
   2. Test checkout
   
   # Edge Cases
   3. Test with invalid data
   4. Test with empty fields
   ```

2. **Hierarchical Naming for Features**
   ```
   E-commerce/Checkout/Payment Processing
   E-commerce/Checkout/Shipping Options
   E-commerce/Cart/Add Items
   ```

3. **CSV for Complex Structures**
   - Use CSV when you need structured metadata
   - Good for test case management integration
   - Easy to edit in spreadsheet applications

### Import Strategy

1. **For New Projects**
   - Use "Import Both" to get complete structure
   - Start with templates for consistency

2. **For Existing Test Suites**
   - Use "Import Steps Only" for execution
   - Keep validation enabled to catch errors

3. **For Test Case Management**
   - Use "Import Test Cases Only" for tracking
   - Import steps separately for execution

### Validation

- Always review validation warnings
- Fix duplicate step numbers before importing
- Ensure all steps have descriptions
- Check section headers are properly formatted

## Examples

### Example 1: Simple Numbered List
```
1. Open application
2. Log in with valid credentials
3. Navigate to dashboard
4. Verify all widgets load
5. Log out
```
**Import Type**: Steps Only

### Example 2: Feature-Based Structure
```
# User Management
Feature/Users/Create New User
Feature/Users/Edit User
Feature/Users/Delete User

# Permissions
Feature/Permissions/Assign Role
Feature/Permissions/Revoke Access
```
**Import Type**: Both

### Example 3: CSV with Hierarchy
```csv
Feature,User Story,Test Case,Step,Step Description
Authentication,Login,Happy Path,1,Enter valid email
Authentication,Login,Happy Path,2,Enter valid password
Authentication,Login,Happy Path,3,Click login
Authentication,Login,Error Cases,1,Enter invalid email
Authentication,Login,Error Cases,2,Verify error message
```
**Import Type**: Steps Only or Both

## Troubleshooting

### Import Fails
- Check file format is supported (.txt, .md, .csv)
- Verify file encoding is UTF-8
- Look for special characters that may cause issues

### Validation Errors
- Review line numbers in error messages
- Fix empty descriptions
- Resolve duplicate step numbers

### Missing Sections
- Ensure section headers start with `#`
- Check hierarchical format uses `/` separators
- Verify "Preserve Section Information" is checked

### CSV Not Parsing
- Check header row matches expected columns
- Verify commas are not inside quoted values
- Ensure consistent column count across rows

## Backward Compatibility

The enhanced import functionality is fully backward compatible:

- Old format (simple numbered lists) still works
- Existing scripts can be imported without changes
- Previous import behavior is preserved when using default options

## Support

For additional help or to report issues:
1. Check the USAGE_GUIDE.md for general extension usage
2. Review sample templates provided
3. Visit the GitHub repository for updates

---

**Last Updated**: December 2024
