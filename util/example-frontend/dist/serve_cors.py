from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer

class handler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.translate_path(self.path)
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        return open(path, 'rb')

httpd = TCPServer(('127.0.0.1', 5555), handler)
httpd.serve_forever()
