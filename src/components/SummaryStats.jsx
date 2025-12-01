import '../styles/SummaryStats.css';

export default function SummaryStats({ stats }) {
  const statCards = [
    {
      label: 'Total Staff',
      value: stats.totalStaff,
      icon: '👥',
      color: 'blue'
    },
    {
      label: 'Courses Tracked',
      value: stats.totalCourses,
      icon: '📚',
      color: 'green'
    },
    {
      label: 'Total Enrollments',
      value: stats.totalEnrollments,
      icon: '📝',
      color: 'teal'
    },
    {
      label: 'Completions',
      value: stats.totalCompletions,
      icon: '✅',
      color: 'emerald'
    },
    {
      label: 'Completion Rate',
      value: `${stats.overallCompletionRate}%`,
      icon: '📊',
      color: stats.overallCompletionRate >= 80 ? 'green' : stats.overallCompletionRate >= 60 ? 'yellow' : 'red'
    },
    {
      label: 'Avg Days to Complete',
      value: stats.avgDaysToComplete,
      icon: '⏱️',
      color: 'purple'
    }
  ];

  return (
    <div className="summary-stats">
      <h2>Overview</h2>
      <div className="stats-grid">
        {statCards.map((stat, index) => (
          <div key={index} className={`stat-card ${stat.color}`}>
            <div className="stat-icon">{stat.icon}</div>
            <div className="stat-content">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
