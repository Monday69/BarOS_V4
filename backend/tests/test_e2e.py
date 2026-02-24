"""
BarOS V4 - Tests End-to-End
Chemin : backend/tests/test_e2e.py

Simule une soirée complète :
  1. Santé de l'API
  2. Scan cartes NFC (user normal + admin)
  3. Consultation du catalogue
  4. Commande de cocktails + vérification décrémentation stocks
  5. Notation d'un verre
  6. Consultation stats & historique
  7. Recommandations personnalisées
  8. Alertes stocks
  9. Logs de séquences
  10. Lab custom (création + préparation)

Lancer avec : python -m backend.tests.test_e2e
Prérequis   : API démarrée sur localhost:8000 + seed_data lancé
"""
import requests
import json
import sys
import time

BASE = "http://localhost:8000"
API  = f"{BASE}/api"

# ── Couleurs terminal ─────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

# ── Compteurs ─────────────────────────────────────────────────────────────────
results = {"passed": 0, "failed": 0, "warnings": 0}

def ok(msg):
    results["passed"] += 1
    print(f"  {GREEN}✓{RESET} {msg}")

def fail(msg, detail=""):
    results["failed"] += 1
    info = f" — {detail}" if detail else ""
    print(f"  {RED}✗{RESET} {msg}{RED}{info}{RESET}")

def warn(msg):
    results["warnings"] += 1
    print(f"  {YELLOW}⚠{RESET} {msg}")

def section(title):
    print(f"\n{BLUE}{BOLD}{'─'*50}{RESET}")
    print(f"{BLUE}{BOLD}  {title}{RESET}")
    print(f"{BLUE}{BOLD}{'─'*50}{RESET}")

def get(path, **kwargs):
    return requests.get(f"{API}{path}", timeout=5, **kwargs)

def post(path, **kwargs):
    return requests.post(f"{API}{path}", timeout=5, **kwargs)

