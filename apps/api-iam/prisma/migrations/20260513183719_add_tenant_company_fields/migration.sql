-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "address" VARCHAR(300),
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "country" VARCHAR(3),
ADD COLUMN     "legal_name" VARCHAR(200),
ADD COLUMN     "phone" VARCHAR(20),
ADD COLUMN     "ruc" VARCHAR(20);
