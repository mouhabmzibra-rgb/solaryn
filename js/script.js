(function () {
    'use strict';

    // Mobile menu toggle
    const toggle = document.querySelector('.menu-toggle');
    const links = document.querySelector('.nav-links');
    if (toggle && links) {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            links.classList.toggle('active');
        });
        links.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', () => {
                toggle.classList.remove('active');
                links.classList.remove('active');
            });
        });
    }

    // Form submission via fetch (no page reload)
    function bindForm(formId, messageId) {
        const form = document.getElementById(formId);
        const messageEl = document.getElementById(messageId);
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;

            // Phone validation (Moroccan)
            const tel = form.querySelector('input[type="tel"]');
            if (tel) {
                const cleaned = tel.value.replace(/\s/g, '');
                if (!/^(0|\+212)[5-7][0-9]{8}$/.test(cleaned)) {
                    showMessage(messageEl, 'رقم الهاتف ماشي صحيح. مثال: 0612345678', 'error');
                    tel.focus();
                    return;
                }
                tel.value = cleaned;
            }

            submitBtn.textContent = 'كنرسلو...';
            submitBtn.disabled = true;
            messageEl.className = 'form-message';
            messageEl.textContent = '';

            try {
                const payload = Object.fromEntries(new FormData(form).entries());
                const res = await fetch(form.action, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
                const data = await res.json().catch(() => ({ ok: res.ok }));

                if (res.ok && data.ok) {
                    showMessage(messageEl, data.message || 'شكرا ! توصلنا بطلبيتك. غادي نعيطو ليك قريب.', 'success');
                    form.reset();
                } else {
                    showMessage(messageEl, data.message || 'كاين مشكل. عاود حاول من بعد.', 'error');
                }
            } catch (err) {
                showMessage(messageEl, 'مشكل فالاتصال. تأكد من الإنترنت وعاود حاول.', 'error');
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    function showMessage(el, text, type) {
        el.textContent = text;
        el.className = 'form-message ' + type;
        if (type === 'success') {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    bindForm('leadForm', 'formMessage');
    bindForm('bulkForm', 'bulkMessage');

    // Navbar shadow on scroll
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 10) {
                navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)';
            } else {
                navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.04)';
            }
        });
    }
})();
