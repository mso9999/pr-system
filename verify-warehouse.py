import subprocess, json

TOKEN = subprocess.run(['gcloud', 'auth', 'print-access-token'], capture_output=True, text=True).stdout.strip()

all_docs = []
page_token = None
while True:
    url = 'https://firestore.googleapis.com/v1/projects/pr-system-4ea55/databases/(default)/documents/purchaseRequests?pageSize=100'
    if page_token:
        url += f'&pageToken={page_token}'
    cmd = ['curl', '-s', '-H', f'Authorization: Bearer {TOKEN}', url]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    docs = data.get('documents', [])
    all_docs.extend(docs)
    page_token = data.get('nextPageToken')
    if not page_token:
        break

print(f'Total PRs scanned: {len(all_docs)}')
for d in all_docs:
    f = d.get('fields', {})
    pr = f.get('prNumber', {}).get('stringValue', '')
    desc = f.get('description', {}).get('stringValue', '')
    if 'warehouse' in desc.lower() or 'weizhengheng' in desc.lower() or 'steel structure' in desc.lower() or '1001' in pr:
        total = f.get('totalAmount', {}).get('doubleValue', 'N/A')
        status = f.get('status', {}).get('stringValue', 'N/A')
        doc_id = d['name'].split('/')[-1]
        print(f'  FOUND: {pr} | doc: {doc_id} | {status} | ${total} | {desc[:80]}')

# Also check if any doc was created today (Jul 16)
print('\n--- Docs with createdAt today ---')
for d in all_docs:
    f = d.get('fields', {})
    pr = f.get('prNumber', {}).get('stringValue', '')
    created = f.get('createdAt', {}).get('timestampValue', '')
    if '2026-07-16' in created:
        doc_id = d['name'].split('/')[-1]
        desc = f.get('description', {}).get('stringValue', '')[:60]
        print(f'  {pr} | doc: {doc_id} | {desc}')
