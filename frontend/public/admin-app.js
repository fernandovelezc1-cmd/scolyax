// ========== CONFIGURACIÓN GLOBAL DEL API ==========
function getApiUrl() {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    console.log(`📍 Frontend hostname: ${hostname}, protocol: ${protocol}`);
    
    // En localhost (desarrollo), usar localhost:8000
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8000';
    }
    
    // En producción - el frontend está en vercel.app, el backend en railway.app
    if (hostname.includes('vercel.app')) {
        console.log(`✅ Detectado Vercel, usando backend Railway: https://scolyax-production.up.railway.app`);
        return 'https://scolyax-production.up.railway.app';
    }
    
    // Si ya estamos en railway.app, intentar con el mismo dominio
    if (hostname.includes('railway.app')) {
        return `${protocol}//${hostname}`;
    }
    
    // Por defecto, intentar desde el mismo dominio
    return `${protocol}//${hostname}`;
}

console.log(`🔧 API URL configurada: ${getApiUrl()}`);

// Verificar autenticación
function initializeAdmin() {
    const user = JSON.parse(localStorage.getItem('authUser'));
    
    if (!user) {
        window.location.href = '/';
        return;
    }

    if (user.email !== 'appscolyax@gmail.com') {
        alert('No tienes permisos para acceder a este panel');
        window.location.href = '/';
        return;
    }

    document.getElementById('userEmail').textContent = user.email;
    if (user.name) {
        document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
    }

    loadDashboardData();
}

async function loadDashboardData() {
    try {
        const authUser = JSON.parse(localStorage.getItem('authUser'));
        const sessionToken = authUser?.sessionToken || localStorage.getItem('scolyax.sessionToken');

        if (!sessionToken) {
            console.warn('No hay token de sesión');
            loadMockData();
            return;
        }

        const headers = { 'Authorization': `Bearer ${sessionToken}` };

        // Cargar métricas generales y Iris stats en paralelo
        const [metricsResponse, irisResponse] = await Promise.all([
            fetch(`${getApiUrl()}/api/admin/metrics`, { headers }),
            fetch(`${getApiUrl()}/admin/iris-stats`, { headers })
        ]);

        if (metricsResponse.ok) {
            const metrics = await metricsResponse.json();
            document.getElementById('activeUsers').textContent = metrics.active_users_30d ?? '0';
            document.getElementById('tasksCompleted').textContent = metrics.tasks_completed ?? '0';
            document.getElementById('retentionRate').textContent = (metrics.retention_rate || 0) + '%';
        } else {
            loadMockData();
        }

        if (irisResponse.ok) {
            const iris = await irisResponse.json();
            document.getElementById('realtimeUsers').textContent = iris.realtime_users ?? '0';
            document.getElementById('irisSummaries').textContent = iris.summaries_count ?? '0';
            document.getElementById('irisAiRequests').textContent = iris.ai_requests_session ?? '0';
            document.getElementById('irisCacheHits').textContent = iris.cache_hits ?? '0';
            document.getElementById('irisFocusSessions').textContent = iris.focus_sessions_total ?? '0';
            document.getElementById('irisTasksTotal').textContent = iris.tasks_total ?? '0';
            document.getElementById('irisApiRemaining').textContent = iris.requests_remaining ?? '20';
        }

        console.log('✅ Datos reales cargados desde backend');
    } catch (error) {
        console.error('Error cargando datos:', error);
        loadMockData();
    }
}

function loadMockData() {
    document.getElementById('activeUsers').textContent = '--';
    document.getElementById('realtimeUsers').textContent = '--';
    document.getElementById('tasksCompleted').textContent = '--';
    document.getElementById('retentionRate').textContent = '--';
    ['irisSummaries','irisAiRequests','irisCacheHits','irisFocusSessions','irisTasksTotal','irisApiRemaining']
        .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '--'; });
    console.log('ℹ️ Usando datos de ejemplo');
}

