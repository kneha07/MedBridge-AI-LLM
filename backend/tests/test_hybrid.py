"""Keyword ranking and rank fusion (pure Python: no index, no model download)."""
from rag.hybrid import BM25, rrf, tokenize

DOCS = [
    "MRI of the lumbar spine is covered after four weeks of conservative therapy.",
    "Imaging for suspected pseudarthrosis should wait six months after fusion surgery.",
    "Physical therapy is limited to a set number of visits per year.",
]


def test_tokenize_lowercases_and_drops_stopwords():
    assert tokenize("The MRI of the Spine, CPB-0236") == ["mri", "spine", "cpb", "0236"]


def test_rare_exact_term_ranks_its_document_first():
    assert BM25(DOCS).rank("pseudarthrosis imaging wait", 3)[0] == 1


def test_documents_without_any_query_term_are_left_out():
    assert BM25(DOCS).rank("pseudarthrosis", 3) == [1]


def test_unknown_terms_and_empty_corpus_score_nothing():
    assert BM25(DOCS).rank("zzz qqq", 3) == []
    assert BM25([]).rank("mri", 3) == []


def test_rrf_prefers_items_ranked_well_in_both_lists():
    assert rrf([["a", "b", "c"], ["b", "a", "d"]])[:2] == ["a", "b"]
    assert rrf([["b", "a", "c"], ["c", "b", "x"]])[0] == "b"


def test_rrf_keeps_items_found_by_only_one_ranking():
    assert set(rrf([["a"], ["b"]])) == {"a", "b"}
