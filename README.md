<div align="center">

<img src="docs/assets/logo.png" alt="BarOS Logo" width="120" />

# BarOS V4

**Système de bar automatisé piloté par Raspberry Pi**  
*Physique des fluides · Interface 3D temps réel · Paiement Stripe · PWA mobile*

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![Tests](https://img.shields.io/badge/Tests-35%2F35%20passed-22c55e?style=flat-square&logo=pytest&logoColor=white)](tests/)
[![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)](LICENSE)

---

*Projet de spécialité IA · ESME Paris · Mattéo Bombrun*

</div>

---

## 📖 Vue d'ensemble

BarOS est un système embarqué complet qui automatise la préparation de cocktails via une machine à pompes pilotée par Raspberry Pi. Un utilisateur scanne son badge NFC sur la borne, choisit son cocktail sur l'interface web, paie par carte ou solde prépayé — la machine calcule les durées de versement par la physique et dose chaque ingrédient avec précision.

> Ce projet couvre l'intégralité de la stack : physique embarquée, backend distribué, interface React 3D, paiement Stripe, file d'attente temps réel et déploiement Docker.

---

## ✨ Fonctionnalités

| Domaine | Fonctionnalité |
|---|---|
| 🍹 **Machine** | Dosage 12 cuves simultanées, séquencement GPIO, arrêt d'urgence |
| 🧪 **Physique** | Loi de Torricelli analytique, calcul exact de la durée de versement |
| 💳 **Paiement** | Stripe Checkout, solde prépayé NFC, remboursement automatique en cas d'erreur hardware |
| 📱 **PWA** | Notifications push WebPush, file d'attente temps réel (WebSocket) |
| 🎨 **UI** | Interface React avec modèle 3D interactif, SmartBar avec suggestions IA |
| 🔒 **Admin** | Dashboard analytique, gestion stocks, export Excel, authentification PIN |
| 🐳 **Infra** | Docker Compose (FastAPI + Nginx + React), SQLite avec volume persistant |

---

## 🏗️ Architecture système

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser / PWA)                   │
│              React 18 · Vite · Three.js · Tailwind              │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NGINX (Reverse Proxy)                      │
│         /* → static build      /api/* → FastAPI :8000           │
└──────────────┬──────────────────────────┬───────────────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────┐    ┌─────────────────────────────────────┐
│   Static Files       │    │         FastAPI Backend              │
│   (React build)      │    │                                     │
└──────────────────────┘    │  ┌─────────────┐  ┌─────────────┐  │
                            │  │   Routers   │  │  Services   │  │
                            │  │  cocktails  │  │ CocktailSvc │  │
                            │  │  payments   │  │ FluidPhysics│  │
                            │  │  queue      │  │ GPIO Mgr    │  │
                            │  │  users      │  └─────────────┘  │
                            │  └──────┬──────┘                   │
                            │         │ SQLAlchemy 2.0            │
                            │         ▼                           │
                            │  ┌─────────────┐                   │
                            │  │   SQLite    │ ← volume Docker   │
                            │  │  baros.db   │                   │
                            │  └─────────────┘                   │
                            └──────────────┬──────────────────────┘
                                           │ asyncio · GPIO
                                           ▼
                            ┌─────────────────────────────────────┐
                            │        Raspberry Pi (Hardware)       │
                            │   12 pompes péristaltiques · NFC    │
                            │   GPIO 40 pins · Emergency Stop     │
                            └─────────────────────────────────────┘
```

### Stack technique

| Couche | Technologie | Rôle |
|---|---|---|
| Frontend | React 18, Vite, Three.js, Tailwind CSS | Interface utilisateur, visualisation 3D |
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic | API REST + WebSocket |
| Hardware | RPi.GPIO, asyncio | Pilotage pompes, NFC |
| Paiement | Stripe Checkout + Webhooks | Transactions sécurisées |
| Infra | Docker Compose, Nginx | Déploiement, reverse proxy |
| Tests | Pytest | 35 tests unitaires physique |

---

## 🧪 Physique des fluides — Loi de Torricelli

Le dosage précis est le cœur technique du projet. La durée de versement est calculée par la **loi de Torricelli**, qui modélise le débit d'un fluide s'écoulant sous l'effet de la gravité.

### Modèle physique

Le débit instantané dépend du niveau de remplissage de la cuve :

$$Q(v) = Q_{max} \cdot \sqrt{\frac{v}{V_{max}}}$$

Avec $Q_{max} = 10\ \text{ml/s}$ (débit calibré sur les pompes physiques).

### Résolution analytique

L'approche naïve (intégration numérique pas à pas, $dt = 10ms$) est coûteuse et imprécise. On résout l'équation différentielle exactement :

$$\frac{dv}{dt} = -Q_{max} \cdot \sqrt{\frac{v}{V_{max}}}$$

Par séparation des variables et intégration de $v_{start}$ à $v_{end} = v_{start} - V_{target}$ :

$$\boxed{T = \frac{2\sqrt{V_{max}}}{Q_{max}} \cdot \left(\sqrt{v_{start}} - \sqrt{v_{end}}\right)}$$

### Gain de performance

| Méthode | Temps de calcul | Précision |
|---|---|---|
| Intégration numérique ($dt = 10ms$) | ~0.18 ms/appel | ±10 ms |
| **Formule analytique** | **~0.0002 ms/appel** | **<1 ms** |
| Gain | **×730 plus rapide** | **×10 plus précis** |

### Validation (Pytest)

```
35 tests · 6 catégories · 0.12s · 100% passed

TestPhysicalCoherence      ·····  Cohérence physique (monotonie, débit)
TestAnalyticalFormula      ·······  Vérification numérique indépendante
TestEdgeCases              ·····  Cas limites (quasi-vide, vidage total)
TestInstantaneousFlowRate  ······  Débit instantané
TestInputValidation        ········  Validation des entrées (ValueError)
TestPerformance            ··  < 1ms/appel garanti
```

---

## 🖥️ Interface

> 📸 *Screenshots et photos de la machine physique à venir*

### SmartBar
Interface principale de commande avec suggestions intelligentes basées sur les favoris, les ratings et la disponibilité des ingrédients en temps réel.

### Configuration 3D
Modèle 3D interactif de la machine permettant d'assigner visuellement les ingrédients aux 12 cuves. Au survol d'un ingrédient dans la liste, la cuve correspondante s'illumine dans le modèle 3D (émissivité GPU).

### Dashboard Admin
Analytics de revenus, suivi des stocks, alertes critiques, export Excel des données.

---

## 🚀 Lancement rapide (Docker)

### Prérequis
- Docker Desktop installé
- Un compte Stripe (clés test suffisantes)

### Installation

```bash
# 1. Clone
git clone https://github.com/matteobombrun/baros-v4.git
cd baros-v4

# 2. Configuration
cp .env.example .env
# Édite .env : renseigne STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET

# 3. Lancement
docker-compose up --build
```

L'application est disponible sur **http://localhost**

| Service | URL |
|---|---|
| Application | http://localhost |
| API docs (Swagger) | http://localhost/api/docs |
| Backend direct | http://localhost:8000 |

### Arrêt

```bash
docker-compose down          # Arrêt (données conservées)
docker-compose down -v       # Arrêt + suppression des volumes
```

---

## 🧪 Tests

```bash
# Depuis la racine du projet
pip install pytest
pytest tests/ -v

# Avec détail des performances
pytest tests/test_fluid_physics.py -v -s
```

```
============= 35 passed in 0.12s =============
```

---

## 📁 Structure du projet

```
BarOS_V4/
├── backend/
│   ├── main.py              # Point d'entrée FastAPI
│   ├── models.py            # Modèles SQLAlchemy 2.0
│   ├── database.py          # Configuration DB (SQLite / PostgreSQL)
│   ├── routers/             # cocktails, payments, queue, users, machine...
│   ├── services/
│   │   └── cocktail_service.py   # Logique séquencement + remboursement
│   ├── logic/
│   │   └── fluid_physics.py      # Loi de Torricelli analytique
│   └── hardware/
│       └── gpio_manager.py       # Pilotage GPIO Raspberry Pi
├── frontend/
│   ├── src/
│   │   ├── api.js           # Configuration API centralisée
│   │   ├── pages/           # SmartBar, Dashboard, TestMachine, ProfilePage...
│   │   ├── components/      # Layout, LoginModal, 3D/Machine...
│   │   └── context/         # UserContext, ThemeContext
│   └── public/
│       └── models/          # Modèle GLTF machine 3D
├── tests/
│   └── test_fluid_physics.py    # 35 tests unitaires Pytest
├── config/
│   └── config.json          # Configuration machine (pompes, cuves)
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── nginx.conf
└── requirements.txt
```

---

## 🔄 Flux de commande

```
User scanne badge NFC
        │
        ▼
Authentification → Solde vérifié
        │
        ▼
Choix cocktail (SmartBar)
        │
        ▼
Paiement (Stripe ou solde)
        │
        ▼
Création PourSequence en DB
        │
        ├─ Réservation stock atomique (Phase 1)
        │
        ├─ Calcul durées Torricelli par ingrédient
        │
        ├─ Séquencement GPIO pompes (Phase 2)
        │         │
        │         ├─ Erreur hardware → Emergency Stop
        │         │                 → Remboursement stock + solde automatique
        │         │                 → Flag OrderHistory.refunded = True (idempotent)
        │         │
        │         └─ Succès → Toutes les steps COMPLETED
        │
        └─ PourSequence status = COMPLETED
```

---

## 🔒 Sécurité & robustesse

- **Mutex machine** (`asyncio.Lock`) — une seule séquence de versement à la fois
- **Remboursement idempotent** — `OrderHistory.refunded` flag atomique, impossible de rembourser deux fois
- **Emergency stop** — coupe toutes les pompes actives en cas d'exception hardware
- **Validation Pydantic** — chaque entrée API est strictement typée et validée
- **Rate limiting** — protection des endpoints sensibles
- **Admin guard** — routes admin protégées par authentification PIN

---

## 📄 Licence

MIT — Mattéo Bombrun · ESME Paris

---

<div align="center">

*Construit avec FastAPI, React, Three.js et beaucoup de physique.*

</div>