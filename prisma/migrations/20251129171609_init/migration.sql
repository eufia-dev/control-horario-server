-- CreateTable
CREATE TABLE "organization" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "company_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "code" VARCHAR(255) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entry_type" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_entry_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "type_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "is_office" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "organization_id" UUID NOT NULL,
    "hourly_cost" DECIMAL(8,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "organization_id" UUID NOT NULL,
    "hourly_cost" DECIMAL(8,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_hours" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "external_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "time_entry_type_name_key" ON "time_entry_type"("name");

-- AddForeignKey
ALTER TABLE "company" ADD CONSTRAINT "fk_company_organization" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "fk_project_company" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "fk_time_entry_company" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "fk_time_entry_project" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "fk_time_entry_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "fk_time_entry_type" FOREIGN KEY ("type_id") REFERENCES "time_entry_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "fk_user_organization" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "external" ADD CONSTRAINT "fk_external_organization" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "external_hours" ADD CONSTRAINT "fk_external_hours_worker" FOREIGN KEY ("external_id") REFERENCES "external"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "external_hours" ADD CONSTRAINT "fk_external_hours_project" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "external_hours" ADD CONSTRAINT "fk_external_hours_company" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
