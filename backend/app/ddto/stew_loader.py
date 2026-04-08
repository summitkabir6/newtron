"""
STEW Dataset Loader.

STEW (Simultaneous Task EEG Workload) — Lim et al., 2018
Published in IEEE Transactions on Neural Systems and Rehabilitation Engineering.
DOI: 10.1109/TNSRE.2018.2872810

Download the dataset from:
  https://figshare.com/articles/dataset/STEW_Dataset_Raw_EEG_Data/6198183

After downloading, extract the zip and place the folder at:
  backend/data/STEW/

Expected structure after extraction:
  backend/data/STEW/
    README.txt
    sub01_lo.csv   ← subject 01, low workload EEG recording
    sub01_hi.csv   ← subject 01, high workload EEG recording
    sub02_lo.csv
    sub02_hi.csv
    ... (48 subjects total)

Each CSV contains raw EEG samples at 128 Hz across 14 channels
(AF3, F7, F3, FC5, T7, P7, O1, O2, P8, T8, FC6, F4, F8, AF4)
from the Emotiv EPOC headset.

This loader:
1. Reads the raw EEG CSVs
2. Computes frequency band powers (theta, alpha, beta) via FFT on sliding windows
3. Derives the same signal features the DDTO signal simulator produces
4. Caches processed features to avoid re-computing on every startup
5. Returns samples in the exact same dict format as signals.py

The system works WITHOUT this dataset — synthetic data is used as fallback.
"""

import os
import json
import math
import random
from typing import List, Dict, Optional, Tuple
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────
# Resolve relative to this file so it works from any working directory
_HERE = Path(__file__).parent
STEW_DIR = _HERE.parent.parent.parent / "data" / "STEW"
CACHE_FILE = _HERE.parent.parent.parent / "data" / "stew_features_cache.json"

# ── STEW constants ─────────────────────────────────────────────────────────
SAMPLE_RATE = 128          # Hz
WINDOW_SEC = 2             # seconds per analysis window
WINDOW_SAMPLES = SAMPLE_RATE * WINDOW_SEC  # 256 samples
STEP_SAMPLES = SAMPLE_RATE // 2            # 0.5s step (50% overlap)

# Channels in STEW CSV (14 total from Emotiv EPOC)
CHANNEL_NAMES = ["AF3","F7","F3","FC5","T7","P7","O1","O2","P8","T8","FC6","F4","F8","AF4"]

# Frontal channels most relevant for workload (matches CognShield electrode placement)
FRONTAL_CHANNELS = ["AF3", "AF4", "F3", "F4", "F7", "F8"]
FRONTAL_INDICES = [CHANNEL_NAMES.index(c) for c in FRONTAL_CHANNELS if c in CHANNEL_NAMES]

# Frequency bands (Hz)
THETA_BAND = (4, 8)
ALPHA_BAND = (8, 13)
BETA_BAND  = (13, 30)


def _bandpower(signal: List[float], fs: int, band: Tuple[float, float]) -> float:
    """
    Compute band power using FFT.
    Returns normalised power in the specified frequency band.
    """
    n = len(signal)
    if n == 0:
        return 0.0

    # Apply Hanning window to reduce spectral leakage
    windowed = [signal[i] * (0.5 - 0.5 * math.cos(2 * math.pi * i / (n - 1))) for i in range(n)]

    # FFT — compute magnitude spectrum
    # Simple DFT for the bands we need (faster than full FFT for small bands)
    freqs_of_interest = range(int(band[0] * n / fs), int(band[1] * n / fs) + 1)
    power = 0.0
    for k in freqs_of_interest:
        if k >= n:
            break
        re = sum(windowed[i] * math.cos(2 * math.pi * k * i / n) for i in range(n))
        im = sum(windowed[i] * math.sin(2 * math.pi * k * i / n) for i in range(n))
        power += (re * re + im * im) / (n * n)

    return power


def _normalize_band_powers(theta: float, alpha: float, beta: float) -> Tuple[float, float, float]:
    """Normalize band powers to 0-1 range using relative power."""
    total = theta + alpha + beta
    if total == 0:
        return 0.33, 0.33, 0.33
    return theta / total, alpha / total, beta / total


def _process_window(samples: List[List[float]]) -> Optional[Dict]:
    """
    Process one EEG window (shape: [WINDOW_SAMPLES, n_channels]).
    Returns a feature dict matching the DDTO signal format.
    """
    if len(samples) < WINDOW_SAMPLES:
        return None

    # Average across frontal channels for band power computation
    frontal_signal = []
    for sample in samples:
        if len(sample) > max(FRONTAL_INDICES):
            avg = sum(sample[i] for i in FRONTAL_INDICES) / len(FRONTAL_INDICES)
            frontal_signal.append(avg)

    if len(frontal_signal) < WINDOW_SAMPLES:
        return None

    # Compute band powers
    theta_raw = _bandpower(frontal_signal, SAMPLE_RATE, THETA_BAND)
    alpha_raw = _bandpower(frontal_signal, SAMPLE_RATE, ALPHA_BAND)
    beta_raw  = _bandpower(frontal_signal, SAMPLE_RATE, BETA_BAND)

    theta, alpha, beta = _normalize_band_powers(theta_raw, alpha_raw, beta_raw)

    # Derived indices
    theta_alpha_ratio  = theta / max(alpha, 0.001)
    beta_alpha_ratio   = beta  / max(alpha, 0.001)
    engagement_index   = beta  / max(theta + alpha, 0.001)

    return {
        "theta": round(theta, 4),
        "alpha": round(alpha, 4),
        "beta":  round(beta,  4),
        "theta_alpha_ratio":  round(theta_alpha_ratio,  4),
        "beta_alpha_ratio":   round(beta_alpha_ratio,   4),
        "engagement_index":   round(engagement_index,   4),
    }


