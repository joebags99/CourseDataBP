import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { calculateYearOverYear } from '../utils/analytics';
import { exportToCSV } from '../utils/csvParser';
import '../styles/YearOverYear.css';

export default function YearOverYear({ data, courseGroups, groupVersions, showRawNumbers }) {
  const [selectedCourses, setSelectedCourses] = useState(new Set());
  const [chartType, setChartType] = useState('bar'); // 'bar' or 'line'

  const yoyStats = useMemo(
    () => calculateYearOverYear(data, courseGroups, groupVersions),
    [data, courseGroups, groupVersions]
  );

  const courseList = useMemo(
    () => Object.keys(yoyStats).sort(),
    [yoyStats]
  );

  // Prepare chart data
  const chartData = useMemo(() => {
    if (selectedCourses.size === 0) return [];

    // Collect all years
    const yearsSet = new Set();
    selectedCourses.forEach(course => {
      Object.keys(yoyStats[course] || {}).forEach(year => yearsSet.add(parseInt(year)));
    });

    const years = Array.from(yearsSet).sort();

    // Build data for each year
    return years.map(year => {
      const dataPoint = { year };

      selectedCourses.forEach(course => {
        const courseYearData = yoyStats[course]?.[year];
        if (courseYearData) {
          dataPoint[`${course}_rate`] = courseYearData.completionRate;
          dataPoint[`${course}_completions`] = courseYearData.totalCompletions;
          dataPoint[`${course}_enrollments`] = courseYearData.totalEnrollments;
        }
      });

      return dataPoint;
    });
  }, [yoyStats, selectedCourses]);

  const handleCourseToggle = (course) => {
    const newSelected = new Set(selectedCourses);
    if (newSelected.has(course)) {
      newSelected.delete(course);
    } else {
      newSelected.add(course);
    }
    setSelectedCourses(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedCourses.size === courseList.length) {
      setSelectedCourses(new Set());
    } else {
      setSelectedCourses(new Set(courseList));
    }
  };

  const exportData = () => {
    const exportRows = [];

    selectedCourses.forEach(course => {
      const courseStats = yoyStats[course];
      Object.keys(courseStats).forEach(year => {
        const stats = courseStats[year];
        exportRows.push({
          Course: course,
          Year: year,
          'Total Enrollments': stats.totalEnrollments,
          'Total Completions': stats.totalCompletions,
          'Completion Rate (%)': stats.completionRate,
          'Average Days to Complete': stats.averageDaysToComplete
        });
      });
    });

    exportToCSV(exportRows, 'year-over-year-comparison.csv');
  };

  const colors = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
    '#82CA9D', '#FFC658', '#FF6B9D', '#C47AFF', '#4ECDC4'
  ];

  return (
    <div className="year-over-year">
      <div className="section-header">
        <h2>Year-over-Year Comparison</h2>
        <div className="header-controls">
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            className="chart-type-select"
          >
            <option value="bar">Bar Chart</option>
            <option value="line">Line Chart</option>
          </select>
          <button
            onClick={exportData}
            disabled={selectedCourses.size === 0}
            className="export-button"
          >
            📥 Export Data
          </button>
        </div>
      </div>

      <div className="yoy-content">
        <div className="course-selector">
          <div className="selector-header">
            <h3>Select Courses</h3>
            <button onClick={handleSelectAll} className="select-all-button">
              {selectedCourses.size === courseList.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="course-list">
            {courseList.map(course => (
              <label key={course} className="course-checkbox">
                <input
                  type="checkbox"
                  checked={selectedCourses.has(course)}
                  onChange={() => handleCourseToggle(course)}
                />
                <span className="course-name">{course}</span>
                <span className="course-years">
                  {Object.keys(yoyStats[course]).length} year(s)
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="yoy-visualization">
          {selectedCourses.size === 0 ? (
            <div className="empty-state">
              <p>Select courses from the list to view year-over-year comparison</p>
            </div>
          ) : (
            <>
              <div className="chart-container">
                <h3>Completion Rate by Year (%)</h3>
                <ResponsiveContainer width="100%" height={400}>
                  {chartType === 'bar' ? (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      {Array.from(selectedCourses).map((course, index) => (
                        <Bar
                          key={course}
                          dataKey={`${course}_rate`}
                          fill={colors[index % colors.length]}
                          name={course}
                        />
                      ))}
                    </BarChart>
                  ) : (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      {Array.from(selectedCourses).map((course, index) => (
                        <Line
                          key={course}
                          type="monotone"
                          dataKey={`${course}_rate`}
                          stroke={colors[index % colors.length]}
                          strokeWidth={2}
                          name={course}
                        />
                      ))}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>

              <div className="yoy-table">
                <h3>Detailed Statistics</h3>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Year</th>
                        <th>Enrollments</th>
                        <th>Completions</th>
                        <th>Rate</th>
                        <th>Avg Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(selectedCourses).flatMap(course =>
                        Object.keys(yoyStats[course])
                          .sort((a, b) => b - a)
                          .map(year => {
                            const stats = yoyStats[course][year];
                            return (
                              <tr key={`${course}-${year}`}>
                                <td>{course}</td>
                                <td>{year}</td>
                                <td>{stats.totalEnrollments}</td>
                                <td>{stats.totalCompletions}</td>
                                <td>
                                  <span className={`rate-badge ${getRateBadgeClass(stats.completionRate)}`}>
                                    {showRawNumbers
                                      ? `${stats.totalCompletions}/${stats.totalEnrollments}`
                                      : `${stats.completionRate}%`}
                                  </span>
                                </td>
                                <td>{stats.averageDaysToComplete || '-'}</td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function getRateBadgeClass(rate) {
  if (rate >= 80) return 'high';
  if (rate >= 60) return 'medium';
  return 'low';
}
