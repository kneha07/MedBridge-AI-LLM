Public payer / CMS policy documents live here (.md or .txt), one file each, with a header:

---
title: Aetna CPB 0236 - MRI and CT of the Spine
payer: Aetna
source: https://www.aetna.com/cpb/medical/data/200_299/0236.html
retrieved: 2026-10-22
---

python -m rag.build_corpus   downloads the configured sources (needs curl and pymupdf)
python -m rag.store          rebuilds the vector index
