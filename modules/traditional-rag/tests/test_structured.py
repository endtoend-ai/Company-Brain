import unittest

from traditional_rag.core.structured import (
    classify_table_fields,
    apply_structured_filter_plan,
    make_structured_row_payloads,
    plan_structured_filters,
    row_to_semantic_text,
)


class StructuredRetrievalTest(unittest.TestCase):
    def test_classifies_table_fields_for_structured_retrieval(self):
        columns = [
            {"name": "客户名称", "type": "string"},
            {"name": "合同金额", "type": "number"},
            {"name": "区域", "type": "string"},
            {"name": "续约风险", "type": "string"},
        ]

        result = classify_table_fields(columns)

        self.assertEqual(result["text_fields"], ["客户名称", "续约风险"])
        self.assertIn("合同金额", result["numeric_fields"])
        self.assertIn("区域", result["categorical_fields"])

    def test_row_to_semantic_text_keeps_business_meaning_and_metadata(self):
        row = {"客户名称": "Northwind Labs", "合同金额": 128000, "区域": "华东", "续约风险": "预算冻结"}

        text = row_to_semantic_text(
            row,
            text_fields=["客户名称", "续约风险"],
            metadata_fields=["合同金额", "区域"],
        )

        self.assertIn("客户名称: Northwind Labs", text)
        self.assertIn("续约风险: 预算冻结", text)
        self.assertIn("合同金额: 128000", text)
        self.assertIn("区域: 华东", text)

    def test_structured_query_extracts_simple_numeric_and_category_filters(self):
        plan = plan_structured_filters("华东区域合同金额大于100000的续约风险客户")

        self.assertIn({"column_hint": "区域", "op": "contains", "value": "华东"}, plan["filters"])
        self.assertIn({"column_hint": "合同金额", "op": "gt", "value": 100000}, plan["filters"])

    def test_make_structured_row_payloads_preserves_row_references(self):
        table = {
            "id": "table-1",
            "document_id": "doc-1",
            "source_id": "source-1",
            "columns": [
                {"name": "客户名称", "type": "string"},
                {"name": "合同金额", "type": "number"},
                {"name": "区域", "type": "string"},
                {"name": "续约风险", "type": "string"},
            ],
        }
        rows = [
            {"row_index": 0, "values": {"客户名称": "Northwind Labs", "合同金额": 128000, "区域": "华东", "续约风险": "预算冻结"}},
        ]

        payloads = make_structured_row_payloads(table, rows)

        self.assertEqual(len(payloads), 1)
        self.assertEqual(payloads[0]["table_id"], "table-1")
        self.assertEqual(payloads[0]["row_index"], 0)
        self.assertIn("客户名称: Northwind Labs", payloads[0]["semantic_text"])
        self.assertEqual(payloads[0]["metadata"]["field_plan"]["numeric_fields"], ["合同金额"])

    def test_apply_structured_filter_plan_resolves_column_hints(self):
        values = {"客户名称": "Northwind Labs", "合同金额": 128000, "区域": "华东", "续约风险": "预算冻结"}
        plan = {
            "filters": [
                {"column_hint": "区域", "op": "contains", "value": "华东"},
                {"column_hint": "合同金额", "op": "gt", "value": 100000},
            ]
        }

        self.assertTrue(apply_structured_filter_plan(values, plan))
        self.assertFalse(apply_structured_filter_plan({**values, "区域": "华南"}, plan))


if __name__ == "__main__":
    unittest.main()
