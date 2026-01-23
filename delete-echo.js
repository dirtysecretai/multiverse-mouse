const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    const deleted = await prisma.$executeRaw`DELETE FROM "EchoMessage"`
    console.log(`✅ Deleted all echo messages`)
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()