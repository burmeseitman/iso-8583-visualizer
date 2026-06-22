import iso8583
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import datetime
import binascii
import random
import string

app = FastAPI(title="ISO 8583 Interactive Visualizer")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Card data mocks
CARD_DATA = {
    "credit": {
        "pan": "4000123456789010",
        "limit": 5000.00,
        "spent": 0.00,
        "type": "Credit Card",
        "expiry": "12/28",
        "cvv": "123"
    },
    "debit": {
        "pan": "5000876543210987",
        "savings": 1500.00,
        "spent": 0.00,
        "type": "Debit Card",
        "expiry": "10/26",
        "cvv": "456"
    }
}

# ─── ISO 8583:1987 Field Definitions ───────────────────────────────────────
# Reference: https://en.wikipedia.org/wiki/ISO_8583
# Each entry: field_id → { name, description }
FIELD_INFO = {
    '0':   {'name': 'Message Type Indicator (MTI)',
             'desc': 'A 4-digit numeric code that classifies the high-level function of the message. First digit = ISO version (0=1987), second = message class (1=Authorization), third = message function (0=Request), fourth = message origin (0=Acquirer).'},
    '1':   {'name': 'Bitmap',
             'desc': 'A 64- or 128-bit field indicating which data elements (DE) are present in the message. Each bit corresponds to a DE number; bit 1 = DE1 (secondary bitmap), bit 2 = DE2, etc.'},
    '2':   {'name': 'Primary Account Number (PAN)',
             'desc': 'The embossed card number (up to 19 digits). This is the primary identifier for the cardholder account. LLVAR format (2-digit length prefix).'},
    '3':   {'name': 'Processing Code',
             'desc': '6-digit code defining the transaction type, from/to account types. First 2 digits = transaction type (00=Purchase, 01=Cash Advance, 20=Refund). Middle 2 = "From" account. Last 2 = "To" account.'},
    '4':   {'name': 'Amount, Transaction',
             'desc': 'The transaction amount in the minor unit of the currency (e.g., cents for USD). Fixed 12-digit numeric field, right-justified, zero-filled.'},
    '5':   {'name': 'Amount, Settlement',
             'desc': 'The settlement amount, which may differ from the transaction amount due to currency conversion.'},
    '6':   {'name': 'Amount, Cardholder Billing',
             'desc': 'Amount billed to the cardholder in the cardholder\'s currency.'},
    '7':   {'name': 'Transmission Date & Time',
             'desc': '10-digit field in MMDDhhmmss format. The UTC date and time when the message was transmitted by the acquirer.'},
    '9':   {'name': 'Conversion Rate, Settlement',
             'desc': 'Conversion rate between the transaction currency and the settlement currency.'},
    '10':  {'name': 'Conversion Rate, Cardholder Billing',
             'desc': 'Conversion rate between the transaction currency and the cardholder billing currency.'},
    '11':  {'name': 'System Trace Audit Number (STAN)',
             'desc': 'A 6-digit number assigned by the originator to uniquely identify a transaction. Used for matching requests with responses and for auditing.'},
    '12':  {'name': 'Local Transaction Time',
             'desc': '6-digit field in hhmmss format representing the local time at the point of transaction.'},
    '13':  {'name': 'Local Transaction Date',
             'desc': '4-digit field in MMDD format representing the local date at the point of transaction.'},
    '14':  {'name': 'Expiration Date',
             'desc': '4-digit field in YYMM format representing the card\'s expiration date.'},
    '18':  {'name': 'Merchant Category Code (MCC)',
             'desc': '4-digit code classifying the merchant type (e.g., 5411=Grocery Stores, 5812=Restaurants, 5999=Misc Retail). Used for authorization decisions and reporting.'},
    '22':  {'name': 'Point of Service Entry Mode',
             'desc': 'Describes how the card data was captured: 01=Manual, 02=Magnetic stripe, 05=Chip (ICC), 07=Contactless chip, 90=Magnetic stripe fallback, 91=Contactless magnetic stripe.'},
    '23':  {'name': 'Card Sequence Number',
             'desc': 'Identifies a card among multiple cards with the same PAN (e.g., supplementary cards).'},
    '25':  {'name': 'Point of Service Condition Code',
             'desc': 'Describes the condition under which the transaction took place: 00=Normal, 08=Mail/Telephone order, 59=E-commerce.'},
    '26':  {'name': 'Point of Service PIN Capture Code',
             'desc': 'Maximum number of PIN digits the terminal can capture.'},
    '32':  {'name': 'Acquiring Institution ID Code',
             'desc': 'Identifies the financial institution acting as the acquirer of this transaction. LLVAR format.'},
    '35':  {'name': 'Track 2 Data',
             'desc': 'Magnetic stripe Track 2 equivalent data. Contains PAN, expiry, service code, and discretionary data. LLVAR format.'},
    '37':  {'name': 'Retrieval Reference Number',
             'desc': '12-character alphanumeric field used by the acquirer to identify and retrieve the original transaction.'},
    '38':  {'name': 'Authorization Identification Response',
             'desc': '6-character code assigned by the authorizing institution (issuer) to identify an approved transaction.'},
    '39':  {'name': 'Response Code',
             'desc': '2-character code indicating the disposition of a transaction: 00=Approved, 05=Do Not Honor, 14=Invalid Card, 51=Insufficient Funds, 54=Expired Card.'},
    '41':  {'name': 'Card Acceptor Terminal ID',
             'desc': '8-character identifier of the terminal at the point of transaction, assigned by the acquirer.'},
    '42':  {'name': 'Card Acceptor Identification Code',
             'desc': '15-character code identifying the card acceptor (merchant), assigned by the acquirer.'},
    '43':  {'name': 'Card Acceptor Name/Location',
             'desc': 'Up to 40 characters describing the merchant name, city, and country. LLVAR format.'},
    '49':  {'name': 'Currency Code, Transaction',
             'desc': '3-digit ISO 4217 numeric currency code for the transaction: 840=USD, 978=EUR, 826=GBP, 392=JPY.'},
    '50':  {'name': 'Currency Code, Settlement',
             'desc': '3-digit ISO 4217 numeric currency code used for settlement.'},
    '51':  {'name': 'Currency Code, Cardholder Billing',
             'desc': '3-digit ISO 4217 numeric currency code for cardholder billing.'},
    '52':  {'name': 'Personal Identification Number (PIN) Data',
             'desc': '8-byte binary field containing the encrypted PIN block used for cardholder verification.'},
    '54':  {'name': 'Additional Amounts',
             'desc': 'Provides additional amount information such as account balance, cashback amount, or remaining credit.'},
    '55':  {'name': 'ICC Data (EMV)',
             'desc': 'Contains chip card (EMV/ICC) related data in TLV (Tag-Length-Value) format. Carries cryptograms, application IDs, and other EMV data elements.'},
    '60':  {'name': 'Reserved (Private)',
             'desc': 'Reserved for private use between the acquirer and issuer or network.'},
    '70':  {'name': 'Network Management Information Code',
             'desc': 'Indicates the type of network management action: 001=Sign-on, 002=Sign-off, 301=Echo test.'},
    '90':  {'name': 'Original Data Elements',
             'desc': 'Contains the original MTI, STAN, date/time, and acquirer/forwarder IDs from the original transaction (used in reversals).'},
    '100': {'name': 'Receiving Institution ID Code',
             'desc': 'Identifies the financial institution that should receive the message.'},
    '102': {'name': 'Account Identification 1',
             'desc': 'Identifies the primary account in account-related transactions (transfers, balance inquiries).'},
    '103': {'name': 'Account Identification 2',
             'desc': 'Identifies the secondary account (e.g., destination account for transfers).'},
    '120': {'name': 'Record Data',
             'desc': 'Contains record data relevant to the transaction.'},
    '123': {'name': 'POS Data Code',
             'desc': 'Additional data about the POS environment and capability.'},
    '128': {'name': 'Message Authentication Code (MAC)',
             'desc': '8-byte field to ensure message integrity. Calculated using a cryptographic key shared between sender and receiver.'},
}

