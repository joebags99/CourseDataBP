# Training Analytics Dashboard

A comprehensive React-based analytics dashboard for analyzing course completion data from UKG Learning Pro. This tool helps track training completion trends, identify courses needing attention, and analyze staff-level performance.

## Features

### 📊 Core Analytics

- **Year-over-Year Comparison** - Compare completion rates across years with interactive charts
- **Completion Trends** - Monthly completion trends and time-to-completion analysis
- **Staff-Level Analysis** - Individual staff completion tracking with detailed drill-down
- **Summary Statistics** - Overall metrics including completion rates and average time-to-complete

### 🎯 Key Capabilities

- **Intelligent Course Grouping** - Automatically groups course versions (e.g., "Trauma 101" and "Trauma 101 (2025 update)")
- **Drag-and-Drop Upload** - Easy CSV file upload with validation
- **Interactive Charts** - Built with Recharts for rich, interactive visualizations
- **Export Functionality** - Download filtered data and analysis results as CSV
- **Search & Filters** - Find staff by name/email, filter by completion status
- **Dark Mode** - Toggle between light and dark themes
- **Responsive Design** - Works on desktop and tablet devices

### 🎨 Design

- Professional blue/green color scheme
- Clean, modern interface
- Smooth animations and transitions
- Accessibility-focused design

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd CourseDataBP
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to the URL shown (typically `http://localhost:3000`)

## CSV Data Format

The application expects CSV files exported from UKG Learning Pro with the following format:

### Expected Headers:
- Legal Firstname
- Preferred Firstname
- Lastname
- Email
- Course
- % Completed
- Enrolled At
- Date Completed

### Important Notes:
- **First 7 rows are skipped** (report metadata)
- **Data starts on row 8**
- Dates should be in format: `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS` (timezone abbreviations like CST are automatically removed)
- Empty "Date Completed" values are handled (means not completed)
- The email field is used as the unique identifier for staff members

### Example CSV Structure:
```
[Row 1-7: Metadata - automatically skipped]
Legal Firstname,Preferred Firstname,Lastname,Email,Course,% Completed,Enrolled At,Date Completed
John,Johnny,Doe,john.doe@example.com,Trauma 101,100,2023-01-15 CST,2023-02-01 CST
Jane,,Smith,jane.smith@example.com,CPR Training,50,2023-01-20 CST,
```

## Usage Guide

### 1. Upload Data

- Drag and drop your CSV file into the upload area, or click "Browse Files"
- The system will automatically parse and validate your data
- You'll see a summary of uploaded records

### 2. Overview Tab

- View high-level statistics:
  - Total staff count
  - Courses tracked
  - Overall completion rate
  - Average days to complete
- Toggle "Group Course Versions" to combine or separate course versions

### 3. Year-over-Year Tab

- Select courses from the left sidebar
- View completion rates by year in bar or line charts
- See detailed statistics table with:
  - Enrollments per year
  - Completions per year
  - Completion rates
  - Average days to complete
- Export selected data to CSV

### 4. Trends Tab

- **Monthly Completions**: View completion trends over time
  - Toggle between overall view and by-course view
- **Time-to-Completion**: See distribution of how long it takes staff to complete courses
- **Courses Needing Attention**: Automatically identifies courses with completion rates below 70%

### 5. Staff Analysis Tab

- Search for specific staff members
- Filter by completion status:
  - 100% Complete
  - Partial Completion
  - Not Started (0%)
- Sort by name, completion rate, or number of courses
- Click on any staff member to expand and see detailed course enrollment info
- Export filtered staff lists for follow-up

## Course Version Grouping

The dashboard intelligently groups course versions together by detecting common patterns:

- Year indicators: `(2025 update)`, `- 2024`, `2023`
- Version numbers: `v2`, `v2.1`, `version 2`
- Update indicators: `(revised)`, `(updated)`, `(new)`

Example groupings:
- "Trauma 101" and "Trauma 101 (2025 update)" → grouped as "Trauma 101"
- "CPR v1" and "CPR v2" → grouped as "CPR"

Toggle the "Group Course Versions" option in the header to switch between grouped and ungrouped views.

## Export Features

### Available Exports:

1. **Year-over-Year Data** - Selected courses with yearly statistics
2. **Staff Summary** - Overview of filtered staff completion rates
3. **Staff Details** - Detailed course-by-course breakdown for filtered staff

All exports are in CSV format for easy import into Excel or other tools.

## Development

### Project Structure

```
CourseDataBP/
├── src/
│   ├── components/       # React components
│   │   ├── FileUpload.jsx
│   │   ├── SummaryStats.jsx
│   │   ├── YearOverYear.jsx
│   │   ├── CompletionTrends.jsx
│   │   └── StaffAnalysis.jsx
│   ├── utils/           # Utility functions
│   │   ├── csvParser.js
│   │   ├── courseGrouping.js
│   │   └── analytics.js
│   ├── styles/          # CSS files
│   ├── App.jsx          # Main app component
│   └── main.jsx         # Entry point
├── index.html
├── package.json
└── vite.config.js
```

### Key Technologies

- **React** - UI framework
- **Recharts** - Data visualization
- **PapaParse** - CSV parsing
- **date-fns** - Date manipulation
- **Vite** - Build tool and dev server

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory. You can serve them with any static file server.

### Preview Production Build

```bash
npm run preview
```

## Customization

### Changing Colors

Edit `src/styles/index.css` to modify the color scheme. Key variables:

```css
--primary-blue: #0088FE;
--primary-teal: #00C49F;
--primary-emerald: #10B981;
```

### Adjusting Date Parsing

Modify `src/utils/csvParser.js` in the `parseDate` function to handle different date formats.

### Course Grouping Logic

Edit `src/utils/courseGrouping.js` to add or modify version detection patterns in the `extractBaseCourse` function.

## Troubleshooting

### CSV Not Parsing

- Ensure first 7 rows contain metadata (they're automatically skipped)
- Verify column headers match expected format exactly
- Check that dates are in YYYY-MM-DD format

### Performance Issues

- The app handles thousands of records in browser memory
- For very large datasets (50,000+ records), consider splitting into multiple files by date range
- Clear browser cache if experiencing slowdowns

### Charts Not Displaying

- Ensure data has been uploaded successfully
- Check browser console for errors
- Verify courses are selected in Year-over-Year view

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

Requires a modern browser with ES6+ support.

## Privacy & Security

- All data processing happens in your browser
- No data is sent to any server
- No backend required
- Safe for sensitive employee data

## License

Internal use only.

## Support

For issues or feature requests, contact the development team.

---

Built with ❤️ for training analytics
