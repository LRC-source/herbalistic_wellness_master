import json
import csv
import os

catalog_file = r"C:\Users\lacar\Desktop\HW_Wholesale\catalog.json"
csv_file = r"C:\Users\lacar\Desktop\HerbalisticWellness_LiveBuild_Sep2026\HW Wholesale Products.csv"

with open(catalog_file, 'r', encoding='utf-8') as f:
    catalog_data = json.load(f)

# The structure is {"success": true, "data": [{...}, ...]}
existing_products = catalog_data.get('data', [])
product_dict = { p['id']: p for p in existing_products }

added_count = 0
updated_count = 0
skipped_rows = []

skip_ids = {"SEA_MOSS_REG", "FOUNDER_PASS", "LIFETIME_PASS"}

with open(csv_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        row_id = row.get('id', '').strip()
        if not row_id:
            continue
        
        if row_id in skip_ids:
            skipped_rows.append(row_id)
            continue
            
        is_new = row_id not in product_dict
        if is_new:
            added_count += 1
            p = {
                "id": row_id,
                "shipping_weight": "1.0 oz" # Default if not found
            }
        else:
            updated_count += 1
            p = product_dict[row_id]
            
        p["title"] = row.get('title', '').strip()
        # "price" column is e.g. "12.00 USD". Can use that or retail_msrp. 
        # The prompt says: "The CSV's 'price' column is written like '12.00 USD' and equals the retail MSRP... Show the tier columns as the wholesale prices"
        price_val = row.get('retail_msrp', '').strip()
        if not price_val and row.get('price', '').strip():
            # e.g., "12.00 USD" -> "$12.00"
            price_val = "$" + row.get('price').replace(' USD', '').strip()
            
        p["retail_msrp"] = price_val
        p["tier1_wholesale_55_percent"] = row.get('tier1_wholesale_55pct', '').strip()
        p["tier2_volume_50_percent"] = row.get('tier2_volume_50pct', '').strip()
        p["white_label_ip_80_percent"] = row.get('white_label_80pct', '').strip()
        p["min_order_qty"] = row.get('min_order_qty', '').strip()
        p["image_link"] = row.get('image_link', '').strip()
        
        product_dict[row_id] = p

new_catalog_list = list(product_dict.values())
catalog_data['data'] = new_catalog_list

with open(catalog_file, 'w', encoding='utf-8') as f:
    json.dump(catalog_data, f, indent=4)

print(f"Added: {added_count}")
print(f"Updated: {updated_count}")
print(f"Skipped: {', '.join(skipped_rows)}")

