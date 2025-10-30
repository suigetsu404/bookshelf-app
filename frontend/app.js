document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const addBookForm = document.getElementById('add-book-form');
    const bookshelfElement = document.getElementById('bookshelf-list');
    const loggedOutView = document.getElementById('logged-out-view');
    const loggedInView = document.getElementById('logged-in-view');
    const addBookSection = document.getElementById('add-book-section');
    const bookshelfSection = document.getElementById('bookshelf-section');
    const userInfo = document.getElementById('user-info');
    const logoutButton = document.getElementById('logout-button');
    const leaderboardList = document.getElementById('leaderboard-list');

    // const BACKEND_ORIGIN = 'http://127.0.0.1:5000';

    async function apiFetch(path, opts = {}) {
        // const url = path.startsWith('http') ? path : BACKEND_ORIGIN + path;
        const url = path;
        return fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
    }

    if (registerForm) {
        registerForm.action = '/api/register';
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(registerForm);
            const payload = { username: fd.get('username'), password: fd.get('password') };
            try {
                const res = await apiFetch('/api/register', { method: 'POST', body: JSON.stringify(payload) });
                const text = await res.text().catch(()=>null);
                let json = null;
                try { json = text ? JSON.parse(text) : null; } catch {}
                if (res.ok) {
                    alert(json?.message || 'Registered. Please log in.');
                    window.location.href = 'login.html';
                } else {
                    alert(json?.message || text || `Register failed (${res.status})`);
                }
            } catch (err) {
                console.error('Register error', err);
                alert('Network error during registration');
            }
        });
    }

    if (loginForm) {
        loginForm.action = '/api/login';
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(loginForm);
            const payload = { username: fd.get('username'), password: fd.get('password') };
            try {
                const res = await apiFetch('/api/login', { method: 'POST', body: JSON.stringify(payload) });
                const text = await res.text().catch(()=>null);
                let json = null;
                try { json = text ? JSON.parse(text) : null; } catch {}
                if (res.ok) {
                    document.body.setAttribute('data-username', payload.username);
                    if (typeof updateContent === 'function') updateContent();
                    window.location.href = 'index.html';
                } else {
                    alert(json?.message || text || `Login failed (${res.status})`);
                }
            } catch (err) {
                console.error('Login error', err);
                alert('Network error during login');
            }
        });
    }

    async function checkSessionAndInit() {
        try {
            const res = await apiFetch('/api/check_session', { method: 'GET' });
            if (res.ok) {
                const data = await res.json();
                onLoggedIn(data.username);
                await fetchAndDisplayBooks();
            } else {
                onLoggedOut();
            }
        } catch (err) {
            console.error('Session check error', err);
            onLoggedOut();
        }
    }

    function onLoggedIn(username) {
        document.body.setAttribute('data-username', username || '');
        if (typeof updateContent === 'function') updateContent();
        if (userInfo) userInfo.style.display = 'block';
        if (loggedOutView) loggedOutView.style.display = 'none';
        if (loggedInView) loggedInView.style.display = 'block';
        if (addBookSection) addBookSection.style.display = 'block';
        if (bookshelfSection) bookshelfSection.style.display = 'block';
    }
    function onLoggedOut() {
        document.body.removeAttribute('data-username');
        if (typeof updateContent === 'function') updateContent();
        if (userInfo) userInfo.style.display = 'none';
        if (loggedOutView) loggedOutView.style.display = 'block';
        if (loggedInView) loggedInView.style.display = 'none';
        if (addBookSection) addBookSection.style.display = 'none';
        if (bookshelfSection) bookshelfSection.style.display = 'none';
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                const res = await apiFetch('/api/logout', { method: 'POST' });
                if (res.ok) {
                    onLoggedOut();
                    window.location.href = 'index.html';
                } else {
                    alert('Logout failed');
                }
            } catch (err) {
                console.error('Logout error', err);
            }
        });
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                          .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    async function fetchAndDisplayBooks() {
        if (!bookshelfElement) return;
        try {
            const res = await apiFetch('/api/books', { method: 'GET' });
            if (!res.ok) {
                bookshelfElement.innerHTML = '';
                return;
            }
            const books = await res.json();
            bookshelfElement.innerHTML = '';
            books.forEach(b => bookshelfElement.appendChild(createBookCard(b)));
            if (typeof updateContent === 'function') {
                try { 
                    updateContent(); 
                } catch (e) {
                    console.error('Error during bulk translation:', e);
                }
            } else if (window.i18next && typeof window.i18next.t === 'function') {
                bookshelfElement.querySelectorAll('[data-i18n]').forEach(el => {
                    const key = el.getAttribute('data-i18n');
                    if(key) el.textContent = i18next.t(key);
                });
                bookshelfElement.querySelectorAll('.book-card').forEach(card => {
                    const cardBook = JSON.parse(card.dataset.book);
                    const rawStatus = cardBook.status || '';
                    const statusKey = STATUS_KEY_MAP[rawStatus] || rawStatus;
                    const statusEl = card.querySelector('.status');
                    if (statusEl) statusEl.textContent = i18next.t(statusKey);
                });
            }
        } catch (err) {
            console.error('Fetch books error', err);
        } finally {
            await fetchAndDisplayLeaderboard();
        }
    }

    const STATUS_KEY_MAP = {
        'To be read': 'status.to_be_read',
        'Reading': 'status.reading',
        'Read': 'status.read'
    };

    function createBookCard(book) {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.dataset.id = book.id;
        card.dataset.book = JSON.stringify(book);

        const rawStatus = book.status || '';
        const statusKey = STATUS_KEY_MAP[rawStatus] || rawStatus;
        const ratingVal = (book.rating !== null && book.rating !== undefined) ? book.rating : null;
        const reviewEsc = escapeHtml(book.review || '');

        const coverHtml = book.cover_image_url
            ? `<div class="book-cover" style="flex:0 0 120px;"><img src="${escapeHtml(book.cover_image_url)}" alt="cover" style="width:100%;height:auto;display:block;border-radius:4px;"></div>`
            : `<div class="book-cover" style="flex:0 0 120px;display:flex;align-items:center;justify-content:center;background:#f0f0f0;border-radius:4px;height:160px;color:#666" data-i18n="no_image">No image</div>`;

        const ratingOptions = ['','1','2','3','4','5'].map(opt => {
            const sel = (ratingVal !== null && String(ratingVal) === opt) ? ' selected' : '';
            const label = opt === '' ? '—' : `${opt}/5`;
            return `<option value="${opt}"${sel}>${label}</option>`;
        }).join('');

        const statusOptionsHtml = [
            `<option value="To be read" data-i18n="status.to_be_read"${rawStatus === 'To be read' ? ' selected' : ''}>To be read</option>`,
            `<option value="Reading" data-i18n="status.reading"${rawStatus === 'Reading' ? ' selected' : ''}>Reading</option>`,
            `<option value="Read" data-i18n="status.read"${rawStatus === 'Read' ? ' selected' : ''}>Read</option>`
        ].join('');

        card.innerHTML = `
            <div class="book-card-inner" style="display:flex;gap:16px;align-items:flex-start;margin:20px 0;">
                ${coverHtml}
                <div class="book-info" style="flex:1;">
                    <h3 style="margin:0 0 8px;">${escapeHtml(book.title)}</h3>
                    <p style="margin:0 0 6px;">
                        <strong data-i18n="author_label">Author:</strong>
                        <span class="author-text">${escapeHtml(book.author)}</span>
                    </p>
                    <p style="margin:0 0 6px;">
                        <strong data-i18n="status_label">Status:</strong>
                        <span class="status" data-i18n="${escapeHtml(statusKey)}">${escapeHtml(rawStatus)}</span>
                    </p>
                    <p style="margin:0 0 6px;">
                        <strong data-i18n="rating_label">Rating:</strong>
                        <span class="rating-display">${ratingVal !== null ? `${escapeHtml(String(ratingVal))}/5` : '—'}</span>
                    </p>
                    ${ reviewEsc ? `<blockquote style="margin:8px 0;padding-left:12px;border-left:3px solid #ddd;color:#333;">${reviewEsc}</blockquote>` : '' }
                    <div style="margin-top:8px;display:flex;gap:8px;align-items:center;">
                        <select class="status-select">
                            ${statusOptionsHtml}
                        </select>
                        <label style="display:flex;align-items:center;gap:6px;margin-left:8px;">
                            <span style="font-size:0.9em;color:#444" data-i18n="rating_label">Rating:</span>
                            <select class="rating-select" aria-label="Rating">
                                ${ratingOptions}
                            </select>
                        </label>
                        <button class="delete-btn">Delete</button>
                    </div>
                </div>
            </div>
        `;
    return card;
    }

    if (bookshelfElement) {
        bookshelfElement.addEventListener('change', async (e) => {
            const selStatus = e.target.closest('.status-select');
            const selRating = e.target.closest('.rating-select');

            if (!selStatus && !selRating) return;

            const card = (selStatus || selRating).closest('.book-card');
            const id = card.dataset.id;
            let book = {};
            try { book = JSON.parse(card.dataset.book || '{}'); } catch {}

            if (selStatus) {
                book.status = selStatus.value;
            }
            if (selRating) {
                const v = selRating.value === '' ? null : parseInt(selRating.value, 10);
                book.rating = Number.isInteger(v) ? v : null;
            }

            try {
                const res = await apiFetch(`/api/books/${id}`, { method: 'PUT', body: JSON.stringify({
                    title: book.title, author: book.author, status: book.status, rating: book.rating, review: book.review
                })});
                if (res.ok) {
                    if (selStatus) {
                        card.querySelector('.status').textContent = book.status;
                    }
                    if (selRating) {
                        card.querySelector('.rating-display').textContent = book.rating !== null ? `${book.rating}/5` : '—';
                    }
                    card.dataset.book = JSON.stringify(book);
                } else {
                    alert('Failed to update book');
                }
            } catch (err) {
                console.error('Update book error', err);
            }
    });

    bookshelfElement.addEventListener('click', async (e) => {
        const btn = e.target.closest('.delete-btn');
        if (!btn) return;
        const card = btn.closest('.book-card');
        const id = card.dataset.id;
        if (!confirm('Delete this book?')) return;
        try {
            const res = await apiFetch(`/api/books/${id}`, { method: 'DELETE' });
            if (res.ok) card.remove();
            else alert('Failed to delete');
        } catch (err) {
            console.error('Delete book error', err);
        }
    });
    }

    if (addBookForm) {
        addBookForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(addBookForm);
            const payload = {
                title: fd.get('title'),
                author: fd.get('author'),
                status: fd.get('status'),
                rating: fd.get('rating') ? parseInt(fd.get('rating'),10) : null,
                review: fd.get('review') || null
            };
            try {
                const res = await apiFetch('/api/books', { method: 'POST', body: JSON.stringify(payload) });
                const text = await res.text().catch(()=>null);
                if (res.ok) {
                    await fetchAndDisplayBooks();
                    addBookForm.reset();
                } else {
                    alert(text || `Add book failed (${res.status})`);
                }
            } catch (err) {
                console.error('Add book error', err);
            }
        });
    }

    async function fetchAndDisplayLeaderboard() {
        if (!leaderboardList) return;
        try {
            const res = await apiFetch('/api/leaderboard', { method: 'GET' });
            if (!res.ok) {
                leaderboardList.innerHTML = '<p>Could not load leaderboard</p>';
                return;
            }
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
                leaderboardList.innerHTML = '<p>No entries yet</p>';
                return;
            }
            leaderboardList.innerHTML = '';
            data.forEach((row, idx) => {
                const count = row.books_read ?? row.book_count ?? row.book_count ?? 0;
                const item = document.createElement('div');
                item.className = 'leaderboard-row';
                const i18n = window.i18next;
                const bookText = i18n
                    ? i18n.t('book', { count: count }) 
                    : (count === 1 ? 'book' : 'books');
                item.textContent = `${idx + 1}. ${row.username} — ${count} ${bookText}`;
                leaderboardList.appendChild(item);
            });
        } catch (err) {
            console.error('Leaderboard fetch error', err);
            leaderboardList.innerHTML = '<p>Error loading leaderboard</p>';
        }
    }

    if (document.body.contains(document.getElementById('bookshelf-list')) || document.body.contains(document.getElementById('add-book-form')) || document.body.contains(document.getElementById('logout-button'))) {
        checkSessionAndInit();
    }
});