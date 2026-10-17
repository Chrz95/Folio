import { NavLink } from 'react-router-dom';
/** Render Folio's original stacked-ledger wordmark.
 * @returns {JSX.Element} Home link. */
export function Brand() {
  return (
    <NavLink
      className="brand"
      to="/"
    >
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      folio<span className="brand-dot">.</span>
    </NavLink>
  );
}
