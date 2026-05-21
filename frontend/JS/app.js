// CORREGIDO: Detección automática de entorno apuntando al ID activo de Render (3iqr)
const API_BASE_URL = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? 'http://127.0.0.1:9090/api'
    : 'https://cinesphere-3iqr.onrender.com/api';

const IMG_URL = 'https://image.tmdb.org/t/p/w500';

const movieGrid = document.getElementById('movieGrid');
const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const loader = document.getElementById('loader');
const errorMessage = document.getElementById('errorMessage');

const modal = document.getElementById('movieModal');
const modalBody = document.getElementById('modalBody');
const closeModal = document.getElementById('closeModal');

const viewFavorites = document.getElementById('viewFavorites');

let currentView = 'catalogo';

// Extraemos el correo guardado en el paso anterior. Si no hay, dejamos un string vacío
const usuarioLogueadoCorreo = localStorage.getItem('usuario_sesion_correo') || "";

async function getMovies(endpoint) {
    if(!movieGrid) return []; 
    if(loader) loader.style.display = 'block';
    if(errorMessage) errorMessage.style.display = 'none';

    try {
        // Añadimos de forma automática el parámetro del correo para segmentar las búsquedas
        const conector = endpoint.includes('?') ? '&' : '?';
        const urlCompleta = `${API_BASE_URL}${endpoint}${conector}usuario_correo=${encodeURIComponent(usuarioLogueadoCorreo)}`;

        const res = await fetch(urlCompleta, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.status === 401) {
            mostrarError("Acceso No Autorizado: Error de credenciales en el servidor.");
            if (loader) loader.style.display = 'none';
            return [];
        }

        const data = await res.json();
        if (loader) loader.style.display = 'none';

        if (data.error) {
            mostrarError("Error en Catálogo: " + data.error);
            return [];
        }

        return Array.isArray(data) ? data : (data.results || []);
    } catch (error) {
        if(loader) loader.style.display = 'none';
        mostrarError("Error de conexión con el servidor backend.");
        return [];
    }
}

function showMovies(movies) {
    if(!movieGrid) return;
    movieGrid.innerHTML = '';
    
    if (!movies || movies.length === 0) {
        mostrarError("No se encontraron resultados en CineSphere.");
        return;
    }
    
    movies.forEach(movie => {
        const title = movie.titulo || movie.title || "Sin título";
        const vote = movie.puntuacion || movie.vote_average || "0";
        const id = movie.id;
        const posterPath = movie.imagen || movie.poster || movie.poster_path;
        const overview = movie.sinopsis || movie.overview || "Sin sinopsis disponible.";
        const esFavorito = movie.esFavorito || false;
        
        let poster = 'https://via.placeholder.com/500x750/141414/e50914?text=' + encodeURIComponent(title);
        if (posterPath) {
            poster = posterPath.startsWith('http') ? posterPath : IMG_URL + posterPath;
        }
        
        const movieEl = document.createElement('div');
        movieEl.classList.add('movie-card');
        movieEl.setAttribute('data-id', id);
        
        const colorBotonFav = esFavorito ? '#ffffff' : '#f1c40f';
        const fondoBotonFav = esFavorito ? '#e50914' : 'transparent';
        const textoBotonFav = esFavorito ? '<i class="fas fa-check"></i> En Favoritos' : '<i class="fas fa-star"></i> Favorito';

        movieEl.innerHTML = `
            <img src="${poster}" alt="${title}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/500x750/1c1c1c/ffffff?text=${encodeURIComponent(title)}';">
            <div class="movie-info">
                <h3 title="${title}">${title}</h3>
                <span style="color: #e50914; font-weight: bold; display: block; margin-bottom: 10px;">⭐ ${vote}</span>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button class="btn-details" onclick="verDetalle(${id})">Detalles</button>
                    <button id="btn-fav-${id}" class="btn-details" style="color: ${colorBotonFav}; background-color: ${fondoBotonFav}; border-color: #f1c40f;">
                        ${textoBotonFav}
                    </button>
                </div>
            </div>
        `;
        
        movieGrid.appendChild(movieEl);

        // Asignamos la función directamente por memoria evitando errores de comillas en el HTML string
        const botonFavorito = movieEl.querySelector(`#btn-fav-${id}`);
        if (botonFavorito) {
            botonFavorito.addEventListener('click', () => {
                agregarFavorito(id, title, overview, vote, poster);
            });
        }
    });
}

