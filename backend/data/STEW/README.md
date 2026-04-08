# STEW Dataset — Real EEG Data

## What this is

The STEW (Simultaneous Task EEG Workload) dataset contains real EEG recordings
from 48 human subjects performing cognitive workload tasks. It is used by the
NewTron DDTO to ground the prediction model in actual human neuroscience data.

**Citation:**
Lim, W. L., Sourina, O., & Wang, L. P. (2018). STEW: Simultaneous task EEG
workload data set. IEEE Transactions on Neural Systems and Rehabilitation
Engineering, 26(11), 2106–2114. DOI: 10.1109/TNSRE.2018.2872810

---

## Download Instructions

1. Go to: https://figshare.com/articles/dataset/STEW_Dataset_Raw_EEG_Data/6198183

2. Click **Download** (the dataset is free and open access — no login required)

3. Extract the zip file

4. Place the CSV files directly into THIS folder:
   ```
   backend/data/STEW/
     sub01_lo.csv
     sub01_hi.csv
     sub02_lo.csv
     sub02_hi.csv
     ... (48 subjects × 2 conditions = 96 files)
   ```

5. Restart the backend — it will automatically detect the files, process them,
   and build a features cache (takes ~2 minutes first time, instant after that)

6. The DDTO Dashboard will update the data source badge from
   "Synthetic Signals" → "Real EEG Data"

---

## What happens automatically

When the backend starts and finds CSV files here:
- Raw EEG is read at 128 Hz across 14 channels (Emotiv EPOC format)
- Sliding 2-second windows with 50% overlap are processed
- Theta, alpha, beta band powers are computed via FFT
- Features are cached to `backend/data/stew_features_cache.json`
- Subsequent restarts load from cache (instant)

---

## If you don't have time to download

The system works perfectly without this data. Synthetic signals are used
as fallback and are grounded in the same published EEG ranges from the
literature cited in the NewTron research paper.

The `_data_source` field in every DDTO tick payload reports which is active.
