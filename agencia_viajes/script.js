const trips = {
  tokio: { name: 'Tokio esencial', country: 'Japón', price: 1850000 },
  seul: { name: 'Seúl cultural', country: 'Corea del Sur', price: 1620000 },
  roma: { name: 'Roma histórica', country: 'Italia', price: 1480000 },
  atenas: { name: 'Islas griegas', country: 'Grecia', price: 1690000 },
  egipto: { name: 'Egipto milenario', country: 'Egipto', price: 1330000 },
  cusco: { name: 'Ruta del Cusco', country: 'Perú', price: 980000 },
  rio: { name: 'Río de Janeiro', country: 'Brasil', price: 760000 },
  cancun: { name: 'Cancún Caribe', country: 'México', price: 1120000 }
};

let cart = JSON.parse(localStorage.getItem('horizonteCart')) || {};
let currentUser = JSON.parse(localStorage.getItem('horizonteUser')) || null;
let currentSlide = 0;

const $ = id => document.getElementById(id);
const money = value => '$' + value.toLocaleString('es-AR');

function saveCart(){ localStorage.setItem('horizonteCart', JSON.stringify(cart)); }
function cartQuantity(){ return Object.values(cart).reduce((sum, qty) => sum + qty, 0); }
function cartTotal(){ return Object.entries(cart).reduce((sum,[id,qty]) => sum + trips[id].price * qty, 0); }

function updateCartCount(){ $('cartCount').textContent = cartQuantity(); }

function addToCart(id){
  cart[id] = (cart[id] || 0) + 1;
  saveCart(); updateCartCount(); renderCart();
  showToast(`${trips[id].name} agregado al carrito`);
}

function changeQuantity(id, amount){
  cart[id] = (cart[id] || 0) + amount;
  if(cart[id] <= 0) delete cart[id];
  saveCart(); updateCartCount(); renderCart();
}

function renderCart(){
  const box = $('cartItems');
  const entries = Object.entries(cart);
  if(!entries.length){ box.innerHTML = '<div class="empty">Todavía no agregaste ningún viaje.<br>Explorá los destinos y sumá tus paquetes.</div>'; }
  else {
    box.innerHTML = entries.map(([id,qty]) => {
      const trip = trips[id];
      return `<div class="cart-row">
        <div class="cart-row-head"><div><h3>${trip.name}</h3><small>${trip.country} · ${money(trip.price)} por pasaje</small></div><button class="remove" data-remove="${id}">Eliminar</button></div>
        <div class="quantity"><button data-change="${id}" data-amount="-1">−</button><strong>${qty}</strong><button data-change="${id}" data-amount="1">+</button><span class="row-subtotal">${money(trip.price * qty)}</span></div>
      </div>`;
    }).join('');
  }
  $('cartTotal').textContent = money(cartTotal());
}