async function loadUsuarios() {
    try {
        const authUser = JSON.parse(localStorage.getItem('authUser'));
        const sessionToken = authUser?.sessionToken || localStorage.getItem('scolyax.sessionToken');

        if (!sessionToken) return;

        const usersResponse = await fetch(`${getApiUrl()}/api/admin/users?page=1&limit=20`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });

        if (!usersResponse.ok) throw new Error(`Error: ${usersResponse.status}`);

        const data = await usersResponse.json();
        const tbody = document.getElementById('allUsuariosTableBody');
        
        if (!data.users || data.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">Sin usuarios</td></tr>';
            return;
        }

        tbody.innerHTML = data.users.map(user => `
            <tr>
                <td>${String(user.id).substring(0, 8)}</td>
                <td>${user.display_name || 'Sin nombre'}</td>
                <td>${user.email}</td>
                <td>${new Date(user.created_at).toLocaleDateString('es-ES')}</td>
                <td>
                    <button class="btn btn-danger" onclick="deleteUser('${user.id}', '${user.email}')">
                        Eliminar
                    </button>
                </td>
            </tr>
        `).join('');

        console.log('✅ Usuarios cargados:', data.users.length);
    } catch (error) {
        console.error('Error cargando usuarios:', error);
    }
}

async function deleteUser(userId, userEmail) {
    if (!confirm(`¿Eliminar a ${userEmail}?`)) return;

    try {
        const authUser = JSON.parse(localStorage.getItem('authUser'));
        const sessionToken = authUser?.sessionToken || localStorage.getItem('scolyax.sessionToken');

        if (!sessionToken) {
            alert('No hay sesión válida');
            return;
        }

        const deleteResponse = await fetch(`${getApiUrl()}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });

        if (!deleteResponse.ok) throw new Error(`Error: ${deleteResponse.status}`);

        const result = await deleteResponse.json();
        alert(`✅ Usuario eliminado: ${result.message}`);
        loadUsuarios();
        console.log('✅ Usuario eliminado correctamente');
    } catch (error) {
        alert(`❌ Error: ${error.message}`);
        console.error('Error:', error);
    }
}

function navigateTo(section) {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');

    const sectionId = `${section}-section`;
    const element = document.getElementById(sectionId);
    if (element) element.style.display = 'block';

    document.querySelectorAll('.sidebar-nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`.sidebar-nav-link[href="#${section}"]`);
    if (activeLink) activeLink.classList.add('active');

    if (section === 'usuarios') loadUsuarios();
    else if (section === 'calificaciones') loadRatings();
}

async function loadRatings() {
    try {
        const authUser = JSON.parse(localStorage.getItem('authUser'));
        const sessionToken = authUser?.sessionToken || localStorage.getItem('scolyax.sessionToken');

        if (!sessionToken) return;

        const response = await fetch(`${getApiUrl()}/admin/feedback`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });

        if (!response.ok) throw new Error(`Error: ${response.status}`);

        const data = await response.json();
        
        // Manejar ambas estructuras: array directo o {feedback: [...]}
        const ratings = Array.isArray(data) ? data : (data.feedback || []);
        
        const statsResponse = await fetch(`${getApiUrl()}/admin/feedback/stats`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });

        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            document.getElementById('totalRatings').textContent = stats.total_feedback || 0;
            document.getElementById('avgRating').textContent = (stats.average_rating || 0).toFixed(1);
        }

        displayRatings(ratings);
        console.log('✅ Calificaciones cargadas:', ratings.length);
    } catch (error) {
        console.error('Error cargando calificaciones:', error);
    }
}

// Estrella SVG (mismo estilo que los stickers de la app)
const STAR_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l5.5 12.5L43 19l-10 9 3 14-12-7-12 7 3-14L5 19l13.5-1.5Z"/></svg>';

function displayRatings(ratings) {
    const tbody = document.getElementById('ratingsTableBody');

    if (!ratings || ratings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><div class="empty-state-title">Sin calificaciones</div></td></tr>';
        return;
    }

    tbody.innerHTML = ratings.map(r => `
        <tr id="rating-row-${r.id}">
            <td>${r.user_email || 'Anónimo'}</td>
            <td><span class="rating-stars">${STAR_SVG.repeat(r.rating || 0)}</span></td>
            <td style="max-width: 400px; white-space: normal; word-wrap: break-word;">${r.comment || '-'}</td>
            <td>${r.created_at ? new Date(r.created_at).toLocaleDateString('es-ES') : '-'}</td>
            <td style="text-align: center;">
                <button class="btn btn-danger" onclick="deleteRating('${r.id}', '${(r.user_email || '').replace(/'/g, '')}')">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

async function deleteRating(feedbackId, userEmail) {
    if (!confirm(`¿Eliminar la calificación de ${userEmail}? Esta acción no se puede deshacer.`)) return;
    const sessionToken = localStorage.getItem('scolyax.sessionToken');
    try {
        const response = await fetch(`${getApiUrl()}/admin/feedback/${feedbackId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Error al eliminar');
        }
        document.getElementById(`rating-row-${feedbackId}`)?.remove();
        alert('✅ Calificación eliminada correctamente');
    } catch (error) {
        alert(`❌ Error: ${error.message}`);
    }
}

async function logout() {
    if (confirm('¿Deseas cerrar sesión?')) {
        const authUser = JSON.parse(localStorage.getItem('authUser'));
        const sessionToken = authUser?.sessionToken || localStorage.getItem('scolyax.sessionToken');
        
        if (sessionToken) {
            try {
                await fetch(`${getApiUrl()}/session`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${sessionToken}` }
                });
            } catch (error) {
                console.error('Error invalidating session:', error);
            }
        }
        
        localStorage.removeItem('authUser');
        localStorage.removeItem('scolyax.sessionToken');
        window.location.href = '/';
    }
}

