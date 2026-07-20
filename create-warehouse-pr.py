import subprocess, json, os, uuid
from datetime import datetime
from urllib.parse import quote

def curl_post(url, headers, data=None, json_body=None, binary_file=None):
    cmd = ['curl', '-s', '-X', 'POST', '-w', '\n__HTTP_CODE__:%{http_code}']
    for k, v in headers.items():
        cmd.extend(['-H', f'{k}: {v}'])
    if json_body:
        cmd.extend(['-H', 'Content-Type: application/json', '-d', json.dumps(json_body)])
    elif binary_file:
        cmd.extend(['--data-binary', f'@{binary_file}'])
    elif data:
        cmd.extend(['-d', data])
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
PO_FILE = 'PO_260716-1001-MIO-BN.pdf'
INV_FILE = 'INV_INV-OPA-2026-008.pdf'
TOTAL_AMOUNT = 30313.13
DEPOSIT_AMOUNT = 9093.94
BALANCE_AMOUNT = 21219.19
DELIVERY_DATE = '2026-09-13'
NOW_ISO = datetime.now().isoformat() + 'Z'

# Upload PO PDF
po_path = os.path.join(PDF_DIR, PO_FILE)
po_storage_path = f'pr/{PR_NUMBER}/{PO_FILE}'
po_upload_url = f'{STORAGE_UPLOAD_BASE}?name={quote(po_storage_path, safe="")}&uploadType=media'
code, body = curl_post(po_upload_url, STORAGE_HEADERS, binary_file=po_path)
if code == 200:
    po_url = f'https://firebasestorage.googleapis.com/v0/b/{BUCKET}/o/{quote(po_storage_path, safe="")}?alt=media'
    po_size = os.path.getsize(po_path)
    print(f'PO uploaded: {po_size} bytes')
else:
    print(f'PO FAIL: {code} {body[:200]}')
    exit(1)

# Upload Invoice PDF
inv_path = os.path.join(PDF_DIR, INV_FILE)
inv_storage_path = f'pr/{PR_NUMBER}/{INV_FILE}'
inv_upload_url = f'{STORAGE_UPLOAD_BASE}?name={quote(inv_storage_path, safe="")}&uploadType=media'
code, body = curl_post(inv_upload_url, STORAGE_HEADERS, binary_file=inv_path)
if code == 200:
    inv_url = f'https://firebasestorage.googleapis.com/v0/b/{BUCKET}/o/{quote(inv_storage_path, safe="")}?alt=media'
    inv_size = os.path.getsize(inv_path)
    print(f'Invoice uploaded: {inv_size} bytes')
else:
    print(f'INV FAIL: {code} {body[:200]}')
    exit(1)

