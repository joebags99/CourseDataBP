import { useState, useMemo } from 'react';
import FileUpload from './components/FileUpload';
import SummaryStats from './components/SummaryStats';
import YearOverYear from './components/YearOverYear';
import CompletionTrends from './components/CompletionTrends';
import StaffAnalysis from './components/StaffAnalysis';
import DataDisclaimer from './components/DataDisclaimer';
import { groupCourseVersions, extractBaseCourse, getUniqueCourses } from './utils/courseGrouping';
import { calculateSummaryStats, filterByDateRange } from './utils/analytics';
import './styles/App.css';

function App() {
  const [rawData, setRawData] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [groupVersions, setGroupVersions] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  // Process course groupings
  const courseGroups = useMemo(() => {
    if (rawData.length === 0) return {};

    const uniqueCourses = getUniqueCourses(rawData);
    const groups = groupCourseVersions(uniqueCourses);

    // Create a map from original course name to group info
    const courseMap = {};
    Object.values(groups).forEach(group => {
      group.versions.forEach(version => {
        courseMap[version] = {
          baseName: group.baseName,
          versions: group.versions
        };
      });
    });

    return courseMap;
  }, [rawData]);

  // Apply date range filter
  const filteredData = useMemo(() => {
    if (!dateRange.start && !dateRange.end) return rawData;
    return filterByDateRange(rawData, dateRange.start, dateRange.end);
  }, [rawData, dateRange]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        totalStaff: 0,
        totalCourses: 0,
        totalEnrollments: 0,
        totalCompletions: 0,
        overallCompletionRate: 0,
        avgDaysToComplete: 0
      };
    }
    return calculateSummaryStats(filteredData, courseGroups);
  }, [filteredData, courseGroups]);

  const handleDataLoaded = (data) => {
    setRawData(data);
    setActiveTab('overview');
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to clear all data?')) {
      setRawData([]);
      setActiveTab('overview');
      setDateRange({ start: null, end: null });
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'yoy', label: 'Year-over-Year', icon: '📈' },
    { id: 'trends', label: 'Trends', icon: '📉' },
    { id: 'staff', label: 'Staff Analysis', icon: '👥' }
  ];

  return (
    <div className={`app ${darkMode ? 'dark-mode' : ''}`}>
      <header className="app-header">
        <div className="header-content">
          <h1>Training Analytics Dashboard</h1>
          <p className="header-subtitle">UKG Learning Pro - Course Completion Analytics</p>
        </div>

        <div className="header-controls">
          {rawData.length > 0 && (
            <>
              <label className="toggle-control">
                <input
                  type="checkbox"
                  checked={groupVersions}
                  onChange={(e) => setGroupVersions(e.target.checked)}
                />
                <span>Group Course Versions</span>
              </label>

              <button
                onClick={() => setDarkMode(!darkMode)}
                className="icon-button"
                title="Toggle dark mode"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>

              <button onClick={handleClearData} className="clear-button">
                🗑️ Clear Data
              </button>
            </>
          )}
        </div>
      </header>

      <main className="app-main">
        {rawData.length === 0 ? (
          <div className="upload-container">
            <FileUpload onDataLoaded={handleDataLoaded} />
          </div>
        ) : (
          <>
            <nav className="tab-nav">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="tab-icon">{tab.icon}</span>
                  <span className="tab-label">{tab.label}</span>
                </button>
              ))}
            </nav>

            <div className="content-area">
              {activeTab === 'overview' && (
                <div className="tab-content">
                  <SummaryStats stats={summaryStats} />

                  <DataDisclaimer />

                  <div className="data-info-card">
                    <h3>Loaded Data Information</h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="info-label">Total Records:</span>
                        <span className="info-value">{rawData.length}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Unique Courses:</span>
                        <span className="info-value">
                          {getUniqueCourses(rawData).length}
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Course Groups:</span>
                        <span className="info-value">
                          {Object.keys(groupCourseVersions(getUniqueCourses(rawData))).length}
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Grouping:</span>
                        <span className="info-value">
                          {groupVersions ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    <div className="action-buttons">
                      <button
                        onClick={() => {
                          setRawData([]);
                          setActiveTab('overview');
                        }}
                        className="secondary-button"
                      >
                        📤 Upload New File
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'yoy' && (
                <div className="tab-content">
                  <YearOverYear
                    data={filteredData}
                    courseGroups={courseGroups}
                    groupVersions={groupVersions}
                  />
                </div>
              )}

              {activeTab === 'trends' && (
                <div className="tab-content">
                  <CompletionTrends
                    data={filteredData}
                    courseGroups={courseGroups}
                    groupVersions={groupVersions}
                  />
                </div>
              )}

              {activeTab === 'staff' && (
                <div className="tab-content">
                  <StaffAnalysis
                    data={filteredData}
                    courseGroups={courseGroups}
                    groupVersions={groupVersions}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>Training Analytics Dashboard - Built with React & Recharts</p>
      </footer>
    </div>
  );
}

export default App;