async function agregarFavorito(id, titulo, sinopsis, puntuacion, imagen) {
    if(!usuarioLogueadoCorreo) {
        alert("Sesión inválida. Por favor, vuelve a iniciar sesión.");
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/favoritos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: id,
                usuario_correo: usuarioLogueadoCorreo,
                titulo: titulo,
                sinopsis: sinopsis,
                puntuacion: parseFloat(puntuacion),
                imagen: imagen
            })
        });
        const data = await response.json();
        
        const btn = document.getElementById(`btn-fav-${id}`);
        
        if (data.status === "eliminado") {
            if (currentView === 'favoritos') {
                const card = document.querySelector(`.movie-card[data-id="${id}"]`);
                if (card) card.remove();
                if (movieGrid.children.length === 0) {
                    mostrarError("No tienes películas guardadas en tus favoritos.");
                }
            } else if (btn) {
                btn.style.color = '#f1c40f';
                btn.style.backgroundColor = 'transparent';
                btn.innerHTML = '<i class="fas fa-star"></i> Favorito';
            }
        } else if (data.status === "agregado") {
            if (btn) {
                btn.style.color = '#ffffff';
                btn.style.backgroundColor = '#e50914';
                btn.innerHTML = '<i class="fas fa-check"></i> En Favoritos';
            }
        }
    } catch (error) {
        console.error("Error en la acción de favoritos:", error);
    }
}

async function verDetalle(id) {
    if(!modal || !modalBody) return;
    modal.style.display = 'flex';
    modalBody.innerHTML = `
        <div style="text-align:center; padding: 20px;">
            <div class="spinner"></div>
            <p style="color:white;">Cargando detalles...</p>
        </div>`;

    try {
        const res = await fetch(`${API_BASE_URL}/peliculas/${id}`);
        const movie = await res.json();

        const titulo = movie.titulo || movie.title || "Sin título";
        const sinopsis = movie.sinopsis || movie.overview || "Sin descripción disponible.";
        const posterPath = movie.imagen || movie.poster || movie.poster_path;
        
        let poster = 'https://via.placeholder.com/500x750/141414/e50914?text=' + encodeURIComponent(titulo);
        if (posterPath) {
            poster = posterPath.startsWith('http') ? posterPath : IMG_URL + posterPath;
        }
        const rating = movie.puntuacion || movie.vote_average || "N/A";
        
        modalBody.innerHTML = `
            <div style="display: flex; gap: 25px; flex-wrap: wrap; align-items: start;">
                <img src="${poster}" style="width: 250px; border-radius: 12px; border: 1px solid #333; box-shadow: 0 4px 10px rgba(0,0,0,0.5);" onerror="this.onerror=null; this.src='https://via.placeholder.com/500x750/1c1c1c/ffffff?text=${encodeURIComponent(titulo)}';">
                <div style="flex: 1; min-width: 280px;">
                    <h1 style="color: var(--rojo-cine); margin-top: 0; font-size: 1.8rem;">${titulo}</h1>
                    <p style="color: #fff; line-height: 1.6;"><strong>Sinopsis:</strong><br>${sinopsis}</p>
                    <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; margin-top: 20px;">
                        <p style="margin: 0; color: #b3b3b3;"><strong>⭐ Puntuación:</strong> ${rating}</p>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        modalBody.innerHTML = `<p style="color:white; text-align:center;">Error al conectar con el servidor.</p>`;
    }
}

if (searchBtn) {
    searchBtn.onclick = async () => {
        currentView = 'catalogo';
        const term = searchInput.value.trim();
        const endpoint = term ? `/peliculas?query=${encodeURIComponent(term)}` : '/peliculas';
        const movies = await getMovies(endpoint);
        showMovies(movies);
    };
}

if (viewFavorites) {
    viewFavorites.onclick = async (e) => {
        e.preventDefault();
        currentView = 'favoritos';
        const movies = await getMovies('/favoritos');
        showMovies(movies);
    };
}

if (closeModal) closeModal.onclick = () => { modal.style.display = 'none'; };
window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };

function mostrarError(mensaje) {
    if(errorMessage) {
        errorMessage.style.display = 'block';
        const p = errorMessage.querySelector('p');
        if(p) p.innerText = mensaje;
    }
}

(async () => {
    currentView = 'catalogo';
    const movies = await getMovies('/peliculas');
    showMovies(movies);
})();