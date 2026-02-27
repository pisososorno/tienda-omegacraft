-- AlterTable
ALTER TABLE "products" ADD COLUMN     "minecraft_version_max" VARCHAR(20),
ADD COLUMN     "minecraft_version_min" VARCHAR(20),
ADD COLUMN     "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "supported_versions" TEXT[] DEFAULT ARRAY[]::TEXT[];
