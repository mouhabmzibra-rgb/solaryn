(function () {
    'use strict';

    // Analytics helper — safe no-op if gtag not loaded (adblock, etc.)
    function track(eventName, params) {
        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, params || {});
        }
    }

    // Read a browser cookie by name (used to pull Meta's _fbp / _fbc
    // cookies and forward them to the server for CAPI matching).
    function readCookie(name) {
        const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\\/+^]/g, '\\$&') + '=([^;]*)'));
        return m ? decodeURIComponent(m[1]) : '';
    }

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
    function bindForm(formId, messageId, eventName) {
        const form = document.getElementById(formId);
        const messageEl = document.getElementById(messageId);
        if (!form) return;

        // Fire form_start once when user first interacts with this form
        let started = false;
        form.querySelectorAll('input, select, textarea').forEach(field => {
            field.addEventListener('focus', () => {
                if (started) return;
                started = true;
                track('form_start', { form_id: formId });
            }, { once: false });
        });

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
                    track('form_error', { form_id: formId, error: 'invalid_phone' });
                    return;
                }
                tel.value = cleaned;
            }

            submitBtn.textContent = 'كنرسلو...';
            submitBtn.disabled = true;
            messageEl.className = 'form-message';
            messageEl.textContent = '';

            // Generate event_id once — shared between Pixel (browser)
            // and CAPI (server) for Meta deduplication.
            const eventId = (window.crypto && crypto.randomUUID)
                ? crypto.randomUUID()
                : 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2);

            try {
                const payload = Object.fromEntries(new FormData(form).entries());
                payload.event_id = eventId;
                payload.fbp = readCookie('_fbp');
                payload.fbc = readCookie('_fbc');

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

                    // Conversion event — value in MAD
                    const qty = parseInt(payload.quantite, 10) || 1;
                    const value = eventName === 'generate_lead' ? qty * 99 : 0;

                    // GA4 event
                    track(eventName, {
                        form_id: formId,
                        currency: 'MAD',
                        value: value,
                        ville: payload.ville || '',
                        quantite: payload.quantite || '',
                        type: payload.type || ''
                    });

                    // Meta Pixel event (Lead for retail, Contact for B2B bulk)
                    if (typeof window.fbq === 'function') {
                        const fbEventName = eventName === 'generate_lead' ? 'Lead' : 'Contact';
                        window.fbq('track', fbEventName, {
                            value: value,
                            currency: 'MAD',
                            content_name: 'Solaryn SPF 50',
                            content_category: eventName === 'generate_lead' ? 'retail' : 'bulk'
                        }, {
                            eventID: eventId
                        });
                    }

                    form.reset();
                } else {
                    showMessage(messageEl, data.message || 'كاين مشكل. عاود حاول من بعد.', 'error');
                    track('form_error', { form_id: formId, error: 'server_error' });
                }
            } catch (err) {
                showMessage(messageEl, 'مشكل فالاتصال. تأكد من الإنترنت وعاود حاول.', 'error');
                track('form_error', { form_id: formId, error: 'network_error' });
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

    bindForm('leadForm', 'formMessage', 'generate_lead');
    bindForm('bulkForm', 'bulkMessage', 'bulk_lead');

    // Smooth-scroll for in-page anchors (iOS Safari fallback)
    // and CTA click tracking for #contact / #bulk
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', (e) => {
            const href = a.getAttribute('href');
            if (!href || href === '#' || href.length < 2) return;
            const target = document.querySelector(href);
            if (!target) return;

            e.preventDefault();
            const navbarH = 80;
            const top = target.getBoundingClientRect().top + window.pageYOffset - navbarH;
            window.scrollTo({ top: top, behavior: 'smooth' });
            history.pushState(null, '', href);

            if (href === '#leadForm' || href === '#bulk' || href === '#contact') {
                track('cta_click', {
                    target: href,
                    label: (a.textContent || '').trim().slice(0, 60)
                });
            }
        });
    });

    // WhatsApp click tracking — fires Contact event in Meta + GA4
    const waBtn = document.getElementById('whatsappBtn');
    if (waBtn) {
        waBtn.addEventListener('click', () => {
            const eventId = (window.crypto && crypto.randomUUID)
                ? crypto.randomUUID()
                : 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2);

            track('whatsapp_click', {
                source: 'floating_button',
                currency: 'MAD',
                value: 99
            });

            if (typeof window.fbq === 'function') {
                window.fbq('track', 'Contact', {
                    content_name: 'WhatsApp click',
                    content_category: 'whatsapp',
                    currency: 'MAD',
                    value: 99
                }, {
                    eventID: eventId
                });
            }
        });
    }

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
