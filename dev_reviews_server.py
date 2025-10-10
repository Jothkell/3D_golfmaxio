#!/usr/bin/env python3
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
MOCK_PATH = os.path.join(ROOT, 'mock-reviews.json')

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.rstrip('/') == '/api/reviews':
            try:
                with open(MOCK_PATH, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception as e:
                data = { 'error': 'mock_file_error', 'message': str(e) }
                payload = json.dumps(data).encode('utf-8')
                self.send_response(500)
                self._cors()
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return

            res = {
                'reviews': data.get('reviews', []),
                'url': data.get('url', '#'),
                'rating': data.get('rating'),
                'user_ratings_total': data.get('user_ratings_total')
            }
            payload = json.dumps(res).encode('utf-8')
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        self.send_response(404)
        self._cors()
        self.end_headers()

    def log_message(self, fmt, *args):
        # silence default logging
        pass

    def _cors(self):
        origin = self.headers.get('Origin') or ''
        if origin in ('http://localhost:8080', 'http://127.0.0.1:8080'):
            self.send_header('Access-Control-Allow-Origin', origin)
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'content-type')
        self.send_header('Vary', 'Origin')

def main():
    port = int(os.environ.get('PORT', '8787'))
    host = os.environ.get('HOST', '127.0.0.1')
    server = HTTPServer((host, port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()

