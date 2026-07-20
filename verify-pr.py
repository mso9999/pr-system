import subprocess, json, sys

TOKEN = subprocess.run(['gcloud', 'auth', 'print-access-token'], capture_output=True, text=True).stdout.strip()
url = 'https://firestore.googleapis.com/v1/projects/pr-system-4ea55/databases/(default)/documents/purchaseRequests?pageSize=200'
cmd = ['curl', '-s', '-H', f'Authorization: Bearer {TOKEN}', url]
result = subprocess.run(cmd, capture_output=True, text=True)
data = json.loads(result.stdout)

for d in data.get('documents', []):
    f = d.get('fields', {})
    pr = f.get('prNumber', {}).get('stringValue', '')
    if '260716-1001' in pr:
        total = f.get('totalAmount', {}).get('doubleValue', 'N/A')
        incoterm = f.get('incoterm', {}).get('stringValue', 'N/A')
        status = f.get('status', {}).get('stringValue', 'N/A')
        po = f.get('poDocument', {}).get('mapValue', {}).get('fields', {}).get('name', {}).get('stringValue', 'None')
        inv = f.get('proformaInvoice', {}).get('arrayValue', {}).get('values', [])
        inv_names = [v.get('mapValue', {}).get('fields', {}).get('name', {}).get('stringValue', '?') for v in inv]
        doc_id = d['name'].split('/')[-1]
        print(f'PR: {pr}')
        print(f'  Doc ID: {doc_id}')
        print(f'  Status: {status}')
        print(f'  Total: ${total:,.2f}')
        print(f'  Incoterm: {incoterm}')
        print(f'  PO: {po}')
        print(f'  Invoice: {inv_names}')
