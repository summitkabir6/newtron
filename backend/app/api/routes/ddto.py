@router.get("/ml-metrics")
def get_ml_metrics():
    """Return basic metrics for the RandomForest cognitive model."""
    from app.ddto.ml_model import get_model_metrics
    return get_model_metrics()