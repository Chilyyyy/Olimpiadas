// Barra de arriba con el menú.
import { useState } from 'react';

export default function Menu({
  user,
  cartCount,
  onOpenAccount,
  onOpenCart,
  onOpenOrders,
  onOpenManagerLogin,
  onLogout,
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="navbar">
      <a href="#inicio" className="brand">
        <span className="brand-mark">H</span>
        <span>HORIZONTE<span className="brand-light">TRAVEL</span></span>
      </a>
      <button
        className="menu-toggle"
        type="button"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={open}
        aria-controls="menu-principal"
        onClick={() => setOpen(value => !value)}
      >
        {open ? '×' : '☰'}
      </button>
      <nav id="menu-principal" className={open ? 'open' : ''}>
        <a href="#inicio" onClick={close}>Inicio</a>
        <a href="#destinos" onClick={close}>Destinos</a>
        <a href="#servicios" onClick={close}>Servicios</a>
        <a href="#contacto" onClick={close}>Contacto</a>
        {user && (
          <button className="account-btn" onClick={() => { close(); onOpenOrders(); }}>
            {user.role === 'jefe_ventas' ? 'Gestión de ventas' : 'Mis pedidos'}
          </button>
        )}
        {!user && (
          <button className="sales-login-btn" onClick={() => { close(); onOpenManagerLogin(); }}>
            Jefe de ventas
          </button>
        )}
        <button className="account-btn" onClick={() => { close(); onOpenAccount(); }}>
          {user ? `Hola, ${user.name.split(' ')[0]}` : 'Iniciar sesión'}
        </button>
        {user && <button className="sales-login-btn" onClick={() => { close(); onLogout(); }}>Cerrar sesión</button>}
        <button className="cart-btn" onClick={() => { close(); onOpenCart(); }}>
          Carrito <span>{cartCount}</span>
        </button>
      </nav>
    </header>
  );
}
