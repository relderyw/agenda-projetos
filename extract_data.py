import pyxlsb
import json
import datetime

FILE_PATH = 'data.xlsb'
SHEET_NAME = 'Tarefas'

def convert_date(serial):
    if serial is None or serial == '': return None
    try:
        # Excel serial to ISO date
        val = float(serial)
        if val < 1: return None # Invalid excel date
        dt = datetime.datetime(1899, 12, 30) + datetime.timedelta(days=val)
        return dt.strftime('%Y-%m-%d')
    except:
        return None

activities = []
try:
    with pyxlsb.open_workbook(FILE_PATH) as wb:
        with wb.get_sheet(SHEET_NAME) as sheet:
            rows = list(sheet.rows())
            # Search for the header row that starts with 'Obrigatorio' or 'Planejamento'
            start_row = 1 # Default Row 2
            
            for i, row in enumerate(rows):
                if i > 10: break
                vals = [str(c.v).lower() for c in row if c.v is not None]
                if 'planejamento' in vals and 'descricão' in ' '.join(vals):
                    start_row = i
                    break

            for row in rows[start_row + 1:]:
                vals = [c.v for c in row]
                if len(vals) < 4: continue
                # Column mapping (assuming standard layout B=Desc, C=Tema, D=Resp)
                desc = vals[1]
                if not desc or str(desc).strip() == "": continue
                
                act = {
                    "planejamento": convert_date(vals[0]),
                    "descricao": str(desc),
                    "themeName": str(vals[2]).strip() if vals[2] else None,
                    "userName": str(vals[3]).strip() if vals[3] else None,
                    "prioridade": (str(vals[4]).capitalize() if vals[4] else "Baixa"),
                    "dataPrevistaFinalizacao": convert_date(vals[5]),
                    "percentualAndamento": int(float(vals[6] or 0) * 100),
                    "dataFinalizada": convert_date(vals[7]),
                    "esforcoRealizado": float(vals[9] or 0),
                    "status": (str(vals[10]).upper() if vals[10] else "PENDENTE"),
                    "week": (str(vals[11]) if vals[11] else "")
                }
                # Filter out garbage
                if act["themeName"] or act["userName"]:
                    activities.append(act)

    with open('activities.json', 'w', encoding='utf-8') as f:
        json.dump(activities, f, ensure_ascii=False, indent=2)
    print(f"Extraction Successful: {len(activities)} activities.")

except Exception as e:
    print(f"Error: {e}")
