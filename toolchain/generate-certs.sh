openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/CN=localhost/O=Arch Systems/C=ZA" \
  2>/dev/null && echo "Certificates generated in $(pwd)"