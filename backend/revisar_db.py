import sqlite3

def revisar():
    conn = sqlite3.connect('cine.db')
    cursor = conn.cursor()
    # Consultamos los nombres de todas las tablas existentes
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tablas = cursor.fetchall()
    print("Tablas encontradas:", tablas)
    conn.close()

if __name__ == "__main__":
    revisar()