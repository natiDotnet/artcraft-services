#!/usr/bin/env bash
set -euo pipefail

run_sql() {
  mysql -h mysql -u root storyteller "$@"
}

echo "Ensuring __diesel_schema_migrations table exists..."
run_sql -e "CREATE TABLE IF NOT EXISTS __diesel_schema_migrations (
  version VARCHAR(50) PRIMARY KEY NOT NULL,
  run_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"

applied=0
skipped=0

for dir in /migrations/*/; do
  [ -d "$dir" ] || continue
  name=$(basename "$dir")
  version=$(echo "${name%%_*}" | tr -d '-')

  exists=$(run_sql -N -s -e "SELECT COUNT(*) FROM __diesel_schema_migrations WHERE version = '$version'")
  if [ "$exists" -gt 0 ]; then
    skipped=$((skipped + 1))
    continue
  fi

  echo "Applying migration: $name (version $version)"
  run_sql < "$dir/up.sql"
  run_sql -e "INSERT INTO __diesel_schema_migrations (version) VALUES ('$version')"
  applied=$((applied + 1))
done

echo "Done! Applied $applied migrations ($skipped already applied)."
