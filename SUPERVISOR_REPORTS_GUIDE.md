# Supervisor Reports Feature Guide

## Overview

The Training Analytics Dashboard now includes a powerful **Supervisor Reports** feature that allows you to generate hierarchical team reports with Excel export capabilities.

## Key Features

### 1. **Cascading Direct Reports Toggle**

The application now supports two reporting modes:

- **Cascading Reports (Enabled)**: Shows all direct and indirect reports
  - When you select a VP, you'll see their directors, managers who report to those directors, and all employees down the organizational hierarchy
  - This gives you a complete view of the entire team structure under a supervisor

- **Direct Reports Only (Disabled)**: Shows only immediate direct reports
  - When you select a VP, you'll only see the directors who directly report to them
  - One level of the organizational hierarchy

### 2. **Excel Report Generation**

All supervisor reports can now be exported to Excel format (.xlsx) with:

- **Summary Sheet**: High-level statistics about the supervisor's team
- **Team Members Sheet**: Detailed roster with completion rates
- **Course Details Sheet**: Course-by-course breakdown for each team member

### 3. **Automatic Hierarchy Detection**

The system automatically builds the organizational hierarchy from your UKG data by:

- Parsing the "Supervisor" column from your CSV export
- Identifying employees who have multiple supervisors listed (indicating they appear in the hierarchy at multiple levels)
- Building a complete organizational tree structure

## Data Requirements

For supervisor reports to work, your CSV export from UKG Learning Pro must include:

- **Supervisor** column: Should contain supervisor names in the format "Name - ID"
  - Example: `"Mercedes Sanchez - 10105, Noelle Schamberger - 06611"`
  - Multiple supervisors are supported (comma-separated)

All other standard columns remain the same:
- Legal Firstname
- Preferred Firstname (optional)
- Lastname
- Email
- Course
- % Completed
- Enrolled At
- Date Completed
- Last Hire Date

## How to Use

### Step 1: Upload Data
1. Upload your CSV export from UKG Learning Pro
2. Ensure the file includes the "Supervisor" column

### Step 2: Navigate to Supervisor Reports
1. Click on the **"👔 Supervisor Reports"** tab in the navigation

### Step 3: Select a Supervisor
1. Use the dropdown menu to select a supervisor
2. The dropdown shows:
   - Supervisor name
   - Number of direct reports
   - Total cascading reports

### Step 4: Configure Report Type
1. Toggle **"Include Cascading Reports"** based on your needs:
   - ✅ **Checked**: Full organizational hierarchy (all levels)
   - ❌ **Unchecked**: Direct reports only (one level)

### Step 5: Export to Excel
1. Click **"📥 Export Report to Excel"** to download the selected supervisor's report
2. Or click **"📥 Export All Supervisors"** to generate a summary report for all supervisors

## Report Contents

### Individual Supervisor Report

Each Excel export includes three sheets:

**Summary Sheet:**
- Supervisor name and email
- Report type (cascading or direct)
- Team statistics:
  - Total team members
  - Direct reports count
  - Total reports (cascading) count
  - Total enrollments
  - Total completions
  - Overall completion rate

**Team Members Sheet:**
- Display name
- Legal first name
- Last name
- Email
- Total courses
- Completed courses
- Completion rate (%)
- Has direct reports indicator
- Immediate supervisor(s)

**Course Details Sheet:**
- Display name
- Email
- Course name
- Percent completed
- Enrolled at date
- Date completed
- Days to complete

### All Supervisors Report

A summary Excel file with one sheet containing:
- Supervisor name and email
- Direct reports count
- Total reports (cascading) count
- Team members in report
- Total enrollments
- Total completions
- Completion rate (%)

## Understanding the Hierarchy

### How Cascading Works

The system identifies cascading relationships by analyzing the supervisor field:

1. **Employee is a supervisor**: They appear in someone else's "Supervisor" field
2. **Employee has supervisors**: They have values in their own "Supervisor" field
3. **Employee is at multiple levels**: They may appear both as a supervisor and as someone with supervisors

Example hierarchy:
```
VP (Sarah Johnson)
├── Director (John Smith) - Direct report
│   ├── Manager (Alice Brown) - Cascading report
│   │   └── Employee (Bob Wilson) - Cascading report
│   └── Manager (Carol Davis) - Cascading report
└── Director (Mike Lee) - Direct report
    └── Manager (Emily Chen) - Cascading report
```

**With Cascading Enabled**: Sarah's report shows all 7 people (2 directors, 3 managers, 2 employees)

**With Cascading Disabled**: Sarah's report shows only 2 people (2 directors)

## Technical Implementation

### New Files Created

**Utilities:**
- `/src/utils/supervisorHierarchy.js`: Hierarchy parsing and traversal logic
- `/src/utils/excelExporter.js`: Excel file generation using xlsx library

**Components:**
- `/src/components/SupervisorReports.jsx`: Main supervisor reports UI
- `/src/styles/SupervisorReports.css`: Component styling

**Modified Files:**
- `/src/utils/csvParser.js`: Added supervisor field parsing
- `/src/App.jsx`: Added supervisor reports tab

### Dependencies Added

- **xlsx** (^0.18.5): Excel file generation library

## Tips and Best Practices

1. **Start with Cascading Enabled**: This gives you the full picture of team structure
2. **Use Direct Reports for Performance Reviews**: When reviewing direct reports only
3. **Export All Supervisors**: Great for leadership team to get an overview
4. **Verify Data Quality**: Ensure supervisor names are consistent in your UKG export
5. **Check for Orphaned Employees**: Employees without supervisors won't appear in any supervisor's report

## Troubleshooting

### "No supervisor data found"
- Ensure your CSV includes a "Supervisor" column
- Check that the column header is exactly "Supervisor" (case-sensitive)

### "No supervisors found"
- This means no employees have direct reports in the data
- Verify that supervisor relationships are correctly populated in UKG

### Missing Team Members
- Check if the employee has a supervisor listed in their record
- Verify supervisor names match exactly (including spelling and formatting)

### Excel Export Not Working
- Ensure your browser allows file downloads
- Check browser console for any error messages
- Verify you have sufficient disk space

## Future Enhancements (Potential)

- Organizational chart visualization
- Department-level rollups
- Historical trending by supervisor
- Comparison between supervisors
- Custom report templates

---

**Need Help?** Review this guide or check the application's in-app help documentation.
