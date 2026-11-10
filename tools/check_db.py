import sqlite3
conn = sqlite3.connect('baros.db')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = c.fetchall()
print("Tables:", tables)
if 'ingredients' in [t[0] for t in tables]:
    c.execute("SELECT name, pump_id, is_available FROM ingredients WHERE pump_id IS NOT NULL")
    rows = c.fetchall()
    print("Ingrédients avec pump_id:", rows)
else:
    print("Table ingredients n'existe pas")
conn.close()