import hashlib
import json
from pathlib import Path
import re
import unittest
from run import probes
from evaluate import real_probes

DATA = Path(__file__).resolve().parent.parent / "lab/data"


class BenchmarkTests(unittest.TestCase):
    def test_flattened_values_are_not_a_table(self):
        p = probes("Beam A 125.5 188.25\nBeam B 240.0 360.0", "mixed")
        self.assertTrue(p["values_present"])
        self.assertFalse(p["beam_a_row"])

    def test_decimal_loss_fails(self):
        good = "| Rib Spice (Max) | 34.3 | 48.0 |"
        self.assertTrue(real_probes(good, "if12027")["table11_3_rib_max_34_3_48_0"])
        self.assertFalse(real_probes(good.replace("34.3", "343"), "if12027")["table11_3_rib_max_34_3_48_0"])

    def test_markdown_escaping_does_not_fail_order(self):
        self.assertTrue(probes("ORDER\\_ALPHA ORDER\\_BETA ORDER\\_GAMMA ORDER\\_DELTA", "native")["column_order"])

    def test_corpus_hashes_and_all_results(self):
        corpus = json.loads((DATA / "corpus.json").read_text())
        for item in corpus:
            self.assertEqual(item["sha256"], hashlib.sha256((DATA / (item["id"] + ".pdf")).read_bytes()).hexdigest())
        for engine in ["pdfo", "markitdown", "mdflux", "pymupdf", "docling"]:
            report = json.loads((DATA / (engine + ".json")).read_text())
            self.assertEqual(len(report["runs"]), len(corpus))
            for run, item in zip(report["runs"], corpus):
                with self.subTest(engine=engine, document=item["id"]):
                    self.assertEqual(run["status"], "ok")
                    self.assertEqual(run["input_sha256"], item["sha256"])
                    self.assertEqual(len(run["seconds"]), 3)
                    output = DATA / run["output"]
                    md = output.read_text()
                    self.assertEqual(run["characters"], len(md))
                    for image in re.findall(r"!\[[^\]]*\]\(([^)]+)\)", md):
                        self.assertTrue((output.parent / image).is_file(), image)


if __name__ == "__main__": unittest.main()
