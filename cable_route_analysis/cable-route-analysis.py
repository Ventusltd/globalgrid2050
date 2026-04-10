from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 8000

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

def run():
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Running at http://127.0.0.1:{PORT}")
    server.serve_forever()

if __name__ == "__main__":
    run()
