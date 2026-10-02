import React, { useState } from 'react';

export default function Menu({ user, cartCount, onOpenAccount, onOpenCart }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="navbar">
      <a href="#inicio" className="brand">
        <span className="brand-mark">H</span>
        <span>HORIZONTE<span className="brand-light">TRAVEL</span></span>
      </a>
      <button className="menu-toggle" aria-label="Abrir menú" onClick={() => setOpen(o => !o)}>☰</button>
      <nav className={open ? 'open' : ''}>
        <a href="#inicio" onClick={close}>Inicio</a>
        <a href="#destinos" onClick={close}>Destinos</a>
        <a href="#servicios" onClick={close}>Servicios</a>
        <a href="#contacto" onClick={close}>Contacto</a>
        <button className="account-btn" onClick={onOpenAccount}>
          {user ? `Hola, ${user.name.split(' ')[0]}` : 'Iniciar sesión'}
        </button>
        <button className="cart-btn" onClick={onOpenCart}>
          Carrito <span>{cartCount}</span>
        </button>
      </nav>
    </header>
  );
}
