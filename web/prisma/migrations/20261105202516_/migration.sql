-- CreateTable
CREATE TABLE "licenses" (
    "id" UUID NOT NULL,
    "license_key" TEXT NOT NULL,
    "customer_name" TEXT DEFAULT 'Khách hàng',
    "customer_email" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'monthly',
    "max_devices" INTEGER NOT NULL DEFAULT 1,
    "hwid_list" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downloads" (
    "id" UUID NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "country" TEXT DEFAULT 'VN',
    "os" TEXT DEFAULT 'Windows',
    "version" TEXT DEFAULT '2.1.0',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "downloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activations" (
    "id" UUID NOT NULL,
    "license_key" TEXT NOT NULL,
    "hwid" TEXT NOT NULL,
    "device_name" TEXT,
    "app_version" TEXT,
    "ip_address" TEXT,
    "last_heartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_releases" (
    "id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "download_url" TEXT NOT NULL,
    "file_size_mb" DOUBLE PRECISION DEFAULT 85.5,
    "release_notes" TEXT,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_code" INTEGER NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_name" TEXT DEFAULT 'Khách hàng',
    "plan" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payment_link_id" TEXT,
    "checkout_url" TEXT,
    "qr_code" TEXT,
    "account_no" TEXT,
    "account_name" TEXT,
    "bank_bin" TEXT,
    "license_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "licenses_license_key_key" ON "licenses"("license_key");

-- CreateIndex
CREATE UNIQUE INDEX "activations_license_key_hwid_key" ON "activations"("license_key", "hwid");

-- CreateIndex
CREATE UNIQUE INDEX "app_releases_version_key" ON "app_releases"("version");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_code_key" ON "orders"("order_code");

-- AddForeignKey
ALTER TABLE "activations" ADD CONSTRAINT "activations_license_key_fkey" FOREIGN KEY ("license_key") REFERENCES "licenses"("license_key") ON DELETE CASCADE ON UPDATE CASCADE;
