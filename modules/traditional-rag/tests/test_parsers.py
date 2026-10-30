import tempfile
import unittest
import os
from pathlib import Path

from traditional_rag.core.parsers import parse_html_file, parse_json_file
from traditional_rag.core.chunks import parse_supported_document


class ParserTest(unittest.TestCase):
    def test_json_parser_flattens_nested_business_records(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "customer.json"
            path.write_text('{"customer":{"name":"Northwind Labs","risk":"续约风险中等"},"amount":128000}', encoding="utf-8")

            parsed = parse_json_file(path)

        self.assertIn("customer.name: Northwind Labs", parsed.text)
        self.assertIn("customer.risk: 续约风险中等", parsed.text)
        self.assertIn("amount: 128000", parsed.text)
        self.assertEqual(parsed.metadata["parser"], "json")

    def test_html_parser_removes_tags_and_keeps_text(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "policy.html"
            path.write_text("<h1>续约制度</h1><p>客户成功需要提前 30 天确认风险。</p>", encoding="utf-8")

            parsed = parse_html_file(path)

        self.assertIn("续约制度", parsed.text)
        self.assertIn("客户成功需要提前 30 天确认风险", parsed.text)
        self.assertNotIn("<h1>", parsed.text)
        self.assertEqual(parsed.metadata["parser"], "html")

    def test_chunk_parser_accepts_html_and_json_file_types(self):
        with tempfile.TemporaryDirectory() as directory:
            previous_storage = os.environ.get("TRADITIONAL_RAG_STORAGE_DIR")
            os.environ["TRADITIONAL_RAG_STORAGE_DIR"] = directory
            html_path = Path(directory) / "policy.html"
            json_path = Path(directory) / "customer.json"
            html_path.write_text("<p>客户续约需要提前识别风险。</p>", encoding="utf-8")
            json_path.write_text('{"客户":"Northwind Labs","风险":"预算冻结"}', encoding="utf-8")

            try:
                html = parse_supported_document("html", ["policy.html"])
                json_doc = parse_supported_document("json", ["customer.json"])
            finally:
                if previous_storage is None:
                    os.environ.pop("TRADITIONAL_RAG_STORAGE_DIR", None)
                else:
                    os.environ["TRADITIONAL_RAG_STORAGE_DIR"] = previous_storage

        self.assertIn("客户续约需要提前识别风险", html.text)
        self.assertIn("客户: Northwind Labs", json_doc.text)


if __name__ == "__main__":
    unittest.main()
