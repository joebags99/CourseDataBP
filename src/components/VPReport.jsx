import { useState, useMemo } from 'react';
import { buildHierarchy, getVPsAndMapping } from '../utils/supervisorHierarchy';
import { exportToCSV } from '../utils/csvParser';
import '../styles/VPReport.css';

export default function VPReport({ data }) {
  const [selectedVPs, setSelectedVPs] = useState(new Set());

  const hierarchy = useMemo(() => {
    if (data.length === 0) return null;
    return buildHierarchy(data);
  }, [data]);

  const { vps, employeeToVP } = useMemo(() => {
    if (!hierarchy) return { vps: [], employeeToVP: new Map() };
    return getVPsAndMapping(hierarchy);
  }, [hierarchy]);

  // Pre-select all VPs on first load
  useMemo(() => {
    if (vps.length > 0 && selectedVPs.size === 0) {
      setSelectedVPs(new Set(vps.map(v => v.email)));
    }
  }, [vps]);

  const toggleVP = (email) => {
    setSelectedVPs(prev => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedVPs(new Set(vps.map(v => v.email)));
  const deselectAll = () => setSelectedVPs(new Set());

  // Build rows: every employee (with data) whose VP is selected
  const rows = useMemo(() => {
    if (!hierarchy) return [];

    const result = [];
    hierarchy.employeeMap.forEach((employee, email) => {
      if (!employee.hasData) return; // skip placeholders with no enrollment data

      const vpEmail = employeeToVP.get(email);
      if (!vpEmail) return; // unassigned (no VP chain found)
      if (!selectedVPs.has(vpEmail)) return;

      const vp = hierarchy.employeeMap.get(vpEmail);
      result.push({
        name: employee.displayName,
        email: employee.isPlaceholder ? '' : employee.email,
        vpName: vp ? vp.displayName : vpEmail,
      });
    });

    result.sort((a, b) => {
      const vpCmp = a.vpName.localeCompare(b.vpName);
      if (vpCmp !== 0) return vpCmp;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [hierarchy, employeeToVP, selectedVPs]);

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
        <div className="info-message">
          <p>No data loaded. Please upload a CSV file first.</p>
        </div>
      </div>
    );
  }

  if (vps.length === 0) {
    return (
      <div className="vp-report">
        <div className="info-message">
          <p>No VP-level managers found. VPs are identified as managers with no supervisor in the dataset.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vp-report">
      <div className="vp-report-header">
        <div>
          <h2>VP Employee Mapping</h2>
          <p className="vp-report-description">
            Select one or more VPs to see every employee who rolls up to them.
            VPs are the top-level managers in the hierarchy (no supervisor in the dataset).
          </p>
        </div>
        <button
          className="export-button"
          onClick={handleExport}
          disabled={rows.length === 0}
        >
          Download CSV
        </button>
      </div>

      <div className="vp-selector-section">
        <div className="vp-selector-header">
          <span className="vp-selector-label">Select VPs ({selectedVPs.size} of {vps.length} selected):</span>
          <div className="vp-selector-actions">
            <button className="link-button" onClick={selectAll}>Select All</button>
            <span className="separator">|</span>
            <button className="link-button" onClick={deselectAll}>Deselect All</button>
          </div>
        </div>
        <div className="vp-checkbox-grid">
          {vps.map(vp => (
            <label key={vp.email} className="vp-checkbox-label">
              <input
                type="checkbox"
                checked={selectedVPs.has(vp.email)}
                onChange={() => toggleVP(vp.email)}
              />
              <span className="vp-name">{vp.displayName}</span>
              <span className="vp-count">({vp.allReports.size + 1} total)</span>
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
                  <th>VP</th>
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
            <p>No employees to display. Select at least one VP above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
