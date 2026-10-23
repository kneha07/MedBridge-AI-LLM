from verticals import healthcare

VERTICALS = {
    "healthcare": healthcare,
}

def get_vertical(vertical_id: str):
    return VERTICALS.get(vertical_id)

def list_verticals():
    return [
        {
            "id": v.VERTICAL_ID,
            "name": v.VERTICAL_NAME,
            "description": v.VERTICAL_DESCRIPTION,
            "icon": v.VERTICAL_ICON,
            "color": v.VERTICAL_COLOR,
            "form_fields": v.FORM_FIELDS,
            "demo_data": v.DEMO_DATA,
        }
        for v in VERTICALS.values()
    ]