async function resetAllAchievements() {
    const confirmed = confirm('⚠️ ADVERTENCIA CRÍTICA ⚠️\n\n¿Estás seguro de que quieres ELIMINAR TODOS los logros y estadísticas de TODOS los usuarios?\n\nEsta acción es IRREVERSIBLE.\n\nEscribe "CONFIRMAR" en el prompt si estás seguro.');
    
    if (!confirmed) return;
    
    const confirmText = prompt('Escribe "CONFIRMAR" para proceder con el reset global:');
    if (confirmText !== 'CONFIRMAR') {
        alert('❌ Reset cancelado');
        return;
    }
    
    try {
        const authUser = JSON.parse(localStorage.getItem('authUser'));
        const sessionToken = authUser?.sessionToken || localStorage.getItem('scolyax.sessionToken');
        
        if (!sessionToken) {
            alert('❌ No hay sesión válida');
            return;
        }
        
        // Primero ver cuántos hay
        const countResponse = await fetch(`${getApiUrl()}/api/admin/stats-count`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        const countData = await countResponse.json();
        console.log('📊 Stats actuales en BD:', countData);
        alert(`📊 Stats actuales en BD: ${countData.total_stats} registros`);
        
        // Ahora hacer reset
        const response = await fetch(`${getApiUrl()}/api/admin/reset-achievements`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        console.log('📊 Reset response status:', response.status);
        const result = await response.json();
        console.log('📊 Reset response data:', result);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${result.detail || JSON.stringify(result)}`);
        }
        
        // Limpiar también el localStorage de logros calificados
        localStorage.removeItem('ratedAchievements');
        console.log('🧹 localStorage limpiado: ratedAchievements');
        
        alert(`✅ Reset completado:\n\nEliminados:\n- ${result.deleted.stats} estadísticas\n- ${result.deleted.feedback} reseñas\n- localStorage (ratedAchievements) limpiado\n\nRestantes:\n- ${result.remaining.stats} estadísticas\n- ${result.remaining.feedback} reseñas`);
        
        // Recargar el dashboard
        loadDashboardData();
        
    } catch (error) {
        console.error('❌ Error en reset:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

window.addEventListener('load', initializeAdmin);

// Auto-actualizar usuarios en tiempo real cada 30 segundos
setInterval(async () => {
    try {
        const authUser = JSON.parse(localStorage.getItem('authUser'));
        const sessionToken = authUser?.sessionToken || localStorage.getItem('scolyax.sessionToken');
        if (!sessionToken) return;
        const resp = await fetch(`${getApiUrl()}/admin/iris-stats`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        if (resp.ok) {
            const iris = await resp.json();
            const el = document.getElementById('realtimeUsers');
            if (el) el.textContent = iris.realtime_users ?? '0';
        }
    } catch {}
}, 30000);