# Create PR document in Firestore
fields = {
    'prNumber': {'stringValue': PR_NUMBER},
    'status': {'stringValue': 'PENDING_APPROVAL'},
    'description': {'stringValue': 'Steel Structure Warehouse (36x14x7m) - 504m2 - Weizhengheng Group OEM. CIF Cotonou. 30% deposit, 70% balance before shipment.'},
    'selectedVendor': {'stringValue': 'One Power Africa GBC'},
    'currency': {'stringValue': 'USD'},
    'totalAmount': {'doubleValue': TOTAL_AMOUNT},
    'estimatedAmount': {'doubleValue': TOTAL_AMOUNT},
    'incoterm': {'stringValue': 'CIF'},
    'modeOfDelivery': {'stringValue': 'Sea'},
    'estimatedDeliveryDate': {'stringValue': DELIVERY_DATE},
    'paymentTerms': {'stringValue': f'30% advance (${DEPOSIT_AMOUNT:,.2f}). Balance ${BALANCE_AMOUNT:,.2f} before shipment. Delivery 45 days from final payment.'},
    'paymentMethod': {'stringValue': 'Bank Transfer'},
    'referenceContractNumber': {'stringValue': 'Software Platform, Procurement and Supply Services Agreement dated 15 June 2026'},
    'buyerRepresentativeName': {'stringValue': 'Hospice CHABI'},
    'buyerRepresentativeTitle': {'stringValue': 'Managing Director'},
    'buyerRepresentativeEmail': {'stringValue': 'hospice@mionwa.com'},
    'supplierRepresentativeName': {'stringValue': 'Matthew Orosz'},
    'supplierRepresentativeTitle': {'stringValue': 'Director'},
    'supplierRepresentativeEmail': {'stringValue': 'mso@1pwrafrica.com'},
    'supplierName': {'stringValue': 'One Power Africa GBC'},
    'organization': {'stringValue': 'Mionwa Generation SA'},
    'poIssueDate': {'stringValue': '2026-07-16'},
    'createdAt': {'timestampValue': NOW_ISO},
    'updatedAt': {'timestampValue': NOW_ISO},
    'oemManufacturer': {'mapValue': {'fields': {
        'name': {'stringValue': 'Weizhengheng Group'},
        'address': {'stringValue': 'Shijiazhuang, Hebei, China'},
        'contact': {'stringValue': 'Crystal Li - Tel: +86-0311-85252196, Email: Crystal@wzhgroup.com'},
    }}},
    'manufacturerRole': {'stringValue': 'OEM manufacturer and exporter of steel structure warehouse'},
    'certificateOfOrigin': {'stringValue': 'China'},
    'hsCodes': {'stringValue': '7308.90 (Steel structures)'},
    'importInvoiceIssuer': {'stringValue': 'One Power Africa GBC'},
    'importValueBasis': {'stringValue': 'Supplier-to-Customer transaction value (CIF Cotonou)'},
    'poRemarks': {'stringValue': 'Wind Load 80km/h, Snow Load 0kg/m2, Brick Wall 0m. Excludes concrete foundation. Quotation valid 7 days from 16-Jul-2026.'},
    'lineItemsWithSKU': {'arrayValue': {'values': [
        {'mapValue': {'fields': {
            'lineNumber': {'integerValue': '1'},
            'description': {'stringValue': 'Steel Structure Warehouse (36x14x7m) - 504m2 - Complete kit with steel structure, roof/wall system, door system, accessories'},
            'quantity': {'doubleValue': 1},
            'uom': {'stringValue': 'set'},
            'unitPrice': {'doubleValue': 22707.00},
            'totalAmount': {'doubleValue': 22707.00},
            'currency': {'stringValue': 'USD'},
            'origin': {'stringValue': 'China'},
        }}},
        {'mapValue': {'fields': {
            'lineNumber': {'integerValue': '2'},
            'description': {'stringValue': 'Logistics & Freight - Inland Freight, Port Cost, Packing, Steel Pallet, Ocean Freight to Cotonou (CIF)'},
            'quantity': {'doubleValue': 1},
            'uom': {'stringValue': 'lot'},
            'unitPrice': {'doubleValue': 7606.13},
            'totalAmount': {'doubleValue': 7606.13},
            'currency': {'stringValue': 'USD'},
            'origin': {'stringValue': 'China'},
        }}},
    ]}},
    'poDocument': {'mapValue': {'fields': {
        'id': {'stringValue': str(uuid.uuid4())},
        'name': {'stringValue': PO_FILE},
        'url': {'stringValue': po_url},
        'path': {'stringValue': po_storage_path},
        'type': {'stringValue': 'application/pdf'},
        'size': {'integerValue': str(po_size)},
        'uploadedAt': {'stringValue': NOW_ISO},
        'uploadedBy': {'mapValue': {'fields': {
            'id': {'stringValue': 'BSY3Ov0tOIgYXvM7bYBfVapjmXA2'},
            'email': {'stringValue': 'mso@1pwrafrica.com'},
            'name': {'stringValue': 'Matthew Orosz'},
        }}},
    }}},
    'proformaInvoice': {'arrayValue': {'values': [{'mapValue': {'fields': {
        'id': {'stringValue': str(uuid.uuid4())},
        'name': {'stringValue': INV_FILE},
        'url': {'stringValue': inv_url},
        'path': {'stringValue': inv_storage_path},
        'type': {'stringValue': 'application/pdf'},
        'size': {'integerValue': str(inv_size)},
        'uploadedAt': {'stringValue': NOW_ISO},
        'uploadedBy': {'mapValue': {'fields': {
            'id': {'stringValue': 'BSY3Ov0tOIgYXvM7bYBfVapjmXA2'},
            'email': {'stringValue': 'mso@1pwrafrica.com'},
            'name': {'stringValue': 'Matthew Orosz'},
        }}},
    }}}]}},
}

code, body = curl_post(f'{FIRESTORE_BASE}/purchaseRequests', FIRESTORE_HEADERS, json_body={'fields': fields})
if code == 200:
    doc_id = body.split('"name":')[1].split('/')[-1].rstrip('"').strip()
    print(f'PR created: {PR_NUMBER} (doc: {doc_id})')
    print(f'  totalAmount: ${TOTAL_AMOUNT:,.2f} | incoterm: CIF')
    print(f'  poDocument: {PO_FILE} | proformaInvoice: {INV_FILE}')
else:
    print(f'CREATE FAIL: {code} {body[:300]}')
print('DONE')
