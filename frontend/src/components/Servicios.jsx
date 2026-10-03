// Los 4 servicios.
import { services } from '../datos.js';

export default function Servicios() {
  return (
    <section id="servicios" className="services section">
      <div className="section-head centered">
        <div><span className="kicker dark">SERVICIOS</span><h2>Todo para viajar tranquilo</h2></div>
      </div>
      <div className="service-grid">
        {services.map(s => (
          <article key={s.num}><span>{s.num}</span><h3>{s.title}</h3><p>{s.text}</p></article>
        ))}
      </div>
    </section>
  );
}