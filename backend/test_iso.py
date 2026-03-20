import iso8583
import binascii

# Simple spec for testing
SPEC = {
    '0': {'name': 'MTI', 'len': 4, 'type': 'n'},
    '2': {'name': 'PAN', 'len': 19, 'type': 'llvar'},
    '3': {'name': 'ProcCode', 'len': 6, 'type': 'n'},
    '4': {'name': 'Amount', 'len': 12, 'type': 'n'},
    '7': {'name': 'DateTime', 'len': 10, 'type': 'n'},
    '11': {'name': 'STAN', 'len': 6, 'type': 'n'},
    '18': {'name': 'MCC', 'len': 4, 'type': 'n'},
    '41': {'name': 'Terminal', 'len': 8, 'type': 'ans'},
    '49': {'name': 'Currency', 'len': 3, 'type': 'n'},
}

fields = {
    '0': '0100',
    '2': '4000123456789010',
    '3': '000000',
    '4': '000000001000',
    '7': '1027103000',
    '11': '123456',
    '18': '5411',
    '41': 'TERM0001',
    '49': '840'
}

try:
    # Actually pyiso8583.encode(fields, spec) is the correct signature
    raw_msg, encoded = iso8583.encode(fields, SPEC)
    print(f"Hex: {binascii.hexlify(raw_msg).upper().decode()}")
except Exception as e:
    print(f"Error: {e}")