class TransactionRequest(BaseModel):
    card_type: str
    amount: float

@app.get("/")
async def root():
    return {"message": "ISO 8583 Interactive Visualizer API is active"}

@app.get("/cards")
async def get_cards():
    return CARD_DATA

# ─── pyiso8583 Spec (field descriptors) ─────────────────────────────────────
ISO_SPEC = {
    'h':   {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 0,   'desc': 'Message Header'},
    't':   {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 4,   'desc': 'Message Type Indicator'},
    'p':   {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 16,  'desc': 'Bitmap, Primary'},
    '1':   {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 16,  'desc': 'Bitmap, Secondary'},
    '2':   {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 2, 'max_len': 19,  'desc': 'PAN'},
    '3':   {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 6,   'desc': 'Processing Code'},
    '4':   {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 12,  'desc': 'Amount, Transaction'},
    '7':   {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 10,  'desc': 'Transmission Date & Time'},
    '11':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 6,   'desc': 'STAN'},
    '12':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 6,   'desc': 'Local Transaction Time'},
    '13':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 4,   'desc': 'Local Transaction Date'},
    '14':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 4,   'desc': 'Expiration Date'},
    '18':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 4,   'desc': 'Merchant Category Code'},
    '22':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 3,   'desc': 'POS Entry Mode'},
    '23':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 3,   'desc': 'Card Sequence Number'},
    '25':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 2,   'desc': 'POS Condition Code'},
    '26':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 2,   'desc': 'POS PIN Capture Code'},
    '32':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 2, 'max_len': 11,  'desc': 'Acquiring Institution ID'},
    '35':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 2, 'max_len': 37,  'desc': 'Track 2 Data'},
    '37':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 12,  'desc': 'Retrieval Reference Number'},
    '38':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 6,   'desc': 'Authorization ID Response'},
    '39':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 2,   'desc': 'Response Code'},
    '41':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 8,   'desc': 'Card Acceptor Terminal ID'},
    '42':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 15,  'desc': 'Card Acceptor ID Code'},
    '43':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 2, 'max_len': 40,  'desc': 'Card Acceptor Name/Location'},
    '49':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 3,   'desc': 'Currency Code, Transaction'},
    '52':  {'data_enc': 'b',      'len_enc': 'ascii',  'len_type': 0, 'max_len': 8,   'desc': 'PIN Data'},
    '54':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 3, 'max_len': 120, 'desc': 'Additional Amounts'},
    '55':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 3, 'max_len': 999, 'desc': 'ICC/EMV Data'},
    '60':  {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 3, 'max_len': 60,  'desc': 'Reserved Private'},
    '100': {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 2, 'max_len': 11,  'desc': 'Receiving Institution ID'},
    '102': {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 2, 'max_len': 28,  'desc': 'Account ID 1'},
    '128': {'data_enc': 'ascii',  'len_enc': 'ascii',  'len_type': 0, 'max_len': 8,   'desc': 'MAC'},
}

