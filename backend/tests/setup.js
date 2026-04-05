const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

let prisma;

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  }
  return prisma;
}

async function cleanDatabase() {
  const client = getPrisma();
  await client.activityLog.deleteMany();
  await client.snippetTag.deleteMany();
  await client.snippet.deleteMany();
  await client.folder.deleteMany();
  await client.tag.deleteMany();
  await client.prompt.deleteMany();
  await client.setting.deleteMany();
  await client.inviteToken.deleteMany();
  await client.user.deleteMany();
}

module.exports = { getPrisma, cleanDatabase };
