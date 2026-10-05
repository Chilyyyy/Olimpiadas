// Una tarjetita de viaje.
import { useState } from 'react';
import {
  bookingTotal,
  bookingTypes,
  extraPassengerDailyRate,
  money,
  todayArgentinaDate,
} from '../datos.js';

export default function Viaje({ trip, onAdd }) {
  const [serviceType, setServiceType] = useState('paquete');
  const [departureDate, setDepartureDate] = useState(todayArgentinaDate);
  const [days, setDays] = useState(String(trip.days));
  const [quantity, setQuantity] = useState('1');
  const booking = {
    days: Number(days) || trip.days,
    quantity: Number(quantity) || 1,
  };

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
          <strong>{money(trip.price)} <small>/ viaje para 1 persona</small></strong>
        </div>
        <form
          className="booking-options"
          onSubmit={event => {
            event.preventDefault();
            onAdd(trip.id, { serviceType, departureDate, ...booking });
          }}
        >
          <label className="booking-field booking-field-wide">
            <span>Tipo de reserva</span>
            <select value={serviceType} onChange={event => setServiceType(event.target.value)}>
              {bookingTypes.map(type => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </label>
          <label className="booking-field">
            <span>Fecha de salida</span>
            <input
              type="date"
              value={departureDate}
              min={todayArgentinaDate()}
              required
              onChange={event => setDepartureDate(event.target.value)}
            />
          </label>
          <label className="booking-field">
            <span>Días</span>
            <input
              type="number"
              min="1"
              max="365"
              value={days}
              required
              onChange={event => setDays(event.target.value)}
            />
          </label>
          <label className="booking-field booking-field-wide">
            <span>Viajeros (máximo 10)</span>
            <input
              type="number"
              min="1"
              max="10"
              value={quantity}
              required
              onChange={event => setQuantity(event.target.value)}
            />
          </label>
          <div className="booking-estimate booking-field-wide">
            <span>Estimado: <strong>{money(bookingTotal(trip, booking))}</strong></span>
            <small>Incluye {money(extraPassengerDailyRate)} por viajero adicional y por día.</small>
          </div>
          <button className="add-btn booking-submit booking-field-wide" type="submit">
            + Agregar al carrito
          </button>
        </form>
      </div>
    </article>
  );
}