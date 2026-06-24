import { useMemo } from 'react';
import { buildHierarchy, getVPsAndMapping } from '../data/hierarchy';
import { exportToCSV } from '../export/csv';
import { useToggleSet } from '../hooks/useToggleSet';
import '../styles/VPReport.css';

// These three VPs get their own category; everyone else rolls into "Admin"
const FEATURED_VP_NAMES = ['Emily Medere', 'Gabby Hidalgo', 'Melinda Smith'];
const ADMIN_GROUP_ID = '__admin__';

export default function VPReport({ data }) {
  const { set: selectedGroups, toggle: toggleGroup, setSet: setSelectedGroups } = useToggleSet();

  const hierarchy = useMemo(() => {
    if (data.length === 0) return null;
    return buildHierarchy(data);
  }, [data]);

  const { vps, employeeToVP } = useMemo(() => {
    if (!hierarchy) return { vps: [], employeeToVP: new Map() };
    return getVPsAndMapping(hierarchy);
  }, [hierarchy]);

  // Build the 4 display groups: 3 featured + Admin
  const displayGroups = useMemo(() => {
    const featured = [];
    const adminVPEmails = new Set();

    vps.forEach(vp => {
      if (FEATURED_VP_NAMES.includes(vp._vpCanonicalName)) {
        featured.push({
          id: vp.email,
          label: vp.displayName,
          vpEmails: new Set([vp.email]),
          notFound: vp.notFound || false,
        });
      } else if (!vp.notFound) {
        adminVPEmails.add(vp.email);
      }
    });

    // Count unique employees under Admin
    let adminEmployeeCount = 0;
    if (adminVPEmails.size > 0) {
      const seen = new Set();
      employeeToVP.forEach((vpEmailSet, empEmail) => {
        if ([...vpEmailSet].some(e => adminVPEmails.has(e))) seen.add(empEmail);
      });
      adminEmployeeCount = seen.size;
    }

    const groups = [...featured];
    if (adminVPEmails.size > 0) {
      groups.push({
        id: ADMIN_GROUP_ID,
        label: 'Admin',
        vpEmails: adminVPEmails,
        notFound: false,
        adminEmployeeCount,
        adminVPCount: adminVPEmails.size,
      });
    }

    return groups;
  }, [vps, employeeToVP]);

  // Pre-select all groups on first load
  useMemo(() => {
    if (displayGroups.length > 0 && selectedGroups.size === 0) {
      setSelectedGroups(new Set(displayGroups.map(g => g.id)));
    }
  }, [displayGroups]);

  const selectAll = () => setSelectedGroups(new Set(displayGroups.map(g => g.id)));
  const deselectAll = () => setSelectedGroups(new Set());

  // Build rows: one per employee whose group(s) are selected
  const rows = useMemo(() => {
    if (!hierarchy) return [];

    const result = [];
    hierarchy.employeeMap.forEach((employee, email) => {
      if (!employee.hasData) return;

      const vpEmailSet = employeeToVP.get(email);
      if (!vpEmailSet) return;

      const matchedLabels = [];
      displayGroups.forEach(group => {
        if (!selectedGroups.has(group.id)) return;
        if ([...vpEmailSet].some(vpEmail => group.vpEmails.has(vpEmail))) {
          matchedLabels.push(group.label);
        }
      });

      if (matchedLabels.length === 0) return;

      result.push({
        name: employee.displayName,
        email: employee.isPlaceholder ? '' : employee.email,
        vpName: matchedLabels.join(', '),
      });
    });

    result.sort((a, b) => {
      const vpCmp = a.vpName.localeCompare(b.vpName);
      return vpCmp !== 0 ? vpCmp : a.name.localeCompare(b.name);
    });

    return result;
  }, [hierarchy, employeeToVP, displayGroups, selectedGroups]);

  const handleExport = () => {
    if (rows.length === 0) return;
    const csvRows = rows.map(r => ({ name: r.name, vp_report_to_name: r.vpName }));
    const date = new Date();
    const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${date.getFullYear()}`;
    exportToCSV(csvRows, `vp-employee-mapping-${dateStr}.csv`);
  };

  if (!hierarchy) {
    return (
      <div className="vp-report">
        <div className="info-message"><p>No data loaded. Please upload a CSV file first.</p></div>
      </div>
    );
  }

  return (
    <div className="vp-report">
      <div className="vp-report-header">
        <div>
          <h2>VP Employee Mapping</h2>
          <p className="vp-report-description">
            Select one or more categories to see every employee who rolls up to them.
          </p>
        </div>
        <button className="export-button" onClick={handleExport} disabled={rows.length === 0}>
          📥 Export CSV
        </button>
      </div>

      <div className="vp-selector-section">
        <div className="vp-selector-header">
          <span className="vp-selector-label">
            Select Categories ({selectedGroups.size} of {displayGroups.length} selected):
          </span>
          <div className="vp-selector-actions">
            <button className="link-button" onClick={selectAll}>Select All</button>
            <span className="separator">|</span>
            <button className="link-button" onClick={deselectAll}>Deselect All</button>
          </div>
        </div>
        <div className="vp-checkbox-grid">
          {displayGroups.map(group => (
            <label key={group.id} className={`vp-checkbox-label${group.notFound ? ' vp-not-found' : ''}`}>
              <input
                type="checkbox"
                checked={selectedGroups.has(group.id)}
                onChange={() => toggleGroup(group.id)}
              />
              <span className="vp-name">{group.label}</span>
              {group.notFound ? (
                <span className="vp-missing" title="Name not matched in this CSV">not in data</span>
              ) : group.id === ADMIN_GROUP_ID ? (
                <span className="vp-count">({group.adminEmployeeCount} employees, {group.adminVPCount} VPs)</span>
              ) : (
                <span className="vp-count">
                  {(() => {
                    const vp = vps.find(v => v.email === group.id);
                    return vp ? `(${vp.allReports.size + 1} total)` : '';
                  })()}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      <div className="vp-table-section">
        <div className="vp-table-meta">
          Showing {rows.length} employee{rows.length !== 1 ? 's' : ''}
        </div>
        {rows.length > 0 ? (
          <div className="table-container">
            <table className="vp-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.name}</td>
                    <td className="vp-cell">{row.vpName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="info-message">
            <p>No employees to display. Select at least one category above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
