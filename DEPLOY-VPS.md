# Déploiement sur le VPS (Nginx)

Le site AccordGuitare est une application Vite/React. Le déploiement consiste à
builder le projet (`dist/`) puis à copier le résultat dans la racine web servie
par Nginx.

## Déploiement automatique

Le script [`deploy-vps.sh`](./deploy-vps.sh) fait tout en une commande.
À lancer **sur le VPS** (par le Claude installé dessus, ou en SSH) :

```bash
./deploy-vps.sh
```

Il enchaîne : `git pull` → `npm install` → `npm run build` → copie dans la
racine web → `nginx -t` + reload.

### Configuration

Les valeurs par défaut sont en tête du script et surchargables à l'appel :

| Variable            | Défaut                    | Rôle                                  |
| ------------------- | ------------------------- | ------------------------------------- |
| `WEB_ROOT`          | `/var/www/accordguitare`  | Racine web servie par Nginx           |
| `BRANCH`            | `main`                    | Branche déployée                      |
| `NGINX_SERVICE`     | `nginx`                   | Nom du service systemd                |
| `VITE_APP_BASE_PATH`| `/`                       | Chemin de base de l'app               |

Exemple avec une autre racine web :

```bash
WEB_ROOT=/var/www/mon-site ./deploy-vps.sh
```

## Configuration Nginx (à faire une seule fois)

Le site est une SPA : toutes les routes inconnues doivent renvoyer `index.html`.
Exemple de bloc serveur :

```nginx
server {
    listen 80;
    server_name  ton-domaine.fr;
    root /var/www/accordguitare;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Le service worker ne doit pas être mis en cache
    location = /sw.js {
        add_header Cache-Control "no-cache";
    }
}
```

> Pense à activer HTTPS (Let's Encrypt / `certbot --nginx`) pour que la PWA et
> le service worker fonctionnent correctement.
