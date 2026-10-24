// ===== Mini Shop =====
// Данные берём из публичного API. Если оно недоступно - показываем демо-товары из data.js.

const API_URL = "https://dummyjson.com/products?limit=30";
const CART_KEY = "miniShopCart";
const ORDERS_KEY = "miniShopOrders";

let allProducts = [];   // все товары
let cart = [];          // корзина: [{id, title, price, thumbnail, emoji, qty}]
let searchTimer = null; // таймер для задержки поиска

// ---------- Элементы страницы ----------
const productsBox = document.getElementById("products");
const statusBox = document.getElementById("status");
const resultInfo = document.getElementById("resultInfo");
const searchInput = document.getElementById("searchInput");
const categorySelect = document.getElementById("categorySelect");
const sortSelect = document.getElementById("sortSelect");
const cartBtn = document.getElementById("cartBtn");
const cartCount = document.getElementById("cartCount");
const cartPanel = document.getElementById("cartPanel");
const overlay = document.getElementById("overlay");
const closeCart = document.getElementById("closeCart");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const checkoutBtn = document.getElementById("checkoutBtn");
const clearBtn = document.getElementById("clearBtn");
const checkoutForm = document.getElementById("checkoutForm");
const orderMessage = document.getElementById("orderMessage");

// ---------- Вспомогательные функции ----------
// Защита от вставки чужого HTML (данные приходят с сервера)
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPrice(number) {
  return "$" + Number(number).toFixed(2);
}

function getTotal() {
  let total = 0;
  cart.forEach(function (item) {
    total += item.price * item.qty;
  });
  return total;
}

// ---------- Загрузка товаров ----------
async function loadProducts() {
  statusBox.textContent = "Загрузка товаров...";
  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 6000); // не ждём дольше 6 секунд

  try {
    const response = await fetch(API_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error("Ошибка сервера: " + response.status);
    }
    const data = await response.json();
    if (!data.products || data.products.length === 0) {
      throw new Error("Пустой список товаров");
    }
    allProducts = data.products;
    statusBox.textContent = "";
  } catch (error) {
    console.warn("API недоступен, используем демо-товары:", error);
    allProducts = fallbackProducts;
    statusBox.textContent = "Не удалось загрузить товары с сервера. Показаны демо-товары.";
  } finally {
    clearTimeout(timeout);
  }

  fillCategories();
  renderProducts();
}

function fillCategories() {
  const categories = [];
  allProducts.forEach(function (product) {
    if (categories.indexOf(product.category) === -1) {
      categories.push(product.category);
    }
  });
  categories.sort();
  categories.forEach(function (name) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    categorySelect.appendChild(option);
  });
}

// ---------- Поиск, фильтр, сортировка ----------
function getFilteredProducts() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categorySelect.value;

  // filter создаёт новый массив, поэтому sort ниже не ломает allProducts
  const result = allProducts.filter(function (product) {
    const matchName = product.title.toLowerCase().indexOf(query) !== -1;
    const matchCategory = category === "all" || product.category === category;
    return matchName && matchCategory;
  });

  if (sortSelect.value === "asc") {
    result.sort(function (a, b) { return a.price - b.price; });
  } else if (sortSelect.value === "desc") {
    result.sort(function (a, b) { return b.price - a.price; });
  }
  return result;
}

function renderProducts() {
  const list = getFilteredProducts();
  resultInfo.textContent = "Найдено товаров: " + list.length;

  if (list.length === 0) {
    productsBox.innerHTML = '<p class="empty">Ничего не найдено. Измените запрос или выберите другую категорию.</p>';
    return;
  }

  let html = "";
  list.forEach(function (p) {
    let picture;
    if (p.thumbnail) {
      picture = '<img src="' + escapeHtml(p.thumbnail) + '" alt="' + escapeHtml(p.title) + '" loading="lazy">';
    } else {
      picture = '<div class="emoji" aria-hidden="true">' + (p.emoji || "📦") + "</div>";
    }
    html +=
      '<article class="card">' + picture +
      '<div class="card-body">' +
      "<h3>" + escapeHtml(p.title) + "</h3>" +
      '<p class="cat">' + escapeHtml(p.category) + "</p>" +
      '<p class="desc">' + escapeHtml(p.description || "") + "</p>" +
      '<div class="card-bottom">' +
      '<span class="price">' + formatPrice(p.price) + "</span>" +
      '<button class="add-btn" type="button" data-id="' + p.id + '">В корзину</button>' +
      "</div></div></article>";
  });
  productsBox.innerHTML = html;
}

// ---------- Корзина ----------
function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY));
    if (Array.isArray(saved)) {
      cart = saved;
    }
  } catch (error) {
    cart = []; // если в localStorage мусор - начинаем с пустой корзины
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch (error) {
    console.warn("Не удалось сохранить корзину", error);
  }
}