def put(path, **kwargs):
    return requests.put(f"{API}{path}", timeout=5, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# 1. SANTÉ API
# ══════════════════════════════════════════════════════════════════════════════
def test_health():
    section("1. Santé de l'API")
    try:
        res = requests.get(f"{BASE}/health", timeout=5)
        if res.status_code == 200:
            data = res.json()
            ok(f"API en ligne — mode: {data.get('hardware_mode', '?')}")
            if data.get("database") == "healthy":
                ok("Base de données connectée")
            else:
                fail("Base de données en erreur")
        else:
            fail(f"Health check failed", f"HTTP {res.status_code}")
    except requests.ConnectionError:
        fail("API inaccessible — assure-toi que le serveur est démarré sur :8000")
        sys.exit(1)


# ══════════════════════════════════════════════════════════════════════════════
# 2. SCAN NFC
# ══════════════════════════════════════════════════════════════════════════════
def test_nfc_scan():
    section("2. Scan cartes NFC")
    users = {}

    test_cards = [
        ("A1B2C3D4", "Alex Martin",  False),
        ("F4E3D2C1", "Léa Dubois",   False),
        ("99887766", "Tom Girard",   False),
        ("DEADBEEF", "Admin BarOS",  True),
    ]

    for uid, expected_name, is_admin in test_cards:
        try:
            res = post("/users/scan", json={"card_uid": uid})
            if res.status_code == 200:
                data = res.json()
                if data.get("name") == expected_name:
                    ok(f"Carte {uid} → {data['name']}" + (" 👑 admin" if is_admin else ""))
                    users[uid] = data
                else:
                    warn(f"Carte {uid} reconnue mais nom inattendu: {data.get('name')}")
                    users[uid] = data
            elif res.status_code == 404:
                fail(f"Carte {uid} inconnue — relance le seed_data.py")
            else:
                fail(f"Scan {uid}", f"HTTP {res.status_code}")
        except Exception as e:
            fail(f"Scan {uid}", str(e))

    # Carte inconnue → doit retourner 404
    res = post("/users/scan", json={"card_uid": "00000000"})
    if res.status_code == 404:
        ok("Carte inconnue → 404 correct")
    else:
        fail("Carte inconnue devrait retourner 404", f"Got {res.status_code}")

    return users


# ══════════════════════════════════════════════════════════════════════════════
# 3. CATALOGUE COCKTAILS
# ══════════════════════════════════════════════════════════════════════════════
def test_catalogue():
    section("3. Catalogue cocktails")

    res = get("/cocktails/")
    if res.status_code != 200:
        fail("GET /cocktails/", f"HTTP {res.status_code}")
        return []

    cocktails = res.json()
    if len(cocktails) >= 40:
        ok(f"{len(cocktails)} cocktails disponibles")
    else:
        warn(f"Seulement {len(cocktails)} cocktails — relance le seed_data.py")

    # Vérification d'un détail
    if cocktails:
        first = cocktails[0]
        res2 = get(f"/cocktails/{first['id']}")
        if res2.status_code == 200:
            detail = res2.json()
            has_nutrition = all(k in detail for k in ["alcohol_degree", "total_kcal", "total_sugar_g"])
            if has_nutrition:
                ok(f"Détail '{first['name']}' — nutrition OK ({detail['alcohol_degree']}°, {detail['total_kcal']} kcal)")
            else:
                fail(f"Détail '{first['name']}' manque les données nutritionnelles")
        else:
            fail(f"GET /cocktails/{first['id']}", f"HTTP {res2.status_code}")

    # Filtre catégorie
    res3 = get("/cocktails/?category=Rhum")
    if res3.status_code == 200:
        rhum = res3.json()
        ok(f"Filtre catégorie Rhum → {len(rhum)} cocktails")
    else:
        warn("Filtre catégorie non supporté")

    return cocktails


# ══════════════════════════════════════════════════════════════════════════════
# 4. COMMANDE + DÉCRÉMENTATION STOCKS
# ══════════════════════════════════════════════════════════════════════════════
def test_commande(users, cocktails):
    section("4. Commande cocktails + stocks")

    user = users.get("A1B2C3D4")
    if not user:
        fail("User Alex introuvable, skip")
        return None

    # Stock avant
    ings_before = {i["id"]: i["current_volume_ml"] for i in get("/ingredients").json()}

    # On prend le Mojito s'il est dispo, sinon le premier
    target = next((c for c in cocktails if c["name"] == "Mojito"), cocktails[0] if cocktails else None)
    if not target:
        fail("Aucun cocktail disponible")
        return None

    res = post(f"/cocktails/{target['id']}/pour", params={"user_id": user["id"]})
    if res.status_code == 200:
        data = res.json()
        ok(f"Commande '{target['name']}' lancée — séquence #{data.get('sequence_id')}")
        sequence_id = data.get("sequence_id")

        # Attente courte pour que la séquence démarre
        time.sleep(1.5)

        # Vérification décrémentation stocks
        ings_after = {i["id"]: i["current_volume_ml"] for i in get("/ingredients").json()}
        decremented = [
            iid for iid, vol in ings_after.items()
            if ings_before.get(iid, 0) > vol
        ]
        if decremented:
            ok(f"Stocks décrémentés pour {len(decremented)} ingrédient(s)")
        else:
            warn("Stocks non décrémentés (normal si pompes en simulation longue)")

        # Vérification OrderHistory
        hist_res = get(f"/users/{user['id']}/history")
        if hist_res.status_code == 200:
            hist = hist_res.json()
            latest = hist[0] if hist else None
            if latest and latest.get("recipe", {}).get("name") == target["name"]:
                ok(f"Historique mis à jour — dernier verre: {latest['recipe']['name']}")
            else:
                warn("Historique non mis à jour immédiatement (async)")
        else:
            fail("GET /users/history", f"HTTP {hist_res.status_code}")

        return sequence_id
    else:
        detail = res.json().get("detail", res.text)
        if "pompe" in str(detail).lower() or "pump" in str(detail).lower():
            warn(f"Pompes non configurées — commande bloquée ({detail})")
        else:
            fail(f"Commande '{target['name']}'", str(detail))
        return None


# ══════════════════════════════════════════════════════════════════════════════
# 5. NOTATION
# ══════════════════════════════════════════════════════════════════════════════
def test_notation(users):
    section("5. Notation d'un verre")

    user = users.get("A1B2C3D4")
    if not user:
        fail("User Alex introuvable, skip")
        return

    hist_res = get(f"/users/{user['id']}/history")
    if hist_res.status_code != 200 or not hist_res.json():
        warn("Historique vide, skip notation")
        return

    order_id = hist_res.json()[0]["id"]

    res = post(f"/users/{user['id']}/history/{order_id}/rate",
               json={"rating": 5, "comment": "Test E2E - parfait !"})
    if res.status_code == 200:
        ok(f"Note 5★ soumise pour la commande #{order_id}")
    else:
        fail(f"Notation commande #{order_id}", f"HTTP {res.status_code} — {res.text}")

    # Note invalide → doit être rejetée
    res2 = post(f"/users/{user['id']}/history/{order_id}/rate",
                json={"rating": 99})
    if res2.status_code in (400, 422):
        ok("Note invalide (99) → rejetée correctement")
    else:
        warn(f"Note invalide non rejetée (HTTP {res2.status_code})")


# ══════════════════════════════════════════════════════════════════════════════
# 6. STATS & HISTORIQUE
# ══════════════════════════════════════════════════════════════════════════════
def test_stats(users):
    section("6. Stats & historique utilisateur")

    for uid, udata in users.items():
        user_id = udata["id"]
        name    = udata["name"]

        # Stats
        res = get(f"/users/{user_id}/stats")
        if res.status_code == 200:
            s = res.json()
            ok(f"{name} — {s.get('total_orders', 0)} verres, "
               f"{s.get('total_alcohol_units', 0)} unités alcool, "
               f"{s.get('total_kcal', 0)} kcal")
        else:
            fail(f"Stats {name}", f"HTTP {res.status_code}")

        # Historique paginé
        res2 = get(f"/users/{user_id}/history", params={"page": 1, "page_size": 5})
        if res2.status_code == 200:
            hist = res2.json()
            ok(f"{name} — historique: {len(hist)} entrées (page 1)")
        else:
            fail(f"Historique {name}", f"HTTP {res2.status_code}")


# ══════════════════════════════════════════════════════════════════════════════
# 7. RECOMMANDATIONS
# ══════════════════════════════════════════════════════════════════════════════
def test_recommendations(users):
    section("7. Recommandations personnalisées")

    for uid, udata in users.items():
        if udata["name"] == "Admin BarOS":
            continue
        user_id = udata["id"]
        res = get(f"/users/{user_id}/recommendations", params={"limit": 5})
        if res.status_code == 200:
            data = res.json()
            mode  = data.get("mode", "?")
            recos = data.get("recommendations", [])
            if recos:
                top = recos[0]["name"]
                ok(f"{udata['name']} — mode '{mode}', top reco: {top}")
            else:
                warn(f"{udata['name']} — aucune recommandation retournée")
        else:
            fail(f"Recommandations {udata['name']}", f"HTTP {res.status_code}")


# ══════════════════════════════════════════════════════════════════════════════
# 8. ALERTES STOCKS
# ══════════════════════════════════════════════════════════════════════════════
def test_stock_alerts():
    section("8. Alertes stocks")

    res = get("/machine/alerts")
    if res.status_code == 200:
        data = res.json()
        summary = data.get("summary", {})
        score   = summary.get("health_score", "?")
        crit    = summary.get("critical_count", 0)
        warn_c  = summary.get("warning_count", 0)
        ok(f"Health score: {score}% — {crit} critique(s), {warn_c} avertissement(s)")

        if crit > 0:
            names = [i["name"] for i in data.get("critical", [])]
            warn(f"Stocks critiques : {', '.join(names)}")
    else:
        fail("GET /machine/alerts", f"HTTP {res.status_code}")

    # Status complet
    res2 = get("/machine/status")
    if res2.status_code == 200:
        ok("Machine status accessible")
    else:
        fail("GET /machine/status", f"HTTP {res2.status_code}")


# ══════════════════════════════════════════════════════════════════════════════
# 9. LOGS DE SÉQUENCES
# ══════════════════════════════════════════════════════════════════════════════
def test_logs(sequence_id):
    section("9. Logs structurés")

    # Résumé global
    res = get("/logs/summary")
    if res.status_code == 200:
        data = res.json()
        ok(f"Summary — {data.get('total_sequences', 0)} séquences, "
           f"taux succès: {data.get('success_rate', 0)}%")
    else:
        fail("GET /logs/summary", f"HTTP {res.status_code}")

    # Logs récents
    res2 = get("/logs/recent", params={"limit": 5})
    if res2.status_code == 200:
        logs = res2.json().get("logs", [])
        ok(f"Logs récents: {len(logs)} entrées")
    else:
        fail("GET /logs/recent", f"HTTP {res2.status_code}")

    # Logs d'une séquence spécifique
    if sequence_id:
        res3 = get(f"/logs/sequences/{sequence_id}")
        if res3.status_code == 200:
            data = res3.json()
            ok(f"Séquence #{sequence_id} — {data.get('logs_count', 0)} logs, "
               f"statut: {data.get('status', '?')}")
        else:
            warn(f"Logs séquence #{sequence_id} non accessibles")

    # Logs erreurs
    res4 = get("/logs/errors")
    if res4.status_code == 200:
        errs = res4.json().get("logs", [])
        if errs:
            warn(f"{len(errs)} erreur(s) dans les logs — à vérifier avant soutenance")
        else:
            ok("Aucune erreur dans les logs")
    else:
        fail("GET /logs/errors", f"HTTP {res4.status_code}")


# ══════════════════════════════════════════════════════════════════════════════
# 10. LAB CUSTOM
# ══════════════════════════════════════════════════════════════════════════════
def test_lab_custom(users):
    section("10. Lab — Recette custom")

    # Récupérer les ingrédients avec pompes
    ings = [i for i in get("/ingredients").json() if i.get("pump_id") is not None]

    if len(ings) < 2:
        warn("Moins de 2 pompes configurées — configure les pompes dans TestMachine d'abord")
        return

    user = users.get("A1B2C3D4")
    payload = {
        "name": "Test E2E Custom",
        "user_id": user["id"] if user else None,
        "ingredients": [
            {"ingredient_id": ings[0]["id"], "volume_ml": 40},
            {"ingredient_id": ings[1]["id"], "volume_ml": 80},
        ]
    }

    res = post("/cocktails/custom", json=payload)
    if res.status_code == 200:
        data = res.json()
        ok(f"Recette custom lancée — séquence #{data.get('sequence_id')}")
    elif res.status_code == 400:
        detail = res.json().get("detail", "")
        warn(f"Custom bloqué (normal si pas de pompes) : {detail}")
    else:
        fail("POST /cocktails/custom", f"HTTP {res.status_code} — {res.text}")

    # Test création recette dans le catalogue
    recipe_payload = {
        "name": "E2E Signature",
        "description": "Créé par le test E2E",
        "category": "Custom",
        "price": 0,
        "ingredients": [
            {"ingredient_id": ings[0]["id"], "volume_ml": 50, "order": 0},
            {"ingredient_id": ings[1]["id"], "volume_ml": 50, "order": 1},
        ]
    }
    res2 = post("/cocktails/", json=recipe_payload)
    if res2.status_code in (200, 201):
        ok("Recette custom sauvegardée dans le catalogue")
    else:
        warn(f"Sauvegarde catalogue : HTTP {res2.status_code}")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main():
    print(f"\n{BOLD}{'═'*50}")
    print(f"  BarOS V4 — Tests End-to-End")
    print(f"  Simulation d'une soirée complète")
    print(f"{'═'*50}{RESET}")
    print(f"  API cible : {BASE}")
    print(f"  Prérequis : seed_data lancé, API démarrée\n")

    test_health()
    users     = test_nfc_scan()
    cocktails = test_catalogue()
    seq_id    = test_commande(users, cocktails)
    test_notation(users)
    test_stats(users)
    test_recommendations(users)
    test_stock_alerts()
    test_logs(seq_id)
    test_lab_custom(users)

    # ── Résumé final ──────────────────────────────────────────────────────────
    total = results["passed"] + results["failed"]
    print(f"\n{BOLD}{'═'*50}")
    print(f"  Résultats")
    print(f"{'═'*50}{RESET}")
    print(f"  {GREEN}✓ {results['passed']} passés{RESET}")
    if results["failed"]:
        print(f"  {RED}✗ {results['failed']} échoués{RESET}")
    if results["warnings"]:
        print(f"  {YELLOW}⚠ {results['warnings']} avertissements{RESET}")
    print(f"  Total : {total} tests\n")

    if results["failed"] == 0:
        print(f"  {GREEN}{BOLD}🎉 Tout est vert — prêt pour la soutenance !{RESET}\n")
    elif results["failed"] <= 2:
        print(f"  {YELLOW}{BOLD}⚠ Quelques points à vérifier avant la soutenance{RESET}\n")
    else:
        print(f"  {RED}{BOLD}✗ Des corrections sont nécessaires{RESET}\n")

    sys.exit(0 if results["failed"] == 0 else 1)


if __name__ == "__main__":
    main()