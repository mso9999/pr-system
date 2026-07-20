import subprocess, json, os
from urllib.parse import quote

def curl_post(url, headers, binary_file=None):
    cmd = ['curl', '-s', '-X', 'POST', '-w', '\n__HTTP_CODE__:%{http_code}']
    for k, v in headers.items():
        cmd.extend(['-H', f'{k}: {v}'])
    if binary_file:
        cmd.extend(['--data-binary', f'@{binary_file}'])
    cmd.append(url)
    result = subprocess.run(cmd, capture_output=True, text=True)
    output = result.stdout
    code = '000'
    if '__HTTP_CODE__:' in output:
        parts = output.rsplit('__HTTP_CODE__:', 1)
        output = parts[0].strip()
        code = parts[1].strip()
    return int(code), output

def curl_patch(url, headers, json_body):
    cmd = ['curl', '-s', '-X', 'PATCH', '-w', '\n__HTTP_CODE__:%{http_code}']
    for k, v in headers.items():
        cmd.extend(['-H', f'{k}: {v}'])
    cmd.extend(['-H', 'Content-Type: application/json', '-d', json.dumps(json_body)])
    cmd.append(url)
    result = subprocess.run(cmd, capture_output=True, text=True)
    output = result.stdout
    code = '000'
    if '__HTTP_CODE__:' in output:
        parts = output.rsplit('__HTTP_CODE__:', 1)
        output = parts[0].strip()
        code = parts[1].strip()
    return int(code), output

TOKEN = subprocess.run(['gcloud', 'auth', 'print-access-token'], capture_output=True, text=True).stdout.strip()
PROJECT_ID = 'pr-system-4ea55'
BUCKET = 'pr-system-4ea55.firebasestorage.app'
FIRESTORE_BASE = f'https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents'
STORAGE_UPLOAD_BASE = f'https://storage.googleapis.com/upload/storage/v1/b/{BUCKET}/o'
FIRESTORE_HEADERS = {'Authorization': f'Bearer {TOKEN}'}
STORAGE_HEADERS = {'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/pdf'}

PDF_DIR = '/Users/mattmso/Dropbox/AI Projects/1PWR Africa/docs/Software Procurement Supply/POs and Invoices'
PR_NUMBER = '260716-1001-MIO-BN'
DOC_ID = 'PMy3AQ8fuHxbv2NYrkM8'
PO_FILE = 'PO_260716-1001-MIO-BN.pdf'
INV_FILE = 'INV_INV-OPA-2026-008.pdf'
DEPOSIT_AMOUNT = 15156.57
BALANCE_AMOUNT = 15156.56
DELIVERY_DATE = '2026-09-13'

# Re-upload PO PDF (overwrite)
po_path = os.path.join(PDF_DIR, PO_FILE)
po_storage_path = f'pr/{PR_NUMBER}/{PO_FILE}'
code, body = curl_post(
    f'{STORAGE_UPLOAD_BASE}?name={quote(po_storage_path, safe="")}&uploadType=media',
    STORAGE_HEADERS, binary_file=po_path
)
if code == 200:
    po_url = f'https://firebasestorage.googleapis.com/v0/b/{BUCKET}/o/{quote(po_storage_path, safe="")}?alt=media'
    po_size = os.path.getsize(po_path)
    print(f'PO re-uploaded: {po_size} bytes')
else:
    print(f'PO FAIL: {code} {body[:200]}')
    exit(1)

# Re-upload Invoice PDF (overwrite)
inv_path = os.path.join(PDF_DIR, INV_FILE)
inv_storage_path = f'pr/{PR_NUMBER}/{INV_FILE}'
code, body = curl_post(
    f'{STORAGE_UPLOAD_BASE}?name={quote(inv_storage_path, safe="")}&uploadType=media',
    STORAGE_HEADERS, binary_file=inv_path
)
if code == 200:
    inv_url = f'https://firebasestorage.googleapis.com/v0/b/{BUCKET}/o/{quote(inv_storage_path, safe="")}?alt=media'
    inv_size = os.path.getsize(inv_path)
    print(f'Invoice re-uploaded: {inv_size} bytes')
else:
    print(f'INV FAIL: {code} {body[:200]}')
    exit(1)

# Update Firestore PR with new payment terms
update_fields = {
    'fields': {
        'paymentTerms': {'stringValue': f'50% advance payment due per contract terms (${DEPOSIT_AMOUNT:,.2f}). Balance of ${BALANCE_AMOUNT:,.2f} due before shipment. Expected delivery: 45 days from final payment ({DELIVERY_DATE}).'},
        'totalAmount': {'doubleValue': 30313.13},
        'estimatedAmount': {'doubleValue': 30313.13},
    }
}

# Firestore PATCH uses field transforms - we need to use commit endpoint instead
# Use the documents:patch endpoint
patch_url = f'{FIRESTORE_BASE}/purchaseRequests/{DOC_ID}'
code, body = curl_patch(patch_url, FIRESTORE_HEADERS, update_fields)
if code == 200:
    print(f'Firestore PR updated: {PR_NUMBER}')
    print(f'  Payment terms: 50% advance (${DEPOSIT_AMOUNT:,.2f}) / 50% balance (${BALANCE_AMOUNT:,.2f})')
else:
    print(f'UPDATE FAIL: {code} {body[:300]}')

print('DONE')
