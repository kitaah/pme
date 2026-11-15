// Photos de demonstration (appele par scripts/seed-listings.sh, execute DANS le pod pme-api : seul pod autorise a parler a Garage).
//   node - put KEY...     : genere une image aleatoire par cle (formes de couleurs tirees au hasard) et l'envoie dans Garage
//   node - delete KEY...  : supprime ces objets
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

const bucket = process.env.S3_BUCKET;
const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
});

const rnd = (n) => Math.floor(Math.random() * n);
const hsl = (l) => `hsl(${rnd(360)},${40 + rnd(40)}%,${l}%)`;

// Fond uni sombre + 6 a 10 formes de couleurs aleatoires : chaque image est unique.
function randomSvg() {
  const shapes = [];
  for (let i = 0, n = 6 + rnd(5); i < n; i++) {
    const fill = hsl(35 + rnd(40));
    const opacity = (0.5 + Math.random() * 0.5).toFixed(2);
    shapes.push(
      rnd(2)
        ? `<circle cx="${rnd(800)}" cy="${rnd(600)}" r="${40 + rnd(160)}" fill="${fill}" fill-opacity="${opacity}"/>`
        : `<rect x="${rnd(700)}" y="${rnd(500)}" width="${60 + rnd(300)}" height="${60 + rnd(240)}" rx="${rnd(40)}" fill="${fill}" fill-opacity="${opacity}"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="${hsl(12)}"/>${shapes.join('')}</svg>`;
}

async function put(keys) {
  for (const key of keys) {
    const body = await sharp(Buffer.from(randomSvg())).webp({ quality: 82 }).toBuffer();
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'image/webp' }));
    console.log(`OK ${key}`);
  }
}

async function del(keys) {
  for (const key of keys) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    console.log(`OK ${key}`);
  }
}

const [mode, ...keys] = process.argv.slice(2);
({ put, delete: del })[mode](keys)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(`ERREUR ${e.message}`);
    process.exit(1);
  });
