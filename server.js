const express = require('express');
require('dotenv').config()

const app = express();
const API_KEY = process.env.API_KEY;
const PORT = Number(process.env.PORT || 3000);
const TVA_PERCENT = 20;

// Le serveur refuse de démarrer sans clé API.
if (!API_KEY || !API_KEY.trim()) {
  throw new Error('La variable API_KEY est obligatoire.');
}

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT doit être un entier entre 1 et 65535.');
}

// Tous les prix sont exprimés en centimes d'euro.
const services = [
  {
    code: 'SITE_VITRINE',
    prixUnitaireHtCentimes: 150000,
    unite: 'prestation'
  },
  {
    code: 'AUTOMATISATION',
    prixUnitaireHtCentimes: 45000,
    unite: 'prestation'
  },
  {
    code: 'FORMATION_IA',
    prixUnitaireHtCentimes: 70000,
    unite: 'journee'
  }
];

// Cette fonction protège les routes qui l'utilisent.
function verifierCleApi(req, res, next) {
  if (req.get('x-api-key') !== API_KEY) {
    return res.status(401).json({
      error: 'Clé API absente ou incorrecte.'
    });
  }

  next();
}

// Route publique.
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Catalogue protégé par la clé API.
app.get('/services', verifierCleApi, (req, res) => {
  res.json({
    devise: 'EUR',
    tvaPercent: TVA_PERCENT,
    services
  });
});

// Calcul de devis protégé par la clé API.
app.post(
  '/calculate-quote',
  verifierCleApi,

  // Transforme le JSON reçu en données JavaScript.
  express.json({ limit: '100kb', strict: false }),

  (req, res) => {
    if (!req.is('application/json')) {
      return res.status(415).json({
        error: 'Utiliser Content-Type: application/json.'
      });
    }

    // Le corps de la requête doit être directement un tableau.
    const prestations = req.body;

    if (
      !Array.isArray(prestations) ||
      prestations.length === 0 ||
      prestations.length > 100
    ) {
      return res.status(400).json({
        error: 'Envoyer un tableau de 1 à 100 prestations.'
      });
    }

    const lignes = [];
    let totalHtCentimes = 0;

    for (const [index, prestation] of prestations.entries()) {
      if (
        !prestation ||
        typeof prestation !== 'object' ||
        Array.isArray(prestation)
      ) {
        return res.status(400).json({
          error: `Prestation ${index + 1} : objet attendu.`
        });
      }

      const { code, quantite } = prestation;

      const service = services.find(
        (element) => element.code === code
      );

      if (!service) {
        return res.status(400).json({
          error: `Prestation ${index + 1} : code inconnu.`
        });
      }

      if (
        !Number.isInteger(quantite) ||
        quantite < 1 ||
        quantite > 10000
      ) {
        return res.status(400).json({
          error:
            `Prestation ${index + 1} : ` +
            'quantite doit être un entier entre 1 et 10000.'
        });
      }

      const montantHtCentimes =
        service.prixUnitaireHtCentimes * quantite;

      totalHtCentimes += montantHtCentimes;

      lignes.push({
        code,
        quantite,
        prixUnitaireHtCentimes: service.prixUnitaireHtCentimes,
        montantHtCentimes
      });
    }

    // La TVA est arrondie au centime sur le total HT.
    const tvaCentimes = Math.round(
      (totalHtCentimes * TVA_PERCENT) / 100
    );

    const totalTtcCentimes = totalHtCentimes + tvaCentimes;

    return res.json({
      devise: 'EUR',
      lignes,
      tvaPercent: TVA_PERCENT,
      totalHtCentimes,
      tvaCentimes,
      totalTtcCentimes
    });
  }
);

// Réponse JSON pour les routes inexistantes.
app.use((req, res) => {
  res.status(404).json({
    error: 'Route introuvable.'
  });
});

// Les quatre paramètres identifient un gestionnaire d'erreurs.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'JSON invalide.'
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Corps de requête trop volumineux.'
    });
  }

  const status =
    err.status >= 400 && err.status < 500 ? err.status : 500;

  res.status(status).json({
    error:
      status === 500
        ? 'Erreur interne du serveur.'
        : 'Requête invalide.'
  });
});

// 0.0.0.0 permet notamment l'accès depuis Railway.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API démarrée sur le port ${PORT}`);
});