function addToCart(id) {
  const product = allProducts.find(function (p) { return p.id === id; });
  if (!product) return;

  const item = cart.find(function (i) { return i.id === id; });
  if (item) {
    item.qty++;
  } else {
    cart.push({
      id: product.id,
      title: product.title,
      price: product.price,
      thumbnail: product.thumbnail || "",
      emoji: product.emoji || "📦",
      qty: 1
    });
  }
  orderMessage.classList.remove("show");
  saveCart();
  renderCart();
}

function changeQty(id, delta) {
  const item = cart.find(function (i) { return i.id === id; });
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(id);
    return;
  }
  saveCart();
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(function (i) { return i.id !== id; });
  saveCart();
  renderCart();
}

function renderCart() {
  let count = 0;
  let html = "";

  cart.forEach(function (item) {
    count += item.qty;
    html +=
      '<div class="cart-item">' +
      '<span class="name">' + escapeHtml(item.title) + "</span>" +
      '<span class="sum">' + formatPrice(item.price * item.qty) + "</span>" +
      '<div class="qty">' +
      '<button type="button" data-action="dec" data-id="' + item.id + '" aria-label="Уменьшить количество">−</button>' +
      "<span>" + item.qty + "</span>" +
      '<button type="button" data-action="inc" data-id="' + item.id + '" aria-label="Увеличить количество">+</button>' +
      '<button type="button" class="remove" data-action="remove" data-id="' + item.id + '">Удалить</button>' +
      "</div></div>";
  });

  if (cart.length === 0) {
    html = '<p class="empty">Корзина пуста. Добавьте товары из каталога.</p>';
    checkoutForm.classList.remove("show");
  }

  cartItems.innerHTML = html;
  cartTotal.textContent = formatPrice(getTotal());
  cartCount.textContent = count;
  checkoutBtn.disabled = cart.length === 0;
  clearBtn.disabled = cart.length === 0;
}

function openCart() {
  cartPanel.classList.add("open");
  overlay.classList.add("show");
}

function closeCartPanel() {
  cartPanel.classList.remove("open");
  overlay.classList.remove("show");
}

// ---------- Оформление заказа ----------
function setError(id, text) {
  document.getElementById(id).textContent = text;
}

function submitOrder(event) {
  event.preventDefault();

  const name = document.getElementById("nameInput").value.trim();
  const phone = document.getElementById("phoneInput").value.trim();
  const address = document.getElementById("addressInput").value.trim();
  let isValid = true;

  if (name.length < 2) {
    setError("nameError", "Введите имя (минимум 2 символа)");
    isValid = false;
  } else {
    setError("nameError", "");
  }

  // разрешаем цифры, пробелы, + - ( ) и требуем минимум 7 цифр
  const digits = phone.replace(/\D/g, "");
  if (!/^[\d\s+()-]+$/.test(phone) || digits.length < 7) {
    setError("phoneError", "Введите корректный номер телефона");
    isValid = false;
  } else {
    setError("phoneError", "");
  }

  if (address.length < 5) {
    setError("addressError", "Укажите адрес доставки (минимум 5 символов)");
    isValid = false;
  } else {
    setError("addressError", "");
  }

  if (!isValid || cart.length === 0) return;

  const order = {
    id: Date.now(),
    date: new Date().toLocaleString(),
    customer: { name: name, phone: phone, address: address },
    items: cart.slice(),
    total: getTotal()
  };

  try {
    const orders = JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
    orders.push(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch (error) {
    console.warn("Не удалось сохранить заказ", error);
  }

  cart = [];
  saveCart();
  renderCart();
  checkoutForm.reset();
  checkoutForm.classList.remove("show");
  orderMessage.textContent = "Спасибо, " + name + "! Заказ №" + order.id + " оформлен. Сумма: " + formatPrice(order.total) + ".";
  orderMessage.classList.add("show");
}

// ---------- События ----------
// Задержка 300 мс: не перерисовываем список на каждую букву
searchInput.addEventListener("input", function () {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderProducts, 300);
});
categorySelect.addEventListener("change", renderProducts);
sortSelect.addEventListener("change", renderProducts);

// Делегирование: один обработчик на весь список товаров
productsBox.addEventListener("click", function (event) {
  const button = event.target.closest(".add-btn");
  if (!button) return;
  addToCart(Number(button.dataset.id));
  button.textContent = "Добавлено ✓";
  setTimeout(function () { button.textContent = "В корзину"; }, 900);
});

cartItems.addEventListener("click", function (event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  if (action === "inc") changeQty(id, 1);
  if (action === "dec") changeQty(id, -1);
  if (action === "remove") removeFromCart(id);
});

cartBtn.addEventListener("click", openCart);
closeCart.addEventListener("click", closeCartPanel);
overlay.addEventListener("click", closeCartPanel);
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") closeCartPanel();
});

checkoutBtn.addEventListener("click", function () {
  checkoutForm.classList.toggle("show");
  if (checkoutForm.classList.contains("show")) {
    document.getElementById("nameInput").focus();
  }
});
clearBtn.addEventListener("click", function () {
  cart = [];
  saveCart();
  renderCart();
});
checkoutForm.addEventListener("submit", submitOrder);

// ---------- Старт ----------
loadCart();
renderCart();
loadProducts();
