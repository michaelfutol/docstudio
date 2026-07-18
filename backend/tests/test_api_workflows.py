import io
import os
import sys
import tempfile
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]


class ApiWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_cwd = Path.cwd()
        cls.workspace = tempfile.TemporaryDirectory()
        os.chdir(cls.workspace.name)
        os.environ["DATABASE_URL"] = f"sqlite:///{cls.workspace.name}/test.db"
        os.environ.pop("GEMINI_API_KEY", None)
        os.environ.pop("OPENROUTER_API_KEY", None)
        sys.path.insert(0, str(BACKEND_DIR))

        from fastapi.testclient import TestClient
        from main import app

        cls.client_context = TestClient(app)
        cls.client = cls.client_context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_context.__exit__(None, None, None)
        os.chdir(cls.original_cwd)
        cls.workspace.cleanup()

    @staticmethod
    def make_text_pdf(text: str) -> bytes:
        import fitz

        document = fitz.open()
        page = document.new_page()
        page.insert_text((72, 72), text)
        content = document.tobytes()
        document.close()
        return content

    @staticmethod
    def make_png() -> bytes:
        from PIL import Image

        image = Image.new("RGB", (500, 300), "white")
        output = io.BytesIO()
        image.save(output, format="PNG")
        return output.getvalue()

    def assert_status(self, method: str, path: str, expected: int, **kwargs):
        response = self.client.request(method, path, **kwargs)
        self.assertEqual(response.status_code, expected, response.text)
        return response

    def test_complete_document_workflow(self):
        import fitz

        pdf_bytes = self.make_text_pdf("Original permit document text")

        project = self.assert_status(
            "POST",
            "/api/v1/projects/",
            200,
            json={"name": "Permit Docs", "industry": "Engineering"},
        ).json()
        self.assertEqual(
            self.assert_status("GET", "/api/v1/projects", 200).json()[0]["industry"],
            "Engineering",
        )
        updated_project = self.assert_status(
            "PUT",
            f"/api/v1/projects/{project['id']}",
            200,
            json={"description": "Verified workflow"},
        ).json()
        self.assertEqual(updated_project["description"], "Verified workflow")
        self.assert_status("POST", "/api/v1/projects/", 422, json={"name": "   "})

        self.assert_status(
            "POST",
            "/api/v1/documents/?project_id=9999",
            404,
            files={"file": ("missing-project.pdf", pdf_bytes, "application/pdf")},
        )
        self.assert_status(
            "POST",
            f"/api/v1/documents/?project_id={project['id']}",
            415,
            files={"file": ("unsafe.exe", b"bad", "application/octet-stream")},
        )
        self.assert_status(
            "POST",
            f"/api/v1/documents/?project_id={project['id']}",
            400,
            files={"file": ("empty.pdf", b"", "application/pdf")},
        )

        document_id = self.assert_status(
            "POST",
            f"/api/v1/documents/?project_id={project['id']}",
            200,
            files={"file": ("permit.pdf", pdf_bytes, "application/pdf")},
        ).json()["document_id"]
        document = self.assert_status("GET", f"/api/v1/documents/{document_id}", 200).json()
        self.assertEqual(document["status"], "processed")
        self.assertIn("Original permit", document["pages"][0]["text_content"])

        payload = document["pages"][0]["ocr_json"]
        payload["pages"][0]["lines"][0]["text"] = "Corrected permit document text"
        self.assert_status(
            "PUT",
            f"/api/v1/documents/{document_id}/pages/1/text",
            200,
            json={"ocr_json": payload, "text_content": "Corrected permit document text"},
        )
        text_export = self.assert_status(
            "GET", f"/api/v1/documents/{document_id}/export/text", 200
        ).text
        self.assertIn("Corrected permit document text", text_export)
        report = self.assert_status(
            "GET", f"/api/v1/documents/{document_id}/processing_report", 200
        ).json()
        self.assertEqual(report["successful_conversions"], 1)

        transcription_template = self.assert_status(
            "POST",
            "/api/v1/templates/",
            200,
            json={
                "name": "Exact Transcription",
                "industry": "Engineering",
                "schema_json": {
                    "type": "object",
                    "properties": {"full_transcription": {"type": "string"}},
                },
            },
        ).json()
        self.assert_status(
            "POST",
            f"/api/v1/documents/{document_id}/extract",
            200,
            json={"template_id": transcription_template["id"]},
        )
        document = self.assert_status("GET", f"/api/v1/documents/{document_id}", 200).json()
        self.assertEqual(document["status"], "pending_review")
        record = self.assert_status(
            "GET", f"/api/v1/documents/{document_id}/record", 200
        ).json()
        self.assertEqual(
            record["record_data"]["full_transcription"],
            "Corrected permit document text",
        )

        self.assert_status(
            "PUT",
            f"/api/v1/records/{record['id']}/status",
            422,
            json={"status": "maybe"},
        )
        self.assert_status(
            "PUT",
            f"/api/v1/records/{record['id']}/status",
            200,
            json={"status": "approved", "record_data": {}},
        )
        emptied_record = self.assert_status(
            "GET", f"/api/v1/records/{record['id']}", 200
        ).json()
        self.assertEqual(emptied_record["record_data"], {})
        self.assert_status(
            "PUT",
            f"/api/v1/records/{record['id']}/status",
            200,
            json={
                "status": "approved",
                "record_data": {"full_transcription": "Corrected permit document text"},
            },
        )

        expected_types = {
            "json": "application/json",
            "csv": "text/csv",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "pdf": "application/pdf",
        }
        for export_format, expected_type in expected_types.items():
            response = self.assert_status(
                "GET",
                f"/api/v1/projects/{project['id']}/export?format={export_format}",
                200,
            )
            self.assertIn(expected_type, response.headers["content-type"])
        self.assert_status(
            "GET", f"/api/v1/projects/{project['id']}/export?format=invalid", 422
        )
        self.assert_status("GET", "/api/v1/export/all?format=json", 200)
        self.assert_status(
            "GET", f"/api/v1/documents/{document_id}/download_book", 200
        )
        self.assert_status(
            "POST", f"/api/v1/documents/{document_id}/recreate_book", 503
        )

        generic_template = self.assert_status(
            "POST",
            "/api/v1/templates/",
            200,
            json={
                "name": "Vendor Name",
                "schema_json": {
                    "type": "object",
                    "properties": {"vendor": {"type": "string"}},
                },
            },
        ).json()
        generic_template = self.assert_status(
            "PUT",
            f"/api/v1/templates/{generic_template['id']}",
            200,
            json={"industry": "Accounting"},
        ).json()
        self.assertEqual(generic_template["industry"], "Accounting")
        self.assert_status(
            "POST",
            f"/api/v1/documents/{document_id}/extract",
            200,
            json={"template_id": generic_template["id"]},
        )
        document = self.assert_status("GET", f"/api/v1/documents/{document_id}", 200).json()
        self.assertEqual(document["status"], "processed")
        self.assertIn(
            "configure GEMINI_API_KEY or OPENROUTER_API_KEY",
            document["extraction_progress"],
        )

        image_document_id = self.assert_status(
            "POST",
            f"/api/v1/documents/?project_id={project['id']}",
            200,
            files={"file": ("scan.png", self.make_png(), "image/png")},
        ).json()["document_id"]
        image_document = self.assert_status(
            "GET", f"/api/v1/documents/{image_document_id}", 200
        ).json()
        self.assertEqual(image_document["status"], "processed")
        self.assertEqual(len(image_document["pages"]), 1)
        image_payload = image_document["pages"][0]["ocr_json"]
        image_payload["pages"][0]["lines"] = [
            {
                "text": "Searchable corrected scan",
                "confidence": 1.0,
                "bbox": [20, 20, 400, 60],
                "needsReview": False,
            }
        ]
        self.assert_status(
            "PUT",
            f"/api/v1/documents/{image_document_id}/pages/1/text",
            200,
            json={
                "ocr_json": image_payload,
                "text_content": "Searchable corrected scan",
            },
        )
        searchable_pdf = self.assert_status(
            "GET",
            f"/api/v1/documents/{image_document_id}/export/searchable-pdf",
            200,
        ).content
        rendered = fitz.open(stream=searchable_pdf, filetype="pdf")
        searchable_text = "".join(page.get_text() for page in rendered)
        rendered.close()
        self.assertIn("Searchable corrected scan", searchable_text)

        settings = self.assert_status("GET", "/api/v1/settings/status", 200).json()
        self.assertEqual(settings["api_status"], "connected")
        self.assertFalse(settings["gemini_configured"])
        templates = self.assert_status("GET", "/api/v1/templates", 200).json()
        built_in = next(template for template in templates if template["is_builtin"])
        self.assert_status("DELETE", f"/api/v1/templates/{built_in['id']}", 409)
        self.assert_status(
            "DELETE", f"/api/v1/templates/{generic_template['id']}", 200
        )

        stats = self.assert_status("GET", "/api/v1/stats/", 200).json()
        self.assertEqual(stats["total_documents"], 2)
        self.assert_status("DELETE", f"/api/v1/projects/{project['id']}", 200)
        self.assertEqual(self.assert_status("GET", "/api/v1/projects", 200).json(), [])
        self.assertEqual(list(Path("uploads").glob("*")), [])


if __name__ == "__main__":
    unittest.main()
