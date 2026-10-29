"""Download public policy documents into rag/corpus (run from backend/: python -m rag.build_corpus).

Every document is fetched from the publisher's own URL and saved with its source and
retrieval date. Needs: curl on PATH and pymupdf (only for PDF sources).
"""
import html
import re
import subprocess
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

CORPUS = Path(__file__).parent / "corpus"
UA = "Mozilla/5.0 (course research project; contact kumari.neh@northeastern.edu)"

AETNA_END = ("CPT Codes / HCPCS Codes / ICD-10 Codes", "\nCPT codes covered", "\nBackground\n")
AETNA = "https://www.aetna.com/cpb/medical/data/"

# (file id, payer, title, url, kind, start marker, end markers): keep text from the start marker
# up to the earliest end marker (drops site chrome, code tables and bibliographies).
SOURCES = [
    ("aetna_cpb_0236_spine_mri", "Aetna", "Aetna CPB 0236 - MRI and CT of the Spine",
     AETNA + "200_299/0236.html", "html", "Scope of Policy", AETNA_END),
    ("aetna_cpb_0171_extremity_mri", "Aetna", "Aetna CPB 0171 - MRI of the Extremities",
     AETNA + "100_199/0171.html", "html", "Scope of Policy", AETNA_END),
    ("aetna_cpb_0093_open_mri", "Aetna", "Aetna CPB 0093 - Open, Low Field Strength and Positional MRI Units",
     AETNA + "1_99/0093.html", "html", "Scope of Policy", AETNA_END),
    ("aetna_cpb_0325_physical_therapy", "Aetna", "Aetna CPB 0325 - Physical Therapy",
     AETNA + "300_399/0325.html", "html", "Scope of Policy", AETNA_END),
    ("aetna_cpb_0157_obesity_surgery", "Aetna", "Aetna CPB 0157 - Obesity Surgery",
     AETNA + "100_199/0157.html", "html", "Scope of Policy", AETNA_END),
    ("cms_ncd_220_2_mri", "Medicare", "CMS NCD 220.2 - Magnetic Resonance Imaging",
     "https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=177", "html", "Benefit Category", ("Revision History",)),
    ("cigna_mm_0550_site_of_care_high_tech_radiology", "Cigna",
     "Cigna Medical Coverage Policy 0550 - Site of Care: High Technology Radiology (MRI, CT)",
     "https://a.static.cigna.com/assets/chcp/pdf/coveragePolicies/medical/mm_0550_coveragepositioncriteria_soc_htr.pdf",
     "pdf", None, ("\nReferences\n",)),
    ("uhc_comm_mp_13_20_mri_ct_site_of_service", "United Healthcare",
     "UnitedHealthcare Commercial MP.13.20 - MRI and CT Scan Site of Service (hospital outpatient vs freestanding)",
     "https://www.uhcprovider.com/content/dam/provider/docs/public/policies/comm-medical-drug/mri-ct-scan-site-of-service.pdf",
     "pdf", "\nCoverage Rationale\n", ("\nReferences\n", "\nApplicable Codes\n")),
    ("uhc_ma_mmp076_radiologic_diagnostic", "United Healthcare",
     "UnitedHealthcare Medicare Advantage MMP076 - Radiologic Diagnostic Procedures",
     "https://www.uhcprovider.com/content/dam/provider/docs/public/policies/medadv-mp/radiologic-diagnostic-procedures.pdf",
     "pdf", "\nCoverage Rationale\n", ("\nReferences\n", "\nApplicable Codes\n")),
    ("bcbssc_cam_709_lumbar_mri", "Blue Cross Blue Shield", "Blue Cross Blue Shield of South Carolina CAM 709 - MRI Lumbar Spine",
     "https://www.southcarolinablues.com/web/public/brands/medicalpolicy/external/external-policies/mri-lumbar-spine",
     "html", "MRI Lumbar Spine - CAM 709", ("\nReferences",)),
    ("bcbsla_mng_018_lumbar_mri_medicare_advantage", "Blue Cross Blue Shield",
     "Blue Cross Blue Shield of Louisiana MNG-018 - MRI Lumbar Spine (Medicare Advantage)",
     "https://providers.bcbsla.com/-/media/Files/Providers/Blue%20Advantage%20Resources/2024-06%20MRI%20Lumbar%20Spine%20MNG-018%20pdf.pdf",
     "pdf", "Coverage Criteria", ("References:", "Policy History")),
    # HealthHelp (WNS) is a radiology benefits manager that writes guidelines for health plans; it is not a payer,
    # so it is indexed under its own name and never answers for a named payer.
    ("healthhelp_mri_lumbar_spine", "HealthHelp",
     "HealthHelp (WNS) MRI Lumbar Spine Guideline MRI-LSpine-HH (radiology benefits manager)",
     "https://www.healthhelp.com/wp-content/uploads/MRI-LSpine-HH_20251107.pdf",
     "pdf", "\nMRI Lumbar Spine Overview\n", ("\nCombination CT and MRI for Metastases Evaluation Guideline\n",)),
]


class _Text(HTMLParser):
    SKIP = ("script", "style", "nav", "header", "footer", "noscript")

    def __init__(self):
        super().__init__()
        self.parts, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        if tag in ("p", "div", "br", "li", "h1", "h2", "h3", "h4", "tr", "table"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self.skip = max(0, self.skip - 1)

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def _clean(text: str) -> str:
    text = re.sub(r"[ \t\xa0]+", " ", html.unescape(text))
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()


def fetch(url: str) -> bytes:
    # curl uses the system certificate store, which Python builds often lack on macOS.
    return subprocess.run(["curl", "-sfL", "-m", "60", "-A", UA, url], check=True, capture_output=True).stdout


def to_text(raw: bytes, kind: str) -> str:
    if kind == "pdf":
        import pymupdf
        return _clean("\n\n".join(p.get_text() for p in pymupdf.open(stream=raw, filetype="pdf")))
    parser = _Text()
    parser.feed(raw.decode("utf-8", errors="ignore"))
    return _clean("".join(parser.parts))


def build():
    CORPUS.mkdir(exist_ok=True)
    for doc_id, payer, title, url, kind, start, ends in SOURCES:
        try:
            text = to_text(fetch(url), kind)
        except Exception as e:
            print(f"SKIP {doc_id}: {e}")
            continue
        if start and start in text:
            text = text[text.index(start):]
        cuts = [text.index(e) for e in ends if e in text]
        if cuts:
            text = text[:min(cuts)].strip()
        if len(text.split()) < 150:  # error page / login wall, not a policy
            print(f"SKIP {doc_id}: only {len(text.split())} words, not a policy document")
            continue
        header = f"---\ntitle: {title}\npayer: {payer}\nsource: {url}\nretrieved: {date.today()}\n---\n"
        (CORPUS / f"{doc_id}.md").write_text(header + text, encoding="utf-8")
        print(f"OK   {doc_id}: {len(text.split())} words")


if __name__ == "__main__":
    build()
