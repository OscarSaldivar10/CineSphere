from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import sqlite3
import httpx

app = FastAPI(
    title="CineSphere API - Fase 2",
    version="2.4.1"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TMDB_API_KEY = "2c53c46e7ebe0a0c8dd4ed1dfb123971"
TMDB_BASE_URL = "https://api.themoviedb.org/3"

DB_NAME = "usuarios.db"

def inicializar_tablas_sistema():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # 1. Crear tabla de usuarios
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        apellido TEXT NOT NULL,
        correo TEXT UNIQUE NOT NULL,
        telefono TEXT NOT NULL
    )
    """)
    
    # 2. Crear tabla de favoritos (Estructura base)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS favoritos (
        id INTEGER,
        titulo TEXT NOT NULL,
        sinopsis TEXT,
        puntuacion REAL,
        imagen TEXT
    )
    """)
    
    # 3. MIGRACIÓN SEGURA: Intentamos agregar la columna 'usuario_correo' si no existe
    try:
        cursor.execute("ALTER TABLE favoritos ADD COLUMN usuario_correo TEXT")
    except sqlite3.OperationalError:
        # Si ya existe la columna, SQLite lanzará un error operativo que ignoramos de forma segura
        pass
        
    conn.commit()
    conn.close()

inicializar_tablas_sistema()

class UsuarioRegistro(BaseModel):
    nombre: str
    apellido: str
    correo: EmailStr
    telefono: str

class UsuarioLogin(BaseModel):
    nombre: str
    correo: EmailStr

class PeliculaFavorito(BaseModel):
    id: int
    usuario_correo: EmailStr
    titulo: str
    sinopsis: str
    puntuacion: float
    imagen: str