@app.post("/generate")
async def generate_iso(request: TransactionRequest):
    card_key = request.card_type.lower()
    card = CARD_DATA.get(card_key)
    
    if not card:
        raise HTTPException(status_code=400, detail="Invalid card type")
    
    # Business Logic Check
    if card_key == "credit":
        if request.amount > (card["limit"] - card["spent"]):
            return {
                "status": "FAILED", 
                "reason": f"Transaction of ${request.amount} exceeds your credit limit of ${card['limit'] - card['spent']:.2f}."
            }
    else:
        if request.amount > card["savings"]:
            return {
                "status": "FAILED", 
                "reason": f"Insufficient funds. Your savings balance is ${card['savings']:.2f}."
            }

    # ── Build a comprehensive ISO 8583 message ──
    now = datetime.datetime.now()
    stan = f"{random.randint(1, 999999):06}"
    rrn = ''.join(random.choices(string.digits, k=12))
    expiry_yymm = card["expiry"].split("/")  # "12/28" → ["12","28"]
    
    msg_data = {
        't':   '0100',                                    # DE 0  - Authorization Request
        '2':   card["pan"],                                # DE 2  - Primary Account Number
        '3':   '000000',                                   # DE 3  - Purchase (goods & services)
        '4':   f"{int(request.amount * 100):012}",         # DE 4  - Amount in cents
        '7':   now.strftime("%m%d%H%M%S"),                 # DE 7  - Transmission date & time (UTC)
        '11':  stan,                                       # DE 11 - STAN
        '12':  now.strftime("%H%M%S"),                     # DE 12 - Local transaction time
        '13':  now.strftime("%m%d"),                       # DE 13 - Local transaction date
        '14':  f"{expiry_yymm[1]}{expiry_yymm[0]}",       # DE 14 - Expiry (YYMM)
        '18':  '5411',                                     # DE 18 - MCC: Grocery stores
        '22':  '051',                                      # DE 22 - POS Entry: ICC chip read
        '23':  '001',                                      # DE 23 - Card sequence number
        '25':  '00',                                       # DE 25 - POS Condition: Normal
        '26':  '04',                                       # DE 26 - PIN Capture: 4-digit
        '32':  '123456',                                   # DE 32 - Acquiring institution ID
        '37':  rrn,                                        # DE 37 - Retrieval reference number
        '41':  'TERM0001',                                 # DE 41 - Terminal ID
        '42':  'MERCHANT0001234',                          # DE 42 - Merchant ID (15 chars)
        '43':  'NEXUS SUPERMARKET     YANGON       MM',   # DE 43 - Merchant name/location
        '49':  '840',                                      # DE 49 - Currency: USD
    }

    try:
        raw_msg, encoded = iso8583.encode(msg_data, ISO_SPEC)
        hex_msg = binascii.hexlify(raw_msg).upper().decode()
    except Exception as e:
        return {"status": "ERROR", "reason": f"Encoding failed: {str(e)}"}
    
    # ── Build detailed field breakdown for the UI ──
    # We walk the encoded dict in stream order to track byte offsets so each
    # field can be located inside hex_msg.  Every encoded entry is
    #   {'len': <length-prefix bytes>, 'data': <field data bytes>}
    breakdown = []
    byte_offset = 0  # running position in raw_msg (bytes)

    # ── MTI ──
    mti_raw = encoded['t']['len'] + encoded['t']['data']
    breakdown.append({
        "id":         "0",
        "name":       FIELD_INFO['0']['name'],
        "value":      msg_data['t'],
        "hex_bytes":  binascii.hexlify(mti_raw).upper().decode(),
        "hex_start":  byte_offset * 2,
        "hex_end":    (byte_offset + len(mti_raw)) * 2,
        "desc":       FIELD_INFO['0']['desc']
    })
    byte_offset += len(mti_raw)

    # ── Primary Bitmap ──
    p_raw = encoded['p']['len'] + encoded['p']['data']
    primary_bitmap = encoded['p']['data'].decode()           # e.g. "723C46C108E08000"
    s_raw = b''
    secondary_bitmap = ''
    if encoded.get('1') and encoded['1']:
        s_raw = encoded['1']['len'] + encoded['1']['data']
        secondary_bitmap = encoded['1']['data'].decode()
    full_bitmap_hex = primary_bitmap + secondary_bitmap
    bitmap_raw = p_raw + s_raw
    breakdown.append({
        "id":         "1",
        "name":       FIELD_INFO['1']['name'],
        "value":      full_bitmap_hex,
        "hex_bytes":  binascii.hexlify(bitmap_raw).upper().decode(),
        "hex_start":  byte_offset * 2,
        "hex_end":    (byte_offset + len(bitmap_raw)) * 2,
        "desc":       FIELD_INFO['1']['desc']
    })
    byte_offset += len(bitmap_raw)

    # ── Data Elements (in numeric order) ──
    for f_id in sorted([k for k in msg_data.keys() if k not in ('t', 'h', 'p')], key=int):
        info      = FIELD_INFO.get(f_id, {'name': f'Field {f_id}', 'desc': f'Data element {f_id}.'})
        raw_value = msg_data[f_id]
        f_raw     = encoded[f_id]['len'] + encoded[f_id]['data']

        # For DE4 (Amount) annotate with dollar value so cents vs dollars is obvious
        if f_id == '4':
            dollar_amount = int(raw_value) / 100
            display_value = f"{raw_value}  (= ${dollar_amount:.2f} USD)"
        else:
            display_value = raw_value

        breakdown.append({
            "id":         f_id,
            "name":       info['name'],
            "value":      display_value,
            "hex_bytes":  binascii.hexlify(f_raw).upper().decode(),
            "hex_start":  byte_offset * 2,
            "hex_end":    (byte_offset + len(f_raw)) * 2,
            "desc":       info['desc']
        })
        byte_offset += len(f_raw)

    return {
        "status":           "SUCCESS",
        "hex":              hex_msg,
        "binary_preview":   " ".join([bin(int(c, 16))[2:].zfill(4) for c in hex_msg[:40]]) + "...",
        "fields":           breakdown,
        "card_used":        card["type"],
        "amount_processed": request.amount,
        "encoding_note":    "All fields use ASCII encoding: each character maps to its ASCII byte (e.g. '0'→0x30, '4'→0x34). Use hex_bytes per field to locate it in the raw stream."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
