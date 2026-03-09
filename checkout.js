import { db, collection, addDoc, getDoc, doc, onSnapshot } from "./firebase-config.js";
import { initNavbar, formatPrice } from "./navbar.js";

document.addEventListener('DOMContentLoaded', async () => {
    initNavbar();
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const selection = urlParams.get('selection');
    const qty = parseInt(urlParams.get('qty')) || 1;

    // --- State ---
    let cartItems = [];
    let isCartMode = localStorage.getItem('checkoutMode') === 'cart';
    let productData = null; // Used for single-product mode

    // --- Redirect Fix: Only redirect if both single-product ID and cart-mode are missing ---
    if (!productId && !isCartMode) {
        window.location.href = 'index.html';
        return;
    }
    let shopData = {}; // Initialize as empty object to avoid TypeError
    let dcPerProduct = 200;
    let finalSubtotal = 0;
    let finalTotal = 0;
    let finalDC = 0;
    let selectedPaymentMethod = 'Meezan';
    let uploadedProofBase64 = null;

    // --- DOM Elements ---
    const orderSummary = document.getElementById('order-summary');
    const subtotalEl = document.getElementById('subtotal');
    const dcEl = document.getElementById('delivery-charges');
    const totalEl = document.getElementById('total-amount');
    const paymentInstructions = document.getElementById('payment-instructions');
    const paymentOpts = document.querySelectorAll('.payment-opt');
    const uploadBox = document.getElementById('upload-box');
    const proofInput = document.getElementById('proof-upload');
    const previewContainer = document.getElementById('preview-container');
    const imagePreview = document.getElementById('image-preview');
    const removeProofBtn = document.getElementById('remove-proof');
    const checkoutForm = document.getElementById('checkout-form');
    const placeOrderBtn = document.getElementById('place-order-btn');

    // --- Data Fetching ---
    try {
        if (isCartMode) {
            cartItems = JSON.parse(localStorage.getItem('cart') || '[]');
            if (cartItems.length === 0) {
                window.location.href = 'index.html';
                return;
            }

            // Calculate for Cart
            let totalQty = 0;
            cartItems.forEach(item => {
                const rawPrice = parseFloat(String(item.price || "0").replace(/[^\d.]/g, '')) || 0;
                let itemPrice = 0;

                const selection = item.selection || "";
                const itemQty = parseInt(item.qty) || 1;
                totalQty += itemQty;
                if (item.cat === 'Loose Oil') {
                    const mlMatch = selection.match(/(\d+)ml/);
                    const ml = mlMatch ? parseInt(mlMatch[1]) : 3;
                    const perMlPrice = rawPrice / 3;
                    itemPrice = (perMlPrice * ml) * itemQty;
                } else {
                    itemPrice = rawPrice * itemQty;
                }
                finalSubtotal += itemPrice;
            });
            finalDC = totalQty * dcPerProduct;
            finalTotal = finalSubtotal + finalDC;

            renderCartSummary(cartItems);
            updateBill(finalSubtotal, finalDC, finalTotal);

        } else {
            if (!productId) {
                window.location.href = 'index.html';
                return;
            }
            // One-time fetch for single product
            const prodSnap = await getDoc(doc(db, "products", productId));
            if (!prodSnap.exists()) throw new Error("Product not found");
            productData = prodSnap.data();

            const rawPrice = parseFloat(String(productData.price).replace(/[^\d.]/g, '')) || 0;
            let basePriceNum = 0;

            if (productData.cat === 'Loose Oil') {
                const mlMatch = (selection || "3ml").match(/(\d+)ml/);
                const ml = mlMatch ? parseInt(mlMatch[1]) : 3;
                const perMlPrice = rawPrice / 3;
                basePriceNum = (perMlPrice * ml) * qty;
            } else {
                basePriceNum = rawPrice * qty;
            }

            finalSubtotal = Math.round(basePriceNum);
            finalDC = dcPerProduct * qty;
            finalTotal = finalSubtotal + finalDC;

            renderSingleSummary(productData, selection, qty);
            updateBill(finalSubtotal, finalDC, finalTotal);
        }

        // Real-time listener for shop settings
        onSnapshot(doc(db, "shopInfo", "details"), (snap) => {
            if (snap.exists()) {
                shopData = snap.data();
            } else {
                shopData = {};
            }
            updatePaymentDetails();
        }, (err) => {
            console.error("Error loading shopInfo:", err);
            shopData = {}; // Ensure shopData is at least an empty object on error
            updatePaymentDetails(); // Resolution: fill with "not set" message
        });

    } catch (err) {
        console.error(err);
        showToast("Error loading checkout details.", "error");
    }

    // --- UI Helpers ---
    function renderSingleSummary(p, sel, q) {
        orderSummary.innerHTML = `
            <div class="checkout-item">
                <div class="item-img-wrap">
                    <img src="${p.url}" alt="${p.name}" onerror="this.src='assets/logo.png'; this.classList.add('placeholder');">
                </div>
                <div class="item-details">
                    <h4>${p.name}</h4>
                    <p>${p.cat} | ${sel || (q + ' Pcs')}</p>
                    <span class="item-price">${formatPrice(finalSubtotal)}</span>
                </div>
            </div>
        `;
    }

    function renderCartSummary(items) {
        orderSummary.innerHTML = items.map((p, index) => {
            const rawPrice = parseFloat(String(p.price || "0").replace(/[^\d.]/g, '')) || 0;
            let itemPrice = 0;
            const selection = p.selection || "";

            if (p.cat === 'Loose Oil') {
                const mlMatch = selection.match(/(\d+)ml/);
                const ml = mlMatch ? parseInt(mlMatch[1]) : 3;
                const perMlPrice = rawPrice / 3;
                itemPrice = perMlPrice * ml;
            } else {
                itemPrice = rawPrice * (parseInt(p.qty) || 1);
            }

            return `
                <div class="checkout-item" data-index="${index}">
                    <button type="button" class="btn-remove-item" title="Remove Item">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    <div class="item-img-wrap">
                        <img src="${p.url}" alt="${p.name}" onerror="this.src='assets/logo.png'; this.classList.add('placeholder');">
                    </div>
                    <div class="item-details">
                        <h4>${p.name}</h4>
                        <p>${p.cat} | ${selection}</p>
                        <span class="item-price">${formatPrice(itemPrice)}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Attach removal events
        orderSummary.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.onclick = (e) => {
                const index = parseInt(e.currentTarget.closest('.checkout-item').dataset.index);
                removeItem(index);
            };
        });
    }

    function removeItem(index) {
        if (!isCartMode) return;

        cartItems.splice(index, 1);
        localStorage.setItem('cart', JSON.stringify(cartItems));

        if (cartItems.length === 0) {
            window.location.href = 'index.html';
            return;
        }

        // Recalculate totals
        finalSubtotal = 0;
        let totalQty = 0;
        cartItems.forEach(item => {
            const rawPrice = parseFloat(String(item.price || "0").replace(/[^\d.]/g, '')) || 0;
            let itemPrice = 0;
            const selection = item.selection || "";
            const itemQty = parseInt(item.qty) || 1;
            totalQty += itemQty;
            if (item.cat === 'Loose Oil') {
                const mlMatch = selection.match(/(\d+)ml/);
                const ml = mlMatch ? parseInt(mlMatch[1]) : 3;
                const perMlPrice = rawPrice / 3;
                itemPrice = (perMlPrice * ml) * itemQty;
            } else {
                itemPrice = rawPrice * itemQty;
            }
            finalSubtotal += itemPrice;
        });
        finalDC = totalQty * dcPerProduct;
        finalTotal = finalSubtotal + finalDC;

        renderCartSummary(cartItems);
        updateBill(finalSubtotal, finalDC, finalTotal);
        updatePaymentDetails();
        showToast("Item removed from cart");
    }

    function updateBill(sub, dc, total) {
        subtotalEl.textContent = formatPrice(sub);
        dcEl.textContent = formatPrice(dc);
        totalEl.textContent = formatPrice(total);
    }

    function updatePaymentDetails() {
        const methodKey = selectedPaymentMethod.toLowerCase();
        const accInfo = shopData[methodKey] || "";

        paymentInstructions.innerHTML = `
            <p style="font-size: 0.9rem; color: #666; margin-bottom: 10px;">Please transfer <strong>${formatPrice(finalTotal)}</strong> to the following account:</p>
            <div class="account-box">
                <div class="account-info">
                    <strong>${selectedPaymentMethod}</strong>
                    <p style="font-size: 0.85rem; margin: 5px 0; color: var(--gold); font-weight: 600;">
                        ${shopData.ownerName || shopData.name || 'BIN MAZHAR'} (ACCOUNT TITLE)
                    </p>
                    <span>${accInfo || "Account details not set yet. Please contact support in Admin Panel."}</span>
                </div>
                ${accInfo ? `
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn-copy" data-copy="${accInfo}" title="Copy Account">
                        <i class="fas fa-copy"></i> Copy Account
                    </button>
                </div>` : ''}
            </div>
        `;

        // Handle Combined Copy & App Launch Logic
        const copyBtn = paymentInstructions.querySelector('.btn-copy');
        if (copyBtn) {
            copyBtn.onclick = () => {
                const text = copyBtn.getAttribute('data-copy');

                // 1. Copy to clipboard
                navigator.clipboard.writeText(text).then(() => {
                    // 2. Visual Feedback
                    const originalContent = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    showToast("Account copied!");
                    setTimeout(() => copyBtn.innerHTML = originalContent, 2000);
                }).catch(err => {
                    console.error("Copy failed:", err);
                    showToast("Failed to copy. Please copy manually.", "error");
                });
            };
        }
    }

    // --- Event Listeners ---
    paymentOpts.forEach(opt => {
        opt.onclick = () => {
            paymentOpts.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            selectedPaymentMethod = opt.getAttribute('data-method');
            updatePaymentDetails();
        };
    });

    // Upload Logic
    uploadBox.onclick = () => proofInput.click();

    proofInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast("File too large (Max 5MB)", "error");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            uploadedProofBase64 = event.target.result;
            imagePreview.src = uploadedProofBase64;
            previewContainer.style.display = 'block';
            uploadBox.querySelector('.upload-inner').style.display = 'none';
            checkFormValidity();
        };
        reader.readAsDataURL(file);
    };

    removeProofBtn.onclick = (e) => {
        e.stopPropagation();
        uploadedProofBase64 = null;
        imagePreview.src = '';
        previewContainer.style.display = 'none';
        uploadBox.querySelector('.upload-inner').style.display = 'block';
        proofInput.value = '';
        checkFormValidity();
    };

    function checkFormValidity() {
        const isReady = uploadedProofBase64 !== null;
        placeOrderBtn.disabled = !isReady;
    }

    // --- Submit Logic ---
    checkoutForm.onsubmit = async (e) => {
        e.preventDefault();

        placeOrderBtn.disabled = true;
        placeOrderBtn.textContent = 'Submitting Order...';

        const orderData = {
            custName: document.getElementById('custName').value.trim(),
            custPhone: document.getElementById('custPhone').value.trim(),
            custAddress: document.getElementById('custAddress').value.trim(),
            custCity: document.getElementById('custCity').value.trim(),

            // For Cart: multiple items
            items: isCartMode ? cartItems.map(i => ({
                id: i.id,
                name: i.name,
                url: i.url,
                cat: i.cat,
                selection: i.selection,
                qty: i.qty,
                price: i.price
            })) : [{
                id: productId,
                name: productData.name,
                url: productData.url,
                cat: productData.cat,
                selection: selection || (qty + ' Pcs'),
                qty: qty,
                price: productData.price
            }],

            // Legacy support for single product (Admin might still use this)
            productId: isCartMode ? (cartItems[0]?.id || '') : (productId || ''),
            productName: isCartMode ? (cartItems[0]?.name || 'Multi-item Order') : (productData.name || ''),
            productUrl: isCartMode ? (cartItems[0]?.url || '') : (productData.url || ''),
            selection: isCartMode ? `${cartItems.length} Items in Cart` : (selection || (qty + ' Pcs')),

            subtotal: finalSubtotal,
            deliveryCharges: finalDC,
            totalPrice: finalTotal,
            paymentMethod: selectedPaymentMethod,
            paymentProof: uploadedProofBase64,
            status: 'Pending',
            createdAt: new Date(),
            phone: document.getElementById('custPhone').value.trim(), // For track-order.js compatibility
            timestamp: new Date() // For track-order.js compatibility
        };

        try {
            const docRef = await addDoc(collection(db, "orders"), orderData);
            showSuccessModal(docRef.id);
        } catch (err) {
            console.error(err);
            showToast("Failed to place order. Try again.", "error");
            placeOrderBtn.disabled = false;
            placeOrderBtn.textContent = 'Confirm Order & Submit Proof';
        }
    };

    function showSuccessModal(orderId) {
        const modal = document.getElementById('order-success-modal');
        document.getElementById('success-order-id').textContent = `#${orderId.slice(-6).toUpperCase()}`;
        modal.style.display = 'flex';

        const custPhone = document.getElementById('custPhone').value.trim();
        document.getElementById('close-success').onclick = () => {
            if (isCartMode) localStorage.removeItem('cart'); // Clear cart after success
            localStorage.removeItem('checkoutMode');
            window.location.href = `track-order.html?phone=${custPhone}`;
        };
    }

    function showToast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> <span>${msg}</span>`;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('active'));
        setTimeout(() => {
            toast.classList.remove('active');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
});
