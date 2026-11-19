import serial
import csv
import time
from datetime import datetime

PORT = 'COM5'
BAUD = 1000000

def verify(line: str):
    """คืนค่า list ของฟิลด์ถ้า checksum ถูก ไม่งั้นคืน None"""
    line = line.strip()
    if not (line.startswith('$') and '*' in line):
        return None
    body, cs = line[1:].rsplit('*', 1)
    calc = 0
    for ch in body:
        calc ^= ord(ch)
    try:
        if calc != int(cs, 16):
            return None
    except ValueError:
        return None
    return body.split(',')

ser = serial.Serial(PORT, BAUD, timeout=2)
time.sleep(2)

ok = bad = lost = 0
last_seq = None

with open('sensor_log.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['time', 'seq', 'temp_C', 'humidity_%', 'sound_p2p', 'sound_digital', 'light_raw'])
    try:
        while True:
            raw = ser.readline().decode('ascii', errors='ignore')
            if not raw:
                print('...ไม่มีข้อมูลเข้ามา (timeout)')
                continue
            fields = verify(raw)
            if fields is None or len(fields) != 6:
                bad += 1
                print('BAD packet:', raw.strip())
                continue

            seq = int(fields[0])
            if last_seq is not None and seq != last_seq + 1:
                lost += seq - last_seq - 1
            last_seq = seq
            ok += 1

            w.writerow([datetime.now().isoformat(timespec='seconds')] + fields)
            f.flush()
            print(f"#{seq} T={fields[1]}°C H={fields[2]}% "
                  f"sound={fields[3]} dig={fields[4]} light={fields[5]}")
    except KeyboardInterrupt:
        pass

ser.close()
print(f'\nok={ok} bad={bad} lost={lost}')