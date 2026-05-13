//AUTH VARIABLES
let authToken = null;
let currentUserId = null;
let currentUsername = null;
let currentPage = 1;

// DEBOUNCE 
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// IGDB SEARCH
async function searchIGDB(query) {
    if (!query || query.length < 2) {
        document.getElementById('searchResults').style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(`/api/search-games?query=${encodeURIComponent(query)}`);
        const games = await response.json();
        displayResults(games);
    } catch (error) {
        console.error('Search failed:', error);
    }
}

function displayResults(games) {
    const container = document.getElementById('searchResults');

    if (!games || games.length === 0) {
        container.innerHTML = '<div class="search-result-item">NO GAMES FOUND</div>';
        container.style.display = 'block';
        return;
    }

    window._searchResults = games;

    container.innerHTML = games.map((game, index) => {
        const coverUrl = game.cover || '';
        const year = game.first_release_date 
            ? new Date(game.first_release_date * 1000).getFullYear() 
            : '';
        const rating = game.rating 
            ? `⭐ ${(game.rating / 10).toFixed(1)}` 
            : '';

        return `
            <div class="search-result-item" data-index="${index}">
                ${coverUrl 
                    ? `<img src="${coverUrl}" class="search-result-cover">` 
                    : '<div class="search-result-cover" style="width:40px;height:53px;background:#222;display:flex;align-items:center;justify-content:center;">🎮</div>'
                }
                <div class="search-result-info">
                    <div class="search-result-title">${escapeHtml(game.name)}</div>
                    <div class="search-result-meta">${year} ${rating}</div>
                </div>
            </div>
        `;
    }).join('');

    container.style.display = 'block';

    container.querySelectorAll('.search-result-item').forEach((el, index) => {
        el.addEventListener('click', () => selectGame(window._searchResults[index]));
    });
}

