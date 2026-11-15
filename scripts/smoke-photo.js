// Test de fumee du stockage des photos (appele par scripts/smoke.sh, execute DANS le pod pme-api).
// Le pod de l'API est le seul a pouvoir parler a Garage (politique reseau) et il porte deja la cle et l'adresse du stockage.
//   node smoke-photo.js put     : genere une image aleatoire, l'envoie, la relit, affiche son empreinte puis une URL signee
//   node smoke-photo.js delete  : supprime l'objet de test
const { createHash, randomBytes } = require('node:crypto');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sharp = require('sharp');

const key = 'smoke/test-fumee.webp';
const bucket = process.env.S3_BUCKET;
const common = {
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
};
const internal = new S3Client({ ...common, endpoint: process.env.S3_ENDPOINT });
const publicFacing = new S3Client({ ...common, endpoint: process.env.S3_PUBLIC_ENDPOINT });
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

async function put() {
  // Image de 64 x 64 pixels faite de bruit aleatoire : chaque lancement produit un fichier different.
  const body = await sharp(randomBytes(64 * 64 * 3), { raw: { width: 64, height: 64, channels: 3 } })
    .webp()
    .toBuffer();
  await internal.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'image/webp' }));
  const back = Buffer.from(await (await internal.send(new GetObjectCommand({ Bucket: bucket, Key: key }))).Body.transformToByteArray());
  if (sha(back) !== sha(body)) throw new Error('image relue differente de l image envoyee');
  const url = await getSignedUrl(publicFacing, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 120 });
  console.log(`SHA ${sha(body)}`);
  console.log(`URL ${url}`);
}

async function del() {
  await internal.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

({ put, delete: del })[process.argv[2]]()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(`ERREUR ${e.message}`);
    process.exit(1);
  });
