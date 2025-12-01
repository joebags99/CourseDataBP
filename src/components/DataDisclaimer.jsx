import '../styles/DataDisclaimer.css';

export default function DataDisclaimer() {
  return (
    <div className="data-disclaimer">
      <div className="disclaimer-icon">ℹ️</div>
      <div className="disclaimer-content">
        <strong>Data Note:</strong> January 2023 shows a batch of completions marked during the migration to UKG LMS.
        Data from 2021-2022 has been excluded as it's no longer applicable.
      </div>
    </div>
  );
}
