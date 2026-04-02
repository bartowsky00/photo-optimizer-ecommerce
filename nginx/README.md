# Configurazione Nginx

## Installazione su VPS (Ubuntu/Debian)

```bash
# 1. Installa nginx
sudo apt update && sudo apt install -y nginx

# 2. Copia la configurazione
sudo cp photo-optimizer.conf /etc/nginx/sites-available/photo-optimizer

# 3. Attiva il sito
sudo ln -s /etc/nginx/sites-available/photo-optimizer /etc/nginx/sites-enabled/

# 4. Rimuovi il sito default (opzionale)
sudo rm -f /etc/nginx/sites-enabled/default

# 5. Verifica la configurazione
sudo nginx -t

# 6. Ricarica nginx
sudo systemctl reload nginx
```

## Con dominio + HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tuodominio.it
```

Certbot aggiorna automaticamente il file di configurazione con SSL.
