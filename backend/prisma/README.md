# prisma/
Place the approved `schema.prisma` here (the existing design doc at the repo root maps
1:1 to this). `prisma generate` produces the client; `prisma migrate deploy` is run by the
deploy pipeline (not at container start). DATABASE_URL comes from validated env.
