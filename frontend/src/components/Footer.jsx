export default function Footer({ onNavigate }) {
  return (
    <footer className="app-footer">
      <div className="footer-top">
        <div className="brand" style={{ fontSize: '14px' }}>Life System</div>
        <nav className="footer-nav" aria-label="Legal pages">
          <button type="button" className="footer-link" onClick={() => onNavigate('privacy')} id="footer-privacy-btn">Privacy Policy</button>
          <button type="button" className="footer-link" onClick={() => onNavigate('terms')} id="footer-terms-btn">Terms and Conditions</button>
        </nav>
      </div>
    </footer>
  );
}