function selectGame(game) {
    document.getElementById('title').value = game.name;

    const platforms = game.platforms ? game.platforms.map(p => p.name) : [];
    document.getElementById('platform').value = platforms.join(', ');

    const coverUrl = game.cover || '';
    document.getElementById('coverUrl').value = coverUrl;

    const preview = document.getElementById('selectedPreview');
    const previewImg = document.getElementById('previewImg');
    const previewTitle = document.getElementById('previewTitle');
    const platformsDiv = document.getElementById('previewPlatforms');

    previewTitle.textContent = game.name;

    platformsDiv.innerHTML = platforms.map(p =>
        `<span class="platform-tag">${p}</span>`
    ).join('');

    if (coverUrl) {
        previewImg.src = coverUrl;
        preview.style.display = 'flex';
    } else {
        preview.style.display = 'none';
    }

    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('searchGame').value = game.name;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

//AUTH
async function register() {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    
    if (!username || !password) {
        alert('Username and password required');
        return;
    }
    
    const response = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    
    if (response.ok) {
        const data = await response.json();
        authToken = data.token;
        currentUserId = data.user.id;
        currentUsername = data.user.username;
        localStorage.setItem('token', authToken);
        localStorage.setItem('userId', currentUserId);
        localStorage.setItem('username', currentUsername);
        showMainApp();
    } else {
        const error = await response.json();
        alert(error.error);
    }
}

async function login() {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    
    if (!username || !password) {
        alert('Username and password required');
        return;
    }
    
    const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    
    if (response.ok) {
        const data = await response.json();
        authToken = data.token;
        currentUserId = data.user.id;
        currentUsername = data.user.username;
        localStorage.setItem('token', authToken);
        localStorage.setItem('userId', currentUserId);
        localStorage.setItem('username', currentUsername);
        showMainApp();
    } else {
        const error = await response.json();
        alert(error.error);
    }
}

function logout() {
    authToken = null;
    currentUserId = null;
    currentUsername = null;
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    showAuthForm();
}

// GAME CRUD
async function loadGames() {
    const status = document.getElementById('statusFilter').value;
    const search = document.getElementById('searchFilter').value;
    const sort_by = document.getElementById('sortBy').value;
    
    let url = `/games?page=${currentPage}&limit=9`;
    if (status) url += `&status=${status}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (sort_by) url += `&sort_by=${sort_by}`;
    
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) {
        if (response.status === 401) logout();
        return;
    }
    
    const data = await response.json();
    const games = data.games;
    const stats = data.stats;
    const pagination = data.pagination;
    
    // Update stats
    document.getElementById('statTotal').textContent = stats.total || 0;
    document.getElementById('statPlanned').textContent = stats.planned || 0;
    document.getElementById('statCompleted').textContent = stats.completed || 0;
    document.getElementById('statHours').textContent = (stats.total_hours || 0).toFixed(1);
    
    const list = document.getElementById('list');
    const counter = document.getElementById('counter');
   
    list.innerHTML = '';
    
    if (!games || games.length === 0) {
        list.innerHTML = '<div class="empty">NO GAMES YET<br><span>[ START YOUR BACKLOG ]</span></div>';
        return;
    }
    
    games.forEach(game => {
        const li = document.createElement('li');
        li.className = 'game-item' + (game.status === 'completed' ? ' completed' : '');
        
        // Format cover image
        let coverHtml = '';
        if (game.cover_url) {
            coverHtml = `<img src="${game.cover_url}" class="game-cover-img" onerror="this.src='https://via.placeholder.com/300x180?text=NO+COVER'">`;
        } else {
            coverHtml = `<div class="game-cover-img" style="display:flex;align-items:center;justify-content:center;font-size:48px;">🎮</div>`;
        }
        
        li.innerHTML = `
            ${coverHtml}
            <div class="game-info">
                <div class="game-title">${escapeHtml(game.title)}</div>
                <div class="game-meta">
                        ${game.platform ? game.platform.split(', ').map(p => `<span class="platform-badge">${p}</span>`).join('') : '<span class="platform-badge">???</span>'
                        }
                <span class="status-badge status-${game.status}">${game.status.toUpperCase()}</span>
                </div>
                <div class="stars">${renderStars(game.rating)}</div>
                <div class="game-details">
                    <span>⏱️ ${game.hours || 0}h</span>
                    ${game.added_at ? `<span>📅 ${game.added_at}</span>` : ''}
                </div>
                ${game.tags ? `<div class="tags">🏷️ ${escapeHtml(game.tags)}</div>` : ''}
            </div>
            <div class="game-actions">
                ${game.status !== 'completed' ? `
                <button class="btn-complete" onclick="completeGame(${game.id})">✓ COMPLETE</button>` : ''}
                <button class="btn-edit" onclick="openEditModal(${game.id})">✎ EDIT</button>
                <button class="btn-delete" onclick="deleteGame(${game.id})">✗ DEL</button>
            </div>
        `;
        list.appendChild(li);
    });
    
    // Update pagination
    const paginationDiv = document.getElementById('pagination');
    if (pagination.pages > 1) {
        let pagesHtml = '';
        for (let i = 1; i <= pagination.pages; i++) {
            pagesHtml += `<button onclick="goToPage(${i})" style="${i === pagination.page ? 'background:#ff00ff; border-color:#ff00ff;' : ''}">${i}</button>`;
        }
        paginationDiv.innerHTML = pagesHtml;
    } else {
        paginationDiv.innerHTML = '';
    }
}

function goToPage(page) {
    currentPage = page;
    loadGames();
}

async function addGame() {
    const title = document.getElementById('title').value.trim();
    const platform = document.getElementById('platform').value.trim();
    const rating = parseInt(document.getElementById('rating').value);
    const hours = parseFloat(document.getElementById('hours').value) || 0;
    const status = document.getElementById('gameStatus').value;
    const tags = document.getElementById('tags').value;
    const coverUrl = document.getElementById('coverUrl').value;
 
    if (!title) { alert('Enter a game title!'); return; }
    if (rating && (rating < 1 || rating > 5)) { alert('Rating must be 1-5'); return; }
 
    const response = await fetch('/games', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ 
            title, platform, status, rating, hours, tags,
            cover_url: coverUrl 
        })
    });
    
    if (response.ok) {
        clearForm();
        loadGames();
    } else {
        const error = await response.json();
        alert(error.error);
    }
}

async function deleteGame(id) {
    if (!confirm('Delete this game?')) return;
    const response = await fetch('/games/' + id, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (response.ok) loadGames();
}

async function completeGame(id) {
    const response = await fetch('/games/' + id, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ status: 'completed' })
    });
    if (response.ok) loadGames();
}

async function openEditModal(id) {
    const response = await fetch(`/games/${id}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.ok) {
        const game = await response.json();
        document.getElementById('editId').value = game.id;
        document.getElementById('editTitle').value = game.title;
        document.getElementById('editPlatform').value = game.platform || '';
        document.getElementById('editStatus').value = game.status;
        document.getElementById('editRating').value = game.rating || '';
        document.getElementById('editHours').value = game.hours || 0;
        document.getElementById('editTags').value = game.tags || '';
        document.getElementById('editModal').style.display = 'flex';
    }
}

