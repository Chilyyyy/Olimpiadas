// Carrusel con los paquetes.
import { useState } from 'react';
import Viaje from './Viaje.jsx';

export default function Destinos({ slides, onAdd }) {
  const [current, setCurrent] = useState(0);
  const goTo = index => setCurrent((index + slides.length) % slides.length);

  return (
    <section id="destinos" className="destinations section">
      <div className="section-head">
        <div>
          <span className="kicker dark">PAQUETES TURÍSTICOS</span>
          <h2>Elegí tu próxima aventura</h2>
        </div>
        <p>Elegí el tipo de reserva, la fecha de salida, los días y la cantidad de viajeros para cada destino.</p>
      </div>

      <div className="carousel-wrap">
        <button className="carousel-arrow" aria-label="Destino anterior" onClick={() => goTo(current - 1)}>‹</button>
        <div className="carousel-window">
          <div className="carousel-track" style={{ transform: `translateX(-${current * 100}%)` }}>
            {slides.map(slide => (
              <section className="slide" key={slide.num}>
                <div className={`slide-intro ${slide.cls}`}>
                  <span>{slide.num}</span><h3>{slide.title}</h3><p>{slide.desc}</p>
                </div>
                <div className="cards">
                  {slide.trips.map(trip => <Viaje key={trip.id} trip={trip} onAdd={onAdd} />)}
                </div>
              </section>
            ))}
          </div>
        </div>
        <button className="carousel-arrow" aria-label="Siguiente destino" onClick={() => goTo(current + 1)}>›</button>
      </div>

      <div className="dots">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`dot ${i === current ? 'active' : ''}`}
            aria-label={`Ir al destino ${i + 1}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </section>
  );
}