function openCart(){ renderCart(); $('cartModal').classList.remove('hidden'); }
function closeCart(){ $('cartModal').classList.add('hidden'); }
function showToast(message){ const toast = $('toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),2200); }

// Menú móvil
$('menuToggle').addEventListener('click', ()=> $('mainMenu').classList.toggle('open'));
document.querySelectorAll('#mainMenu a').forEach(a => a.addEventListener('click', ()=> $('mainMenu').classList.remove('open')));

// Carrusel
const track = $('carouselTrack');
const slides = document.querySelectorAll('.slide');
function renderDots(){
  $('dots').innerHTML = [...slides].map((_,i)=>`<button class="dot ${i===0?'active':''}" data-slide="${i}" aria-label="Ir al destino ${i+1}"></button>`).join('');
  document.querySelectorAll('.dot').forEach(dot=>dot.addEventListener('click',()=>goToSlide(Number(dot.dataset.slide))));
}
function goToSlide(index){ currentSlide = (index + slides.length) % slides.length; track.style.transform = `translateX(-${currentSlide * 100}%)`; document.querySelectorAll('.dot').forEach((dot,i)=>dot.classList.toggle('active',i===currentSlide)); }
$('prevSlide').addEventListener('click',()=>goToSlide(currentSlide-1));
$('nextSlide').addEventListener('click',()=>goToSlide(currentSlide+1));
renderDots();

// Carrito
$('cartBtn').addEventListener('click', openCart);
$('heroCartBtn').addEventListener('click', openCart);
$('closeCart').addEventListener('click', closeCart);
$('cartModal').addEventListener('click', e=>{ if(e.target === $('cartModal')) closeCart(); });
document.querySelectorAll('.add-btn').forEach(btn=>btn.addEventListener('click',()=>addToCart(btn.dataset.id)));
$('cartItems').addEventListener('click', e=>{
  const change = e.target.closest('[data-change]');
  const remove = e.target.closest('[data-remove]');
  if(change) changeQuantity(change.dataset.change, Number(change.dataset.amount));
  if(remove){ delete cart[remove.dataset.remove]; saveCart(); updateCartCount(); renderCart(); }
});
$('clearCart').addEventListener('click',()=>{ cart={}; saveCart(); updateCartCount(); renderCart(); showToast('Carrito vacío'); });

// Cuenta
function openAccount(){ $('accountModal').classList.remove('hidden'); updateAccountUI(); }
function closeAccount(){ $('accountModal').classList.add('hidden'); }
function updateAccountUI(){ $('accountBtn').textContent = currentUser ? `Hola, ${currentUser.name.split(' ')[0]}` : 'Iniciar sesión'; }
$('accountBtn').addEventListener('click',openAccount);
$('closeAccount').addEventListener('click',closeAccount);
$('accountModal').addEventListener('click',e=>{if(e.target === $('accountModal')) closeAccount();});

document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); tab.classList.add('active');
  $('loginPanel').classList.toggle('hidden', tab.dataset.tab !== 'login');
  $('registerPanel').classList.toggle('hidden', tab.dataset.tab !== 'register');
}));

$('registerForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name = $('registerName').value.trim();
  const email = $('registerEmail').value.trim().toLowerCase();
  const password = $('registerPassword').value;
  if(password.length < 4){ $('registerMessage').textContent='La contraseña debe tener al menos 4 caracteres.'; return; }
  currentUser = {name,email,password};
  localStorage.setItem('horizonteUser',JSON.stringify(currentUser));
  $('registerMessage').textContent='Cuenta creada correctamente.';
  updateAccountUI();
  setTimeout(closeAccount,700);
  showToast('Cuenta creada. Ya podés pagar.');
});

$('loginForm').addEventListener('submit',e=>{
  e.preventDefault();
  const email=$('loginEmail').value.trim().toLowerCase(); const password=$('loginPassword').value;
  const saved=JSON.parse(localStorage.getItem('horizonteUser'));
  if(saved && saved.email===email && saved.password===password){
    currentUser=saved; localStorage.setItem('horizonteUser',JSON.stringify(currentUser)); $('loginMessage').textContent='Sesión iniciada.'; updateAccountUI(); setTimeout(closeAccount,500); showToast('Sesión iniciada correctamente');
  }else $('loginMessage').textContent='Datos incorrectos. Si no tenés cuenta, elegí “Crear cuenta”.';
});

// Pago: obliga a tener cuenta solamente aquí
$('checkoutBtn').addEventListener('click',()=>{
  if(!Object.keys(cart).length){ showToast('Agregá al menos un viaje al carrito.'); return; }
  if(!currentUser){ closeCart(); openAccount(); showToast('Para pagar necesitás una cuenta.'); return; }
  renderPayment(); $('paymentModal').classList.remove('hidden');
});
function renderPayment(){
  $('paymentSummary').innerHTML = Object.entries(cart).map(([id,qty])=>`<div class="payment-line"><span>${trips[id].name} × ${qty}</span><strong>${money(trips[id].price*qty)}</strong></div>`).join('');
  $('paymentTotal').textContent=money(cartTotal());
}
$('closePayment').addEventListener('click',()=> $('paymentModal').classList.add('hidden'));
$('paymentModal').addEventListener('click',e=>{if(e.target === $('paymentModal')) $('paymentModal').classList.add('hidden');});
$('finishPayment').addEventListener('click',()=>{
  const total=cartTotal(); cart={}; saveCart(); updateCartCount(); $('paymentModal').classList.add('hidden'); showToast(`Reserva confirmada por ${money(total)}`); setTimeout(openCart,600);
});

updateCartCount(); updateAccountUI(); renderCart();