async function saveEdit() {
    const id = document.getElementById('editId').value;
    const gameData = {
        title: document.getElementById('editTitle').value,
        platform: document.getElementById('editPlatform').value,
        status: document.getElementById('editStatus').value,
        rating: parseInt(document.getElementById('editRating').value) || null,
        hours: parseFloat(document.getElementById('editHours').value) || 0,
        tags: document.getElementById('editTags').value
    };
    
    const response = await fetch(`/games/${id}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(gameData)
    });
    
    if (response.ok) {
        document.getElementById('editModal').style.display = 'none';
        loadGames();
    } else {
        const error = await response.json();
        alert(error.error);
    }
}

async function exportCSV() {
    window.open('/export/csv', '_blank');
}

async function exportPDF() {
    window.open('/export/pdf', '_blank');
}

function renderStars(rating) {
    if (!rating) return '<span style="color:#333;">NOT RATED</span>';
    let stars = '';
    for (let i = 0; i < 5; i++) {
        stars += `<svg width="12" height="12" style="opacity:${i < rating ? '1' : '0.1'}"><use href="#star"></use></svg>`;
    }
    return stars;
}

function clearForm() {
    document.getElementById('searchGame').value = '';
    document.getElementById('title').value = '';
    document.getElementById('platform').value = '';
    document.getElementById('rating').value = '';
    document.getElementById('hours').value = '0';
    document.getElementById('tags').value = '';
    document.getElementById('gameStatus').value = 'planned';
    document.getElementById('coverUrl').value = '';
    document.getElementById('selectedPreview').style.display = 'none';
}

// ============= UI =============
function showMainApp() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('currentUser').textContent = currentUsername;
    loadGames();
}

function showAuthForm() {
    document.getElementById('authContainer').style.display = 'block';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('authUsername').value = '';
    document.getElementById('authPassword').value = '';
}

// ============= EVENT LISTENERS =============
document.getElementById('authBtn').addEventListener('click', () => {
    const isLogin = document.getElementById('authTitle').innerText === 'LOGIN';
    if (isLogin) login();
    else register();
});

document.getElementById('switchAuth').addEventListener('click', () => {
    const title = document.getElementById('authTitle');
    const btn = document.getElementById('authBtn');
    const switchText = document.getElementById('switchAuth');
    
    if (title.innerText === 'LOGIN') {
        title.innerText = 'REGISTER';
        btn.innerText = 'REGISTER';
        switchText.innerHTML = 'HAVE ACCOUNT? <span>LOGIN</span>';
    } else {
        title.innerText = 'LOGIN';
        btn.innerText = 'LOGIN';
        switchText.innerHTML = 'NO ACCOUNT? <span>REGISTER</span>';
    }
});

document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('addBtn').addEventListener('click', addGame);
document.getElementById('saveEditBtn').addEventListener('click', saveEdit);
document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('editModal').style.display = 'none';
});

document.getElementById('statusFilter').addEventListener('change', () => { currentPage = 1; loadGames(); });
document.getElementById('sortBy').addEventListener('change', () => { currentPage = 1; loadGames(); });
document.getElementById('searchFilter').addEventListener('input', debounce(() => { currentPage = 1; loadGames(); }, 500));

// IGDB Search
const searchInput = document.getElementById('searchGame');
if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
        searchIGDB(e.target.value);
    }, 500));
}

// Close search results
document.addEventListener('click', function(e) {
    const searchSection = document.querySelector('.search-section');
    if (searchSection && !searchSection.contains(e.target)) {
        document.getElementById('searchResults').style.display = 'none';
    }
});

// Check session
const savedToken = localStorage.getItem('token');
const savedUserId = localStorage.getItem('userId');
const savedUsername = localStorage.getItem('username');

function hideLoader() {
    const loader = document.getElementById('loadingScreen');
    loader.style.opacity = '0';
    loader.style.transition = 'opacity 0.3s ease';
    setTimeout(() => loader.style.display = 'none', 300);
}

if (savedToken && savedUserId && savedUsername) {
    authToken = savedToken;
    currentUserId = savedUserId;
    currentUsername = savedUsername;

    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loadingBar').style.width = '60%';

    fetch('/games?page=1&limit=1', {
        headers: { 'Authorization': `Bearer ${authToken}` }
    }).then(res => {
        document.getElementById('loadingBar').style.width = '100%';
        setTimeout(() => {
            hideLoader();
            if (res.ok) showMainApp();
            else logout();
        }, 300);
    }).catch(() => {
        hideLoader();
        showMainApp();
    });
} else {
    document.getElementById('loadingBar').style.width = '100%';
    setTimeout(() => {
        hideLoader();
        showAuthForm();
    }, 500);
}

let chartInstances = {};
 
function destroyCharts() {
    Object.values(chartInstances).forEach(c => c && c.destroy());
    chartInstances = {};
}
 
// Chart styling defaults
const CHART_DEFAULTS = {
    color: '#888',
    font: { family: 'Orbitron, sans-serif', size: 10 },
};
 
const GRID_COLOR  = 'rgba(255,255,255,0.05)';
const TICK_COLOR  = '#555';
 
function baseScales() {
    return {
        x: {
            ticks: { color: TICK_COLOR, font: { size: 9 } },
            grid:  { color: GRID_COLOR },
        },
        y: {
            ticks: { color: TICK_COLOR, font: { size: 9 } },
            grid:  { color: GRID_COLOR },
            beginAtZero: true,
        },
    };
}
 
// Load stats
async function loadAndRenderStats() {
    try {
        const res = await fetch('/games/stats/detailed', {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!res.ok) { console.error('Stats fetch failed'); return; }
 
        const data = await res.json();
        destroyCharts();
        renderSummary(data.summary);
        renderStatusChart(data.byStatus);
        renderRatingChart(data.byRating);
        renderHoursChart(data.topByHours);
        renderMonthlyChart(data.byMonth);
    } catch (e) {
        console.error('Stats error:', e);
    }
}
 
function renderSummary(s) {
    if (!s) return;
    document.getElementById('sSummaryTotal').textContent     = s.total     ?? '0';
    document.getElementById('sSummaryCompleted').textContent = s.completed ?? '0';
    document.getElementById('sSummaryHours').textContent     = s.total_hours != null ? s.total_hours + 'h' : '0h';
    document.getElementById('sSummaryRating').textContent    = s.avg_rating != null  ? '★ ' + s.avg_rating : '—';
}
 
function renderStatusChart(rows) {
    const STATUS_COLORS = {
        planned:   '#555577',
        playing:   '#ffaa00',
        completed: '#00ff88',
        dropped:   '#ff5555',
    };
 
    const labels = rows.map(r => r.status.toUpperCase());
    const values = rows.map(r => r.count);
    const colors = rows.map(r => STATUS_COLORS[r.status] || '#888');
 
    const ctx = document.getElementById('chartStatus').getContext('2d');
    chartInstances.status = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors.map(c => c + 'cc'),
                borderColor:     colors,
                borderWidth: 2,
                hoverOffset: 8,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#888', font: { size: 9, family: 'Orbitron' }, padding: 12 },
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.raw} games`,
                    },
                },
            },
        },
    });
}
 
