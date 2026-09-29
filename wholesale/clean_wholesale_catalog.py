import json
import csv

catalog_file = r"C:\Users\lacar\Desktop\HW_Wholesale\catalog.json"
csv_file = r"C:\Users\lacar\Desktop\HerbalisticWellness_LiveBuild_Sep2026\HW Wholesale Products.csv"

# Read existing catalog to preserve properties like shipping_weight
with open(catalog_file, 'r', encoding='utf-8') as f:
    catalog_data = json.load(f)

existing_products = { p['id']: p for p in catalog_data.get('data', []) }
skip_ids = {"SEA_MOSS_REG", "FOUNDER_PASS", "LIFETIME_PASS"}

new_catalog_list = []
added_count = 0
updated_count = 0
skipped_rows = []

with open(csv_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        row_id = row.get('id', '').strip()
        if not row_id:
            continue
            
        if row_id in skip_ids:
            skipped_rows.append(row_id)
            continue
            
        is_new = row_id not in existing_products
        if is_new:
            added_count += 1
            p = {"id": row_id, "shipping_weight": "1.0 oz"}
        else:
            updated_count += 1
            p = existing_products[row_id]
            
        p["title"] = row.get('title', '').strip()
        price_val = row.get('retail_msrp', '').strip()
        if not price_val and row.get('price', '').strip():
            price_val = "$" + row.get('price').replace(' USD', '').strip()
            
        p["retail_msrp"] = price_val
        p["tier1_wholesale_55_percent"] = row.get('tier1_wholesale_55pct', '').strip()
        p["tier2_volume_50_percent"] = row.get('tier2_volume_50pct', '').strip()
        p["white_label_ip_80_percent"] = row.get('white_label_80pct', '').strip()
        p["min_order_qty"] = row.get('min_order_qty', '').strip()
        p["image_link"] = row.get('image_link', '').strip()
        
        new_catalog_list.append(p)

catalog_data['data'] = new_catalog_list

with open(catalog_file, 'w', encoding='utf-8') as f:
    json.dump(catalog_data, f, indent=4)

print(f"Total in catalog: {len(new_catalog_list)}")
print(f"Skipped: {', '.join(skipped_rows)}")
