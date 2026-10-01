// Cartelito que aparece abajo.
export default function Aviso({ message, show }) {
  return <div className={`toast ${show ? 'show' : ''}`}>{message}</div>;
}
