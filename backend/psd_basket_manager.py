"""
AirScope - Price Statistics Division (PSD) Basket & Weight Management Engine
Ministry of Statistics and Programme Implementation (MoSPI) CPI Augmentation Architecture.

Enables authorized PSD / administrative route basket ingestion, mathematical weight validation,
basket versioning, and configurable elementary aggregation without source code modifications.
"""

import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

logger = logging.getLogger("airscope.psd_basket")

BASKETS_DIR = Path(__file__).resolve().parent / "config" / "baskets"
BASKETS_DIR.mkdir(parents=True, exist_ok=True)

CONFIG_FILE = BASKETS_DIR / "index_configuration.json"
ACTIVE_VERSION_FILE = BASKETS_DIR / "active_version.json"

DEFAULT_52_INITIAL_BASKET = [
    {"origin": "DEL", "destination": "BOM", "corridor": "DEL-BOM", "weight": 0.080, "base_price": 4600, "cluster": "Metro Trunk"},
    {"origin": "BOM", "destination": "DEL", "corridor": "BOM-DEL", "weight": 0.080, "base_price": 4650, "cluster": "Metro Trunk"},
    {"origin": "DEL", "destination": "BLR", "corridor": "DEL-BLR", "weight": 0.065, "base_price": 5400, "cluster": "Metro Trunk"},
    {"origin": "BLR", "destination": "DEL", "corridor": "BLR-DEL", "weight": 0.065, "base_price": 5450, "cluster": "Metro Trunk"},
    {"origin": "BOM", "destination": "BLR", "corridor": "BOM-BLR", "weight": 0.050, "base_price": 3800, "cluster": "Metro Trunk"},
    {"origin": "BLR", "destination": "BOM", "corridor": "BLR-BOM", "weight": 0.050, "base_price": 3850, "cluster": "Metro Trunk"},
    {"origin": "DEL", "destination": "CCU", "corridor": "DEL-CCU", "weight": 0.045, "base_price": 4500, "cluster": "Metro Trunk"},
    {"origin": "CCU", "destination": "DEL", "corridor": "CCU-DEL", "weight": 0.045, "base_price": 4550, "cluster": "Metro Trunk"},
    {"origin": "BLR", "destination": "HYD", "corridor": "BLR-HYD", "weight": 0.040, "base_price": 2900, "cluster": "Metro Trunk"},
    {"origin": "HYD", "destination": "BLR", "corridor": "HYD-BLR", "weight": 0.040, "base_price": 2950, "cluster": "Metro Trunk"},

    {"origin": "MAA", "destination": "DEL", "corridor": "MAA-DEL", "weight": 0.035, "base_price": 5300, "cluster": "Metro-Tier2 Link"},
    {"origin": "DEL", "destination": "MAA", "corridor": "DEL-MAA", "weight": 0.035, "base_price": 5350, "cluster": "Metro-Tier2 Link"},
    {"origin": "DEL", "destination": "PNQ", "corridor": "DEL-PNQ", "weight": 0.030, "base_price": 4400, "cluster": "Metro-Tier2 Link"},
    {"origin": "PNQ", "destination": "DEL", "corridor": "PNQ-DEL", "weight": 0.030, "base_price": 4450, "cluster": "Metro-Tier2 Link"},
    {"origin": "BOM", "destination": "AMD", "corridor": "BOM-AMD", "weight": 0.025, "base_price": 2800, "cluster": "Metro-Tier2 Link"},
    {"origin": "AMD", "destination": "BOM", "corridor": "AMD-BOM", "weight": 0.025, "base_price": 2850, "cluster": "Metro-Tier2 Link"},
    {"origin": "DEL", "destination": "AMD", "corridor": "DEL-AMD", "weight": 0.025, "base_price": 3600, "cluster": "Metro-Tier2 Link"},
    {"origin": "DEL", "destination": "LKO", "corridor": "DEL-LKO", "weight": 0.020, "base_price": 2700, "cluster": "Metro-Tier2 Link"},
    {"origin": "LKO", "destination": "DEL", "corridor": "LKO-DEL", "weight": 0.020, "base_price": 2750, "cluster": "Metro-Tier2 Link"},
    {"origin": "BOM", "destination": "HYD", "corridor": "BOM-HYD", "weight": 0.020, "base_price": 3200, "cluster": "Metro-Tier2 Link"},
    {"origin": "HYD", "destination": "BOM", "corridor": "HYD-BOM", "weight": 0.020, "base_price": 3250, "cluster": "Metro-Tier2 Link"},
    {"origin": "DEL", "destination": "PAT", "corridor": "DEL-PAT", "weight": 0.020, "base_price": 3900, "cluster": "Metro-Tier2 Link"},
    {"origin": "BOM", "destination": "PAT", "corridor": "BOM-PAT", "weight": 0.015, "base_price": 4900, "cluster": "Metro-Tier2 Link"},
    {"origin": "BLR", "destination": "PNQ", "corridor": "BLR-PNQ", "weight": 0.015, "base_price": 3500, "cluster": "Metro-Tier2 Link"},

    {"origin": "DEL", "destination": "GAU", "corridor": "DEL-GAU", "weight": 0.015, "base_price": 4800, "cluster": "Regional & NE"},
    {"origin": "GAU", "destination": "DEL", "corridor": "GAU-DEL", "weight": 0.015, "base_price": 4850, "cluster": "Regional & NE"},
    {"origin": "CCU", "destination": "GAU", "corridor": "CCU-GAU", "weight": 0.012, "base_price": 3100, "cluster": "Regional & NE"},
    {"origin": "DEL", "destination": "IXB", "corridor": "DEL-IXB", "weight": 0.012, "base_price": 4300, "cluster": "Regional & NE"},
    {"origin": "CCU", "destination": "IXB", "corridor": "CCU-IXB", "weight": 0.010, "base_price": 2800, "cluster": "Regional & NE"},
    {"origin": "DEL", "destination": "IXC", "corridor": "DEL-IXC", "weight": 0.010, "base_price": 2400, "cluster": "Regional & NE"},
    {"origin": "MAA", "destination": "TRZ", "corridor": "MAA-TRZ", "weight": 0.008, "base_price": 2300, "cluster": "Regional & NE"},
    {"origin": "BLR", "destination": "COK", "corridor": "BLR-COK", "weight": 0.012, "base_price": 2500, "cluster": "Regional & NE"},
    {"origin": "COK", "destination": "BLR", "corridor": "COK-BLR", "weight": 0.012, "base_price": 2550, "cluster": "Regional & NE"},
    {"origin": "HYD", "destination": "VGA", "corridor": "HYD-VGA", "weight": 0.008, "base_price": 2200, "cluster": "Regional & NE"},

    {"origin": "DEL", "destination": "GOI", "corridor": "DEL-GOI", "weight": 0.020, "base_price": 5100, "cluster": "Leisure & Tourist"},
    {"origin": "GOI", "destination": "DEL", "corridor": "GOI-DEL", "weight": 0.020, "base_price": 5150, "cluster": "Leisure & Tourist"},
    {"origin": "BOM", "destination": "GOI", "corridor": "BOM-GOI", "weight": 0.018, "base_price": 2900, "cluster": "Leisure & Tourist"},
    {"origin": "GOI", "destination": "BOM", "corridor": "GOI-BOM", "weight": 0.018, "base_price": 2950, "cluster": "Leisure & Tourist"},
    {"origin": "BLR", "destination": "GOI", "corridor": "BLR-GOI", "weight": 0.015, "base_price": 3100, "cluster": "Leisure & Tourist"},
    {"origin": "DEL", "destination": "SXR", "corridor": "DEL-SXR", "weight": 0.015, "base_price": 4200, "cluster": "Leisure & Tourist"},
    {"origin": "SXR", "destination": "DEL", "corridor": "SXR-DEL", "weight": 0.015, "base_price": 4250, "cluster": "Leisure & Tourist"},
    {"origin": "DEL", "destination": "IXL", "corridor": "DEL-IXL", "weight": 0.010, "base_price": 5800, "cluster": "Leisure & Tourist"},
    {"origin": "DEL", "destination": "VNS", "corridor": "DEL-VNS", "weight": 0.012, "base_price": 3400, "cluster": "Leisure & Tourist"},
    {"origin": "BOM", "destination": "VNS", "corridor": "BOM-VNS", "weight": 0.010, "base_price": 4500, "cluster": "Leisure & Tourist"},

    {"origin": "BLR", "destination": "IXE", "corridor": "BLR-IXE", "weight": 0.008, "base_price": 2400, "cluster": "Emerging Hubs"},
    {"origin": "HYD", "destination": "RPR", "corridor": "HYD-RPR", "weight": 0.008, "base_price": 3100, "cluster": "Emerging Hubs"},
    {"origin": "DEL", "destination": "JAI", "corridor": "DEL-JAI", "weight": 0.010, "base_price": 2300, "cluster": "Emerging Hubs"},
    {"origin": "BOM", "destination": "NAG", "corridor": "BOM-NAG", "weight": 0.009, "base_price": 3300, "cluster": "Emerging Hubs"},
    {"origin": "BLR", "destination": "VTZ", "corridor": "BLR-VTZ", "weight": 0.009, "base_price": 3600, "cluster": "Emerging Hubs"},
    {"origin": "HYD", "destination": "VTZ", "corridor": "HYD-VTZ", "weight": 0.009, "base_price": 3000, "cluster": "Emerging Hubs"},
    {"origin": "BOM", "destination": "IDR", "corridor": "BOM-IDR", "weight": 0.009, "base_price": 3100, "cluster": "Emerging Hubs"},
    {"origin": "DEL", "destination": "UDR", "corridor": "DEL-UDR", "weight": 0.008, "base_price": 3500, "cluster": "Emerging Hubs"},
]