@app.post("/api/registro")
def registrar_usuario(usuario: UsuarioRegistro):
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO usuarios (nombre, apellido, correo, telefono) 
        VALUES (?, ?, ?, ?)
        """, (usuario.nombre, usuario.apellido, usuario.correo, usuario.telefono))
        conn.commit()
        conn.close()
        return {"mensaje": "Usuario registrado exitosamente."}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="El correo electrónico ya se encuentra registrado.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@app.post("/api/login")
def verificar_usuario(usuario: UsuarioLogin):
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("""
        SELECT * FROM usuarios WHERE LOWER(nombre) = LOWER(?) AND LOWER(correo) = LOWER(?)
        """, (usuario.nombre, usuario.correo))
        registro = cursor.fetchone()
        conn.close()
        
        if registro:
            return {"mensaje": f"Acceso concedido. ¡Bienvenido, {usuario.nombre}!"}
        else:
            raise HTTPException(status_code=401, detail="Usuario no encontrado o datos incorrectos.")
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en servidor: {str(e)}")

@app.post("/api/favoritos")
def guardar_favorito(pelicula: PeliculaFavorito):
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # Filtrar existencia combinando ID de película y correo del usuario activo
        cursor.execute("SELECT id FROM favoritos WHERE id = ? AND usuario_correo = ?", (pelicula.id, pelicula.usuario_correo))
        existe = cursor.fetchone()
        
        if existe:
            cursor.execute("DELETE FROM favoritos WHERE id = ? AND usuario_correo = ?", (pelicula.id, pelicula.usuario_correo))
            conn.commit()
            conn.close()
            return {"status": "eliminado", "mensaje": f"Se quitó '{pelicula.titulo}' de tus favoritos."}
        else:
            cursor.execute("""
            INSERT INTO favoritos (id, usuario_correo, titulo, sinopsis, puntuacion, imagen)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (pelicula.id, pelicula.usuario_correo, pelicula.titulo, pelicula.sinopsis, pelicula.puntuacion, pelicula.imagen))
            conn.commit()
            conn.close()
            return {"status": "agregado", "mensaje": f"¡'{pelicula.titulo}' añadida a tus favoritos!"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en favoritos: {str(e)}")

@app.get("/api/favoritos")
def obtener_favoritos(usuario_correo: str = None):
    if not usuario_correo:
        raise HTTPException(status_code=400, detail="Se requiere el correo del usuario para filtrar.")
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT id, titulo, sinopsis, puntuacion, imagen FROM favoritos WHERE usuario_correo = ?", (usuario_correo,))
        rows = cursor.fetchall()
        conn.close()
        
        favoritos_lista = []
        for r in rows:
            favoritos_lista.append({
                "id": r[0],
                "titulo": r[1],
                "sinopsis": r[2],
                "puntuacion": r[3],
                "imagen": r[4],
                "esFavorito": True
            })
        return favoritos_lista
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al leer favoritos: {str(e)}")

@app.get("/api/peliculas")
async def get_movies(query: str = None, top_type: str = None, usuario_correo: str = None):
    async with httpx.AsyncClient() as client:
        try:
            if top_type:
                url = f"{TMDB_BASE_URL}/discover/movie"
                params = {"api_key": TMDB_API_KEY, "primary_release_year": "2026", "language": "es-MX"}
                if top_type == "mejores":
                    params["sort_by"] = "vote_average.desc"
                    params["vote_count.gte"] = "10" 
                elif top_type == "menos_vistas":
                    params["sort_by"] = "popularity.asc"
                
                response = await client.get(url, params=params, timeout=10.0)
                if response.status_code != 200:
                    return {"error": f"Error de TMDB: {response.status_code}"}
                data = response.json()
                results = data.get("results", [])[:5]
            else:
                search_term = query if query else "Pokemon"
                url = f"{TMDB_BASE_URL}/search/movie"
                params = {"api_key": TMDB_API_KEY, "query": search_term, "language": "es-MX"}
                response = await client.get(url, params=params, timeout=10.0)
                if response.status_code != 200:
                    return {"error": f"TMDB error: {response.status_code}"}
                data = response.json()
                results = data.get("results", [])

            fav_ids = []
            if usuario_correo:
                conn = sqlite3.connect(DB_NAME)
                cursor = conn.cursor()
                # Validación de seguridad por si la columna apenas se está creando en caliente
                try:
                    cursor.execute("SELECT id FROM favoritos WHERE usuario_correo = ?", (usuario_correo,))
                    fav_ids = [r[0] for r in cursor.fetchall()]
                except sqlite3.OperationalError:
                    fav_ids = []
                conn.close()

            peliculas_mapeadas = []
            for item in results:
                m_id = item.get("id")
                poster_path = item.get("poster_path")
                url_imagen = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else 'https://via.placeholder.com/500x750?text=Sin+Imagen'
                peliculas_mapeadas.append({
                    "id": m_id,
                    "titulo": item.get("title") or "Sin título",
                    "sinopsis": item.get("overview") or "Sin sinopsis.",
                    "puntuacion": item.get("vote_average") or 0,
                    "imagen": url_imagen,
                    "esFavorito": m_id in fav_ids
                })
            return peliculas_mapeadas
        except Exception as e:
            return {"error": str(e)}

@app.get("/api/peliculas/{movie_id}")
async def get_movie_detail(movie_id: int):
    async with httpx.AsyncClient() as client:
        try:
            url = f"{TMDB_BASE_URL}/movie/{movie_id}"
            params = {"api_key": TMDB_API_KEY, "language": "es-MX"}
            response = await client.get(url, params=params, timeout=10.0)
            if response.status_code != 200:
                return {"error": "No encontrada"}
            item = response.json()
            poster_path = item.get("poster_path")
            url_imagen = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else 'https://via.placeholder.com/500x750?text=Sin+Imagen'
            return {
                "id": item.get("id"),
                "titulo": item.get("title"),
                "sinopsis": item.get("overview"),
                "puntuacion": item.get("vote_average"),
                "imagen": url_imagen
            }
        except Exception as e:
            return {"error": str(e)}