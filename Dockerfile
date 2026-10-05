FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html privacy.html terms.html app-ads.txt /usr/share/caddy/
COPY css /usr/share/caddy/css
COPY js /usr/share/caddy/js
COPY assets /usr/share/caddy/assets
COPY cannery /usr/share/caddy/cannery
COPY lodebook /usr/share/caddy/lodebook