DEFAULT_CONFIG = {
    "index_name": "Airfare Price Index (APIx)",
    "base_period": "2026-01",
    "base_value": 100.0,
    "elementary_method": "JEVONS",  # 'JEVONS', 'ARITHMETIC_MEAN', 'MEDIAN'
    "aggregation_method": "WEIGHTED_ROUTE_AGGREGATION",
    "missing_route_policy": "EXCLUDE_RENORMALIZE",  # 'EXCLUDE_RENORMALIZE', 'CARRY_FORWARD', 'MARK_UNAVAILABLE'
    "min_coverage_threshold_pct": 75.0,
    "target_cabin": "ECONOMY",
    "target_window": "ALL",
    "last_updated": datetime.utcnow().isoformat() + "Z"
}


class WeightValidator:
    """
    Mathematical and schema validation engine for PSD route baskets.
    Enforces that weights sum to exactly 1.0 (with floating-point tolerance).
    """

    @staticmethod
    def validate_routes_and_weights(routes: List[Dict[str, Any]], tolerance: float = 0.002) -> Tuple[bool, List[str], Dict[str, Any]]:
        errors = []
        warnings = []
        if not routes or not isinstance(routes, list):
            return False, ["Route basket is empty or invalid format."], {}

        seen_corridors = set()
        total_weight = 0.0

        for idx, r in enumerate(routes):
            corridor = (r.get("corridor") or r.get("route") or r.get("route_code") or "").strip().upper()
            orig = (r.get("origin") or "").strip().upper()
            dest = (r.get("destination") or "").strip().upper()

            if not corridor and orig and dest:
                corridor = f"{orig}-{dest}"

            if not corridor:
                errors.append(f"Row {idx + 1}: Missing corridor identifier.")
                continue

            parts = corridor.split("-")
            if len(parts) == 2:
                if not orig: orig = parts[0]
                if not dest: dest = parts[1]

            if orig and dest and orig == dest:
                errors.append(f"Corridor {corridor}: Origin and Destination cannot be identical.")

            if corridor in seen_corridors:
                errors.append(f"Corridor {corridor}: Duplicate corridor found in basket.")
            seen_corridors.add(corridor)

            weight_val = r.get("weight")
            try:
                w = float(weight_val)
            except (ValueError, TypeError):
                errors.append(f"Corridor {corridor}: Weight must be numeric (found: {weight_val}).")
                continue

            if w <= 0.0 or w > 1.0:
                errors.append(f"Corridor {corridor}: Weight must be strictly > 0 and <= 1.0 (found: {w}).")

            total_weight += w

        total_weight_rounded = round(total_weight, 4)
        pct = round(total_weight * 100.0, 2)

        if abs(total_weight - 1.0) > tolerance:
            errors.append(
                f"Weight validation failed: Route weights sum to {pct}% ({total_weight_rounded}), expected 100%."
            )

        summary = {
            "total_routes": len(seen_corridors),
            "total_weight": total_weight_rounded,
            "total_weight_pct": pct,
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }

        return len(errors) == 0, errors, summary

    @staticmethod
    def parse_csv_text(csv_text: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Parses CSV text into normalized route dictionaries."""
        import csv
        import io
        routes = []
        errors = []
        if not csv_text or not csv_text.strip():
            return routes, ["CSV content is empty."]

        try:
            reader = csv.DictReader(io.StringIO(csv_text.strip()))
            for idx, row in enumerate(reader):
                # Clean keys (strip whitespace)
                cleaned_row = {k.strip(): v.strip() for k, v in row.items() if k is not None and v is not None}
                
                # Check for comment rows
                first_val = next(iter(cleaned_row.values()), "")
                if first_val and str(first_val).startswith("#"):
                    continue

                corridor = (cleaned_row.get("route_code") or cleaned_row.get("corridor") or cleaned_row.get("route") or "").strip().upper()
                orig = (cleaned_row.get("origin") or "").strip().upper()
                dest = (cleaned_row.get("destination") or "").strip().upper()

                if not corridor and orig and dest:
                    corridor = f"{orig}-{dest}"

                weight_str = cleaned_row.get("weight") or cleaned_row.get("Weight") or "0"
                try:
                    w = float(weight_str)
                except (ValueError, TypeError):
                    errors.append(f"Row {idx + 1}: Invalid weight '{weight_str}'")
                    continue

                cluster = cleaned_row.get("cluster") or "Metro Trunk"
                base_price_val = cleaned_row.get("base_price")
                try:
                    base_p = float(base_price_val) if base_price_val else 4500.0
                except (ValueError, TypeError):
                    base_p = 4500.0

                routes.append({
                    "corridor": corridor,
                    "origin": orig or (corridor.split("-")[0] if "-" in corridor else ""),
                    "destination": dest or (corridor.split("-")[1] if "-" in corridor else ""),
                    "weight": w,
                    "cluster": cluster,
                    "base_price": base_p
                })
        except Exception as e:
            errors.append(f"CSV Parsing Error: {str(e)}")

        return routes, errors


class PSDBasketManager:
    """
    Manages versioned route baskets, persistence, active selection, and configuration.
    """

    def __init__(self):
        self._ensure_initial_basket()

    def _ensure_initial_basket(self):
        """Initializes DEMO_V1 illustrative prototype basket if absent."""
        demo_file = BASKETS_DIR / "basket_DEMO_V1.json"
        if not demo_file.exists():
            # Validate weights of default basket to ensure initial integrity
            val_ok, errs, summary = WeightValidator.validate_routes_and_weights(DEFAULT_52_INITIAL_BASKET)
            demo_basket = {
                "basket_version": "DEMO_V1",
                "basket_name": "Illustrative 52-Corridor Prototype Basket",
                "source": "ILLUSTRATIVE_PROTOTYPE",
                "source_description": "Prototype weights — illustrative only; replace with PSD-supplied weights for official compilation.",
                "effective_from": "2026-01-01",
                "effective_to": None,
                "status": "ACTIVE",
                "created_at": datetime.utcnow().isoformat() + "Z",
                "total_routes": len(DEFAULT_52_INITIAL_BASKET),
                "total_weight": summary.get("total_weight", 1.0),
                "routes": DEFAULT_52_INITIAL_BASKET
            }
            with open(demo_file, "w", encoding="utf-8") as f:
                json.dump(demo_basket, f, indent=2)

        if not ACTIVE_VERSION_FILE.exists():
            with open(ACTIVE_VERSION_FILE, "w", encoding="utf-8") as f:
                json.dump({"active_version": "DEMO_V1"}, f, indent=2)

        if not CONFIG_FILE.exists():
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_CONFIG, f, indent=2)

    def get_active_version_id(self) -> str:
        if ACTIVE_VERSION_FILE.exists():
            try:
                with open(ACTIVE_VERSION_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data.get("active_version", "DEMO_V1")
            except Exception:
                pass
        return "DEMO_V1"

    def get_active_basket(self) -> Dict[str, Any]:
        active_ver = self.get_active_version_id()
        file_path = BASKETS_DIR / f"basket_{active_ver}.json"
        if file_path.exists():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed loading active basket {file_path}: {e}")
        
        # Fallback to DEMO_V1
        demo_file = BASKETS_DIR / "basket_DEMO_V1.json"
        if demo_file.exists():
            with open(demo_file, "r", encoding="utf-8") as f:
                return json.load(f)

        return {
            "basket_version": "DEMO_V1",
            "source": "ILLUSTRATIVE_PROTOTYPE",
            "routes": DEFAULT_52_INITIAL_BASKET
        }

    def list_basket_versions(self) -> List[Dict[str, Any]]:
        versions = []
        active_id = self.get_active_version_id()
        for f in BASKETS_DIR.glob("basket_*.json"):
            try:
                with open(f, "r", encoding="utf-8") as fp:
                    data = json.load(fp)
                    versions.append({
                        "basket_version": data.get("basket_version"),
                        "basket_name": data.get("basket_name"),
                        "source": data.get("source"),
                        "source_description": data.get("source_description"),
                        "effective_from": data.get("effective_from"),
                        "effective_to": data.get("effective_to"),
                        "status": "ACTIVE" if data.get("basket_version") == active_id else "SUPERSEDED",
                        "is_active": data.get("basket_version") == active_id,
                        "total_routes": data.get("total_routes") or len(data.get("routes", [])),
                        "total_weight": data.get("total_weight", 1.0),
                        "created_at": data.get("created_at")
                    })
            except Exception as e:
                logger.warning(f"Error reading basket file {f}: {e}")

        # Sort with active on top, then by created_at desc
        versions.sort(key=lambda x: (not x["is_active"], x.get("created_at", "")), reverse=True)
        return versions

    def save_new_basket(
        self,
        basket_version: str,
        basket_name: str,
        routes: List[Dict[str, Any]],
        source: str = "AUTHORIZED_PSD",
        effective_from: Optional[str] = None,
        activate_now: bool = False
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """Validates and saves a new versioned route basket."""
        version_cleaned = basket_version.strip().upper().replace(" ", "_")
        if not version_cleaned:
            return False, "Basket version identifier cannot be empty.", {}

        is_valid, errors, summary = WeightValidator.validate_routes_and_weights(routes)
        if not is_valid:
            return False, "Weight validation failed: " + "; ".join(errors), summary

        # Format routes uniformly
        formatted_routes = []
        for r in routes:
            corr = (r.get("corridor") or r.get("route") or r.get("route_code") or "").strip().upper()
            orig = (r.get("origin") or corr.split("-")[0] if "-" in corr else "").strip().upper()
            dest = (r.get("destination") or corr.split("-")[1] if "-" in corr else "").strip().upper()
            w = float(r.get("weight", 0.0))
            bp = float(r.get("base_price", r.get("base_fare", 4500)))
            cluster = r.get("cluster", "Metro Trunk")

            formatted_routes.append({
                "origin": orig,
                "destination": dest,
                "corridor": corr,
                "weight": round(w, 4),
                "base_price": round(bp, 2),
                "cluster": cluster
            })

        basket_record = {
            "basket_version": version_cleaned,
            "basket_name": basket_name or f"Basket {version_cleaned}",
            "source": source,
            "source_description": (
                "Official Price Statistics Division (PSD) prescribed basket"
                if source == "AUTHORIZED_PSD"
                else "Illustrative prototype basket for demonstration purposes."
            ),
            "effective_from": effective_from or datetime.utcnow().strftime("%Y-%m-%d"),
            "effective_to": None,
            "status": "ACTIVE" if activate_now else "INACTIVE",
            "created_at": datetime.utcnow().isoformat() + "Z",
            "total_routes": len(formatted_routes),
            "total_weight": summary["total_weight"],
            "routes": formatted_routes
        }

        dest_file = BASKETS_DIR / f"basket_{version_cleaned}.json"
        with open(dest_file, "w", encoding="utf-8") as f:
            json.dump(basket_record, f, indent=2)

        if activate_now:
            self.activate_basket(version_cleaned)

        return True, f"Basket {version_cleaned} saved successfully with {len(formatted_routes)} corridors.", basket_record

    def activate_basket(self, version_id: str) -> Tuple[bool, str]:
        version_cleaned = version_id.strip().upper().replace(" ", "_")
        target_file = BASKETS_DIR / f"basket_{version_cleaned}.json"
        if not target_file.exists():
            return False, f"Basket version '{version_cleaned}' does not exist."

        # Mark previous active basket effective_to
        prev_active_id = self.get_active_version_id()
        if prev_active_id != version_cleaned:
            prev_file = BASKETS_DIR / f"basket_{prev_active_id}.json"
            if prev_file.exists():
                try:
                    with open(prev_file, "r", encoding="utf-8") as pf:
                        p_data = json.load(pf)
                    p_data["effective_to"] = datetime.utcnow().strftime("%Y-%m-%d")
                    p_data["status"] = "SUPERSEDED"
                    with open(prev_file, "w", encoding="utf-8") as pf:
                        json.dump(p_data, pf, indent=2)
                except Exception as e:
                    logger.warning(f"Could not update previous basket {prev_active_id}: {e}")

        # Update target basket status
        try:
            with open(target_file, "r", encoding="utf-8") as tf:
                t_data = json.load(tf)
            t_data["status"] = "ACTIVE"
            t_data["effective_to"] = None
            with open(target_file, "w", encoding="utf-8") as tf:
                json.dump(t_data, tf, indent=2)
        except Exception as e:
            logger.error(f"Failed updating target basket {version_cleaned}: {e}")

        # Update active pointer
        with open(ACTIVE_VERSION_FILE, "w", encoding="utf-8") as f:
            json.dump({"active_version": version_cleaned, "activated_at": datetime.utcnow().isoformat() + "Z"}, f, indent=2)

        return True, f"Basket {version_cleaned} is now the active statistical basket."

    def get_index_configuration(self) -> Dict[str, Any]:
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return DEFAULT_CONFIG

    def update_index_configuration(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        cfg = self.get_index_configuration()
        allowed_fields = [
            "index_name", "base_period", "base_value",
            "elementary_method", "aggregation_method",
            "missing_route_policy", "min_coverage_threshold_pct",
            "target_cabin", "target_window"
        ]
        for k in allowed_fields:
            if k in updates and updates[k] is not None:
                cfg[k] = updates[k]

        cfg["last_updated"] = datetime.utcnow().isoformat() + "Z"
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)

        return cfg


# Singleton instance
basket_manager = PSDBasketManager()