function renderRatingChart(rows) {

    const fullData = [1, 2, 3, 4, 5].map(star => {
        const found = rows.find(r => r.rating === star);
        return found ? found.count : 0;
    });
 
    const ctx = document.getElementById('chartRating').getContext('2d');
    chartInstances.rating = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['1 star', '2 stars', '3 stars', '4 stars', '5 stars'],
            datasets: [{
                data: fullData,
                backgroundColor: [
                    '#ff555544', '#ff888844', '#ffaa0044', '#88ff0044', '#fbb03b66',
                ],
                borderColor: [
                    '#ff5555', '#ff8888', '#ffaa00', '#88ff00', '#fbb03b',
                ],
                borderWidth: 2,
                borderRadius: 3,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: baseScales(),
        },
    });
}
 
function renderHoursChart(rows) {
    if (!rows || rows.length === 0) {
        document.getElementById('chartHours').parentElement.innerHTML =
            '<div style="color:#333;font-family:\'Press Start 2P\',monospace;font-size:0.5rem;text-align:center;padding:60px 0;">NO HOURS DATA</div>';
        return;
    }
 
    const STATUS_BORDER = { planned: '#555577', playing: '#ffaa00', completed: '#00ff88', dropped: '#ff5555' };
 
    const ctx = document.getElementById('chartHours').getContext('2d');
    chartInstances.hours = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: rows.map(r => r.title.length > 18 ? r.title.slice(0, 16) + '…' : r.title),
            datasets: [{
                data:            rows.map(r => r.hours),
                backgroundColor: rows.map(r => (STATUS_BORDER[r.status] || '#00ffff') + '44'),
                borderColor:     rows.map(r => STATUS_BORDER[r.status]  || '#00ffff'),
                borderWidth: 2,
                borderRadius: 3,
            }],
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${ctx.raw}h` } },
            },
            scales: {
                x: { ...baseScales().x, ticks: { ...baseScales().x.ticks, callback: v => v + 'h' } },
                y: { ...baseScales().y, ticks: { color: '#aaa', font: { size: 9 } } },
            },
        },
    });
}
 

 
// Button to open stats modal
document.getElementById('statsBtn').addEventListener('click', () => {
    document.getElementById('statsModal').style.display = 'flex';
    loadAndRenderStats();
});
 
document.getElementById('closeStatsBtn').addEventListener('click', () => {
    document.getElementById('statsModal').style.display = 'none';
    destroyCharts();
});
 

document.getElementById('statsModal').addEventListener('click', function(e) {
    if (e.target === this) {
        this.style.display = 'none';
        destroyCharts();
    }
});
const value = "Poly16";
const numerical = Number.parseFloat(value);
console.log(numerical); 