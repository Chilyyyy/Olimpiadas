// Viajes de muestra para mostrar la página mientras responde el servidor.
export const slides = [
  {
    num: '01', title: 'Asia', cls: 'japan',
    desc: 'Tradición, tecnología y paisajes increíbles.',
    trips: [
      { id: 'tokio', name: 'Tokio esencial', country: 'Japón', photo: 'japan-photo', place: 'TOKIO', days: 7, rating: 4.9, price: 1850000, desc: 'Hotel 4 estrellas, desayuno, traslados y city tour.' },
      { id: 'seul', name: 'Seúl cultural', country: 'Corea del Sur', photo: 'korea-photo', place: 'SEÚL', days: 6, rating: 4.8, price: 1620000, desc: 'Hotel, desayuno, palacios históricos y paseo nocturno.' }
    ]
  },
  {
    num: '02', title: 'Europa', cls: 'europe',
    desc: 'Historia, gastronomía y ciudades inolvidables.',
    trips: [
      { id: 'roma', name: 'Roma histórica', country: 'Italia', photo: 'italy-photo', place: 'ROMA', days: 8, rating: 4.9, price: 1480000, desc: 'Alojamiento céntrico, desayuno y visitas guiadas.' },
      { id: 'atenas', name: 'Islas griegas', country: 'Grecia', photo: 'greece-photo', place: 'ATENAS', days: 7, rating: 4.8, price: 1690000, desc: 'Hotel, desayuno, excursión y navegación entre islas.' }
    ]
  },
  {
    num: '03', title: 'Aventura', cls: 'nature',
    desc: 'Naturaleza, aventura y experiencias diferentes.',
    trips: [
      { id: 'egipto', name: 'Egipto milenario', country: 'Egipto', photo: 'egypt-photo', place: 'EL CAIRO', days: 6, rating: 4.7, price: 1330000, desc: 'Hotel, desayuno, pirámides, museo y excursión al Nilo.' },
      { id: 'cusco', name: 'Ruta del Cusco', country: 'Perú', photo: 'peru-photo', place: 'CUSCO', days: 5, rating: 4.9, price: 980000, desc: 'Hotel, desayuno, excursiones y visita a Machu Picchu.' }
    ]
  },
  {
    num: '04', title: 'América', cls: 'america',
    desc: 'Playas, cultura y grandes ciudades.',
    trips: [
      { id: 'rio', name: 'Río de Janeiro', country: 'Brasil', photo: 'brazil-photo', place: 'RÍO', days: 6, rating: 4.8, price: 760000, desc: 'Hotel cerca de la playa, desayuno y excursiones.' },
      { id: 'cancun', name: 'Cancún Caribe', country: 'México', photo: 'mexico-photo', place: 'CANCÚN', days: 7, rating: 4.9, price: 1120000, desc: 'Resort, desayuno, playa y excursión de snorkel.' }
    ]
  }
];

// Acceso rápido a cada viaje usando su identificador.
export const trips = Object.fromEntries(
  slides.flatMap(s => s.trips).map(t => [t.id, t])
);

export const bookingTypes = [
  { id: 'paquete', label: 'Paquete completo' },
  { id: 'viaje', label: 'Viaje simple' },
  { id: 'hotel', label: 'Reservación en hotel' },
  { id: 'vehiculo', label: 'Reservación de vehículo' },
];

export const extraPassengerDailyRate = 200000;

export function todayArgentinaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export const bookingTypeLabels = Object.fromEntries(
  bookingTypes.map(type => [type.id, type.label])
);

export function bookingTotal(trip, booking) {
  return trip.price + Math.max(0, booking.quantity - 1) * extraPassengerDailyRate * booking.days;
}

// Servicios que se muestran en la página principal.
export const services = [
  { num: '01', title: 'Vuelos', text: 'Opciones de vuelos de ida y vuelta para tus destinos.' },
  { num: '02', title: 'Alojamiento', text: 'Hoteles y resorts seleccionados para cada paquete.' },
  { num: '03', title: 'Excursiones', text: 'Experiencias locales y recorridos para aprovechar cada día.' },
  { num: '04', title: 'Traslados', text: 'Traslados coordinados desde el aeropuerto hasta tu alojamiento.' }
];

// Formatea precios con los separadores usados en Argentina.
export const money = value => '$' + value.toLocaleString('es-AR');