def _load_csv(filepath: Path) -> List[List[float]]:
    """Load a STEW CSV file. Returns list of samples, each sample is a list of channel values."""
    samples = []
    try:
        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or line.startswith('AF3'):
                    continue  # Skip header/comments
                try:
                    values = [float(v) for v in line.split(',')]
                    if len(values) >= len(CHANNEL_NAMES):
                        samples.append(values[:len(CHANNEL_NAMES)])
                except ValueError:
                    continue
    except Exception as e:
        print(f"[STEW] Failed to load {filepath}: {e}")
    return samples


def _extract_features_from_file(filepath: Path, workload_label: str) -> List[Dict]:
    """
    Extract windowed EEG features from one STEW recording file.
    Returns list of feature dicts with workload label attached.
    """
    print(f"[STEW] Processing {filepath.name}...")
    raw = _load_csv(filepath)
    if not raw:
        return []

    features = []
    i = 0
    while i + WINDOW_SAMPLES <= len(raw):
        window = raw[i:i + WINDOW_SAMPLES]
        feat = _process_window(window)
        if feat:
            feat["workload_label"] = workload_label  # "low" or "high"
            feat["source"] = "stew_real"
            features.append(feat)
        i += STEP_SAMPLES

    return features


def build_cache() -> Dict:
    """
    Process all STEW files and build the features cache.
    Called once when STEW data is first detected.
    """
    print("[STEW] Building features cache from raw EEG files...")
    cache = {"low": [], "high": [], "subject_count": 0}

    if not STEW_DIR.exists():
        print(f"[STEW] Data directory not found: {STEW_DIR}")
        return cache

    files_found = 0
    for subject_num in range(1, 49):  # STEW has 48 subjects
        for label, suffix in [("low", "lo"), ("high", "hi")]:
            # Try both naming conventions seen in STEW releases
            for pattern in [f"sub{subject_num:02d}_{suffix}.csv", f"Subject{subject_num:02d}_{suffix}.csv"]:
                filepath = STEW_DIR / pattern
                if filepath.exists():
                    features = _extract_features_from_file(filepath, label)
                    cache[label].extend(features)
                    files_found += 1
                    break

    if files_found > 0:
        cache["subject_count"] = files_found // 2
        print(f"[STEW] Cache built: {len(cache['low'])} low-load + {len(cache['high'])} high-load windows from {cache['subject_count']} subjects")

        # Save cache
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(CACHE_FILE, 'w') as f:
            json.dump(cache, f)
        print(f"[STEW] Cache saved to {CACHE_FILE}")
    else:
        print(f"[STEW] No STEW files found in {STEW_DIR}")

    return cache


def load_cache() -> Optional[Dict]:
    """Load pre-built features cache if it exists."""
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, 'r') as f:
                cache = json.load(f)
            print(f"[STEW] Loaded cache: {len(cache.get('low', []))} low + {len(cache.get('high', []))} high windows")
            return cache
        except Exception as e:
            print(f"[STEW] Cache load failed: {e}")
    return None


def is_available() -> bool:
    """Check if STEW data or cache is available."""
    return CACHE_FILE.exists() or STEW_DIR.exists()


class STEWLoader:
    """
    Provides random samples from the STEW dataset.
    Initialises lazily — only processes files when first accessed.
    """

    def __init__(self):
        self._cache: Optional[Dict] = None
        self._initialised = False

    def _ensure_loaded(self):
        if self._initialised:
            return
        self._initialised = True

        # Try cache first (fast)
        self._cache = load_cache()

        # If no cache but raw files exist, build cache
        if not self._cache and STEW_DIR.exists():
            self._cache = build_cache()

        if self._cache and (self._cache.get("low") or self._cache.get("high")):
            total = len(self._cache.get("low", [])) + len(self._cache.get("high", []))
            print(f"[STEW] Ready — {total} real EEG windows available")
        else:
            print("[STEW] No data available — using synthetic signals")
            self._cache = None

    def get_sample(self, workload_level: str = "low") -> Optional[Dict]:
        """
        Get a random EEG feature sample for the given workload level.
        workload_level: 'low' | 'high'
        Returns None if STEW data is not available.
        """
        self._ensure_loaded()
        if not self._cache:
            return None

        pool = self._cache.get(workload_level, [])
        if not pool:
            return None

        return random.choice(pool)

    def get_sample_for_load_score(self, load_score: float) -> Optional[Dict]:
        """
        Get a STEW sample appropriate for the given cognitive load score (0-1).
        Maps load score to low/high workload condition.
        """
        level = "high" if load_score > 0.4 else "low"
        return self.get_sample(level)

    @property
    def available(self) -> bool:
        self._ensure_loaded()
        return self._cache is not None and (
            bool(self._cache.get("low")) or bool(self._cache.get("high"))
        )

    @property
    def stats(self) -> Dict:
        self._ensure_loaded()
        if not self._cache:
            return {"available": False, "source": "synthetic"}
        return {
            "available": True,
            "source": "stew_real",
            "low_windows": len(self._cache.get("low", [])),
            "high_windows": len(self._cache.get("high", [])),
            "subject_count": self._cache.get("subject_count", 0),
            "dataset": "STEW (Lim et al. 2018, IEEE TNSRE)",
        }


# Singleton
stew_loader = STEWLoader()
