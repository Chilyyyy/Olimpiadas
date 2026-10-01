// Lo primero que se ve.
export default function Portada({ onOpenCart }) {
  return (
    <section id="inicio" className="hero">
      <div className="hero-overlay"></div>
      <div className="hero-content">
        <span className="kicker">TU PRÓXIMO DESTINO EMPIEZA ACÁ</span>
        <h1>Viajá lejos.<br /><em>Viví más.</em></h1>
        <p>Descubrí destinos únicos, elegí tus paquetes y armá tu viaje a tu medida.</p>
        <div className="hero-actions">
          <a href="#destinos" className="primary-btn">Explorar destinos</a>
          <button className="secondary-btn" onClick={onOpenCart}>Ver carrito</button>
        </div>
      </div>
      <div className="hero-badge"><strong>+20</strong><span>destinos<br />disponibles</span></div>
    </section>
  );
}
