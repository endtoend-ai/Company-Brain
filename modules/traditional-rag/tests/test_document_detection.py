import unittest

from traditional_rag.core.documents import detect_file_type


class DocumentDetectionTest(unittest.TestCase):
    def test_detects_html_and_json_as_indexable_documents(self):
        self.assertEqual(detect_file_type("policy.html", b"<html><body>hello</body></html>"), "html")
        self.assertEqual(detect_file_type("record.json", b'{"customer":"ACME"}'), "json")

    def test_image_audio_video_are_accepted_as_media_pending_extraction(self):
        self.assertEqual(detect_file_type("receipt.png", b"\x89PNG\r\n\x1a\nrest"), "image")
        self.assertEqual(detect_file_type("meeting.mp3", b"ID3rest"), "audio")
        self.assertEqual(detect_file_type("demo.mp4", b"\x00\x00\x00\x18ftypmp42"), "video")


if __name__ == "__main__":
    unittest.main()
