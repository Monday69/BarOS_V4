from curl_cffi import requests
from bs4 import BeautifulSoup
import json
import re
import time

# --- CONFIGURATION ---
URL_A_TESTER = "https://www.destinationcocktails.fr/rhum-ambre/"
OUTPUT_FILE = "cocktails_import.json"

def clean_volume(text):
    match = re.search(r"(\d+[\.,]?\d*)\s*(cl|ml|trait|cuillère)", text.lower())
    if not match: return 0
    value = float(match.group(1).replace(',', '.'))
    unit = match.group(2)
    if unit == "cl": return value * 10
    return value

def scrape_now(url):
    # On crée une session qui se fait passer pour un Chrome 120 sous Windows
    print(f"👻 Infiltration indétectable en cours : {url}")
    
    try:
        # impersonate="chrome120" est la clé magique pour éviter le 403
        res = requests.get(url, impersonate="chrome120")
        res.raise_for_status()
    except Exception as e:
        print(f"❌ Échec de l'infiltration : {e}")
        return

    soup = BeautifulSoup(res.text, 'html.parser')
    
    # On cherche les liens card-recipe__link
    links = []
    links = [a['href'] for a in soup.find_all('a', class_='card-recipe__link')]
    if not links:
        print("🔍 Recherche alternative de liens...")
        links = [a['href'] for a in soup.find_all('a', href=True) if '/recette/' in a['href']]
    
    # On enlève les doublons
    links = list(set(links))

    print(f"🎯 {len(links)} cocktails repérés. Extraction commencée.")
    all_cocktails = []

    for i, link in enumerate(links):
        try:
            full_link = link if link.startswith('http') else f"https://www.destinationcocktails.fr{link}"
            
            # Un peu de délai pour rester discret
            time.sleep(2) 
            
            # On réutilise impersonate pour chaque page de cocktail
            recipe_res = requests.get(full_link, impersonate="chrome120")
            recipe_soup = BeautifulSoup(recipe_res.text, 'html.parser')
            
            json_script = recipe_soup.find('script', type='application/ld+json')
            if not json_script: continue
            
            data = json.loads(json_script.string)
            info = data[0] if isinstance(data, list) else data

            # Gestion du format spécifique @graph que certains sites utilisent
            if "@graph" in info:
                info = next((x for x in info["@graph"] if x["@type"] == "Recipe"), info["@graph"][0])

            cocktail = {
                "name": info.get("name"),
                "image_url": info.get("image", [None])[0] if isinstance(info.get("image"), list) else info.get("image"),
                "description": info.get("description"),
                "ingredients": []
            }

            for ing_text in info.get("recipeIngredient", []):
                cocktail["ingredients"].append({
                    "raw_text": ing_text,
                    "volume_ml": clean_volume(ing_text)
                })

            all_cocktails.append(cocktail)
            print(f"✅ [{i+1}/{len(links)}] {cocktail['name']}")

        except Exception as e:
            print(f"❌ Erreur sur {link}: {e}")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_cocktails, f, indent=2, ensure_ascii=False)
    
    print(f"\n✨ Succès total ! {len(all_cocktails)} cocktails sauvegardés.")

if __name__ == "__main__":
    scrape_now(URL_A_TESTER)