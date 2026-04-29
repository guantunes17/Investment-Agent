from datetime import date

import httpx

BASE_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados"

SERIES_CODES = {
    "CDI": 12,
    "SELIC": 432,
    "IPCA": 433,
}


class BCBProvider:
    async def get_latest_rate(self, rate_type: str) -> dict:
        code = SERIES_CODES.get(rate_type.upper())
        if not code:
            raise ValueError(f"Unknown rate type: {rate_type}")
        params = {"formato": "json", "dataInicial": "", "dataFinal": ""}
        url = BASE_URL.format(code=code)
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{url}/ultimos/1", params={"formato": "json"})
            resp.raise_for_status()
            data = resp.json()
            if data:
                item = data[-1]
                return {
                    "rate_type": rate_type.upper(),
                    "date": item["data"],
                    "value": float(item["valor"]),
                }
            return {"rate_type": rate_type.upper(), "date": None, "value": 0.0}

    async def get_rate_history(
        self, rate_type: str, start_date: date, end_date: date
    ) -> list[dict]:
        code = SERIES_CODES.get(rate_type.upper())
        if not code:
            raise ValueError(f"Unknown rate type: {rate_type}")
        url = BASE_URL.format(code=code)
        params = {
            "formato": "json",
            "dataInicial": start_date.strftime("%d/%m/%Y"),
            "dataFinal": end_date.strftime("%d/%m/%Y"),
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            records = []
            for item in data:
                records.append({
                    "date": item["data"],
                    "value": float(item["valor"]),
                })
            return records
