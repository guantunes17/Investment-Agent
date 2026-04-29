from app.api.deps import async_session
from app.services.portfolio import PortfolioService


async def get_portfolio_summary() -> dict:
    async with async_session() as db:
        service = PortfolioService(db)
        return await service.get_summary()


async def get_allocation_analysis() -> dict:
    summary = await get_portfolio_summary()
    breakdown = summary.get("breakdown", [])
    total = summary.get("total_net_worth", 0)

    recommended = {
        "stocks": {"min": 25, "max": 55, "target": 40},
        "fixed_income": {"min": 45, "max": 75, "target": 60},
    }

    analysis = []
    for item in breakdown:
        asset_class = item["asset_class"]
        current_pct = item["allocation_pct"]
        rec = recommended.get(asset_class, {"min": 0, "max": 100, "target": 33})

        status = "balanced"
        if current_pct < rec["min"]:
            status = "underweight"
        elif current_pct > rec["max"]:
            status = "overweight"

        deviation = current_pct - rec["target"]

        analysis.append({
            "asset_class": asset_class,
            "current_allocation_pct": current_pct,
            "target_allocation_pct": rec["target"],
            "min_pct": rec["min"],
            "max_pct": rec["max"],
            "deviation_pct": round(deviation, 2),
            "status": status,
            "current_value": item["total_value"],
        })

    return {
        "total_net_worth": total,
        "allocation": analysis,
        "recommended_ranges": recommended,
    }


async def suggest_rebalancing() -> dict:
    allocation = await get_allocation_analysis()
    total = allocation["total_net_worth"]
    items = allocation["allocation"]

    suggestions = []
    for item in items:
        if item["status"] == "underweight":
            target_value = total * item["target_allocation_pct"] / 100
            needed = target_value - item["current_value"]
            suggestions.append({
                "action": "increase",
                "asset_class": item["asset_class"],
                "current_pct": item["current_allocation_pct"],
                "target_pct": item["target_allocation_pct"],
                "amount_needed": round(needed, 2),
                "description": f"Consider adding R${needed:,.2f} to {item['asset_class']} to reach target allocation of {item['target_allocation_pct']}%",
            })
        elif item["status"] == "overweight":
            target_value = total * item["target_allocation_pct"] / 100
            excess = item["current_value"] - target_value
            suggestions.append({
                "action": "reduce",
                "asset_class": item["asset_class"],
                "current_pct": item["current_allocation_pct"],
                "target_pct": item["target_allocation_pct"],
                "amount_excess": round(excess, 2),
                "description": f"Consider reducing {item['asset_class']} by R${excess:,.2f} to reach target allocation of {item['target_allocation_pct']}%",
            })

    return {
        "total_net_worth": total,
        "suggestions": suggestions,
        "is_balanced": len(suggestions) == 0,
    }
