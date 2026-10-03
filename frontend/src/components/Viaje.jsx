// Una tarjetita de viaje.
import { money } from '../datos.js';

export default function Viaje({ trip, onAdd }) {
  return (
    <article className="trip-card">
      <div className={`trip-photo ${trip.photo}`}><span>{trip.country.toUpperCase()}</span></div>
      <div className="trip-body">
        <div className="trip-top">
          <span className="country">{trip.place} · {trip.days} DÍAS</span>
          <span className="rating">★ {trip.rating}</span>
        </div>
        <h3>{trip.name}</h3>
        <p>{trip.desc}</p>
        <div className="trip-bottom">
          <strong>{money(trip.price)} <small>/ pasaje</small></strong>
          <button className="add-btn" onClick={() => onAdd(trip.id)}>+ Agregar</button>
        </div>
      </div>
    </article>
  );
}